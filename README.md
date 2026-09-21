# WORLDS

A playground for [TypeSafe's](https://docs.typesafe.ai) **Jev** model. Write state,
build typed questions, and see calibrated answers with their full probability
distributions — no prompt engineering, no JSON parsing, no guessing.

Runs on **zero npm dependencies**. Node 18+ has everything it needs.

## Setup

**1. Get an API key** at [console.typesafe.ai/keys](https://console.typesafe.ai/keys)

**2. Point the app at it:**

```bash
cp .env.example .env
# open .env and paste your key into TYPESAFE_API_KEY=
```

`.env` is gitignored. The key is read server-side only — the browser never sees it.

**3. Run:**

```bash
npm start          # or: node server.js
```

Open <http://localhost:3000>.

## Using it

1. **State** — paste what you want judged. Plain text, or JSON for structured data
   like chat logs and records. The app detects which you gave it.
2. **Questions** — add as many as you want. They all go in **one call** and run in
   parallel, so ask anything worth knowing, including speculative branches.
3. **Ask Jev** — or hit `Cmd/Ctrl+Enter`.

Three examples ship with it (support triage, content moderation, resume screening).
Load one from the dropdown to see the shape of a real request.

## The three primitives

| Type | Answers | Returns |
| --- | --- | --- |
| **Noul** | Does this condition hold? | `noul`: probability of yes, 0–1 |
| **Choice** | Which one of these? | `choice` + `probabilities` over every option + `confidence` |
| **Score** | How much, along this dimension? | `score` (probability-weighted, can land between levels) + per-level `probabilities` + `confidence` |

**Noul** has no separate confidence — the probability *is* the answer. A Noul near
0.5 means genuinely split, not "medium intensity." Use one per label when several
could apply at once.

**Score** levels must describe concrete, distinguishable situations, ordered low to
high. 2–10 levels.

**Choice** needs at least 2 options, max 255. Include a no-match option when nothing
might fit.

Confidence on Choice and Score reflects how concentrated the distribution is — not
whether the answer is correct, and not permission to act. Pick thresholds against
your own data and the cost of being wrong.

## How it fits together

```
browser (public/)  ──POST /api/systemone──>  server.js  ──Bearer key──>  api.typesafe.ai/v1/systemone
```

`server.js` validates questions before spending a request, injects the key, and
retries `429` / `529` with exponential backoff. Everything else is static files.

## Layout

```
server.js           HTTP server, validation, API proxy, retries
public/index.html   markup
public/app.js       question builder + answer rendering
public/styles.css   light/dark theming
.env.example        copy to .env and add your key
```

## Notes

- Set `TYPESAFE_MODEL` to pin a model (default `jev-latest`), or `PORT` to move off 3000.
- Typed output guarantees the *interface*, not the truth. Test on representative
  cases from your own domain before trusting a threshold.
- Changing a weight or display filter doesn't need a rerun — the judgments are
  reusable data. Keep policy in code.

Built with the [TypeSafe agent skill](https://docs.typesafe.ai/agent-skill),
enabled for this repo in `.claude/settings.json`.
