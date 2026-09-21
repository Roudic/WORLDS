'use strict';
/**
 * The model pool, cheapest first.
 *
 * Each tier records what the Messages API will and won't accept for that model.
 * These differences are not cosmetic — sending `effort` to Haiku 4.5, or
 * `budget_tokens` to Sonnet 5 / Opus 5, is a 400. Encoding them here means
 * buildThinkingParams() is the only place that has to know.
 *
 * Prices are Anthropic first-party rates in USD per million tokens.
 */

const TIERS = [
  {
    key: 'haiku',
    name: 'Claude Haiku 4.5',
    model: 'claude-haiku-4-5',
    rank: 0,
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    contextWindow: 200_000,
    // Haiku 4.5 predates adaptive thinking: it takes the older explicit budget.
    thinkingStyle: 'budget',
    supportsEffort: false,
    blurb: 'Fast and cheap. Lookups, formatting, short answers, simple classification.',
  },
  {
    key: 'sonnet',
    name: 'Claude Sonnet 5',
    model: 'claude-sonnet-5',
    rank: 1,
    inputPerMTok: 2.0,
    outputPerMTok: 10.0,
    contextWindow: 1_000_000,
    // Adaptive is the only on-mode; omitting it also runs adaptive.
    thinkingStyle: 'adaptive',
    supportsEffort: true,
    blurb: 'The workhorse. Most coding, analysis, and multi-step reasoning.',
  },
  {
    key: 'opus',
    name: 'Claude Opus 5',
    model: 'claude-opus-5',
    rank: 2,
    inputPerMTok: 5.0,
    outputPerMTok: 25.0,
    contextWindow: 1_000_000,
    // Thinking is on by default here — omitting the param still runs adaptive.
    thinkingStyle: 'adaptive',
    supportsEffort: true,
    blurb: 'Deepest reasoning. Hard problems, high stakes, long-horizon work.',
  },
];

const BY_KEY = Object.fromEntries(TIERS.map((t) => [t.key, t]));

/** The tier every request would use if there were no router. Baseline for savings. */
const BASELINE_KEY = 'opus';

function getTier(key) {
  const tier = BY_KEY[key];
  if (!tier) throw new Error(`Unknown tier "${key}"`);
  return tier;
}

/** Walk up the pool from a tier. Used when a gate says "not good enough". */
function escalate(key, steps = 1) {
  const from = getTier(key);
  const target = Math.min(from.rank + steps, TIERS.length - 1);
  return TIERS[target];
}

function lowestTierWithContext(tokens) {
  return TIERS.find((t) => tokens <= t.contextWindow) || TIERS[TIERS.length - 1];
}

/**
 * Build the model-specific thinking/effort params.
 *
 * This is the whole reason tiers carry thinkingStyle and supportsEffort:
 * the same request object sent to two different tiers is a 400 on one of them.
 */
function buildThinkingParams(tier, { effort = 'medium', thinkingBudget = 2048, maxTokens } = {}) {
  const params = {};

  if (tier.thinkingStyle === 'adaptive') {
    params.thinking = { type: 'adaptive' };
    if (tier.supportsEffort) params.output_config = { effort };
    return params;
  }

  // 'budget' style (Haiku 4.5): explicit token budget, and effort is rejected.
  // The budget must be at least 1024 and strictly below max_tokens.
  if (thinkingBudget && maxTokens && thinkingBudget >= 1024 && thinkingBudget < maxTokens) {
    params.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
  }
  return params;
}

/** Cost of a call in USD, from the usage block the API returns. */
function costOf(tier, usage = {}) {
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  // Cache reads bill at roughly a tenth of input; writes at roughly 1.25x.
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;

  return (
    (input * tier.inputPerMTok +
      cacheRead * tier.inputPerMTok * 0.1 +
      cacheWrite * tier.inputPerMTok * 1.25 +
      output * tier.outputPerMTok) /
    1_000_000
  );
}

/** What the same token counts would have cost on the baseline tier. */
function baselineCostOf(usage) {
  return costOf(getTier(BASELINE_KEY), usage);
}

module.exports = {
  TIERS,
  BASELINE_KEY,
  getTier,
  escalate,
  lowestTierWithContext,
  buildThinkingParams,
  costOf,
  baselineCostOf,
};
