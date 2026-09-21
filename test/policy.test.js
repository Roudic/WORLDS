'use strict';
/**
 * The routing policy is a pure function, so it can be pinned down exactly.
 * These run with no API keys and no network.
 */

const test = require('node:test');
const assert = require('node:assert');

const { decide, generationParams } = require('../router/policy');
const { buildThinkingParams, getTier, costOf, baselineCostOf } = require('../router/tiers');

/** Build an answers map shaped exactly like the API returns. */
function answers({
  depth = 0.2,
  depthConf = 0.95,
  type = 'factual_lookup',
  typeConf = 0.9,
  stakes = 0.05,
  vague = 0.05,
  long = 0.1,
} = {}) {
  return {
    reasoning_depth: {
      type: 'score',
      score: depth,
      confidence: depthConf,
      legend: { 0: 'Direct recall', 1: 'Single step', 2: 'Several steps', 3: 'Extended' },
      probabilities: { 0: 0.8, 1: 0.2, 2: 0, 3: 0 },
    },
    task_type: { type: 'choice', choice: type, confidence: typeConf, probabilities: { [type]: typeConf } },
    is_high_stakes: { type: 'noul', noul: stakes },
    is_underspecified: { type: 'noul', noul: vague },
    expects_long_output: { type: 'noul', noul: long },
  };
}

const tierOf = (a, ctx) => decide(a, ctx).tier.key;

// ---------- the primary signal ----------

test('shallow lookup routes to the cheapest tier', () => {
  assert.equal(tierOf(answers({ depth: 0.1, type: 'factual_lookup' })), 'haiku');
});

test('moderate reasoning routes to sonnet', () => {
  assert.equal(tierOf(answers({ depth: 1.4, type: 'analysis' })), 'sonnet');
});

test('deep reasoning routes to opus', () => {
  assert.equal(tierOf(answers({ depth: 2.6, type: 'analysis' })), 'opus');
});

test('a greeting is the cheapest possible request', () => {
  assert.equal(tierOf(answers({ depth: 0.0, type: 'chat', stakes: 0.01 })), 'haiku');
});

// ---------- category floors ----------

test('trivial-looking code still clears the haiku floor', () => {
  assert.equal(tierOf(answers({ depth: 0.3, type: 'code' })), 'sonnet');
});

test('math never runs on the cheapest tier', () => {
  assert.equal(tierOf(answers({ depth: 0.2, type: 'math_logic' })), 'sonnet');
});

test('a category floor never drags a decision down', () => {
  // chat floors at haiku, but deep reasoning already chose opus.
  assert.equal(tierOf(answers({ depth: 2.9, type: 'chat' })), 'opus');
});

// ---------- escalation gates ----------

test('high stakes moves one tier up', () => {
  assert.equal(tierOf(answers({ depth: 0.2, type: 'factual_lookup', stakes: 0.9 })), 'sonnet');
});

test('high stakes on a sonnet request reaches opus', () => {
  assert.equal(tierOf(answers({ depth: 1.5, type: 'analysis', stakes: 0.8 })), 'opus');
});

test('escalation cannot exceed the top tier', () => {
  const d = decide(answers({ depth: 2.9, type: 'code', stakes: 0.99, vague: 0.99, depthConf: 0.1 }));
  assert.equal(d.tier.key, 'opus');
});

test('an underspecified request leaves the cheapest tier', () => {
  assert.equal(tierOf(answers({ depth: 0.2, type: 'creative', vague: 0.85 })), 'sonnet');
});

test('low confidence on the depth score fails safe upward', () => {
  const low = tierOf(answers({ depth: 0.3, type: 'factual_lookup', depthConf: 0.2 }));
  const high = tierOf(answers({ depth: 0.3, type: 'factual_lookup', depthConf: 0.95 }));
  assert.equal(high, 'haiku');
  assert.equal(low, 'sonnet', 'uncertainty should never be resolved in favor of the cheap model');
});

test('the decision records why it landed where it did', () => {
  const d = decide(answers({ depth: 0.2, type: 'code', stakes: 0.9 }));
  const rules = d.reasons.map((r) => r.rule);
  assert.ok(rules.includes('depth'));
  assert.ok(rules.includes('category_floor'));
  assert.ok(rules.includes('high_stakes'));
  assert.equal(d.escalated, true);
});

// ---------- deterministic constraints stay in code ----------

test('input beyond haiku\'s window forces a bigger context model', () => {
  assert.equal(tierOf(answers({ depth: 0.1, type: 'transform' }), { inputTokens: 500_000 }), 'sonnet');
});

test('a normal-sized request is unaffected by the context rule', () => {
  assert.equal(tierOf(answers({ depth: 0.1, type: 'transform' }), { inputTokens: 1_200 }), 'haiku');
});

// ---------- overrides and tuning ----------

test('forceTier bypasses every rule', () => {
  const d = decide(answers({ depth: 2.9, type: 'code', stakes: 0.99 }), { forceTier: 'haiku' });
  assert.equal(d.tier.key, 'haiku');
  assert.equal(d.reasons[0].rule, 'override');
});

test('thresholds are tunable without touching the signals', () => {
  const a = answers({ depth: 1.4, type: 'analysis' });
  assert.equal(tierOf(a), 'sonnet');
  assert.equal(tierOf(a, { thresholds: { opusFloor: 1.0 } }), 'opus');
  assert.equal(tierOf(a, { thresholds: { sonnetFloor: 2.0, opusFloor: 3.0 } }), 'haiku');
});

// ---------- the per-model API shim ----------

test('haiku gets budget_tokens and never gets effort', () => {
  const p = buildThinkingParams(getTier('haiku'), { effort: 'high', thinkingBudget: 2048, maxTokens: 4096 });
  assert.equal(p.thinking.type, 'enabled');
  assert.equal(p.thinking.budget_tokens, 2048);
  assert.equal(p.output_config, undefined, 'effort is a 400 on Haiku 4.5');
});

test('haiku omits thinking when the budget is not below max_tokens', () => {
  const p = buildThinkingParams(getTier('haiku'), { thinkingBudget: 4096, maxTokens: 4096 });
  assert.equal(p.thinking, undefined);
});

test('haiku omits thinking below the 1024 minimum', () => {
  const p = buildThinkingParams(getTier('haiku'), { thinkingBudget: 512, maxTokens: 4096 });
  assert.equal(p.thinking, undefined);
});

for (const key of ['sonnet', 'opus']) {
  test(`${key} gets adaptive thinking and effort, never budget_tokens`, () => {
    const p = buildThinkingParams(getTier(key), { effort: 'high', thinkingBudget: 2048, maxTokens: 4096 });
    assert.equal(p.thinking.type, 'adaptive');
    assert.equal(p.thinking.budget_tokens, undefined, 'budget_tokens is a 400 on this model');
    assert.equal(p.output_config.effort, 'high');
  });
}

// ---------- generation params ----------

test('effort scales with reasoning depth', () => {
  assert.equal(generationParams(answers({ depth: 0.2 })).effort, 'low');
  assert.equal(generationParams(answers({ depth: 1.5 })).effort, 'medium');
  assert.equal(generationParams(answers({ depth: 2.5 })).effort, 'high');
});

test('a long-output request gets more room', () => {
  assert.ok(generationParams(answers({ long: 0.9 })).maxTokens > generationParams(answers({ long: 0.1 })).maxTokens);
});

// ---------- cost math ----------

test('cost is computed from the real per-tier rates', () => {
  const usage = { input_tokens: 1_000_000, output_tokens: 1_000_000 };
  assert.equal(costOf(getTier('haiku'), usage), 6);   // $1 in + $5 out
  assert.equal(costOf(getTier('sonnet'), usage), 12); // $2 in + $10 out
  assert.equal(costOf(getTier('opus'), usage), 30);   // $5 in + $25 out
  assert.equal(baselineCostOf(usage), 30);
});

test('cached reads bill at a tenth of input', () => {
  const c = costOf(getTier('sonnet'), { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 });
  assert.equal(c, 0.2);
});

test('routing away from the baseline always saves money', () => {
  const usage = { input_tokens: 10_000, output_tokens: 2_000 };
  assert.ok(costOf(getTier('haiku'), usage) < baselineCostOf(usage));
  assert.ok(costOf(getTier('sonnet'), usage) < baselineCostOf(usage));
});
