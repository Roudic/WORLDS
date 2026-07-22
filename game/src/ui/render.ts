import { TECHNIQUES } from '../data/catalog';
import { artForScene, VISUAL_REFS } from '../data/visuals';
import { activeCombatant, displayPower, livePower } from '../engine/combat';
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
  combatProfile,
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
  activeCharacter,
  activeWorld,
  playerDerived,
  visibleChoices,
} from '../state/game';
import { ENDINGS } from '../data/story';
import type { FluxBias, WorldFocus, WorldTone } from '../engine/types';
import { charactersOnWorld } from '../engine/characters';

export function render(state: AppState): string {
  switch (state.screen) {
    case 'title':
      return renderTitle(state);
    case 'create':
      return renderCreate(state);
    case 'characters':
      return renderCharacters(state);
    case 'worlds':
      return renderWorlds(state);
    case 'world_create':
      return renderWorldCreate(state);
    case 'event':
      return renderEvent(state);
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

  root.querySelectorAll('[data-world-draft]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = (el as HTMLElement).dataset.worldDraft!;
      const value = (el as HTMLElement).dataset.value!;
      dispatch({ type: 'SET_WORLD_DRAFT', patch: { [key]: value } });
    });
  });

  const nameInput = root.querySelector<HTMLInputElement>('#name-input');
  if (nameInput) {
    nameInput.addEventListener('change', () => {
      dispatch({ type: 'SET_DRAFT', patch: { name: nameInput.value } });
    });
  }

  const worldNameInput = root.querySelector<HTMLInputElement>('#world-name-input');
  if (worldNameInput) {
    worldNameInput.addEventListener('change', () => {
      dispatch({ type: 'SET_WORLD_DRAFT', patch: { name: worldNameInput.value } });
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
      dispatch({ type: 'OPEN_CREATE_CAMPAIGN' });
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
    case 'open-worlds':
      dispatch({ type: 'OPEN_WORLDS' });
      break;
    case 'open-characters':
      dispatch({ type: 'OPEN_CHARACTERS' });
      break;
    case 'open-create-character':
      dispatch({ type: 'OPEN_CREATE_CHARACTER' });
      break;
    case 'select-character':
      if (payload) dispatch({ type: 'SELECT_CHARACTER', characterId: payload });
      break;
    case 'place-character': {
      const [characterId, worldId] = (payload ?? '').split('|');
      if (characterId && worldId) {
        dispatch({ type: 'PLACE_CHARACTER', characterId, worldId });
      }
      break;
    }
    case 'open-world-create':
      dispatch({ type: 'OPEN_WORLD_CREATE' });
      break;
    case 'create-world':
      dispatch({ type: 'CREATE_WORLD' });
      break;
    case 'select-world':
      if (payload) dispatch({ type: 'SELECT_WORLD', worldId: payload });
      break;
    case 'set-world-focus':
      if (payload) dispatch({ type: 'SET_WORLD_FOCUS', focus: payload as WorldFocus });
      break;
    case 'raise-ceiling':
      dispatch({ type: 'RAISE_CEILING' });
      break;
    case 'roll-event':
      dispatch({ type: 'ROLL_EVENT', prefer: 'any' });
      break;
    case 'roll-battle':
      dispatch({ type: 'ROLL_EVENT', prefer: 'battle' });
      break;
    case 'travel-to':
      if (payload) dispatch({ type: 'TRAVEL_TO_WORLD', worldId: payload });
      break;
    case 'meet-character':
      if (payload) dispatch({ type: 'MEET_CHARACTER', characterId: payload });
      break;
    case 'resolve-event':
      if (payload) dispatch({ type: 'RESOLVE_EVENT', choiceId: payload });
      break;
    case 'legacy-trials':
      dispatch({ type: 'OPEN_LEGACY_TRIALS' });
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
            <button data-action="open-characters">Characters</button>
            <button data-action="open-worlds">Worlds</button>
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
      <p class="tagline">Forge characters and worlds. Station people where events find them — develop whoever you want, whenever you want.</p>
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
        <div class="scene-head"><h2>${state.createMode === 'roster' ? 'New Character' : 'Character Creation'}</h2><span class="meta">Origin · Discipline · Conviction</span></div>
        <div class="field"><label>Name</label><input id="name-input" value="${escapeHtml(d.name ?? '')}" maxlength="24" /></div>
        <h3>Origin</h3><div class="grid-2">${originCards}</div>
        <h3>Discipline</h3><div class="grid-2">${discCards}</div>
        <h3>Convictions (pick two)</h3><div class="grid-2" id="conviction-grid">${convCards}</div>
        <h3>Motivation</h3><div class="grid-2">${motCards}</div>
        <div class="actions" style="margin-top:1.2rem">
          <button data-action="${state.createMode === 'roster' ? 'open-characters' : 'goto-title'}">Back</button>
          <button data-action="goto-gallery">Visual Refs</button>
          <button class="primary" data-action="start-new">${
            state.createMode === 'roster' ? 'Add to roster' : 'Forge your path'
          }</button>
        </div>
      </div>
    </div>`,
    state,
  );
}

function renderCharacters(state: AppState): string {
  if (!state.save) return renderTitle(state);
  const chars = state.save.characters ?? [];
  const ch = activeCharacter(state.save);
  const worlds = state.save.worlds ?? [];
  const dice = state.lastDiceText
    ? `<p class="dice-line">${escapeHtml(state.lastDiceText)}</p>`
    : '';

  const list =
    chars.length === 0
      ? `<p class="muted">No characters yet. Create one, place them on a world, then roll events around them.</p>`
      : `<div class="grid-2 world-list">${chars
          .map((c) => {
            const active = c.id === ch?.id;
            const worldName =
              worlds.find((w) => w.id === c.worldId)?.name ?? 'Unplaced';
            const pl = formatPL(
              playerPower(c.build, { formId: c.build.formId ?? 'base' }).powerLevel,
            );
            const pending = c.currentEvent ? ' · Event pending' : '';
            return `<button class="option ${active ? 'selected' : ''}" data-action="select-character" data-payload="${c.id}">
              <strong>${escapeHtml(c.build.name)}${active ? ' · Active' : ''}${pending}</strong>
              <small>${ORIGINS[c.build.origin].name} · ${DISCIPLINES[c.build.discipline].name} · PL ${pl}<br/>${escapeHtml(worldName)}</small>
            </button>`;
          })
          .join('')}</div>`;

  const placeButtons =
    ch && worlds.length
      ? `<div class="chip-row">
          ${worlds
            .map(
              (w) =>
                `<button class="${ch.worldId === w.id ? 'selected' : ''}" data-action="place-character" data-payload="${ch.id}|${w.id}">${escapeHtml(w.name)}</button>`,
            )
            .join('')}
        </div>`
      : worlds.length === 0
        ? `<p class="muted">Create a world first, then station this character there.</p>
           <button data-action="open-world-create">Create world</button>`
        : '';

  const travelButtons =
    ch && worlds.length > 1
      ? `<div class="chip-row">
          ${worlds
            .filter((w) => w.id !== ch.worldId)
            .map(
              (w) =>
                `<button data-action="travel-to" data-payload="${w.id}">Travel → ${escapeHtml(w.name)}</button>`,
            )
            .join('')}
        </div>`
      : worlds.length <= 1
        ? `<p class="muted">Create another world to open travel roads (safe path or hot road with battle).</p>`
        : '';

  const hereWith = ch?.worldId
    ? (state.save.characters ?? []).filter(
        (c) => c.id !== ch.id && c.worldId === ch.worldId,
      )
    : [];
  const meetButtons = ch?.worldId
    ? hereWith.length
      ? `<div class="chip-row">
          ${hereWith
            .map(
              (c) =>
                `<button data-action="meet-character" data-payload="${c.id}">Meet ${escapeHtml(c.build.name)}</button>`,
            )
            .join('')}
        </div>`
      : `<p class="muted">No other roster characters on this world. Place or travel someone here to meet.</p>`
    : `<p class="muted">Station them first to meet others on the same world.</p>`;

  const log = (ch?.developmentLog ?? state.save.developmentLog ?? []).slice(0, 6);
  const journal =
    log.length === 0
      ? '<p class="muted">This character’s journal fills as events around them resolve — every gain has a reason.</p>'
      : `<ul class="log-list dev-log">${log
          .map(
            (e) => `<li><strong>${escapeHtml(e.eventTitle)}</strong> — ${escapeHtml(e.reason)}
            <span class="meta">${escapeHtml(e.worldName)} · ${e.gains.map(escapeHtml).join(' · ')}</span></li>`,
          )
          .join('')}</ul>`;

  const canAct = !!(ch && (ch.worldId || worlds[0]));
  const manage = ch
    ? `<div class="panel world-manage">
        <div class="scene-head">
          <h2>${escapeHtml(ch.build.name)}</h2>
          <span class="meta">${ORIGINS[ch.build.origin].name} · ${DISCIPLINES[ch.build.discipline].name}</span>
        </div>
        <p class="lede">Lv ${ch.build.level} · Resolve ${ch.build.resolve} · PL <strong>${formatPL(
          playerPower(ch.build, { formId: ch.build.formId ?? 'base' }).powerLevel,
        )}</strong></p>
        <p class="muted">Convictions: ${ch.build.convictions.map((c) => CONVICTIONS[c].name).join(' / ')}</p>
        <h3>Station</h3>
        <p class="muted">Instant place (no road event). Use Travel for roads that can turn into battles.</p>
        ${placeButtons}
        <h3>Travel</h3>
        ${travelButtons}
        <h3>Meet</h3>
        ${meetButtons}
        <h3>Start events</h3>
        <div class="actions" style="margin-top:0.5rem">
          <button class="primary" data-action="roll-event" ${canAct ? '' : 'disabled'}>Any event</button>
          <button data-action="roll-battle" ${canAct ? '' : 'disabled'}>Battle event</button>
          <button data-action="open-sheet">Stats</button>
          <button data-action="open-worlds">Worlds</button>
        </div>
        ${
          ch.currentEvent
            ? `<p class="dice-line">Pending: <strong>${escapeHtml(ch.currentEvent.title)}</strong> — <button data-action="select-character" data-payload="${ch.id}">Continue event</button></p>`
            : ''
        }
      </div>`
    : `<div class="panel"><div class="actions"><button class="primary" data-action="open-create-character">Create your first character</button></div></div>`;

  return shell(
    `<div class="worlds-layout">
      <div class="panel">
        <div class="scene-head"><h2>Character Roster</h2><span class="meta">Travel · meet · battle · follow</span></div>
        <p class="lede">Station people, send them on roads, meet allies on the same world, and roll battle events into the combat system.</p>
        ${list}
        <div class="actions" style="margin-top:1rem">
          <button class="primary" data-action="open-create-character">New character</button>
          <button data-action="open-worlds">World Hub</button>
          <button data-action="legacy-trials">Legacy Trials</button>
        </div>
        ${dice}
      </div>
      ${manage}
      <div class="panel">
        <div class="scene-head"><h2>Their development</h2><span class="meta">${ch ? escapeHtml(ch.build.name) : '—'}</span></div>
        ${journal}
      </div>
    </div>`,
    state,
    { showNav: true },
  );
}

const TONES: { id: WorldTone; label: string; blurb: string }[] = [
  { id: 'discovery', label: 'Discovery', blurb: 'Wells, maps, rising currents' },
  { id: 'war', label: 'War', blurb: 'High ceiling, hot threat' },
  { id: 'intrigue', label: 'Intrigue', blurb: 'Factions, decrees, knives' },
  { id: 'survival', label: 'Survival', blurb: 'District slips, scarce stability' },
  { id: 'ascension', label: 'Ascension', blurb: 'Multiplier hunger, mastery' },
  { id: 'politics', label: 'Politics', blurb: 'Names on the decree' },
];

const BIASES: { id: FluxBias; label: string }[] = [
  { id: 'pulse', label: 'Pulse' },
  { id: 'aether', label: 'Aether' },
  { id: 'lumen', label: 'Lumen' },
  { id: 'riftforce', label: 'Riftforce' },
  { id: 'hybrid', label: 'Hybrid' },
];

const FOCI: { id: WorldFocus; label: string }[] = [
  { id: 'balance', label: 'Balance' },
  { id: 'stabilize', label: 'Stabilize' },
  { id: 'empower', label: 'Empower' },
  { id: 'story', label: 'Story' },
];

function renderWorlds(state: AppState): string {
  if (!state.save) return renderTitle(state);
  const worlds = state.save.worlds ?? [];
  const world = activeWorld(state.save);
  const log = (state.save.developmentLog ?? []).slice(0, 6);
  const dice = state.lastDiceText
    ? `<p class="dice-line">${escapeHtml(state.lastDiceText)}</p>`
    : '';

  const list =
    worlds.length === 0
      ? `<p class="muted">No worlds yet. Create one — then roll random events that grow your character with named reasons.</p>`
      : `<div class="grid-2 world-list">${worlds
          .map((w) => {
            const active = w.id === world?.id;
            return `<button class="option ${active ? 'selected' : ''}" data-action="select-world" data-payload="${w.id}">
              <strong>${escapeHtml(w.name)}${active ? ' · Active' : ''}</strong>
              <small>${w.tone} · ceiling ${formatPL(w.powerCeiling)} · story ${w.storyProgress}%</small>
            </button>`;
          })
          .join('')}</div>`;

  const stationed = world ? charactersOnWorld(state.save, world.id) : [];
  const stationedLine = world
    ? stationed.length
      ? `<p class="muted">Stationed: ${stationed.map((c) => escapeHtml(c.build.name)).join(' · ')}</p>`
      : `<p class="muted">No one stationed here yet — place characters from the roster.</p>`
    : '';

  const manage = world
    ? `<div class="panel world-manage">
        <div class="scene-head">
          <h2>${escapeHtml(world.name)}</h2>
          <span class="meta">${escapeHtml(world.era)} · ${world.fluxBias}</span>
        </div>
        <p class="lede">Arc: <em>${escapeHtml(world.storyArc)}</em> (${world.storyProgress}%)</p>
        <div class="stat-row">
          <span>Stability <strong>${world.stability}</strong></span>
          <span>Threat <strong>${world.threatLevel}</strong></span>
          <span>PL ceiling <strong>${formatPL(world.powerCeiling)}</strong></span>
          <span>Events <strong>${world.eventCount}</strong></span>
        </div>
        <p class="muted">Factions: ${world.factions.map(escapeHtml).join(' · ')}</p>
        ${stationedLine}
        <h3>Manage focus</h3>
        <div class="chip-row">
          ${FOCI.map(
            (f) =>
              `<button class="${world.focus === f.id ? 'selected' : ''}" data-action="set-world-focus" data-payload="${f.id}">${f.label}</button>`,
          ).join('')}
        </div>
        <div class="actions" style="margin-top:1rem">
          <button class="primary" data-action="roll-battle">Battle event</button>
          <button data-action="roll-event">Any event</button>
          <button data-action="raise-ceiling">Raise power ceiling</button>
          <button data-action="open-world-create">Create another world</button>
          <button data-action="open-characters">Character roster</button>
        </div>
        <h3>World history</h3>
        <ul class="log-list">${world.history
          .slice(-6)
          .reverse()
          .map((h) => `<li>${escapeHtml(h)}</li>`)
          .join('')}</ul>
      </div>`
    : `<div class="panel"><div class="actions"><button class="primary" data-action="open-world-create">Create your first world</button></div></div>`;

  const journal =
    log.length === 0
      ? '<p class="muted">Campaign journal fills as events resolve across characters — every gain has a reason.</p>'
      : `<ul class="log-list dev-log">${log
          .map(
            (e) => `<li><strong>${escapeHtml(e.characterName ?? 'Wanderer')}</strong> · ${escapeHtml(e.eventTitle)} — ${escapeHtml(e.reason)}
            <span class="meta">${e.gains.map(escapeHtml).join(' · ')}</span></li>`,
          )
          .join('')}</ul>`;

  return shell(
    `<div class="worlds-layout">
      <div class="panel">
        <div class="scene-head"><h2>World Hub</h2><span class="meta">Create · manage · progress</span></div>
        <p class="lede">Manage power ceilings, stability, threat, and story arcs. Characters stationed here catch random events.</p>
        ${list}
        <div class="actions" style="margin-top:1rem">
          <button class="primary" data-action="open-world-create">New world</button>
          <button data-action="open-characters">Characters</button>
          <button data-action="legacy-trials">Legacy Trials</button>
          <button data-action="open-sheet">Stats</button>
        </div>
        ${dice}
      </div>
      ${manage}
      <div class="panel">
        <div class="scene-head"><h2>Campaign development</h2><span class="meta">All characters</span></div>
        ${journal}
      </div>
    </div>`,
    state,
    { showNav: true },
  );
}

function renderWorldCreate(state: AppState): string {
  if (!state.save) return renderTitle(state);
  const d = state.worldDraft;
  const toneCards = TONES.map(
    (t) => `<button class="option ${d.tone === t.id ? 'selected' : ''}" data-world-draft="tone" data-value="${t.id}">
      <strong>${t.label}</strong><small>${t.blurb}</small>
    </button>`,
  ).join('');
  const biasCards = BIASES.map(
    (b) => `<button class="option ${d.fluxBias === b.id ? 'selected' : ''}" data-world-draft="fluxBias" data-value="${b.id}">
      <strong>${b.label}</strong>
    </button>`,
  ).join('');

  return shell(
    `<div class="panel narrow">
      <div class="scene-head"><h2>Create World</h2><span class="meta">Tone sets ceiling & pressure</span></div>
      <div class="field"><label>Name (optional)</label>
        <input id="world-name-input" value="${escapeHtml(d.name)}" maxlength="32" placeholder="Leave blank for a generated name" />
      </div>
      <h3>Tone</h3><div class="grid-2">${toneCards}</div>
      <h3>Flux bias</h3><div class="grid-2">${biasCards}</div>
      <div class="actions" style="margin-top:1.2rem">
        <button data-action="open-worlds">Back</button>
        <button class="primary" data-action="create-world">Forge world</button>
      </div>
    </div>`,
    state,
    { showNav: true },
  );
}

function renderEvent(state: AppState): string {
  if (!state.save) return renderTitle(state);
  const ch = activeCharacter(state.save);
  const event = ch?.currentEvent ?? state.save.currentEvent;
  if (!event) return renderCharacters(state);
  const world =
    (state.save.worlds ?? []).find((w) => w.id === ch?.worldId) ?? activeWorld(state.save);
  const choices = event.choices
    .map(
      (c) => `<button data-action="resolve-event" data-payload="${c.id}">
        <strong>${escapeHtml(c.label)}</strong>
        <span class="hint">${escapeHtml(c.hint ?? '')}</span>
      </button>`,
    )
    .join('');

  return shell(
    `<div class="panel event-panel">
      <div class="scene-head">
        <h2>${escapeHtml(event.title)}</h2>
        <span class="meta">${escapeHtml(event.tag)}${ch ? ` · ${escapeHtml(ch.build.name)}` : ''}${world ? ` · ${escapeHtml(world.name)}` : ''}</span>
      </div>
      <p class="lede">${escapeHtml(event.body)}</p>
      <p class="muted">Pick a path — dice decide the margin. Battle choices drop into combat; travel moves worlds; meets can spar roster mates.</p>
      <div class="choice-stack">${choices}</div>
      <div class="actions" style="margin-top:1rem">
        <button data-action="open-characters">Back to roster</button>
        <button data-action="open-worlds">Worlds</button>
      </div>
    </div>`,
    state,
    { showNav: true },
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
          <button class="primary" data-action="open-worlds">World Hub</button>
          <button data-action="roll-event">Roll random event</button>
          <button data-action="open-story-ai">Story AI grind</button>
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
      const profile = combatProfile(res.stats);
      const shownPL = scanned ? livePower(c) : displayPower(c);
      const deceiving = !scanned && !!c.suppression && !c.revealed;
      const aura = c.ascended || c.output >= 0.9 || c.statuses.includes('aura') ? ' aura' : '';
      const surge = c.output >= 0.85 ? ' surge' : '';
      const mo = Math.max(-100, Math.min(100, c.momentum ?? 0));
      const moPct = Math.round(((mo + 100) / 200) * 100);
      const moClass = mo >= 55 ? 'hot' : mo <= -55 ? 'cold' : '';
      const chips = [
        c.ascended ? `<span class="chip form">${escapeHtml(res.formName)}</span>` : '',
        c.depthsAwakened ? '<span class="chip serious">HIDDEN DEPTHS</span>' : '',
        c.revealed ? '<span class="chip revealed">TRUE POWER</span>' : '',
        deceiving ? '<span class="chip masked-chip">reading soft…</span>' : '',
        mo >= 80 ? '<span class="chip tempo">TEMPO</span>' : '',
      ]
        .filter(Boolean)
        .join('');
      return `<div class="combatant${aura}${surge} ${c.id === active.id ? 'active' : ''} ${c.alive ? '' : 'down'}">
        <div class="name"><span>${escapeHtml(c.name)}</span><span class="band-chip">${escapeHtml(res.bandLabel)} · ${escapeHtml(profile.label)}</span></div>
        <div class="res-readout ${scanned ? 'known' : deceiving ? 'deceiving' : 'masked'}">
          <span class="res-label">PL</span>
          <strong class="res-num">${scanned ? formatPL(shownPL) : deceiving ? `~${formatPL(shownPL)}` : '????'}</strong>
          <span class="muted">${scanned ? `${outputLabel(c.output)} ${Math.round(c.output * 100)}%` : deceiving ? 'unscanned · may be masking' : 'not scanned'}</span>
        </div>
        ${chips ? `<div class="chip-row">${chips}</div>` : ''}
        <div class="bars">
          <div class="bar hp"><i style="width:${hp}%"></i></div>
          <div class="bar flux"><i style="width:${flux}%"></i></div>
          <div class="bar stagger"><i style="width:${st}%"></i></div>
          <div class="bar momentum ${moClass}"><i style="width:${moPct}%"></i></div>
        </div>
        <div class="statline">
          <span>Health ${c.vitality}/${c.maxVitality}</span>
          <span>Energy ${c.flux}/${c.maxFlux}</span>
          <span>Stun ${c.stagger}/${c.maxStagger}</span>
          <span>Tempo ${mo > 0 ? '+' : ''}${mo}</span>
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
          <button class="primary" data-action="open-characters">Character roster</button>
          <button data-action="roll-event">Roll event</button>
          <button data-action="open-worlds">World Hub</button>
        </div>
      </div>
    </div>`,
    state,
    { showNav: true },
  );
}

function escapeHtml(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
