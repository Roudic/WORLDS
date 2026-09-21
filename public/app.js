'use strict';
/* WORLDS — builds System One requests in the browser and renders typed answers.
   The API key lives on the server; this file only talks to /api/systemone. */

const $ = (sel) => document.querySelector(sel);

const els = {
  state: $('#state'),
  stateCount: $('#state-count'),
  stateKind: $('#state-kind'),
  questions: $('#questions'),
  noQuestions: $('#no-questions'),
  runBtn: $('#run-btn'),
  runNote: $('#run-note'),
  resultsPanel: $('#results-panel'),
  results: $('#results'),
  runMeta: $('#run-meta'),
  rawJson: $('#raw-json'),
  error: $('#error'),
  keyStatus: $('#key-status'),
  examplePicker: $('#example-picker'),
};

let seq = 0;

/* ---------- examples ---------- */

const EXAMPLES = {
  'Support ticket triage': {
    state:
      "Hi, I've been trying to connect my Stripe account for 3 days and the integration keeps failing. I'm losing sales. Please help ASAP.",
    questions: [
      {
        type: 'choice',
        id: 'department',
        instructions: 'Which team should handle this',
        criteria: [
          ['billing', 'Payment or subscription issues'],
          ['technical', 'Bugs or integration problems'],
          ['sales', 'Pricing or account questions'],
        ],
      },
      {
        type: 'score',
        id: 'frustration',
        instructions: 'How frustrated the customer appears',
        criteria: ['Calm, just stating facts', 'Frustrated but civil', 'Very angry, strong language'],
      },
      {
        type: 'noul',
        id: 'is_urgent',
        instructions: 'The message conveys urgency or time-sensitivity',
        criteria: [
          ['true', 'Explicitly time-sensitive'],
          ['false', 'No urgency expressed'],
        ],
      },
    ],
  },
  'Content moderation': {
    state:
      'Honestly this product is garbage and whoever designed the checkout flow should be fired. Third time my cart emptied itself.',
    questions: [
      { type: 'noul', id: 'is_actionable_feedback', instructions: 'Contains specific, actionable product feedback' },
      { type: 'noul', id: 'targets_a_person', instructions: 'Directs hostility at a specific person rather than the product' },
      {
        type: 'score',
        id: 'severity',
        instructions: 'How severe the policy violation is, if any',
        criteria: ['No violation at all', 'Rude but within bounds', 'Personal attack', 'Abuse requiring removal'],
      },
    ],
  },
  'Resume screening': {
    state:
      'Six years building distributed payment systems in Go and Rust. Led a team of four. Shipped a ledger handling 2M transactions daily. No formal CS degree — self-taught, started as a support engineer.',
    questions: [
      {
        type: 'score',
        id: 'backend_depth',
        instructions: 'Depth of backend systems experience',
        criteria: ['Entry level', 'Solid mid-level', 'Senior with production scale', 'Deep expert, designed critical systems'],
      },
      { type: 'noul', id: 'has_leadership', instructions: 'Shows evidence of leading or mentoring other engineers' },
      {
        type: 'choice',
        id: 'next_step',
        instructions: 'What should happen with this candidate next',
        criteria: [
          ['advance', 'Move to technical interview'],
          ['screen_call', 'Needs a recruiter call to clarify fit first'],
          ['reject', 'Not a match for this role'],
        ],
      },
    ],
  },
};

/* ---------- question cards ---------- */

function makeCard({ type, id, instructions = '', criteria }) {
  seq += 1;
  const card = document.createElement('div');
  card.className = 'qcard';
  card.dataset.type = type;

  const defaults = {
    noul: [['true', ''], ['false', '']],
    choice: [['option_a', ''], ['option_b', '']],
    score: ['', '', ''],
  };
  const crit = criteria || defaults[type];

  card.innerHTML = `
    <div class="qcard-head">
      <span class="qtype">${type}</span>
      <input class="qid" type="text" value="${escapeAttr(id || `${type}_${seq}`)}"
             aria-label="Question id" placeholder="question_id" />
      <button class="remove-btn" type="button" title="Remove" aria-label="Remove question">&times;</button>
    </div>
    <div class="field">
      <label>Instructions &mdash; what Jev should judge</label>
      <input class="qinstructions" type="text" value="${escapeAttr(instructions)}"
             placeholder="${placeholderFor(type)}" />
    </div>
    <div class="field criteria-field"></div>
  `;

  card.querySelector('.remove-btn').addEventListener('click', () => {
    card.remove();
    refreshEmptyNote();
  });

  renderCriteria(card.querySelector('.criteria-field'), type, crit);
  return card;
}

function placeholderFor(type) {
  return {
    noul: 'The message conveys urgency',
    choice: 'Which team should handle this',
    score: 'How frustrated the customer appears',
  }[type];
}

function renderCriteria(container, type, crit) {
  container.innerHTML = '';

  if (type === 'noul') {
    const label = document.createElement('label');
    label.innerHTML = 'Criteria <em>(optional)</em> &mdash; what yes and no mean';
    container.append(label);
    for (const [key, desc] of crit) {
      container.append(critRow({ key, desc, fixedKey: true, placeholder: key === 'true' ? 'What a yes means' : 'What a no means' }));
    }
    return;
  }

  if (type === 'choice') {
    const label = document.createElement('label');
    label.textContent = 'Options — name and description (2–255)';
    container.append(label);
    const list = document.createElement('div');
    list.className = 'crit-list';
    for (const [key, desc] of crit) list.append(critRow({ key, desc, removable: true }));
    container.append(list);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'mini-btn';
    add.textContent = '+ option';
    add.addEventListener('click', () => list.append(critRow({ key: '', desc: '', removable: true })));
    container.append(add);
    return;
  }

  // score
  const label = document.createElement('label');
  label.textContent = 'Levels — ordered low to high (2–10)';
  container.append(label);
  const list = document.createElement('div');
  list.className = 'crit-list';
  for (const desc of crit) list.append(levelRow(desc));
  container.append(list);
  renumber(list);

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'mini-btn';
  add.textContent = '+ level';
  add.addEventListener('click', () => {
    if (list.children.length >= 10) return;
    list.append(levelRow(''));
    renumber(list);
  });
  container.append(add);
}

function critRow({ key, desc, fixedKey = false, removable = false, placeholder = 'Description' }) {
  const row = document.createElement('div');
  row.className = 'crit-row';

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.className = 'key';
  keyInput.value = key;
  keyInput.placeholder = 'option_name';
  keyInput.setAttribute('aria-label', 'Option name');
  if (fixedKey) keyInput.readOnly = true;

  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'desc';
  descInput.value = desc || '';
  descInput.placeholder = placeholder;
  descInput.setAttribute('aria-label', 'Option description');

  row.append(keyInput, descInput);

  if (removable) {
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'remove-btn';
    rm.innerHTML = '&times;';
    rm.title = 'Remove option';
    rm.addEventListener('click', () => row.remove());
    row.append(rm);
  }
  return row;
}

function levelRow(desc) {
  const row = document.createElement('div');
  row.className = 'crit-row';

  const num = document.createElement('span');
  num.className = 'level-num';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'desc';
  input.value = desc || '';
  input.placeholder = 'Describe this level concretely';
  input.setAttribute('aria-label', 'Level description');

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'remove-btn';
  rm.innerHTML = '&times;';
  rm.title = 'Remove level';
  rm.addEventListener('click', () => {
    const list = row.parentElement;
    row.remove();
    renumber(list);
  });

  row.append(num, input, rm);
  return row;
}

function renumber(list) {
  [...list.children].forEach((row, i) => {
    const num = row.querySelector('.level-num');
    if (num) num.textContent = i;
  });
}

/* ---------- read the form into an API request ---------- */

function collectQuestions() {
  const questions = {};
  const meta = {};

  for (const card of els.questions.querySelectorAll('.qcard')) {
    const type = card.dataset.type;
    const id = card.querySelector('.qid').value.trim();
    const instructions = card.querySelector('.qinstructions').value.trim();
    if (!id) throw new Error('Every question needs an id');
    if (questions[id]) throw new Error(`Duplicate question id "${id}" — ids must be unique`);
    if (!instructions) throw new Error(`Question "${id}" needs instructions`);

    const q = { type, instructions };

    if (type === 'noul') {
      const criteria = {};
      for (const row of card.querySelectorAll('.crit-row')) {
        const key = row.querySelector('.key').value.trim();
        const desc = row.querySelector('.desc').value.trim();
        if (desc) criteria[key] = desc;
      }
      if (Object.keys(criteria).length) q.criteria = criteria;
    }

    if (type === 'choice') {
      const criteria = {};
      for (const row of card.querySelectorAll('.crit-row')) {
        const key = row.querySelector('.key').value.trim();
        const desc = row.querySelector('.desc').value.trim();
        if (!key) continue;
        criteria[key] = desc || null;
      }
      if (Object.keys(criteria).length < 2) throw new Error(`Choice "${id}" needs at least 2 named options`);
      q.criteria = criteria;
    }

    if (type === 'score') {
      const levels = [...card.querySelectorAll('.crit-row .desc')]
        .map((i) => i.value.trim())
        .filter(Boolean);
      if (levels.length < 2) throw new Error(`Score "${id}" needs at least 2 described levels`);
      q.criteria = levels;
    }

    questions[id] = q;
    meta[id] = instructions;
  }

  if (!Object.keys(questions).length) throw new Error('Add at least one question');
  return { questions, meta };
}

/** State is a string unless it parses as a JSON object/array — then send it structured. */
function collectState() {
  const raw = els.state.value.trim();
  if (!raw) throw new Error('State is required — give Jev something to evaluate');
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw; // looked like JSON but isn't; send as text
    }
  }
  return raw;
}

/* ---------- run ---------- */

async function run() {
  hideError();
  let payload;
  let meta;
  try {
    const collected = collectQuestions();
    meta = collected.meta;
    payload = { state: collectState(), questions: collected.questions };
  } catch (err) {
    showError(err.message);
    return;
  }

  els.runBtn.disabled = true;
  els.runBtn.textContent = 'Asking Jev…';
  els.runNote.textContent = `${Object.keys(payload.questions).length} question(s) in one call`;

  try {
    const res = await fetch('/api/systemone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || `Request failed (${res.status})`);
      return;
    }
    renderResults(data, meta);
  } catch (err) {
    showError(`Could not reach the server: ${err.message}`);
  } finally {
    els.runBtn.disabled = false;
    els.runBtn.textContent = 'Ask Jev';
    els.runNote.textContent = '';
  }
}

/* ---------- render ---------- */

function renderResults(data, meta) {
  els.results.innerHTML = '';

  for (const [id, answer] of Object.entries(data.answers || {})) {
    const box = document.createElement('div');
    box.className = 'answer';
    box.dataset.type = answer.type;

    const head = document.createElement('div');
    head.className = 'answer-head';
    head.innerHTML = `<span class="answer-id">${escapeHtml(id)}</span>
                      <span class="pill pill-muted">${escapeHtml(answer.type)}</span>`;
    box.append(head);

    if (meta[id]) {
      const instr = document.createElement('div');
      instr.className = 'answer-instructions';
      instr.textContent = meta[id];
      box.append(instr);
    }

    box.append(...renderAnswerBody(answer));
    els.results.append(box);
  }

  const usage = data.usage || {};
  els.runMeta.textContent = [
    data.model,
    data.latency_ms != null ? `${data.latency_ms} ms` : null,
    usage.input_tokens != null ? `${usage.input_tokens + (usage.output_tokens || 0)} tokens` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const shown = { ...data };
  els.rawJson.textContent = JSON.stringify(shown, null, 2);
  els.resultsPanel.hidden = false;
  els.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAnswerBody(answer) {
  const parts = [];
  const headline = document.createElement('div');
  headline.className = 'headline';

  if (answer.type === 'noul') {
    const p = answer.noul;
    headline.innerHTML = `${(p * 100).toFixed(1)}% yes
      <small>${p >= 0.5 ? 'leans yes' : 'leans no'}${nearHalf(p) ? ' — genuinely split' : ''}</small>`;
    parts.push(headline, bar('yes', p, true), bar('no', 1 - p, false));
    return parts;
  }

  if (answer.type === 'choice') {
    headline.innerHTML = `${escapeHtml(answer.choice)}
      <small>confidence ${fmt(answer.confidence)}</small>`;
    parts.push(headline);
    const entries = Object.entries(answer.probabilities || {}).sort((a, b) => b[1] - a[1]);
    for (const [option, p] of entries) parts.push(bar(option, p, option === answer.choice));
    return parts;
  }

  // score
  const legend = answer.legend || {};
  const nearest = Math.round(answer.score);
  headline.innerHTML = `${answer.score.toFixed(2)}
    <small>${escapeHtml(legend[String(nearest)] || '')} &middot; confidence ${fmt(answer.confidence)}</small>`;
  parts.push(headline);
  const entries = Object.entries(answer.probabilities || {}).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  for (const [level, p] of entries) {
    parts.push(bar(`${level} · ${legend[level] || ''}`, p, Number(level) === nearest));
  }
  return parts;
}

function bar(label, p, isTop) {
  const row = document.createElement('div');
  row.className = 'bar-row' + (isTop ? ' is-top' : '');
  const pct = Math.max(0, Math.min(1, p)) * 100;
  row.innerHTML = `
    <span class="bar-label" title="${escapeAttr(label)}">${escapeHtml(label)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span></span>
    <span class="bar-pct">${pct.toFixed(1)}%</span>`;
  return row;
}

const fmt = (n) => (n == null ? '—' : n.toFixed(2));
const nearHalf = (p) => p > 0.4 && p < 0.6;

/* ---------- misc ---------- */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
const escapeAttr = escapeHtml;

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
  els.error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hideError() {
  els.error.hidden = true;
}

function refreshEmptyNote() {
  els.noQuestions.hidden = els.questions.children.length > 0;
}

function loadExample(name) {
  const ex = EXAMPLES[name];
  if (!ex) return;
  els.state.value = ex.state;
  els.questions.innerHTML = '';
  for (const q of ex.questions) els.questions.append(makeCard(q));
  refreshEmptyNote();
  updateStateMeta();
  hideError();
  els.resultsPanel.hidden = true;
}

function updateStateMeta() {
  const raw = els.state.value;
  els.stateCount.textContent = `${raw.length.toLocaleString()} characters`;
  let kind = 'text';
  const t = raw.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      JSON.parse(t);
      kind = 'structured JSON';
    } catch {
      kind = 'text (invalid JSON)';
    }
  }
  els.stateKind.textContent = kind;
}

/* ---------- wire up ---------- */

for (const btn of document.querySelectorAll('.add-btn')) {
  btn.addEventListener('click', () => {
    els.questions.append(makeCard({ type: btn.dataset.add }));
    refreshEmptyNote();
  });
}

els.runBtn.addEventListener('click', run);
els.state.addEventListener('input', updateStateMeta);

$('#clear-btn').addEventListener('click', () => {
  els.state.value = '';
  els.questions.innerHTML = '';
  els.resultsPanel.hidden = true;
  hideError();
  refreshEmptyNote();
  updateStateMeta();
});

$('#theme-toggle').addEventListener('click', () => {
  const dark =
    document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('worlds-theme', document.documentElement.dataset.theme);
  } catch { /* private mode — theme just won't persist */ }
});

try {
  const saved = localStorage.getItem('worlds-theme');
  if (saved) document.documentElement.dataset.theme = saved;
} catch { /* ignore */ }

for (const name of Object.keys(EXAMPLES)) {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  els.examplePicker.append(opt);
}
els.examplePicker.addEventListener('change', (e) => {
  if (e.target.value) loadExample(e.target.value);
});

// Cmd/Ctrl+Enter runs from anywhere in the form.
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
});

fetch('/api/health')
  .then((r) => r.json())
  .then((h) => {
    if (h.keyConfigured) {
      els.keyStatus.textContent = `key loaded · ${h.defaultModel}`;
      els.keyStatus.className = 'pill';
    } else {
      els.keyStatus.textContent = 'no API key';
      els.keyStatus.className = 'pill pill-bad';
      showError(
        'No TYPESAFE_API_KEY found. Copy .env.example to .env, add your key from console.typesafe.ai/keys, then restart the server.'
      );
    }
  })
  .catch(() => {
    els.keyStatus.textContent = 'server unreachable';
    els.keyStatus.className = 'pill pill-bad';
  });

loadExample('Support ticket triage');
