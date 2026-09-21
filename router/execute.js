'use strict';
/** Runs the request on whichever tier the policy picked. */

const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.default || AnthropicModule;

const { buildThinkingParams, costOf } = require('./tiers');

let client;
function getClient(apiKey) {
  if (!client) {
    // A bare constructor also resolves ANTHROPIC_API_KEY / an `ant auth login`
    // profile, so only pass a key when one was handed to us explicitly.
    client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
  }
  return client;
}

/** Count tokens before routing, so the context-window rule has a real number. */
async function countInputTokens({ prompt, systemPrompt, model, apiKey }) {
  try {
    const result = await getClient(apiKey).messages.countTokens({
      model,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
    return result.input_tokens;
  } catch {
    // Not worth failing a request over; the policy treats 0 as "unknown".
    return 0;
  }
}

async function execute({ tier, prompt, systemPrompt, history = [], params = {}, apiKey }) {
  const { effort = 'medium', maxTokens = 4096, thinkingBudget = 0 } = params;

  const request = {
    model: tier.model,
    max_tokens: maxTokens,
    messages: [...history, { role: 'user', content: prompt }],
    ...(systemPrompt ? { system: systemPrompt } : {}),
    // The per-tier shim: adaptive+effort for Sonnet 5 / Opus 5, an explicit
    // budget for Haiku 4.5. Sending the wrong one is a 400.
    ...buildThinkingParams(tier, { effort, thinkingBudget, maxTokens }),
  };

  const started = Date.now();
  let response;
  try {
    response = await getClient(apiKey).messages.create(request);
  } catch (err) {
    throw describeError(err, tier);
  }

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const thinking = response.content
    .filter((block) => block.type === 'thinking')
    .map((block) => block.thinking)
    .filter(Boolean)
    .join('\n');

  return {
    text,
    thinking: thinking || null,
    stopReason: response.stop_reason,
    // stop_details is populated only on a refusal — guard before reading it.
    stopDetails: response.stop_reason === 'refusal' ? response.stop_details : null,
    usage: response.usage,
    cost: costOf(tier, response.usage),
    latencyMs: Date.now() - started,
    servedBy: response.model,
  };
}

/** Most specific first, so retryable and non-retryable stay distinguishable. */
function describeError(err, tier) {
  if (err instanceof Anthropic.AuthenticationError) {
    return Object.assign(new Error('ANTHROPIC_API_KEY is missing or invalid.'), { status: 401 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return Object.assign(new Error(`Rate limited on ${tier.name}. Retry shortly.`), { status: 429 });
  }
  if (err instanceof Anthropic.BadRequestError) {
    return Object.assign(new Error(`${tier.name} rejected the request: ${err.message}`), { status: 400 });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return Object.assign(new Error(`Could not reach the Claude API: ${err.message}`), { status: 502 });
  }
  if (err instanceof Anthropic.APIError) {
    return Object.assign(new Error(`Claude API error ${err.status}: ${err.message}`), {
      status: err.status || 500,
    });
  }
  return err;
}

module.exports = { execute, countInputTokens };
