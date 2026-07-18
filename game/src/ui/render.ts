import { TECHNIQUES } from '../data/catalog';
import { artForScene, VISUAL_REFS } from '../data/visuals';
import { activeCombatant } from '../engine/combat';
import {
  attributeBars,
  bandTrack,
  outputLabel,
  powerGapFlavor,
  RESONANCE_BENCHMARKS,
} from '../engine/resonance';
import {
  FORMS,
  STAT_LABELS,
  combatantPower,
  formatPL,
  playerPower,
  type BattleStats,
} from '../engine/power';
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
    case 'gallery':
      return renderGallery(state);
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
    case 'goto-gallery':
      dispatch({ type: 'GOTO', screen: 'gallery' });
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
    case 'power-up':
      dispatch({ type: 'COMBAT_POWER_UP' });
      break;
    case 'suppress':
      dispatch({ type: 'COMBAT_SUPPRESS' });
      break;
    case 'scan':
      if (payload) dispatch({ type: 'COMBAT_SCAN', targetId: payload });
      break;
    case 'continue-turn':
      dispatch({ type: 'COMBAT_CONTINUE' });
      break;
    case 'ai-choice':
      if (payload) dispatch({ type: 'AI_CHOICE', choiceId: payload });
      break;
    case 'open-story-ai':
      dispatch({ type: 'OPEN_STORY_AI' });
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
  const navRes = save
    ? formatPL(playerPower(save.player, { formId: save.player.formId ?? 'base' }).powerLevel)
    : '';
  const nav =
    opts?.showNav && save
      ? `<div class="topbar">
          <div class="brand">Project <span>Riftwake</span></div>
          <div class="actions">
            <span class="meta">Ch.${save.chapter} · ${escapeHtml(save.player.name)} · PL <strong>${navRes}</strong> · Resolve ${save.player.resolve}</span>
            <button data-action="open-story-ai">Story AI</button>
            <button data-action="open-sheet">Stats</button>
          </div>
        </div>`
      : '';
  const toast = state.toast
    ? `<div class="toast" data-action="clear-toast">${escapeHtml(state.toast)}</div>`
    : '';
  return `<div class="shell">${nav}${content}</div>${toast}`;
}

function renderTitle(state: AppState): string {
  return `<div class="hero-title fullbleed over-3d">
    <div class="hero-copy glass">
      <p class="brand-mark">Project <em>Riftwake</em></p>
      <p class="tagline">3D tactical battles in a joined-reality city. Build power, scan ratings, and clash with explosive Energy.</p>
      <div class="rule">Anything can happen, but everything does not have the same chance of happening.</div>
      <div class="actions">
        <button class="primary" data-action="goto-create">New Campaign</button>
        <button data-action="continue" ${state.save ? '' : 'disabled'}>Continue</button>
        <button data-action="goto-gallery">Visual Refs</button>
        <button class="danger" data-action="delete-save" ${state.save ? '' : 'disabled'}>Clear Save</button>
      </div>
    </div>
    <div class="ref-strip">
      ${VISUAL_REFS.slice(0, 4)
        .map(
          (r) => `<button class="ref-thumb" data-action="goto-gallery" title="${escapeHtml(r.title)}">
            <img src="${r.src}" alt="${escapeHtml(r.title)}" loading="lazy" />
            <span>${escapeHtml(r.title)}</span>
          </button>`,
        )
        .join('')}
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
    `<div class="create-layout">
      <aside class="create-visual panel">
        <img class="create-art" src="./refs/ref-tempered-wake.png" alt="Tempered Wake ascension reference" />
        <img class="create-art flux" src="./refs/ref-flux-types.png" alt="Flux type reference" />
        <p class="muted">Visual lock: original silhouettes, Flux materials, no borrowed power-up tropes.</p>
      </aside>
      <div class="panel">
        <div class="scene-head"><h2>Character Creation</h2><span class="meta">Origin · Discipline · Conviction</span></div>
        <div class="field"><label>Name</label><input id="name-input" value="${escapeHtml(d.name ?? '')}" maxlength="24" /></div>
        <h3>Origin</h3><div class="grid-2">${originCards}</div>
        <h3>Discipline</h3><div class="grid-2">${discCards}</div>
        <h3>Convictions (pick two)</h3><div class="grid-2" id="conviction-grid">${convCards}</div>
        <h3>Motivation</h3><div class="grid-2">${motCards}</div>
        <div class="actions" style="margin-top:1.2rem">
          <button data-action="goto-title">Back</button>
          <button data-action="goto-gallery">Visual Refs</button>
          <button class="primary" data-action="start-new">Enter Crossfall</button>
        </div>
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

  // Story AI runtime beat
  if (state.save.sceneId === 'ai_runtime' && state.save.aiBeat) {
    const beat = state.save.aiBeat;
    const pl = playerPower(state.save.player, { formId: state.save.player.formId ?? 'base' });
    const choices = beat.choices
      .map(
        (c) => `<button data-action="ai-choice" data-payload="${c.id}">
          ${escapeHtml(c.label)}
          ${c.hint ? `<span class="hint">${escapeHtml(c.hint)}</span>` : ''}
        </button>`,
      )
      .join('');
    return shell(
      `<div class="scene-stage">
        <figure class="scene-art panel">
          <img src="./refs/ref-power-surge.png" alt="" />
          <figcaption>Story AI · PL ${formatPL(pl.powerLevel)} · ×${pl.formMultiplier}</figcaption>
        </figure>
        <div class="panel">
          <div class="scene-head">
            <h2>${escapeHtml(beat.title)}</h2>
            <span class="pill">Story AI</span>
          </div>
          <div class="location">${escapeHtml(beat.location)}</div>
          <div class="scanner-bar compact">
            <span class="res-label">POWER LEVEL</span>
            <div class="res-hero">${formatPL(pl.powerLevel)}</div>
            <div class="muted">${pl.formName} ×${pl.formMultiplier} · Stat total ${pl.statTotal} · Trains ${state.save.trainCount ?? 0}</div>
          </div>
          ${state.lastDiceText ? `<div class="dice-banner">${escapeHtml(state.lastDiceText)}</div>` : ''}
          <div class="body">${escapeHtml(beat.body)}</div>
          <div class="choice-list">${choices}</div>
        </div>
      </div>`,
      state,
      { showNav: true },
    );
  }

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

  const art = artForScene(scene.id, scene.chapter);
  const pl = playerPower(state.save.player, { formId: state.save.player.formId ?? 'base' });

  return shell(
    `<div class="scene-stage">
      <figure class="scene-art panel">
        <img src="${art}" alt="" />
        <figcaption>${escapeHtml(scene.location)}</figcaption>
      </figure>
      <div class="panel">
        <div class="scene-head">
          <h2>${escapeHtml(scene.title)}</h2>
          <span class="pill">Chapter ${scene.chapter} · PL ${formatPL(pl.powerLevel)}</span>
        </div>
        <div class="location">${escapeHtml(scene.location)}${party ? ` · Party: ${escapeHtml(party)}` : ''}</div>
        ${state.lastDiceText ? `<div class="dice-banner">${escapeHtml(state.lastDiceText)}</div>` : ''}
        <div class="body">${escapeHtml(scene.body)}</div>
        <div class="choice-list">${choices}</div>
        <div class="actions" style="margin-top:1rem">
          <button data-action="open-story-ai">Open Story AI (train / grind)</button>
        </div>
      </div>
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
      const scanned = combat.tags.includes(`scanned:${c.id}`) || c.isPlayer || c.isCompanion;
      const res = combatantPower(c);
      const aura = c.ascended || c.output >= 0.9 || c.statuses.includes('aura') ? ' aura' : '';
      const surge = c.output >= 0.85 ? ' surge' : '';
      return `<div class="combatant${aura}${surge} ${c.id === active.id ? 'active' : ''} ${c.alive ? '' : 'down'}">
        <div class="name"><span>${escapeHtml(c.name)}${c.ascended ? ` · ${escapeHtml(res.formName)}` : ''}</span><span class="band-chip">${escapeHtml(res.bandLabel)}</span></div>
        <div class="res-readout ${scanned ? 'known' : 'masked'}">
          <span class="res-label">PL</span>
          <strong class="res-num">${scanned ? formatPL(res.powerLevel) : '????'}</strong>
          <span class="muted">${scanned ? `×${res.formMultiplier} · ${outputLabel(c.output)} ${Math.round(c.output * 100)}%` : 'not scanned'}</span>
        </div>
        <div class="bars">
          <div class="bar hp"><i style="width:${hp}%"></i></div>
          <div class="bar flux"><i style="width:${flux}%"></i></div>
          <div class="bar stagger"><i style="width:${st}%"></i></div>
          <div class="bar output"><i style="width:${Math.round(c.output * 100)}%"></i></div>
        </div>
        <div class="statline">
          <span>Health ${c.vitality}/${c.maxVitality}</span>
          <span>Energy ${c.flux}/${c.maxFlux}</span>
          <span>Stun ${c.stagger}/${c.maxStagger}</span>
          <span>Stress ${c.pressure}</span>
          <span>Defense ${c.guard}</span>
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
        <strong>${escapeHtml(t.name)}</strong> <span class="muted">(${t.fluxCost} Energy)</span>
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
      ? `<button class="primary" data-action="ascend">Transform · Tempered Wake</button>`
      : '';

  const ascendedClass = player.ascended || player.output >= 0.9 ? ' ascended' : '';
  const playerRes = combatantPower(player);
  const foe = combat.combatants.find((c) => c.id === selectedTarget);
  const gapText = foe ? powerGapFlavor(player.powerBand, foe.powerBand) : '';
  const whoseTurn = active.isPlayer
    ? 'Your turn'
    : active.isCompanion
      ? `${active.name} (ally) is acting`
      : `${active.name}'s turn`;

  return shell(
    `<div class="combat-stage over-3d${ascendedClass}">
      <div class="combat-hud">
        <div class="panel combat-panel">
          <div class="scene-head">
            <h2>${escapeHtml(combat.name)}</h2>
            <span class="meta">3D Arena · Round ${combat.round} · ${escapeHtml(combat.objective.label)}</span>
          </div>
          <div class="turn-banner ${canAct ? 'ready' : 'wait'}">
            <strong>${escapeHtml(whoseTurn)}</strong>
            ${
              canAct
                ? '<span>Choose a target, then use a move. Watch the 3D arena react.</span>'
                : '<span>Resolving other fighters — tap Continue if locked.</span>'
            }
            ${canAct ? '' : '<button class="primary" data-action="continue-turn">Continue</button>'}
          </div>
          <div class="scanner-bar">
            <div>
              <span class="res-label">POWER LEVEL</span>
              <div class="res-hero">${formatPL(playerRes.powerLevel)}</div>
              <div class="muted">${playerRes.formName} ×${playerRes.formMultiplier} · ${outputLabel(player.output)} ${Math.round(player.output * 100)}% · ${playerRes.bandLabel}</div>
            </div>
            <div class="band-track">${bandTrack(playerRes.band)
              .map(
                (b) =>
                  `<span class="band-step ${b.reached ? 'reached' : ''} ${b.active ? 'active' : ''}">${escapeHtml(b.label)}</span>`,
              )
              .join('')}</div>
          </div>
          <p class="muted">${escapeHtml(combat.description)}${gapText ? ` · ${escapeHtml(gapText)}` : ''}</p>
          <div class="combat-layout">
            <div>
              ${list}
              <h3>Target</h3>
              <div class="target-row">${targets}</div>
              <h3>Combat Actions</h3>
              <div class="actions power-actions">
                <button ${canAct ? '' : 'disabled'} data-action="power-up">Power Up</button>
                <button ${canAct ? '' : 'disabled'} data-action="suppress">Hold Back</button>
                <button ${canAct && selectedTarget ? '' : 'disabled'} data-action="scan" data-payload="${selectedTarget}">Scan Power</button>
                ${ascendBtn}
                ${talkOk && canAct && talkTarget ? `<button data-action="combat-talk" data-payload="${talkTarget}">Talk Them Down</button>` : ''}
                ${canAct ? '' : '<button data-action="continue-turn">Continue</button>'}
              </div>
              <h3>Moves ${canAct ? '' : '<span class="muted">(locked until your turn)</span>'}</h3>
              <div class="tech-grid">${techs}</div>
            </div>
            <div>
              <h3>Fight Log</h3>
              <div class="log">${log}</div>
              ${combat.lastRoll ? `<div class="dice-banner" style="margin-top:0.8rem">${escapeHtml(combat.lastRoll.narrative)}</div>` : ''}
            </div>
          </div>
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
    `<div class="clash-stage over-3d">
      <div class="panel clash-panel">
        <div class="scene-head"><h2>Power Clash</h2><span class="pill">Exchange ${beat} / 2</span></div>
        <p>Beams lock in the 3D arena. Pick how you fight this exchange.</p>
        <div class="clash-choices">
          <button data-action="clash" data-payload="push"><strong>Push</strong><span class="hint">Spend Energy, contest with Control</span></button>
          <button data-action="clash" data-payload="overcharge"><strong>Overcharge</strong><span class="hint">More power, more Stress, risk injury</span></button>
          <button data-action="clash" data-payload="redirect"><strong>Redirect</strong><span class="hint">Outthink the angle (Intellect / Control)</span></button>
          <button data-action="clash" data-payload="call"><strong>Call for help</strong><span class="hint">Spend Resolve for an ally assist</span></button>
          <button data-action="clash" data-payload="release"><strong>Break off</strong><span class="hint">Drop the clash and try to dodge</span></button>
        </div>
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
    `<div class="ending-stage">
      <figure class="scene-art panel wide">
        <img src="./refs/ref-axis-engine.png" alt="Axis Engine aftermath" />
      </figure>
      <div class="panel ending">
        <div class="pill">Vertical Slice Complete</div>
        <h2>${escapeHtml(def.title)}</h2>
        <div class="body">${escapeHtml(body)}</div>
        <p class="muted">There is no single perfect result. Preparation determined which costs you avoided.</p>
        <div class="actions">
          <button class="primary" data-action="goto-create">Play again</button>
          <button data-action="goto-title">Title</button>
          <button data-action="goto-gallery">Visual Refs</button>
          <button data-action="open-sheet">Review character</button>
        </div>
      </div>
    </div>`,
    state,
  );
}

function renderGallery(state: AppState): string {
  const cards = VISUAL_REFS.map(
    (r) => `<article class="gallery-card panel">
      <img src="${r.src}" alt="${escapeHtml(r.title)}" loading="lazy" />
      <div>
        <h3>${escapeHtml(r.title)}</h3>
        <p class="muted">${escapeHtml(r.caption)}</p>
      </div>
    </article>`,
  ).join('');

  return shell(
    `<div class="panel">
      <div class="scene-head">
        <h2>Visual References</h2>
        <button data-action="goto-title">Back</button>
      </div>
      <p class="muted">Art direction plates for Crossfall, Flux, Ascension, companions, and the Axis Engine. Use these as the silhouette and material lock for production.</p>
      <div class="gallery-grid">${cards}</div>
    </div>`,
    state,
  );
}

function renderSheet(state: AppState): string {
  if (!state.save) return renderTitle(state);
  const p = state.save.player;
  const d = playerDerived(p);
  const held = playerPower(p, { output: 0.6, formId: p.formId ?? 'base' });
  const open = playerPower(p, {
    output: 1,
    formId: p.formId && p.formId !== 'base' ? p.formId : 'tempered_wake',
    ascended: true,
  });
  const battle = held.stats;
  const battleBoxes = (Object.keys(STAT_LABELS) as (keyof BattleStats)[])
    .map((k) => {
      const trained = p.trainedStats?.[k] ?? 0;
      return `<div class="stat-box attr-bar">
        <span class="muted">${STAT_LABELS[k]}</span>
        <b>${battle[k]}</b>
        <span class="mod">+${trained} train</span>
        <div class="bar attr"><i style="width:${Math.min(100, battle[k] / 4)}%"></i></div>
      </div>`;
    })
    .join('');
  const attrs = attributeBars(p.attributes)
    .map(
      (a) => `<div class="stat-box attr-bar">
        <span class="muted">${a.label}</span>
        <b>${a.value}</b>
        <span class="mod">${a.mod >= 0 ? '+' : ''}${a.mod}</span>
        <div class="bar attr"><i style="width:${Math.min(100, (a.value / 20) * 100)}%"></i></div>
      </div>`,
    )
    .join('');
  const bonds = Object.entries(state.save.relationships)
    .filter(([, r]) => r.recruited || r.approval !== 0 || r.trust !== 0)
    .map(([id, r]) => {
      const name = COMPANIONS[id]?.name ?? id;
      return `<div class="combatant"><div class="name">${escapeHtml(name)}</div><div class="statline"><span>Approval ${r.approval}</span><span>Trust ${r.trust}</span><span>${r.inParty ? 'In party' : 'Met'}</span></div></div>`;
    })
    .join('') || '<p class="muted">No bonds recorded yet.</p>';

  const formList = Object.values(FORMS)
    .map(
      (f) =>
        `<div class="bench ${held.formId === f.id ? 'beat' : ''}"><span>${escapeHtml(f.name)}</span><strong>×${f.multiplier}</strong></div>`,
    )
    .join('');

  const benches = RESONANCE_BENCHMARKS.map(
    (b) =>
      `<div class="bench ${held.powerLevel >= b.value ? 'beat' : ''}"><span>${escapeHtml(b.name)}</span><strong>${formatPL(b.value)}</strong></div>`,
  ).join('');

  return shell(
    `<div class="sheet-layout">
      <div class="panel aura-panel">
        <img src="./refs/ref-power-surge.png" alt="Power surge" />
        <div class="scanner-bar compact">
          <span class="res-label">POWER LEVEL</span>
          <div class="res-hero">${formatPL(held.powerLevel)}</div>
          <div class="muted">${held.formName} ×${held.formMultiplier} · stats ${held.statTotal} · anger ×${held.angerMult.toFixed(2)}</div>
          <div class="res-open">All-out / transformed: <strong>${formatPL(open.powerLevel)}</strong></div>
        </div>
      </div>
      <div class="panel">
        <div class="scene-head"><h2>${escapeHtml(p.name)}</h2><button data-action="close-sheet">Close</button></div>
        <p class="muted">${ORIGINS[p.origin].name} · ${DISCIPLINES[p.discipline].name} · ${p.convictions.map((c) => CONVICTIONS[c].name).join(' / ')}</p>
        <p class="muted">BYOND-style: every battle stat feeds one Power Level, then forms multiply it.</p>
        <div class="band-track">${bandTrack(held.band)
          .map(
            (b) =>
              `<span class="band-step ${b.reached ? 'reached' : ''} ${b.active ? 'active' : ''}">${escapeHtml(b.label)}</span>`,
          )
          .join('')}</div>
        <div class="statline resources" style="margin:0.6rem 0 1rem">
          <span>Health ${d.vitality}</span><span>Energy ${d.flux}</span><span>Defense ${d.guard}</span><span>Stun ${d.stagger}</span><span>Resolve ${p.resolve}</span><span>Lv ${p.level}</span>
        </div>
        <h3>Battle Stats → Power Level</h3>
        <div class="sheet-grid">${battleBoxes}</div>
        <h3>Form Multipliers</h3>
        <div class="bench-list">${formList}</div>
        <h3>Dice Attributes</h3>
        <div class="sheet-grid">${attrs}</div>
        <h3>Scanner Benchmarks</h3>
        <div class="bench-list">${benches}</div>
        <h3>Moves</h3>
        <p>${p.techniques.map((t) => TECHNIQUES[t]?.name ?? t).join(' · ')}</p>
        <h3>Bonds</h3>
        ${bonds}
        <div class="actions" style="margin-top:1rem">
          <button class="primary" data-action="open-story-ai">Story AI — train & grind</button>
        </div>
      </div>
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
