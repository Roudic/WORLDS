'use strict';
/* Router UI. Posts to /api/route and renders the decision, the signals that
   produced it, the response, and what the routing saved. */

const $ = (s) => document.querySelector(s);

const els = {
  prompt: $('#prompt'),
  dryRun: $('#dry-run'),
  forceTier: $('#force-tier'),
  runBtn: $('#run-btn'),
  runNote: $('#run-note'),
  error: $('#error'),
  keyStatus: $('#key-status'),
  samplePicker: $('#sample-picker'),
  decisionPanel: $('#decision-panel'),
  decisionMeta: $('#decision-meta'),
  tierTrack: $('#tier-track'),
  reasons: $('#reasons'),
  signalsPanel: $('#signals-panel'),
  signalsMeta: $('#signals-meta'),
  signals: $('#signals'),
  responsePanel: $('#response-panel'),
  responseMeta: $('#response-meta'),
  responseText: $('#response-text'),
  costPanel: $('#cost-panel'),
  cost: $('#cost'),
  ledgerPanel: $('#ledger-panel'),
  ledgerRows: $('#ledger-rows'),
  ledgerSummary: $('#ledger-summary'),
};

let TIERS = [];
const ledger = [];

const SAMPLES = [
  ['Trivial lookup', 'What year did the Berlin Wall fall?'],
  ['Greeting', 'hey, how are you doing today?'],
  ['Simple transform', 'Turn this into a bulleted list: eggs, milk, bread, coffee, bananas'],
  ['Everyday code', 'Write a Python function that reverses the words in a sentence.'],
  ['Gnarly debugging', 'My Postgres query got 40x slower after we added a partial index on a jsonb column. Connection pool is maxing out, but only under concurrent writes. Walk me through diagnosing this.'],
  ['High stakes', 'Review this auth middleware for vulnerabilities before we ship it to production tonight.'],
  ['Vague', 'make it better'],
  ['Hard reasoning', 'Design a distributed rate limiter that stays correct across regions during a network partition, and explain the consistency tradeoffs you chose.'],
];

/* ---------- render ---------- */

function renderTierTrack(chosenKey) {
  els.tierTrack.innerHTML = '';
  for (const t of TIERS) {
    const el = document.createElement('div');
    el.className = 'tier' + (t.key === chosenKey ? ' chosen' : '');
    el.dataset.key = t.key;
    el.innerHTML = `
      ${t.key === chosenKey ? '<span class="tier-flag">routed here</span>' : ''}
      <div class="tier-name">${escapeHtml(t.name)}</div>
      <div class="tier-model">${escapeHtml(t.model)}</div>
      <div class="tier-price">$${t.inputPerMTok.toFixed(2)} in &middot; $${t.outputPerMTok.toFixed(2)} out &middot; ${(t.contextWindow / 1000).toLocaleString()}K ctx</div>`;
    els.tierTrack.append(el);
  }
}

function renderReasons(decision) {
  els.reasons.innerHTML = '';
  for (const r of decision.reasons) {
    const li = document.createElement('li');
    const escalating = ['high_stakes', 'underspecified', 'low_confidence', 'context_window'].includes(r.rule);
    li.innerHTML = `<span class="rule-tag${escalating ? ' escalate' : ''}">${escapeHtml(r.rule)}</span>
                    <span>${escapeHtml(r.detail)}</span>`;
    els.reasons.append(li);
  }
}

function signalBar(name, value, max, note, type) {
  const wrap = document.createElement('div');
  wrap.className = 'signal';
  wrap.dataset.type = type;
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  wrap.innerHTML = `
    <div class="signal-head">
      <span class="signal-name">${escapeHtml(name)}</span>
      <span class="signal-value">${escapeHtml(note)}</span>
    </div>
    <span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span></span>`;
  // Reuse the answer colour tokens from the playground stylesheet.
  wrap.style.setProperty('--type-color', `var(--${type})`);
  wrap.querySelector('.bar-fill').style.background = `var(--${type})`;
  return wrap;
}

function renderSignals(signals) {
  els.signals.innerHTML = '';
  const d = signals.reasoning_depth;
  els.signals.append(
    signalBar('reasoning_depth', d.score, 3, `${d.score.toFixed(2)} / 3 · ${d.label || ''} · conf ${d.confidence.toFixed(2)}`, 'score')
  );
  els.signals.append(
    signalBar('task_type', signals.task_type.confidence, 1, `${signals.task_type.choice} · conf ${signals.task_type.confidence.toFixed(2)}`, 'choice')
  );
  els.signals.append(signalBar('is_high_stakes', signals.is_high_stakes, 1, signals.is_high_stakes.toFixed(2), 'noul'));
  els.signals.append(signalBar('is_underspecified', signals.is_underspecified, 1, signals.is_underspecified.toFixed(2), 'noul'));
  if (signals.expects_long_output != null) {
    els.signals.append(signalBar('expects_long_output', signals.expects_long_output, 1, signals.expects_long_output.toFixed(2), 'noul'));
  }
}

function renderCost(economics, response) {
  const saved = economics.saved;
  els.cost.innerHTML = `
    <div class="cost-grid">
      <div class="cost-cell">
        <div class="cost-label">This request</div>
        <div class="cost-value">$${economics.actualCost.toFixed(6)}</div>
      </div>
      <div class="cost-cell">
        <div class="cost-label">All-Opus baseline</div>
        <div class="cost-value">$${economics.baselineCost.toFixed(6)}</div>
      </div>
      <div class="cost-cell${saved > 0 ? ' saved' : ''}">
        <div class="cost-label">${saved > 0 ? 'Saved' : 'Premium'}</div>
        <div class="cost-value">${saved > 0 ? `${economics.savedPct.toFixed(0)}%` : '—'}</div>
      </div>
    </div>
    <div class="cost-note">${response.usage.input_tokens.toLocaleString()} input &middot;
      ${response.usage.output_tokens.toLocaleString()} output tokens.
      ${saved > 0
        ? `Routing saved $${saved.toFixed(6)} on this one request.`
        : 'This request earned the top tier — no saving, and that is the router working.'}</div>`;
}

function renderLedger() {
  if (!ledger.length) {
    els.ledgerPanel.hidden = true;
    return;
  }
  els.ledgerPanel.hidden = false;
  els.ledgerRows.innerHTML = '';

  let actual = 0;
  let baseline = 0;
  const counts = {};

  for (const row of ledger) {
    actual += row.actual;
    baseline += row.baseline;
    counts[row.tier] = (counts[row.tier] || 0) + 1;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="tier-chip" data-key="${escapeAttr(row.tier)}">${escapeHtml(row.tier)}</span></td>
      <td class="ledger-prompt">${escapeHtml(row.prompt.slice(0, 90))}${row.prompt.length > 90 ? '…' : ''}</td>
      <td>$${row.actual.toFixed(6)}</td>`;
    els.ledgerRows.append(tr);
  }

  const pct = baseline > 0 ? ((baseline - actual) / baseline) * 100 : 0;
  const mix = TIERS.map((t) => `${counts[t.key] || 0} ${t.key}`).join(' · ');
  els.ledgerSummary.innerHTML =
    `<strong>${ledger.length}</strong> routed (${escapeHtml(mix)}) · spent <strong>$${actual.toFixed(6)}</strong>
     vs <strong>$${baseline.toFixed(6)}</strong> all-Opus · <strong>${pct.toFixed(1)}%</strong> saved`;
}

/* ---------- run ---------- */

async function run() {
  const prompt = els.prompt.value.trim();
  hideError();
  if (!prompt) {
    showError('Type a request first.');
    return;
  }

  els.runBtn.disabled = true;
  els.runBtn.textContent = 'Routing…';
  els.runNote.textContent = 'asking Jev…';

  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        dryRun: els.dryRun.checked,
        forceTier: els.forceTier.value || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || `Request failed (${res.status})`);
      return;
    }

    renderTierTrack(data.decision.tier);
    renderReasons(data.decision);
    els.decisionMeta.textContent = data.decision.escalated ? 'escalated' : 'baseline decision';
    els.decisionPanel.hidden = false;

    renderSignals(data.signals);
    els.signalsMeta.textContent = `${data.classifyModel || 'jev'} · ${data.classifyMs} ms`;
    els.signalsPanel.hidden = false;

    if (data.response) {
      els.responseText.textContent = data.response.text || '(empty response)';
      els.responseMeta.textContent = `${data.response.servedBy} · ${data.response.latencyMs} ms · effort ${data.params.effort}`;
      els.responsePanel.hidden = false;

      renderCost(data.economics, data.response);
      els.costPanel.hidden = false;

      ledger.unshift({
        tier: data.decision.tier,
        prompt,
        actual: data.economics.actualCost,
        baseline: data.economics.baselineCost,
      });
      renderLedger();
    } else {
      els.responsePanel.hidden = true;
      els.costPanel.hidden = true;
      els.runNote.textContent = 'dry run — no model was called';
    }

    els.decisionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError(`Could not reach the server: ${err.message}`);
  } finally {
    els.runBtn.disabled = false;
    els.runBtn.textContent = 'Route it';
    if (!els.dryRun.checked) els.runNote.textContent = '';
  }
}

/* ---------- misc ---------- */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
const escapeAttr = escapeHtml;

function showError(m) {
  els.error.textContent = m;
  els.error.hidden = false;
}
function hideError() {
  els.error.hidden = true;
}

els.runBtn.addEventListener('click', run);
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
});
$('#clear-ledger').addEventListener('click', () => {
  ledger.length = 0;
  renderLedger();
});
$('#theme-toggle').addEventListener('click', () => {
  const dark =
    document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('worlds-theme', document.documentElement.dataset.theme);
  } catch { /* private mode */ }
});
try {
  const saved = localStorage.getItem('worlds-theme');
  if (saved) document.documentElement.dataset.theme = saved;
} catch { /* ignore */ }

for (const [label, text] of SAMPLES) {
  const opt = document.createElement('option');
  opt.value = text;
  opt.textContent = label;
  els.samplePicker.append(opt);
}
els.samplePicker.addEventListener('change', (e) => {
  if (e.target.value) els.prompt.value = e.target.value;
});

fetch('/api/health')
  .then((r) => r.json())
  .then((h) => {
    TIERS = h.tiers || [];
    renderTierTrack(null);
    // Show the pool up front so the choice has visible context.
    els.decisionMeta.textContent = 'model pool';
    els.decisionPanel.hidden = false;

    if (!h.keyConfigured) {
      els.keyStatus.textContent = 'no TypeSafe key';
      els.keyStatus.className = 'pill pill-bad';
      showError('TYPESAFE_API_KEY is not set — the router cannot classify. Add it to .env and restart.');
    } else if (!h.anthropicConfigured) {
      els.keyStatus.textContent = 'dry run only';
      els.keyStatus.className = 'pill pill-bad';
      els.dryRun.checked = true;
      showError('ANTHROPIC_API_KEY is not set, so the router can classify and decide but not execute. Dry run is on.');
    } else {
      els.keyStatus.textContent = 'both keys loaded';
      els.keyStatus.className = 'pill';
    }
  })
  .catch(() => {
    els.keyStatus.textContent = 'server unreachable';
    els.keyStatus.className = 'pill pill-bad';
  });
