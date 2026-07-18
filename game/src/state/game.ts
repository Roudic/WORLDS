import {
  buildStarterAttributes,
  playerDerived,
} from '../engine/attributes';
import { isSuccess, makeCheck } from '../engine/dice';
import type {
  ConvictionId,
  EndingId,
  FluxBias,
  PlayerBuild,
  Relationship,
  SaveGame,
  ScreenId,
  WorldFocus,
  WorldTone,
} from '../engine/types';
import {
  COMPANIONS,
  CONVICTIONS,
  DISCIPLINES,
  MOTIVATIONS,
  ORIGINS,
  starterTechniques,
} from '../data/catalog';
import { buildEncounter } from '../data/encounters';
import { ENDINGS, SCENES, type ChoiceEffect, type StoryChoice } from '../data/story';
import {
  activateAscension,
  activeCombatant,
  attemptConvince,
  powerUp,
  resolveClashBeat,
  runEnemyTurns,
  scanResonance,
  suppressOutput,
  useTechnique,
  type CombatState,
} from '../engine/combat';
import {
  activeWorld,
  createWorld,
  raiseCeiling,
  setWorldFocus,
} from '../engine/worlds';
import { applyAiChoice, generateAiHub, openStoryAi } from '../story/director';
import { resolveEventChoice, rollWorldEvent } from '../story/events';

const SAVE_KEY = 'riftwake.save.v2';

export interface WorldDraft {
  name: string;
  tone: WorldTone;
  fluxBias: FluxBias;
}

export interface AppState {
  screen: ScreenId;
  draft: Partial<PlayerBuild> & {
    motivationId?: string;
    convictionA?: ConvictionId;
    convictionB?: ConvictionId;
  };
  worldDraft: WorldDraft;
  save: SaveGame | null;
  combat: CombatState | null;
  returnSceneId: string | null;
  lastDiceText: string | null;
  endingId: EndingId | null;
  toast: string | null;
}

function emptyRelationship(): Relationship {
  return {
    approval: 0,
    trust: 0,
    alive: true,
    recruited: false,
    inParty: false,
  };
}

export function createNewSave(player: PlayerBuild): SaveGame {
  const relationships: Record<string, Relationship> = {
    sori: emptyRelationship(),
    tamsin: emptyRelationship(),
    ivo: emptyRelationship(),
    vexa: { ...emptyRelationship(), approval: 0 },
    maelin: { ...emptyRelationship(), approval: 1, trust: 1 },
  };
  return {
    version: 3,
    player,
    relationships,
    flags: {},
    sceneId: 'arrival_gate',
    partyIds: [],
    hubUnlocked: ['gate', 'clinic', 'arena'],
    chapter: 1,
    log: ['Campaign begun — forge a world, then chase random events that shape who you become.'],
    aiBeat: null,
    storySeed: Date.now() % 1_000_000,
    trainCount: 0,
    worlds: [],
    activeWorldId: null,
    currentEvent: null,
    developmentLog: [],
  };
}

export function initialAppState(): AppState {
  const loaded = loadSave();
  return {
    screen: 'title',
    draft: {
      name: 'Ashen Vale',
      origin: 'crossborn',
      discipline: 'channeler',
      motivationId: 'answers',
      convictionA: 'mercy',
      convictionB: 'truth',
    },
    worldDraft: {
      name: '',
      tone: 'discovery',
      fluxBias: 'pulse',
    },
    save: loaded,
    combat: null,
    returnSceneId: null,
    lastDiceText: null,
    endingId: null,
    toast: null,
  };
}

function migrateSave(save: SaveGame): SaveGame {
  save.version = 3;
  save.player.trainedStats = save.player.trainedStats ?? {};
  save.player.formId = save.player.formId ?? 'base';
  save.trainCount = save.trainCount ?? 0;
  save.storySeed = save.storySeed ?? Date.now() % 1_000_000;
  save.worlds = save.worlds ?? [];
  save.activeWorldId = save.activeWorldId ?? save.worlds[0]?.id ?? null;
  save.currentEvent = save.currentEvent ?? null;
  save.developmentLog = save.developmentLog ?? [];
  if (save.sceneId === 'ai_runtime' && !save.aiBeat) {
    save.aiBeat = generateAiHub(save);
  }
  return save;
}

export function loadSave(): SaveGame | null {
  try {
    const raw =
      localStorage.getItem(SAVE_KEY) ?? localStorage.getItem('riftwake.save.v1');
    if (!raw) return null;
    return migrateSave(JSON.parse(raw) as SaveGame);
  } catch {
    return null;
  }
}

function patchActiveWorld(save: SaveGame, world: NonNullable<ReturnType<typeof activeWorld>>): SaveGame {
  const worlds = (save.worlds ?? []).map((w) => (w.id === world.id ? world : w));
  return { ...save, worlds, activeWorldId: world.id };
}

export function persistSave(save: SaveGame) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function finalizeDraft(draft: AppState['draft']): PlayerBuild {
  const origin = draft.origin ?? 'crossborn';
  const discipline = draft.discipline ?? 'channeler';
  const motivation = MOTIVATIONS.find((m) => m.id === draft.motivationId) ?? MOTIVATIONS[2];
  const a = draft.convictionA ?? 'mercy';
  const b = draft.convictionB ?? 'truth';
  const attrs = draft.attributes ?? buildStarterAttributes(origin, discipline);
  return {
    name: (draft.name ?? 'Wanderer').trim() || 'Wanderer',
    origin,
    discipline,
    convictions: [a, b],
    motivation: motivation.id,
    attributes: attrs,
    techniques: starterTechniques(discipline),
    level: 3,
    resolve: 3,
    powerBand: 'mortal',
    ascensionUnlocked: false,
    ascensionMastery: 0,
    catalystReady: false,
    trainedStats: {},
    formId: 'base',
  };
}

function flagMatch(
  flags: SaveGame['flags'],
  req?: Record<string, boolean | number | string>,
): boolean {
  if (!req) return true;
  return Object.entries(req).every(([k, v]) => flags[k] === v);
}

export function visibleChoices(save: SaveGame, choices: StoryChoice[]): StoryChoice[] {
  return choices.filter((c) => {
    if (!flagMatch(save.flags, c.requireFlags)) return false;
    if (c.hideIfFlags && Object.entries(c.hideIfFlags).some(([k, v]) => save.flags[k] === v)) {
      return false;
    }
    if (c.requireConviction && !save.player.convictions.includes(c.requireConviction)) {
      return false;
    }
    if (c.requireCompanion && !save.partyIds.includes(c.requireCompanion)) {
      return false;
    }
    if (c.requireResolve && save.player.resolve < c.requireResolve) return false;
    // Special: breakthrough needs catalyst-ish flag
    if (c.id === 'breakthrough') {
      const ready =
        save.player.catalystReady ||
        save.flags['Catalyst.TemperedWake'] ||
        save.flags['Catalyst.Partial'] ||
        save.flags['Mentor.Passed'];
      if (!ready) return false;
    }
    // Stabilize availability soft-gated in ending resolution, choice always shown
    return true;
  });
}

export function applyEffects(save: SaveGame, effects: ChoiceEffect): {
  save: SaveGame;
  combatId?: string;
  goTo?: string;
  ending?: EndingId;
  diceText?: string;
} {
  const next: SaveGame = structuredClone(save);
  let diceText: string | undefined;

  if (effects.setFlags) {
    Object.assign(next.flags, effects.setFlags);
  }
  if (effects.addApproval) {
    for (const [id, n] of Object.entries(effects.addApproval)) {
      if (!next.relationships[id]) next.relationships[id] = emptyRelationship();
      next.relationships[id].approval += n;
    }
  }
  if (effects.addTrust) {
    for (const [id, n] of Object.entries(effects.addTrust)) {
      if (!next.relationships[id]) next.relationships[id] = emptyRelationship();
      next.relationships[id].trust += n;
    }
  }
  if (effects.spendResolve) {
    next.player.resolve = Math.max(0, next.player.resolve - effects.spendResolve);
  }
  if (effects.gainResolve) {
    next.player.resolve += effects.gainResolve;
  }
  if (effects.unlockCatalyst) {
    next.player.catalystReady = true;
  }
  if (effects.recruit) {
    const id = effects.recruit;
    if (!next.relationships[id]) next.relationships[id] = emptyRelationship();
    next.relationships[id].recruited = true;
    next.relationships[id].inParty = true;
    if (!next.partyIds.includes(id)) next.partyIds.push(id);
  }
  if (effects.party) {
    next.partyIds = Array.from(new Set([...next.partyIds, ...effects.party])).slice(0, 3);
    for (const id of effects.party) {
      if (!next.relationships[id]) next.relationships[id] = emptyRelationship();
      next.relationships[id].recruited = true;
      next.relationships[id].inParty = true;
    }
  }

  if (effects.attributeCheck) {
    const chk = effects.attributeCheck;
    let situation = 0;
    if (chk.attribute === 'intellect' && next.partyIds.includes('ivo')) situation += 2;
    if (chk.attribute === 'presence' && next.partyIds.includes('sori')) situation += 1;
    if (next.flags['Knowledge.Sabotage'] && chk.attribute === 'intellect') situation += 1;

    const roll = makeCheck({
      rollType: `${chk.attribute} check`,
      attributeValue: next.player.attributes[chk.attribute],
      proficiency: chk.proficiency ?? Math.floor(next.player.level / 2),
      situation,
      dc: chk.dc,
      useRiftDie: chk.useRiftDie,
    });
    diceText = `${roll.narrative} (d20 ${roll.chosenDie} + ${roll.attributeModifier} + ${roll.proficiency} + ${roll.situationModifiers} = ${roll.total} vs DC ${roll.targetDc})`;
    if (roll.riftEvent) diceText += ` | Rift ${roll.riftDie}: ${roll.riftEvent}`;
    next.log.push(diceText);

    const success = isSuccess(roll.outcomeTier);
    // Partial catalyst can still unlock on success
    if (success && next.flags['Tried.Breakthrough']) {
      next.player.ascensionUnlocked = true;
      next.player.powerBand = 'awakened';
    }
    return {
      save: next,
      goTo: success ? chk.successGoTo : chk.failGoTo,
      combatId: effects.startCombat,
      diceText,
    };
  }

  if (effects.ending) {
    return { save: next, ending: effects.ending as EndingId, diceText };
  }

  return {
    save: next,
    goTo: effects.goTo,
    combatId: effects.startCombat,
    diceText,
  };
}

export function resolveEnding(save: SaveGame, ending: EndingId): {
  save: SaveGame;
  title: string;
  body: string;
} {
  const next = structuredClone(save);
  next.flags['Ending.Id'] = ending;

  if (ending === 'stabilize') {
    const prep =
      !!next.flags['Knowledge.Axis.Sabotage'] &&
      (!!next.flags['Knowledge.Axis.CoreAccess'] ||
        next.partyIds.length >= 1 ||
        Object.values(next.relationships).some((r) => r.trust >= 2));
    next.flags['Ending.Stabilize.Success'] = prep;
  }

  if (ending === 'synchronize') {
    next.player.powerBand = 'awakened';
    next.player.ascensionUnlocked = true;
    next.flags['Ascension.RiftSync'] = true;
  }

  const def = ENDINGS[ending] ?? ENDINGS.lose;
  const body = def.summary(next.flags);
  next.log.push(`Ending: ${def.title}`);
  return { save: next, title: def.title, body };
}

export function startCombatFrom(
  state: AppState,
  combatId: string,
  returnSceneId: string,
): AppState {
  if (!state.save) return state;
  let player = state.save.player;
  if (state.save.flags['Ascension.TemperedWake']) {
    player = {
      ...player,
      ascensionUnlocked: true,
      powerBand: 'awakened',
      catalystReady: true,
    };
  }
  const combat = buildEncounter(combatId, player, state.save.partyIds);
  if (!combat) {
    return { ...state, toast: `Missing encounter ${combatId}` };
  }
  // Auto-ascend if already in a multiplied form
  let c = combat;
  const form = state.save.player.formId;
  if (
    form &&
    form !== 'base' &&
    (state.save.flags['Ascension.TemperedWake'] || state.save.player.ascensionUnlocked)
  ) {
    c = activateAscension(
      c,
      'player',
      form === 'rift_sync' ? 'rift_sync' : 'tempered_wake',
      true,
    );
  } else if (state.save.flags['Ascension.TemperedWake']) {
    c = activateAscension(c, 'player', 'tempered_wake', true);
  }
  // Advance any non-player turns (companions / stragglers) until you can act
  c = runEnemyTurns(c);
  return {
    ...state,
    screen: c.pendingClash ? 'clash' : 'combat',
    combat: c,
    returnSceneId,
    save: { ...state.save, player },
    toast: c.pendingClash
      ? 'Power clash! Choose how you meet their attack.'
      : 'Your turn — attack, power up, or scan their rating.',
  };
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GOTO':
      return { ...state, screen: action.screen, toast: null };
    case 'SET_DRAFT':
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case 'START_NEW': {
      const player = finalizeDraft(state.draft);
      const save = createNewSave(player);
      persistSave(save);
      return {
        ...state,
        save,
        screen: 'worlds',
        endingId: null,
        lastDiceText: null,
        toast: 'Create a world — then roll random events that grow you with reasons.',
      };
    }
    case 'CONTINUE': {
      const save = loadSave();
      if (!save) return { ...state, toast: 'No save found.' };
      if (save.flags['Ending.Id']) {
        return {
          ...state,
          save,
          screen: 'ending',
          endingId: save.flags['Ending.Id'] as EndingId,
        };
      }
      const screen: ScreenId = save.currentEvent
        ? 'event'
        : (save.worlds?.length ?? 0) > 0 || save.version === 3
          ? 'worlds'
          : 'scene';
      return { ...state, save, screen, endingId: null };
    }
    case 'SET_WORLD_DRAFT':
      return { ...state, worldDraft: { ...state.worldDraft, ...action.patch } };
    case 'OPEN_WORLDS':
      return { ...state, screen: 'worlds', toast: null };
    case 'OPEN_WORLD_CREATE':
      return { ...state, screen: 'world_create', toast: null };
    case 'CREATE_WORLD': {
      if (!state.save) return state;
      const world = createWorld({
        name: state.worldDraft.name,
        tone: state.worldDraft.tone,
        fluxBias: state.worldDraft.fluxBias,
      });
      const save: SaveGame = {
        ...state.save,
        worlds: [...(state.save.worlds ?? []), world],
        activeWorldId: world.id,
        log: [
          ...state.save.log,
          `World forged: ${world.name} (${world.tone}, ceiling ${world.powerCeiling}).`,
        ],
      };
      persistSave(save);
      return {
        ...state,
        save,
        screen: 'worlds',
        toast: `${world.name} is live — set focus, raise the ceiling, or roll an event.`,
      };
    }
    case 'SELECT_WORLD': {
      if (!state.save) return state;
      const exists = (state.save.worlds ?? []).some((w) => w.id === action.worldId);
      if (!exists) return { ...state, toast: 'World not found.' };
      const save = { ...state.save, activeWorldId: action.worldId, currentEvent: null };
      persistSave(save);
      return { ...state, save, screen: 'worlds', toast: 'Active world switched.' };
    }
    case 'SET_WORLD_FOCUS': {
      if (!state.save) return state;
      const world = activeWorld(state.save);
      if (!world) return { ...state, toast: 'Create a world first.' };
      const save = patchActiveWorld(state.save, setWorldFocus(world, action.focus));
      persistSave(save);
      return { ...state, save, toast: `World focus → ${action.focus}` };
    }
    case 'RAISE_CEILING': {
      if (!state.save) return state;
      const world = activeWorld(state.save);
      if (!world) return { ...state, toast: 'Create a world first.' };
      const raised = raiseCeiling(world);
      const save = patchActiveWorld(state.save, raised);
      persistSave(save);
      return {
        ...state,
        save,
        toast: `Power ceiling raised to ${raised.powerCeiling}.`,
      };
    }
    case 'ROLL_EVENT': {
      if (!state.save) return state;
      const world = activeWorld(state.save);
      if (!world) return { ...state, toast: 'Create a world first.', screen: 'world_create' };
      const event = rollWorldEvent(state.save, world);
      const save = { ...state.save, currentEvent: event };
      persistSave(save);
      return {
        ...state,
        save,
        screen: 'event',
        lastDiceText: null,
        toast: 'A random event lands — your choice writes the reason for the gain.',
      };
    }
    case 'RESOLVE_EVENT': {
      if (!state.save || !state.save.currentEvent) return state;
      const world = activeWorld(state.save);
      if (!world) return { ...state, toast: 'No active world.', screen: 'worlds' };
      const result = resolveEventChoice(
        state.save,
        world,
        state.save.currentEvent,
        action.choiceId,
      );
      const save = patchActiveWorld(
        { ...result.save, currentEvent: null },
        result.world,
      );
      persistSave(save);
      return {
        ...state,
        save,
        screen: 'worlds',
        lastDiceText: result.diceText,
        toast: result.toast,
      };
    }
    case 'OPEN_LEGACY_TRIALS': {
      if (!state.save) return state;
      return {
        ...state,
        screen: 'scene',
        toast: 'Legacy Crossfall Trials — optional authored path.',
      };
    }
    case 'CHOICE': {
      if (!state.save) return state;
      const scene = SCENES[state.save.sceneId];
      const choice = scene.choices.find((c) => c.id === action.choiceId);
      if (!choice) return state;
      const result = applyEffects(state.save, choice.effects);
      let save = result.save;

      if (result.ending) {
        // Soft-gate stabilize failure still allowed
        const ended = resolveEnding(save, result.ending);
        persistSave(ended.save);
        return {
          ...state,
          save: ended.save,
          screen: 'ending',
          endingId: result.ending,
          lastDiceText: result.diceText ?? state.lastDiceText,
          toast: null,
        };
      }

      if (result.combatId) {
        const returnTo = result.goTo ?? save.sceneId;
        if (result.goTo) save.sceneId = result.goTo;
        const sceneObj = SCENES[save.sceneId];
        if (sceneObj) save.chapter = sceneObj.chapter;
        persistSave(save);
        return startCombatFrom(
          { ...state, save, lastDiceText: result.diceText ?? null },
          result.combatId,
          returnTo,
        );
      }

      if (result.goTo) {
        save.sceneId = result.goTo;
        const sceneObj = SCENES[save.sceneId];
        if (sceneObj) save.chapter = sceneObj.chapter;
        if (result.goTo === 'ai_runtime') {
          save = openStoryAi(save);
        }
      }
      persistSave(save);
      return {
        ...state,
        save,
        lastDiceText: result.diceText ?? null,
        toast: null,
      };
    }
    case 'AI_CHOICE': {
      if (!state.save) return state;
      const result = applyAiChoice(state.save, action.choiceId);
      let save = result.save;
      if (result.goAuthored) {
        save.sceneId = result.goAuthored;
        save.aiBeat = null;
      } else {
        save.sceneId = 'ai_runtime';
      }
      persistSave(save);
      if (result.combatId) {
        return startCombatFrom(
          {
            ...state,
            save,
            lastDiceText: result.diceText ?? null,
            toast: result.toast ?? null,
          },
          result.combatId,
          'ai_runtime',
        );
      }
      return {
        ...state,
        save,
        screen: 'scene',
        lastDiceText: result.diceText ?? null,
        toast: result.toast ?? null,
      };
    }
    case 'OPEN_STORY_AI': {
      if (!state.save) return state;
      const save = openStoryAi(state.save);
      persistSave(save);
      return {
        ...state,
        save,
        screen: 'scene',
        toast: 'Story AI online — train, spar, transform, follow threads.',
      };
    }
    case 'COMBAT_TECH': {
      if (!state.combat || !state.save) return state;
      let combat = useTechnique(
        state.combat,
        action.actorId,
        action.techniqueId,
        action.targetId,
      );
      if (combat.pendingClash) {
        return { ...state, combat, screen: 'clash' };
      }
      if (!combat.finished) combat = runEnemyTurns(combat);
      if (combat.pendingClash) {
        return { ...state, combat, screen: 'clash' };
      }
      if (combat.finished) {
        return finishCombat({ ...state, combat });
      }
      return { ...state, combat };
    }
    case 'COMBAT_ASCEND': {
      if (!state.combat || !state.save) return state;
      const combat = activateAscension(
        state.combat,
        'player',
        'tempered_wake',
        state.save.player.catalystReady || !!state.save.flags['Catalyst.TemperedWake'],
      );
      const save = {
        ...state.save,
        player: {
          ...state.save.player,
          ascensionUnlocked: true,
          powerBand: combat.combatants.find((c) => c.id === 'player')?.powerBand ?? 'awakened',
        },
        flags: {
          ...state.save.flags,
          'Ascension.TemperedWake': true,
          ...(combat.tags.includes('ascension_uncontrolled')
            ? { 'Ascension.Uncontrolled': true }
            : { 'Ascension.Controlled': true }),
        },
      };
      persistSave(save);
      return { ...state, combat, save };
    }
    case 'COMBAT_TALK': {
      if (!state.combat || !state.save) return state;
      let combat = attemptConvince(
        state.combat,
        'player',
        action.targetId,
        state.save.player.attributes.presence,
        action.dc,
      );
      if (!combat.finished) combat = runEnemyTurns(combat);
      if (combat.finished) return finishCombat({ ...state, combat });
      return { ...state, combat };
    }
    case 'COMBAT_POWER_UP': {
      if (!state.combat) return state;
      let combat = powerUp(state.combat, 'player');
      if (!combat.finished) combat = runEnemyTurns(combat);
      if (combat.pendingClash) return { ...state, combat, screen: 'clash' };
      if (combat.finished) return finishCombat({ ...state, combat });
      return { ...state, combat };
    }
    case 'COMBAT_SUPPRESS': {
      if (!state.combat) return state;
      let combat = suppressOutput(state.combat, 'player');
      if (!combat.finished) combat = runEnemyTurns(combat);
      if (combat.finished) return finishCombat({ ...state, combat });
      return { ...state, combat };
    }
    case 'COMBAT_SCAN': {
      if (!state.combat) return state;
      let combat = scanResonance(state.combat, 'player', action.targetId);
      if (!combat.finished) combat = runEnemyTurns(combat);
      if (combat.pendingClash) return { ...state, combat, screen: 'clash' };
      if (combat.finished) return finishCombat({ ...state, combat });
      return { ...state, combat };
    }
    case 'COMBAT_CONTINUE': {
      if (!state.combat) return state;
      let combat = runEnemyTurns(state.combat);
      if (combat.pendingClash) return { ...state, combat, screen: 'clash', toast: null };
      if (combat.finished) return finishCombat({ ...state, combat });
      return {
        ...state,
        combat,
        screen: 'combat',
        toast: activeIsPlayer(combat)
          ? 'Your turn.'
          : 'Still resolving other fighters… tap Continue again.',
      };
    }
    case 'CLASH_CHOICE': {
      if (!state.combat) return state;
      const defenderChoices = ['push', 'overcharge', 'redirect', 'release'] as const;
      const defenderChoice =
        defenderChoices[Math.floor(Math.random() * defenderChoices.length)];
      let combat = resolveClashBeat(state.combat, action.choice, defenderChoice);
      if (combat.pendingClash) {
        return { ...state, combat, screen: 'clash' };
      }
      if (!combat.finished) combat = runEnemyTurns(combat);
      if (combat.pendingClash) {
        return { ...state, combat, screen: 'clash' };
      }
      if (combat.finished) return finishCombat({ ...state, combat, screen: 'combat' });
      return { ...state, combat, screen: 'combat' };
    }
    case 'OPEN_SHEET':
      return { ...state, screen: 'sheet' };
    case 'CLOSE_SHEET':
      return {
        ...state,
        screen: state.combat
          ? 'combat'
          : state.save?.currentEvent
            ? 'event'
            : (state.save?.worlds?.length ?? 0) > 0
              ? 'worlds'
              : 'scene',
      };
    case 'DELETE_SAVE':
      clearSave();
      return { ...initialAppState(), toast: 'Save cleared.' };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

function finishCombat(state: AppState): AppState {
  if (!state.save || !state.combat) return state;
  const save = structuredClone(state.save);
  const victory = state.combat.victory;
  save.log.push(
    victory
      ? `Combat won: ${state.combat.name}`
      : `Combat lost: ${state.combat.name}`,
  );
  save.flags[`Combat.${state.combat.id}.Victory`] = victory;

  // Sync pressure/resolve hints
  const player = state.combat.combatants.find((c) => c.id === 'player');
  if (player) {
    save.player.resolve = player.resolve;
    if (player.pressure >= 6) save.flags['Pressure.High'] = true;
  }

  if (!victory && state.combat.id.startsWith('final')) {
    const ended = resolveEnding(save, 'lose');
    persistSave(ended.save);
    return {
      ...state,
      save: ended.save,
      combat: null,
      screen: 'ending',
      endingId: 'lose',
    };
  }

  const sceneId = state.returnSceneId ?? save.sceneId;
  save.sceneId = sceneId;
  const scene = SCENES[sceneId];
  if (scene) save.chapter = scene.chapter;
  if (sceneId === 'ai_runtime') {
    save.aiBeat = save.aiBeat ?? generateAiHub(save);
  }
  persistSave(save);
  return {
    ...state,
    save,
    combat: null,
    screen: 'scene',
    returnSceneId: null,
    toast: victory ? 'Encounter resolved.' : 'You survive — the story continues.',
  };
}

export type Action =
  | { type: 'GOTO'; screen: ScreenId }
  | { type: 'SET_DRAFT'; patch: Partial<AppState['draft']> }
  | { type: 'SET_WORLD_DRAFT'; patch: Partial<WorldDraft> }
  | { type: 'START_NEW' }
  | { type: 'CONTINUE' }
  | { type: 'CHOICE'; choiceId: string }
  | {
      type: 'COMBAT_TECH';
      actorId: string;
      techniqueId: string;
      targetId: string;
    }
  | { type: 'COMBAT_ASCEND' }
  | { type: 'COMBAT_TALK'; targetId: string; dc: number }
  | { type: 'COMBAT_POWER_UP' }
  | { type: 'COMBAT_SUPPRESS' }
  | { type: 'COMBAT_SCAN'; targetId: string }
  | { type: 'COMBAT_CONTINUE' }
  | { type: 'CLASH_CHOICE'; choice: string }
  | { type: 'AI_CHOICE'; choiceId: string }
  | { type: 'OPEN_STORY_AI' }
  | { type: 'OPEN_WORLDS' }
  | { type: 'OPEN_WORLD_CREATE' }
  | { type: 'CREATE_WORLD' }
  | { type: 'SELECT_WORLD'; worldId: string }
  | { type: 'SET_WORLD_FOCUS'; focus: WorldFocus }
  | { type: 'RAISE_CEILING' }
  | { type: 'ROLL_EVENT' }
  | { type: 'RESOLVE_EVENT'; choiceId: string }
  | { type: 'OPEN_LEGACY_TRIALS' }
  | { type: 'OPEN_SHEET' }
  | { type: 'CLOSE_SHEET' }
  | { type: 'DELETE_SAVE' }
  | { type: 'CLEAR_TOAST' };

function activeIsPlayer(combat: CombatState): boolean {
  try {
    return activeCombatant(combat).isPlayer;
  } catch {
    return false;
  }
}

export {
  ORIGINS,
  DISCIPLINES,
  CONVICTIONS,
  MOTIVATIONS,
  COMPANIONS,
  SCENES,
  playerDerived,
  activeWorld,
};
