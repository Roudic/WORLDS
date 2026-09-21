'use strict';
/**
 * WORLDS — a local playground for TypeSafe's Jev model.
 *
 * The API key is read from the environment and used only here, server-side.
 * The browser talks to /api/systemone and never sees the key.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { loadDotEnv } = require('./config');
const { route } = require('./router');
const { TIERS } = require('./router/tiers');

const API_URL = 'https://api.typesafe.ai/v1/systemone';
const PUBLIC_DIR = path.join(__dirname, 'public');

// --- config -----------------------------------------------------------------

loadDotEnv(path.join(__dirname, '.env'));

const API_KEY = process.env.TYPESAFE_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEFAULT_MODEL = process.env.TYPESAFE_MODEL || 'jev-latest';
const PORT = Number(process.env.PORT) || 3000;

// --- helpers ----------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** TypeSafe nests error text a few ways; pull out something a human can read. */
function extractMessage(body, status) {
  const candidates = [body?.error, body?.detail, body?.message];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (candidate && typeof candidate === 'object') {
      if (typeof candidate.message === 'string') return candidate.message;
      if (Array.isArray(candidate) && candidate.length) {
        // 422 validation errors arrive as a list of field problems.
        return candidate
          .map((item) => {
            const where = Array.isArray(item?.loc) ? item.loc.join('.') : null;
            const what = item?.msg || item?.message || JSON.stringify(item);
            return where ? `${where}: ${what}` : what;
          })
          .join('; ');
      }
    }
  }
  return `TypeSafe returned ${status}`;
}

/**
 * Validate the question map before spending a request on it. The API returns
 * 422 for these, but catching them here gives a clearer message faster.
 */
function validateQuestions(questions) {
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
    return 'questions must be an object keyed by question id';
  }
  const ids = Object.keys(questions);
  if (ids.length === 0) return 'Add at least one question';

  for (const id of ids) {
    const q = questions[id];
    if (!q || typeof q !== 'object') return `Question "${id}" is malformed`;
    if (!q.instructions || typeof q.instructions !== 'string' || !q.instructions.trim()) {
      return `Question "${id}" needs instructions`;
    }
    if (q.type === 'noul') {
      continue; // criteria optional
    }
    if (q.type === 'choice') {
      const options = Object.keys(q.criteria || {});
      if (options.length < 2) return `Choice "${id}" needs at least 2 options`;
      if (options.length > 255) return `Choice "${id}" exceeds the 255 option limit`;
      continue;
    }
    if (q.type === 'score') {
      const levels = Array.isArray(q.criteria) ? q.criteria : [];
      if (levels.length < 2) return `Score "${id}" needs at least 2 levels`;
      if (levels.length > 10) return `Score "${id}" exceeds the 10 level limit`;
      continue;
    }
    return `Question "${id}" has unknown type "${q.type}"`;
  }
  return null;
}

/** 429 and 529 are documented as retryable. Back off rather than hammering. */
async function callTypeSafe(payload, { attempts = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      lastError = { status: 502, body: { error: `Could not reach TypeSafe: ${err.message}` } };
      await sleep(500 * 2 ** attempt);
      continue;
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { error: text.slice(0, 500) };
    }

    if (response.ok) return { status: response.status, body: parsed };

    const retryable = response.status === 429 || response.status === 529;
    lastError = { status: response.status, body: parsed };
    if (!retryable || attempt === attempts - 1) return lastError;
    await sleep(500 * 2 ** attempt);
  }
  return lastError;
}

// --- static files -----------------------------------------------------------

function serveStatic(req, res) {
  const urlPath = new URL(req.url, 'http://localhost').pathname;
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, relative);

  // Keep requests inside public/ — no traversal out of the served directory.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

// --- server -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/api/health') {
    sendJson(res, 200, {
      keyConfigured: Boolean(API_KEY),
      anthropicConfigured: Boolean(ANTHROPIC_KEY),
      defaultModel: DEFAULT_MODEL,
      tiers: TIERS.map((t) => ({
        key: t.key, name: t.name, model: t.model,
        inputPerMTok: t.inputPerMTok, outputPerMTok: t.outputPerMTok,
        contextWindow: t.contextWindow, blurb: t.blurb,
      })),
    });
    return;
  }

  if (pathname === '/api/route') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Use POST' });
      return;
    }
    if (!API_KEY) {
      sendJson(res, 500, { error: 'TYPESAFE_API_KEY is not set — the router cannot classify without it.' });
      return;
    }

    let request;
    try {
      request = JSON.parse(await readBody(req));
    } catch (err) {
      sendJson(res, err.status || 400, { error: err.message || 'Invalid JSON body' });
      return;
    }

    const dryRun = Boolean(request.dryRun);
    if (!ANTHROPIC_KEY && !dryRun) {
      sendJson(res, 500, {
        error: 'ANTHROPIC_API_KEY is not set. Add it to .env, or use dry run to route without executing.',
      });
      return;
    }

    try {
      const result = await route({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        typesafeKey: API_KEY,
        anthropicKey: ANTHROPIC_KEY,
        thresholds: request.thresholds,
        forceTier: request.forceTier || null,
        dryRun,
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/systemone') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Use POST' });
      return;
    }
    if (!API_KEY) {
      sendJson(res, 500, {
        error:
          'TYPESAFE_API_KEY is not set. Copy .env.example to .env and add your key from https://console.typesafe.ai/keys',
      });
      return;
    }

    let request;
    try {
      request = JSON.parse(await readBody(req));
    } catch (err) {
      sendJson(res, err.status || 400, { error: err.message || 'Invalid JSON body' });
      return;
    }

    const state = request.state;
    if (typeof state === 'string' ? !state.trim() : state == null) {
      sendJson(res, 400, { error: 'State is required — give the model something to evaluate' });
      return;
    }

    const problem = validateQuestions(request.questions);
    if (problem) {
      sendJson(res, 400, { error: problem });
      return;
    }

    const started = Date.now();
    const result = await callTypeSafe({
      state,
      model: request.model || DEFAULT_MODEL,
      questions: request.questions,
    });

    if (result.status >= 400) {
      sendJson(res, result.status, {
        error: extractMessage(result.body, result.status),
        details: result.body,
      });
      return;
    }

    sendJson(res, 200, { ...result.body, latency_ms: Date.now() - started });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n  WORLDS — Jev playground`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  model: ${DEFAULT_MODEL}`);
  console.log(`  typesafe key: ${API_KEY ? 'loaded' : 'MISSING'}`);
  console.log(`  anthropic key: ${ANTHROPIC_KEY ? 'loaded' : 'MISSING (router can still dry-run)'}\n`);
});
