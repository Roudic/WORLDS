# WORLDS

A **model router** built on [TypeSafe's](https://docs.typesafe.ai) Jev model. One fast
classification call decides which Claude tier each request actually needs, so the
expensive model only runs when the request earns it.

Ships with a playground for building Jev questions by hand, too.

```
request ──> Jev: one call, five parallel questions
                     │
               policy.decide()   ← pure, deterministic, yours to tune
                     │
               run on the chosen tier ──> answer + what it saved
```

## The pool

| Tier | Model | In / Out per 1M | Context |
| --- | --- | --- | --- |
| Haiku 4.5 | `claude-haiku-4-5` | $1 / $5 | 200K |
| Sonnet 5 | `claude-sonnet-5` | $2 / $10 | 1M |
| Opus 5 | `claude-opus-5` | $5 / $25 | 1M |

These tiers do not take the same request. Haiku 4.5 wants
`thinking: {type:"enabled", budget_tokens:N}` and **rejects `effort` with a 400**;
Sonnet 5 and Opus 5 want `thinking: {type:"adaptive"}` plus `output_config.effort`
and **reject `budget_tokens` with a 400**. `router/tiers.js` is the only file that
knows this — `buildThinkingParams()` shims it per tier.

## Setup

```bash
cp .env.example .env     # add TYPESAFE_API_KEY and ANTHROPIC_API_KEY
npm install
npm start                # http://localhost:3000/router.html
```

- TypeSafe key: [console.typesafe.ai/keys](https://console.typesafe.ai/keys) — required, it does the routing.
- Anthropic key: [console.anthropic.com](https://console.anthropic.com/settings/keys) — required to *execute*. Without it the router still classifies and decides; use dry run.

Both keys are read server-side. The browser never sees either one.

## Use it

**Web** — <http://localhost:3000/router.html>. Type a request, hit **Route it**. You get
the chosen tier, every rule that fired, the signals behind it, the response, and what
the routing saved against an all-Opus baseline. A session ledger totals it up.

**CLI**

```bash
node cli.js "why is my docker build slow"
node cli.js --dry "explain closures"     # classify + decide, spend nothing
node cli.js --tier opus "..."            # pin a tier
```

**As a library**

```js
const { route } = require('./router');

const result = await route({
  prompt: 'Review this auth middleware before we ship tonight.',
  typesafeKey: process.env.TYPESAFE_API_KEY,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
});

result.decision.model     // 'claude-opus-5'
result.decision.reasons   // why, rule by rule
result.economics.savedPct // vs. running everything on Opus
```

## What Jev is asked

One call, five questions, answered in parallel:

| Question | Type | Job |
| --- | --- | --- |
| `reasoning_depth` | Score (4 levels) | The primary signal. Drives the tier floor. |
| `task_type` | Choice (7 options) | Per-category floors — code and math never run on the cheapest tier. |
| `is_high_stakes` | Noul | Escalation gate. A costly mistake is worth a better model. |
| `is_underspecified` | Noul | Cheap models degrade fastest on vague input. |
| `expects_long_output` | Noul | Speculative — sets the generation budget. |

Nothing deterministic is asked of the model. Token counts, context limits, and cost
math are code's job.

## The policy

`router/policy.js` is a pure function: answers in, decision out. No network, no keys,
no clock. It applies, in order:

1. **Depth** sets the starting tier.
2. **Category floor** can only raise it.
3. **Escalation gates** — high stakes moves up a tier; an underspecified request
   leaves the cheapest tier.
4. **Confidence floor** — low confidence on a signal that *actually moved the
   decision* fails safe upward. Uncertainty is never resolved in favor of the cheap
   model. Low confidence on an unused branch is ignored.
5. **Context window** — a hard constraint, decided in code from a real token count.

Every rule that fires is recorded, so a decision can always be explained.

Thresholds live in `DEFAULT_THRESHOLDS` and can be overridden per call. Retuning them
needs no new inference — the judgments are reusable data, and only the weights over
them live in the policy.

## Tests

```bash
npm test     # 27 tests, no API keys, no network
```

Because the policy is pure, the routing rules are pinned exactly: category floors,
each escalation gate, the confidence fail-safe, the context-window constraint,
threshold retuning, the per-model thinking shim, and the cost math.

## Layout

```
router/tiers.js      the pool: pricing, context, per-model API quirks
router/classify.js   the five Jev questions + the System One call
router/policy.js     the decision — pure, tunable, tested
router/execute.js    runs the request on the chosen tier
router/index.js      route() ties it together
cli.js               terminal interface
server.js            /api/route, /api/systemone, static files
public/router.*      the router UI
public/index.html    the Jev question playground
test/policy.test.js  the policy suite
```

## Notes

- Confidence measures how concentrated a distribution is — not whether an answer is
  correct, and not permission to act. Tune thresholds against your own traffic.
- The savings figure compares actual spend to the same token counts at Opus rates.
  It's a useful directional number, not an accounting record.
- Judge cost per *completed* task. A cheap answer that needs a retry isn't cheap.

Built with the [TypeSafe agent skill](https://docs.typesafe.ai/agent-skill),
enabled for this repo in `.claude/settings.json`.
