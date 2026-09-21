'use strict';
/**
 * route() — classify with Jev, decide in code, run on the chosen tier.
 *
 *   prompt ──> Jev (one call, 5 parallel questions)
 *                    │
 *              policy.decide()  ← pure, deterministic, yours to tune
 *                    │
 *              execute on the chosen tier
 */

const { classify, buildState } = require('./classify');
const { decide, generationParams } = require('./policy');
const { execute, countInputTokens } = require('./execute');
const { getTier, costOf, baselineCostOf, BASELINE_KEY, TIERS } = require('./tiers');

async function route({
  prompt,
  systemPrompt,
  history = [],
  typesafeKey,
  anthropicKey,
  thresholds,
  forceTier,
  dryRun = false,
} = {}) {
  if (!prompt || !prompt.trim()) {
    throw Object.assign(new Error('A prompt is required'), { status: 400 });
  }

  const totals = { classifyMs: 0, executeMs: 0 };

  // Token count and classification are independent — run them together.
  const startedClassify = Date.now();
  const [classification, inputTokens] = await Promise.all([
    classify(buildState({ prompt, systemPrompt, history }), { apiKey: typesafeKey }),
    countInputTokens({
      prompt,
      systemPrompt,
      model: getTier(BASELINE_KEY).model,
      apiKey: anthropicKey,
    }),
  ]);
  totals.classifyMs = Date.now() - startedClassify;

  const decision = decide(classification.answers, { inputTokens, thresholds, forceTier });
  const params = generationParams(classification.answers, decision.tier);

  const result = {
    decision: {
      tier: decision.tier.key,
      model: decision.tier.model,
      name: decision.tier.name,
      reasons: decision.reasons,
      escalated: decision.escalated,
    },
    signals: decision.signals,
    params,
    inputTokens,
    classifyMs: totals.classifyMs,
    classifyUsage: classification.usage,
    classifyModel: classification.model,
  };

  if (dryRun) return { ...result, response: null, economics: null };

  const response = await execute({
    tier: decision.tier,
    prompt,
    systemPrompt,
    history,
    params,
    apiKey: anthropicKey,
  });

  const baseline = baselineCostOf(response.usage);
  return {
    ...result,
    response,
    economics: {
      actualCost: response.cost,
      baselineCost: baseline,
      baselineTier: BASELINE_KEY,
      saved: baseline - response.cost,
      savedPct: baseline > 0 ? ((baseline - response.cost) / baseline) * 100 : 0,
    },
  };
}

module.exports = { route, TIERS, costOf, baselineCostOf };
