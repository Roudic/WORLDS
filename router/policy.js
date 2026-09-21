'use strict';
/**
 * The routing decision.
 *
 * Deliberately a pure function: answers in, decision out. No network, no keys,
 * no clock. That keeps the policy testable against fixed inputs and lets you
 * retune thresholds without re-running inference — the judgments are reusable
 * data, and only the weights over them live here.
 *
 * Everything deterministic (token counts, context windows, cost) is decided
 * here in code. The model never sees a number it could get wrong.
 */

const { TIERS, getTier, escalate, lowestTierWithContext } = require('./tiers');

const DEFAULT_THRESHOLDS = {
  // Below this, we don't trust the classification enough to save money on it.
  minChoiceConfidence: 0.5,
  minScoreConfidence: 0.5,

  // reasoning_depth cuts. Scores are probability-weighted and land between levels.
  sonnetFloor: 0.8, // at or above this, Haiku is no longer the default
  opusFloor: 2.2,   // at or above this, go straight to Opus

  // Noul gates.
  highStakes: 0.6,
  underspecified: 0.7,

  // Per-category floors. Some work is never worth the cheapest tier.
  categoryFloor: {
    code: 'sonnet',
    math_logic: 'sonnet',
    chat: 'haiku',
    factual_lookup: 'haiku',
    transform: 'haiku',
    creative: 'haiku',
    analysis: 'haiku',
  },
};

/**
 * @param {object} answers  the `answers` map from classify()
 * @param {object} ctx      { inputTokens, thresholds, forceTier }
 */
function decide(answers, ctx = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...(ctx.thresholds || {}) };
  const reasons = [];

  if (ctx.forceTier) {
    return {
      tier: getTier(ctx.forceTier),
      reasons: [{ rule: 'override', detail: `Tier pinned to ${ctx.forceTier} by the caller` }],
      signals: summarize(answers),
      escalated: false,
    };
  }

  const depth = answers.reasoning_depth;
  const type = answers.task_type;
  const stakes = answers.is_high_stakes;
  const vague = answers.is_underspecified;

  // --- 1. Start from reasoning depth. This is the primary signal. -----------
  let choice;
  if (depth.score >= t.opusFloor) {
    choice = 'opus';
    reasons.push({ rule: 'depth', detail: `reasoning_depth ${depth.score.toFixed(2)} ≥ ${t.opusFloor}` });
  } else if (depth.score >= t.sonnetFloor) {
    choice = 'sonnet';
    reasons.push({ rule: 'depth', detail: `reasoning_depth ${depth.score.toFixed(2)} ≥ ${t.sonnetFloor}` });
  } else {
    choice = 'haiku';
    reasons.push({ rule: 'depth', detail: `reasoning_depth ${depth.score.toFixed(2)} — shallow` });
  }

  // --- 2. Per-category floor. Code and math don't run on the cheap tier. ----
  const floorKey = t.categoryFloor[type.choice];
  if (floorKey && getTier(floorKey).rank > getTier(choice).rank) {
    reasons.push({
      rule: 'category_floor',
      detail: `task_type "${type.choice}" has a floor of ${floorKey}`,
    });
    choice = floorKey;
  }

  // --- 3. Escalation gates. Each can only move us up. -----------------------
  let escalated = false;

  if (stakes.noul >= t.highStakes) {
    const up = escalate(choice);
    if (up.key !== choice) {
      reasons.push({
        rule: 'high_stakes',
        detail: `is_high_stakes ${stakes.noul.toFixed(2)} ≥ ${t.highStakes} — one tier up`,
      });
      choice = up.key;
      escalated = true;
    }
  }

  if (vague.noul >= t.underspecified && choice === 'haiku') {
    reasons.push({
      rule: 'underspecified',
      detail: `is_underspecified ${vague.noul.toFixed(2)} ≥ ${t.underspecified} — cheap tiers guess badly`,
    });
    choice = 'sonnet';
    escalated = true;
  }

  // --- 4. Confidence floor. Uncertainty is not a reason to save money. ------
  // Only escalate on confidence for signals that actually moved the decision;
  // low confidence on an unused branch is irrelevant.
  if (type.confidence < t.minChoiceConfidence && floorKey) {
    const up = escalate(choice);
    if (up.key !== choice) {
      reasons.push({
        rule: 'low_confidence',
        detail: `task_type confidence ${type.confidence.toFixed(2)} < ${t.minChoiceConfidence} — fail safe upward`,
      });
      choice = up.key;
      escalated = true;
    }
  }

  if (depth.confidence < t.minScoreConfidence) {
    const up = escalate(choice);
    if (up.key !== choice) {
      reasons.push({
        rule: 'low_confidence',
        detail: `reasoning_depth confidence ${depth.confidence.toFixed(2)} < ${t.minScoreConfidence} — fail safe upward`,
      });
      choice = up.key;
      escalated = true;
    }
  }

  // --- 5. Hard constraint: context window. Deterministic, so code decides. --
  if (ctx.inputTokens) {
    const needed = lowestTierWithContext(ctx.inputTokens);
    if (needed.rank > getTier(choice).rank) {
      reasons.push({
        rule: 'context_window',
        detail: `${ctx.inputTokens.toLocaleString()} input tokens exceed ${getTier(choice).name}'s window`,
      });
      choice = needed.key;
    }
  }

  return { tier: getTier(choice), reasons, signals: summarize(answers), escalated };
}

function summarize(answers) {
  return {
    reasoning_depth: {
      score: answers.reasoning_depth.score,
      confidence: answers.reasoning_depth.confidence,
      label: answers.reasoning_depth.legend?.[String(Math.round(answers.reasoning_depth.score))] || null,
      probabilities: answers.reasoning_depth.probabilities,
    },
    task_type: {
      choice: answers.task_type.choice,
      confidence: answers.task_type.confidence,
      probabilities: answers.task_type.probabilities,
    },
    is_high_stakes: answers.is_high_stakes.noul,
    is_underspecified: answers.is_underspecified.noul,
    expects_long_output: answers.expects_long_output?.noul ?? null,
  };
}

/** Pick a sensible generation budget from the signals we already paid for. */
function generationParams(answers, tier) {
  const long = (answers.expects_long_output?.noul ?? 0) >= 0.5;
  const depth = answers.reasoning_depth.score;

  const effort = depth >= 2.2 ? 'high' : depth >= 1.0 ? 'medium' : 'low';
  const maxTokens = long ? 16000 : 4096;
  // Only consulted for the 'budget' thinking style (Haiku 4.5).
  const thinkingBudget = depth >= 1.0 ? Math.min(4096, Math.floor(maxTokens / 2)) : 0;

  return { effort, maxTokens, thinkingBudget };
}

module.exports = { decide, generationParams, DEFAULT_THRESHOLDS, TIERS };
