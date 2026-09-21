'use strict';
/**
 * One System One call that produces everything the routing policy needs.
 *
 * Design notes, following TypeSafe's guidance:
 *  - Every question is independent, so they all go in a single request and run
 *    in parallel. None of them can see another's answer.
 *  - Nothing here is deterministic. Token counts, context limits and cost math
 *    are code's job (see policy.js) — the model is only asked for judgment that
 *    code cannot make.
 *  - Score levels describe concrete situations so they stand on their own.
 */

const API_URL = 'https://api.typesafe.ai/v1/systemone';

const QUESTIONS = {
  // Drives the tier floor. The dominant signal.
  reasoning_depth: {
    type: 'score',
    instructions:
      'How much reasoning work is needed to answer this request well, beyond simply recalling or restating information',
    criteria: [
      'Direct recall, lookup, formatting, or a greeting — the answer is immediate and needs no working out',
      'A single step of reasoning, or a short well-known procedure applied once',
      'Several dependent steps, or weighing tradeoffs where a wrong early step changes the answer',
      'Extended multi-step reasoning, novel problem solving, or holding many interacting constraints at once',
    ],
  },

  // Used for per-category floors — code is unforgiving about small errors.
  task_type: {
    type: 'choice',
    instructions: 'What kind of work is this request primarily asking for',
    criteria: {
      chat: 'Greeting, small talk, or a conversational remark with no real task',
      factual_lookup: 'Asking for a specific fact, definition, or piece of information',
      code: 'Writing, debugging, reviewing, or explaining software',
      analysis: 'Interpreting, comparing, evaluating, or drawing conclusions from information',
      creative: 'Producing original writing, ideas, names, or other creative material',
      math_logic: 'Calculation, proof, formal logic, or quantitative problem solving',
      transform: 'Reformatting, translating, summarizing, or extracting from supplied content',
    },
  },

  // Escalation gate. High stakes means pay for the better model.
  is_high_stakes: {
    type: 'noul',
    instructions:
      'A subtly wrong or incomplete answer to this request would cause real harm, cost, or a bad decision that is hard to undo',
    criteria: {
      true: 'Touches money, health, legal exposure, security, production systems, or an irreversible decision',
      false: 'A wrong answer is merely unhelpful and easy to notice and correct',
    },
  },

  // Cheap models degrade fastest on underspecified input.
  is_underspecified: {
    type: 'noul',
    instructions:
      'The request is vague or missing context that the responder must infer before it can be answered well',
    criteria: {
      true: 'Key details are absent, so answering requires guessing at intent',
      false: 'The request states clearly enough what is wanted',
    },
  },

  // Speculative: consumed only when the policy needs a tiebreak.
  expects_long_output: {
    type: 'noul',
    instructions:
      'A good answer to this request is long — many paragraphs, a full document, or a substantial amount of code',
    criteria: {
      true: 'Asks for something extended, complete, or covering many parts',
      false: 'A short or moderate answer would fully satisfy it',
    },
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Classify one request. `state` is the user's prompt, optionally wrapped with
 * surrounding context (see buildState).
 */
async function classify(state, { apiKey, model = 'jev-latest', attempts = 3 } = {}) {
  if (!apiKey) throw new Error('TYPESAFE_API_KEY is required to classify a request');

  const body = JSON.stringify({ state, model, questions: QUESTIONS });
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body,
      });
    } catch (err) {
      lastError = new Error(`Could not reach TypeSafe: ${err.message}`);
      await sleep(400 * 2 ** attempt);
      continue;
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }

    if (response.ok) {
      return { answers: parsed.answers, usage: parsed.usage, model: parsed.model };
    }

    const message =
      parsed?.detail?.message || parsed?.error?.message || parsed?.error || `TypeSafe returned ${response.status}`;
    lastError = Object.assign(new Error(message), { status: response.status });

    // Only 429 and 529 are documented as retryable.
    if (response.status !== 429 && response.status !== 529) throw lastError;
    await sleep(400 * 2 ** attempt);
  }

  throw lastError;
}

/**
 * Give Jev the request plus whatever surrounding facts matter. Named fields
 * beat one concatenated blob — the questions can refer to them by name.
 */
function buildState({ prompt, systemPrompt, history }) {
  if (!systemPrompt && !history?.length) return prompt;
  const state = { request: prompt };
  if (systemPrompt) state.system_instructions = systemPrompt;
  if (history?.length) state.recent_turns = history.slice(-6);
  return state;
}

module.exports = { classify, buildState, QUESTIONS };
