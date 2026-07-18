import { TECHNIQUES } from '../data/catalog';
import { activeCombatant } from '../engine/combat';
import type { Action, AppState } from '../state/game';
import {
  COMPANIONS,
  CONVICTIONS,
  DISCIPLINES,
  MOTIVATIONS,
  ORIGINS,
  SCENES,
  playerDerived,
  visibleChoices,
} from '../state/game';
import { ENDINGS } from '../data/story';

export function render(state: AppState): string {
  switch (state.screen) {
    case 'title':
      return renderTitle(state);
    case 'create':
      return renderCreate(state);
    case 'scene':
      return renderScene(state);
    case 'combat':
      return renderCombat(state);
    case 'clash':
      return renderClash(state);
    case 'ending':
      return renderEnding(state);
    case 'sheet':
      return renderSheet(state);
    default:
      return renderTitle(state);
  }
}

export function bind(root: HTMLElement, dispatch: (a: Action) => void) {
  root.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = (el as HTMLElement).dataset.action!;
      const payload = (el as HTMLElement).dataset.payload;
      handleClick(action, payload, dispatch);
    });
  });

  root.querySelectorAll('[data-draft]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = (el as HTMLElement).dataset.draft!;
      const value = (el as HTMLElement).dataset.value!;
      dispatch({ type: 'SET_DRAFT', patch: { [key]: value } });
    });
  });

  const nameInput = root.querySelector<HTMLInputElement>('#name-input');
  if (nameInput) {
    nameInput.addEventListener('change', () => {
      dispatch({ type: 'SET_DRAFT', patch: { name: nameInput.value } });
    });
  }
}

function handleClick(
  action: string,
  payload: string | undefined,
  dispatch: (a: Action) => void,
) {
  switch (action) {
    case 'goto-create':
      dispatch({ type: 'GOTO', screen: 'create' });
      break;
    case 'goto-title':
      dispatch({ type: 'GOTO', screen: 'title' });
      break;
    case 'start-new':
      dispatch({ type: 'START_NEW' });
      break;
    case 'continue':
      dispatch({ type: 'CONTINUE' });
      break;
    case 'delete-save':
      dispatch({ type: 'DELETE_SAVE' });
      break;
    case 'choice':
      if (payload) dispatch({ type: 'CHOICE', choiceId: payload });
      break;
    case 'open-sheet':
      dispatch({ type: 'OPEN_SHEET' });
      break;
    case 'close-sheet':
      dispatch({ type: 'CLOSE_SHEET' });
      break;
    case 'combat-tech': {
      const [techId, targetId] = (payload ?? '').split('|');
      dispatch({
        type: 'COMBAT_TECH',
        actorId: 'player',
        techniqueId: techId,
        targetId,
      });
      break;
    }
    case 'set-target':
      // handled via re-render selection stored on button group using data on root
      if (payload) {
        (window as unknown as { __riftTarget?: string }).__riftTarget = payload;
        // force lightweight refresh through noop draft
        dispatch({ type: 'SET_DRAFT', patch: {} });
      }
      break;
    case 'ascend':
      dispatch({ type: 'COMBAT_ASCEND' });
      break;
    case 'combat-talk':
      if (payload) dispatch({ type: 'COMBAT_TALK', targetId: payload, dc: 14 });
      break;
    case 'clash':
      if (payload) dispatch({ type: 'CLASH_CHOICE', choice: payload });
      break;
    case 'clear-toast':
      dispatch({ type: 'CLEAR_TOAST' });
      break;
  }
}

function shell(content: string, state: AppState, opts?: { showNav?: boolean }) {
  const save = state.save;
  const nav =
    opts?.showNav && save
      ? `<div class="topbar">
          <div class="brand">Project <span>Riftwake</span></div>
          <div class="actions">
            <span class="meta">Ch.${save.chapter} · ${escapeHtml(save.player.name)} · Resolve ${save.player.resolve}</span>
            <button data-action="open-sheet">Character</button>
          </div>
        </div>`
      : '';
  const toast = state.toast
    ? `<div class="toast" data-action="clear-toast">${escapeHtml(state.toast)}</div>`
    : '';
  return `<div class="shell">${nav}${content}</div>${toast}`;
}

function renderTitle(state: AppState): string {
  return `<div class="hero-title">
    <div class="panel hero-card">
      <div class="pill">Eidara · Crossfall Trials</div>
      <h1>Project <em>Riftwake</em></h1>
      <p class="tagline">A party-based cinematic tactical RPG. Build a hybrid Flux fighter, make costly choices, and rise through unstable reality.</p>
      <div class="rule">Anything can happen, but everything does not have the same chance of happening.</div>
      <div class="actions">
        <button class="primary" data-action="goto-create">New Campaign</button>
        <button data-action="continue" ${state.save ? '' : 'disabled'}>Continue</button>
        <button class="danger" data-action="delete-save" ${state.save ? '' : 'disabled'}>Clear Save</button>
      </div>
    </div>
  </div>`;
}

function renderCreate(state: AppState): string {
  const d = state.draft;
  const originCards = Object.values(ORIGINS)
    .map(
      (o) => `<button class="option ${d.origin === o.id ? 'selected' : ''}" data-draft="origin" data-value="${o.id}">
        <strong>${o.name}</strong><small>${o.identity}<br/>${o.strength}</small>
      </button>`,
    )
    .join('');
  const discCards = Object.values(DISCIPLINES)
    .map(
      (o) => `<button class="option ${d.discipline === o.id ? 'selected' : ''}" data-draft="discipline" data-value="${o.id}">
        <strong>${o.name}</strong><small>${o.combat}</small>
      </button>`,
    )
    .join('');
  const convCards = Object.values(CONVICTIONS)
    .map((o) => {
      const selected = d.convictionA === o.id || d.convictionB === o.id;
      const slot =
        d.convictionA === o.id ? 'A' : d.convictionB === o.id ? 'B' : '';
      return `<button class="option ${selected ? 'selected' : ''}" data-action="pick-conviction" data-payload="${o.id}">
        <strong>${o.name}${slot ? ` · ${slot}` : ''}</strong><small>${o.prompt}</small>
      </button>`;
    })
    .join('');
  // conviction picking via special handler — patch bind
  const motCards = MOTIVATIONS.map(
    (m) => `<button class="option ${d.motivationId === m.id ? 'selected' : ''}" data-draft="motivationId" data-value="${m.id}">
      <strong>${m.label}</strong><small>${m.text}</small>
    </button>`,
  ).join('');

  return shell(
    `<div class="panel">
      <div class="scene-head"><h2>Character Creation</h2><span class="meta">Three layers · Origin · Discipline · Conviction</span></div>
      <div class="field"><label>Name</label><input id="name-input" value="${escapeHtml(d.name ?? '')}" maxlength="24" /></div>
      <h3>Origin</h3><div class="grid-2">${originCards}</div>
      <h3>Discipline</h3><div class="grid-2">${discCards}</div>
      <h3>Convictions (pick two)</h3><div class="grid-2" id="conviction-grid">${convCards}</div>
      <h3>Motivation</h3><div class="grid-2">${motCards}</div>
      <div class="actions" style="margin-top:1.2rem">
        <button data-action="goto-title">Back</button>
        <button class="primary" data-action="start-new">Enter Crossfall</button>
      </div>
    </div>`,
    state,
  );
}

export function bindCreateExtra(root: HTMLElement, state: AppState, dispatch: (a: Action) => void) {
  root.querySelectorAll('[data-action="pick-conviction"]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.payload as keyof typeof CONVICTIONS;
      const a = state.draft.convictionA;
      const b = state.draft.convictionB;
      if (a === id) {
        dispatch({ type: 'SET_DRAFT', patch: { convictionA: b, convictionB: undefined } });
      } else if (b === id) {
        dispatch({ type: 'SET_DRAFT', patch: { convictionB: undefined } });
      } else if (!a) {
        dispatch({ type: 'SET_DRAFT', patch: { convictionA: id } });
      } else if (!b && a !== id) {
        dispatch({ type: 'SET_DRAFT', patch: { convictionB: id } });
      } else {
        dispatch({ type: 'SET_DRAFT', patch: { convictionB: id } });
      }
    });
  });
}

function renderScene(state: AppState): string {
  if (!state.save) return renderTitle(state);
  const scene = SCENES[state.save.sceneId];
  if (!scene) {
    return shell(`<div class="panel"><p>Missing scene ${state.save.sceneId}</p></div>`, state, {
      showNav: true,
    });
  }
  const choices = visibleChoices(state.save, scene.choices)
    .map(
      (c) => `<button data-action="choice" data-payload="${c.id}">
        ${escapeHtml(c.label)}
        ${c.hint ? `<span class="hint">${escapeHtml(c.hint)}</span>` : ''}
      </button>`,
    )
    .join('');

  const party = state.save.partyIds
    .map((id) => COMPANIONS[id]?.name ?? id)
    .join(' · ');

  return shell(
    `<div class="panel">
      <div class="scene-head">
        <h2>${escapeHtml(scene.title)}</h2>
        <span class="pill">Chapter ${scene.chapter}</span>
      </div>
      <div class="location">${escapeHtml(scene.location)}${party ? ` · Party: ${escapeHtml(party)}` : ''}</div>
      ${state.lastDiceText ? `<div class="dice-banner">${escapeHtml(state.lastDiceText)}</div>` : ''}
      <div class="body">${escapeHtml(scene.body)}</div>
      <div class="choice-list">${choices}</div>
    </div>`,
    state,
    { showNav: true },
  );
}

function renderCombat(state: AppState): string {
  const combat = state.combat!;
  const active = activeCombatant(combat);
  const selectedTarget =
    (window as unknown as { __riftTarget?: string }).__riftTarget ??
    combat.combatants.find((c) => c.alive && !c.isPlayer && !c.isCompanion)?.id ??
    combat.combatants.find((c) => c.alive && c.id !== 'player')?.id ??
    'player';

  const list = combat.combatants
    .map((c) => {
      const hp = Math.round((c.vitality / c.maxVitality) * 100);
      const flux = Math.round((c.flux / Math.max(1, c.maxFlux)) * 100);
      const st = Math.round((c.stagger / Math.max(1, c.maxStagger)) * 100);
      return `<div class="combatant ${c.id === active.id ? 'active' : ''} ${c.alive ? '' : 'down'}">
        <div class="name"><span>${escapeHtml(c.name)}${c.ascended ? ' ✦' : ''}</span><span class="muted">${c.powerBand}</span></div>
        <div class="bars">
          <div class="bar hp"><i style="width:${hp}%"></i></div>
          <div class="bar flux"><i style="width:${flux}%"></i></div>
          <div class="bar stagger"><i style="width:${st}%"></i></div>
        </div>
        <div class="statline">
          <span>VIT ${c.vitality}/${c.maxVitality}</span>
          <span>FLUX ${c.flux}/${c.maxFlux}</span>
          <span>STG ${c.stagger}/${c.maxStagger}</span>
          <span>PRS ${c.pressure}</span>
          <span>Guard ${c.guard}</span>
        </div>
      </div>`;
    })
    .join('');

  const targets = combat.combatants
    .filter((c) => c.alive)
    .map(
      (c) =>
        `<button class="${c.id === selectedTarget ? 'selected' : ''}" data-action="set-target" data-payload="${c.id}">${escapeHtml(c.name)}</button>`,
    )
    .join('');

  const player = combat.combatants.find((c) => c.id === 'player')!;
  const canAct = active.id === 'player' && !combat.finished;
  const techs = player.techniques
    .map((id) => TECHNIQUES[id])
    .filter(Boolean)
    .map((t) => {
      const disabled = !canAct || player.flux < t.fluxCost;
      return `<button ${disabled ? 'disabled' : ''} data-action="combat-tech" data-payload="${t.id}|${selectedTarget}">
        <strong>${escapeHtml(t.name)}</strong> <span class="muted">(${t.fluxCost} Flux)</span>
        <span class="hint">${escapeHtml(t.description)}</span>
      </button>`;
    })
    .join('');

  const talkOk = combat.tags.includes('talk_ok') || combat.objective.type === 'convince';
  const talkTarget =
    combat.combatants.find((c) => c.alive && !c.isPlayer && !c.isCompanion)?.id ?? '';

  const log = combat.log
    .slice(-14)
    .map((l) => `<div class="${l.kind}">${escapeHtml(l.text)}</div>`)
    .join('');

  const ascendBtn =
    canAct &&
    !player.ascended &&
    state.save &&
    (state.save.player.catalystReady ||
      state.save.flags['Catalyst.TemperedWake'] ||
      player.pressure >= 6)
      ? `<button data-action="ascend">Ascension · Tempered Wake</button>`
      : '';

  return shell(
    `<div class="panel">
      <div class="scene-head">
        <h2>${escapeHtml(combat.name)}</h2>
        <span class="meta">Round ${combat.round} · ${escapeHtml(combat.objective.label)}</span>
      </div>
      <p class="muted">${escapeHtml(combat.description)}</p>
      <div class="combat-layout">
        <div>
          ${list}
          <h3>Target</h3>
          <div class="target-row">${targets}</div>
          <h3>Techniques ${canAct ? '' : '<span class="muted">(waiting)</span>'}</h3>
          <div class="tech-grid">${techs}</div>
          <div class="actions" style="margin-top:0.8rem">
            ${ascendBtn}
            ${talkOk && canAct && talkTarget ? `<button data-action="combat-talk" data-payload="${talkTarget}">Combat Conversation</button>` : ''}
          </div>
        </div>
        <div>
          <h3>Battle Log</h3>
          <div class="log">${log}</div>
          ${combat.lastRoll ? `<div class="dice-banner" style="margin-top:0.8rem">${escapeHtml(combat.lastRoll.narrative)}</div>` : ''}
        </div>
      </div>
    </div>`,
    state,
    { showNav: true },
  );
}

function renderClash(state: AppState): string {
  const clash = state.combat?.pendingClash;
  if (!clash) return renderCombat(state);
  const beat = clash.beats.length + 1;
  return shell(
    `<div class="panel">
      <div class="scene-head"><h2>Clash</h2><span class="pill">Beat ${beat} / 2</span></div>
      <p>Two major techniques collide. Choose your approach.</p>
      <div class="clash-choices">
        <button data-action="clash" data-payload="push"><strong>Push</strong><span class="hint">Spend Flux, roll Control</span></button>
        <button data-action="clash" data-payload="overcharge"><strong>Overcharge</strong><span class="hint">Add power, gain Pressure, risk injury</span></button>
        <button data-action="clash" data-payload="redirect"><strong>Redirect</strong><span class="hint">Use Intellect/Control to change the angle</span></button>
        <button data-action="clash" data-payload="call"><strong>Call for aid</strong><span class="hint">Spend Resolve for party help</span></button>
        <button data-action="clash" data-payload="release"><strong>Release</strong><span class="hint">Abandon the clash and evade</span></button>
      </div>
    </div>`,
    state,
    { showNav: true },
  );
}

function renderEnding(state: AppState): string {
  const id = state.endingId ?? (state.save?.flags['Ending.Id'] as string) ?? 'lose';
  const def = ENDINGS[id] ?? ENDINGS.lose;
  const body = def.summary(state.save?.flags ?? {});
  return shell(
    `<div class="panel ending">
      <div class="pill">Vertical Slice Complete</div>
      <h2>${escapeHtml(def.title)}</h2>
      <div class="body">${escapeHtml(body)}</div>
      <p class="muted">There is no single perfect result. Preparation determined which costs you avoided.</p>
      <div class="actions">
        <button class="primary" data-action="goto-create">Play again</button>
        <button data-action="goto-title">Title</button>
        <button data-action="open-sheet">Review character</button>
      </div>
    </div>`,
    state,
  );
}

function renderSheet(state: AppState): string {
  if (!state.save) return renderTitle(state);
  const p = state.save.player;
  const d = playerDerived(p);
  const attrs = Object.entries(p.attributes)
    .map(
      ([k, v]) =>
        `<div class="stat-box"><span class="muted">${k}</span><b>${v}</b></div>`,
    )
    .join('');
  const bonds = Object.entries(state.save.relationships)
    .filter(([, r]) => r.recruited || r.approval !== 0 || r.trust !== 0)
    .map(([id, r]) => {
      const name = COMPANIONS[id]?.name ?? id;
      return `<div class="combatant"><div class="name">${escapeHtml(name)}</div><div class="statline"><span>Approval ${r.approval}</span><span>Trust ${r.trust}</span><span>${r.inParty ? 'In party' : 'Met'}</span></div></div>`;
    })
    .join('') || '<p class="muted">No bonds recorded yet.</p>';

  return shell(
    `<div class="panel">
      <div class="scene-head"><h2>${escapeHtml(p.name)}</h2><button data-action="close-sheet">Close</button></div>
      <p class="muted">${ORIGINS[p.origin].name} · ${DISCIPLINES[p.discipline].name} · ${p.convictions.map((c) => CONVICTIONS[c].name).join(' / ')}</p>
      <p>Band <strong>${p.powerBand}</strong> · Resonance ~${d.resonance} · Level ${p.level} · Resolve ${p.resolve}</p>
      <div class="statline" style="margin:0.6rem 0 1rem">
        <span>VIT ${d.vitality}</span><span>FLUX ${d.flux}</span><span>Guard ${d.guard}</span><span>Stagger ${d.stagger}</span>
      </div>
      <div class="sheet-grid">${attrs}</div>
      <h3>Techniques</h3>
      <p>${p.techniques.map((t) => TECHNIQUES[t]?.name ?? t).join(' · ')}</p>
      <h3>Bonds</h3>
      ${bonds}
      <h3>Key flags</h3>
      <p class="muted">${Object.keys(state.save.flags).slice(0, 18).join(' · ') || 'None yet'}</p>
    </div>`,
    state,
    { showNav: true },
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
