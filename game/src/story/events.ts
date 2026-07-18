/**
 * Random AI events — fun, character-developing, never empty grind.
 * Every gain carries a reason tied to the choice and the active world.
 */
import type {
  DevEntry,
  PlayerBuild,
  SaveGame,
  WorldEvent,
  WorldEventChoice,
} from '../engine/types';
import { isSuccess, makeCheck } from '../engine/dice';
import {
  formatPL,
  playerPower,
  trainStat,
  type BattleStats,
} from '../engine/power';
import {
  applyWorldDelta,
  raiseCeiling,
  type World,
} from '../engine/worlds';

export type { DevEntry, WorldEvent, WorldEventChoice };

type EventChoice = WorldEventChoice & {
  lean?: (keyof BattleStats)[];
};

type EventFactory = (ctx: {
  world: World;
  player: PlayerBuild;
  rand: () => number;
  pl: number;
}) => WorldEvent;

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

const FACTORIES: EventFactory[] = [
  ({ world, pl, rand }) => {
    const rival = pick(rand, ['Kael Drift', 'Nira Ash', 'Boss Hex', 'Vexa Thorn', 'an Unbound stray']);
    return {
      id: 'rival_pressure',
      title: 'Rival at the Gate',
      tag: 'rivalry',
      body: `${rival} lands in ${world.name} with a scanner scream near your band. Crowds want a show. Your current PL is ${formatPL(pl)}. How you answer becomes who you are here.`,
      choices: [
        {
          id: 'spar_hard',
          label: 'Accept a hard spar',
          hint: 'Might DC — Offense/Strength from real pressure',
          attribute: 'might',
          dc: 12,
          lean: ['offense', 'strength', 'endurance'],
        },
        {
          id: 'outthink',
          label: 'Study their form first',
          hint: 'Intellect DC — Defense/Force from analysis',
          attribute: 'intellect',
          dc: 13,
          lean: ['defense', 'force'],
        },
        {
          id: 'talk_down',
          label: 'Talk the heat down',
          hint: 'Presence DC — Resistance from restraint',
          attribute: 'presence',
          dc: 13,
          lean: ['resistance'],
          convictionTouch: 'mercy',
        },
      ],
    };
  },
  ({ world }) => ({
    id: 'flux_well',
    title: 'Unstable Flux Well',
    tag: 'discovery',
    body: `A ${world.fluxBias} well under ${world.name} pulses wrong. Drink deep and risk corruption, map it for the arc “${world.storyArc}”, or seal it for the people living nearby.`,
    choices: [
      {
        id: 'drink',
        label: 'Channel the well',
        hint: 'Control DC — Force spike, stability hit',
        attribute: 'control',
        dc: 14,
        lean: ['force', 'resistance'],
      },
      {
        id: 'map',
        label: 'Map it into the story arc',
        hint: 'Intellect DC — story progress + Force',
        attribute: 'intellect',
        dc: 12,
        lean: ['force'],
      },
      {
        id: 'seal',
        label: 'Seal it for civilians',
        hint: 'Will DC — Resistance; world stabilizes',
        attribute: 'will',
        dc: 13,
        lean: ['resistance', 'endurance'],
        convictionTouch: 'duty',
      },
    ],
  }),
  ({ world, rand }) => {
    const faction = pick(rand, world.factions);
    return {
      id: 'faction_ask',
      title: `${faction} Comes Calling`,
      tag: 'politics',
      body: `${faction} wants your name on a decree in ${world.name}. Sign and gain patronage (Offense/Presence path), refuse and harden Independence (Resistance), or broker a third path.`,
      choices: [
        {
          id: 'sign',
          label: 'Sign their decree',
          hint: 'Presence DC — Offense from public backing',
          attribute: 'presence',
          dc: 12,
          lean: ['offense'],
        },
        {
          id: 'refuse',
          label: 'Refuse cleanly',
          hint: 'Will DC — Resistance from standing alone',
          attribute: 'will',
          dc: 13,
          lean: ['resistance'],
          convictionTouch: 'freedom',
        },
        {
          id: 'broker',
          label: 'Broker a third path',
          hint: 'Intellect DC — Defense/Speed from juggling sides',
          attribute: 'intellect',
          dc: 14,
          lean: ['defense', 'speed'],
          convictionTouch: 'balance',
        },
      ],
    };
  },
  ({ world }) => ({
    id: 'collapse_watch',
    title: 'District Slip',
    tag: 'survival',
    body: `Stability in ${world.name} dips to ${world.stability}. A skyrail shears. You can brace it with body, rewrite Lumen anchors, or evacuate and accept the scar.`,
    choices: [
      {
        id: 'brace',
        label: 'Brace it with body',
        hint: 'Grit DC — Endurance/Strength earned the hard way',
        attribute: 'grit',
        dc: 14,
        lean: ['endurance', 'strength'],
      },
      {
        id: 'rewrite',
        label: 'Rewrite the anchors',
        hint: 'Control DC — Force/Defense',
        attribute: 'control',
        dc: 13,
        lean: ['force', 'defense'],
      },
      {
        id: 'evacuate',
        label: 'Prioritize evacuation',
        hint: 'Presence DC — Speed/Resistance; story of mercy',
        attribute: 'presence',
        dc: 12,
        lean: ['speed', 'resistance'],
        convictionTouch: 'mercy',
      },
    ],
  }),
  ({ world, pl }) => ({
    id: 'form_temptation',
    title: 'Multiplier Hunger',
    tag: 'ascension',
    body: `Your PL (${formatPL(pl)}) presses ${world.name}’s ceiling (${formatPL(world.powerCeiling)}). A Rift tutor offers a dirty multiplier shortcut — or you can earn mastery the slow way.`,
    choices: [
      {
        id: 'dirty',
        label: 'Take the dirty shortcut',
        hint: 'Control DC — Force up, stability down, unlock risk',
        attribute: 'control',
        dc: 15,
        lean: ['force', 'offense'],
      },
      {
        id: 'master',
        label: 'Drill clean mastery',
        hint: 'Will DC — Resistance + transform mastery',
        attribute: 'will',
        dc: 14,
        lean: ['resistance', 'speed'],
        convictionTouch: 'balance',
      },
      {
        id: 'raise_world',
        label: 'Raise the world’s ceiling instead',
        hint: 'Intellect DC — manage world power progression',
        attribute: 'intellect',
        dc: 14,
        lean: ['defense'],
      },
    ],
  }),
  ({ world, rand }) => {
    const mentor = pick(rand, ['Maelin Orr', 'an Ashbound breath-smith', 'a Glass Synod mind', 'a Wild Choir elder']);
    return {
      id: 'mentor_lesson',
      title: 'Lesson with Teeth',
      tag: 'growth',
      body: `${mentor} refuses empty reps. In ${world.name}, they tie a lesson to your convictions — gain only if the reason sticks.`,
      choices: [
        {
          id: 'body',
          label: 'Learn through impact',
          hint: 'Might DC — Strength/Endurance with a scar-story',
          attribute: 'might',
          dc: 12,
          lean: ['strength', 'endurance'],
        },
        {
          id: 'breath',
          label: 'Learn through breath & timing',
          hint: 'Agility DC — Speed/Defense',
          attribute: 'agility',
          dc: 12,
          lean: ['speed', 'defense'],
        },
        {
          id: 'mind',
          label: 'Learn through reading Flux',
          hint: 'Control DC — Force/Resistance',
          attribute: 'control',
          dc: 13,
          lean: ['force', 'resistance'],
        },
      ],
    };
  },
  ({ world }) => ({
    id: 'story_hinge',
    title: 'Arc Hinge',
    tag: 'story',
    body: `The arc “${world.storyArc}” hits a hinge (progress ${world.storyProgress}%). A truth surfaces that can advance the world story — or you can cash it for personal power.`,
    choices: [
      {
        id: 'advance',
        label: 'Advance the world story',
        hint: 'Will DC — Resistance; big story progress',
        attribute: 'will',
        dc: 13,
        lean: ['resistance'],
        convictionTouch: 'truth',
      },
      {
        id: 'cash_in',
        label: 'Cash the secret for power',
        hint: 'Presence DC — Offense/Force; threat rises',
        attribute: 'presence',
        dc: 12,
        lean: ['offense', 'force'],
        convictionTouch: 'ambition',
      },
      {
        id: 'share',
        label: 'Share it with a companion',
        hint: 'Presence DC — Defense; bond + mild story',
        attribute: 'presence',
        dc: 11,
        lean: ['defense'],
        convictionTouch: 'belonging',
      },
    ],
  }),
];

export function rollWorldEvent(save: SaveGame, world: World): WorldEvent {
  const ch = (save.characters ?? []).find((c) => c.id === save.activeCharacterId);
  const train = ch?.trainCount ?? save.trainCount ?? 0;
  const seed =
    (save.storySeed ?? 1) +
    world.eventCount * 97 +
    world.seed +
    train * 13 +
    (ch ? ch.id.length * 17 : 0);
  const rand = rng(seed);
  const player = ch?.build ?? save.player;
  const pl = playerPower(player, { formId: player.formId ?? 'base' }).powerLevel;
  // Weight by world focus / tone
  let pool = [...FACTORIES];
  if (world.focus === 'stabilize') {
    pool = [FACTORIES[3], FACTORIES[1], FACTORIES[5], ...pool];
  } else if (world.focus === 'empower') {
    pool = [FACTORIES[4], FACTORIES[0], FACTORIES[5], ...pool];
  } else if (world.focus === 'story') {
    pool = [FACTORIES[6], FACTORIES[2], FACTORIES[1], ...pool];
  }
  if (world.tone === 'war') pool = [FACTORIES[0], FACTORIES[3], ...pool];
  if (world.tone === 'ascension') pool = [FACTORIES[4], FACTORIES[0], ...pool];
  const factory = pick(rand, pool);
  const event = factory({ world, player, rand, pl });
  // Frame the event around the stationed character
  const who = player.name;
  return {
    ...event,
    body: `${who} is on ${world.name}. ${event.body}`,
  };
}

export interface EventResolveResult {
  save: SaveGame;
  world: World;
  diceText: string;
  toast: string;
  entry: DevEntry;
}

export function resolveEventChoice(
  save: SaveGame,
  world: World,
  event: WorldEvent,
  choiceId: string,
): EventResolveResult {
  const choice = event.choices.find((c) => c.id === choiceId) ?? event.choices[0];
  const nextSave: SaveGame = structuredClone(save);
  nextSave.developmentLog = nextSave.developmentLog ?? [];
  nextSave.characters = nextSave.characters ?? [];

  const chIndex = nextSave.characters.findIndex(
    (c) => c.id === nextSave.activeCharacterId,
  );
  const ch = chIndex >= 0 ? nextSave.characters[chIndex] : null;
  let player = structuredClone(ch?.build ?? nextSave.player);
  player.trainedStats = player.trainedStats ?? {};
  let trainCount = (ch?.trainCount ?? nextSave.trainCount ?? 0) + 1;
  let charFlags = { ...(ch?.flags ?? {}) };

  const attr = choice.attribute ?? 'will';
  const dc = choice.dc ?? 12;
  const roll = makeCheck({
    rollType: `${event.title}: ${choice.label}`,
    attributeValue: player.attributes[attr],
    proficiency: Math.floor(player.level / 2),
    dc,
    useRiftDie: world.fluxBias === 'riftforce' || world.stability < 35,
  });
  const success = isSuccess(roll.outcomeTier);
  const strong =
    roll.outcomeTier === 'strongSuccess' ||
    roll.outcomeTier === 'exceptionalSuccess';

  const gains: string[] = [];
  const lean = choice.lean ?? ['endurance'];
  const amount = success ? (strong ? 14 : 9) : 4;

  for (const stat of lean) {
    player.trainedStats = trainStat(player.trainedStats, stat, amount);
    gains.push(`+${amount} ${stat}`);
  }

  const reason = buildReason(event, choice, success, world, roll.outcomeTier, player.name);

  let worldNext = { ...world, eventCount: world.eventCount + 1 };
  worldNext = applyFocusAndChoice(worldNext, event, choice, success);

  if (choice.id === 'master' && success) {
    player.ascensionMastery = (player.ascensionMastery ?? 0) + 1;
    player.ascensionUnlocked = true;
    player.catalystReady = true;
    charFlags['Ascension.TemperedWake'] = true;
    nextSave.flags['Ascension.TemperedWake'] = true;
    gains.push('+1 transform mastery');
  }
  if (choice.id === 'dirty' && success) {
    charFlags['Ascension.TemperedWake'] = true;
    nextSave.flags['Ascension.TemperedWake'] = true;
    player.ascensionUnlocked = true;
    player.formId = 'tempered_wake';
    gains.push('Tempered Wake unlocked (risky)');
  }
  if (choice.id === 'raise_world' && success) {
    worldNext = raiseCeiling(worldNext);
    gains.push(`world ceiling → ${worldNext.powerCeiling}`);
  }
  if (choice.convictionTouch && success) {
    charFlags[`Conviction.${choice.convictionTouch}.Lived`] = true;
    nextSave.flags[`Conviction.${choice.convictionTouch}.Lived`] = true;
    gains.push(`lived conviction: ${choice.convictionTouch}`);
  }

  player.level = 3 + Math.floor(trainCount / 4);
  if (success) player.resolve += strong ? 2 : 1;

  const pl = playerPower(player, { formId: player.formId ?? 'base' });
  gains.push(`PL now ${formatPL(pl.powerLevel)}`);

  const entry: DevEntry = {
    id: `dev_${Date.now().toString(36)}`,
    at: Date.now(),
    characterId: ch?.id,
    characterName: player.name,
    worldId: world.id,
    worldName: world.name,
    eventTitle: event.title,
    reason,
    gains,
  };

  nextSave.player = player;
  nextSave.trainCount = trainCount;
  nextSave.currentEvent = null;
  nextSave.developmentLog = [entry, ...nextSave.developmentLog].slice(0, 80);
  nextSave.log.push(
    `${player.name} @ ${world.name} — ${event.title}: ${reason} (${gains.join(', ')})`,
  );

  if (chIndex >= 0 && ch) {
    nextSave.characters[chIndex] = {
      ...ch,
      build: player,
      trainCount,
      flags: charFlags,
      currentEvent: null,
      worldId: ch.worldId ?? world.id,
      developmentLog: [entry, ...ch.developmentLog].slice(0, 60),
    };
  }

  worldNext.history = [
    ...worldNext.history,
    `${player.name}: “${event.title}” → ${choice.label} (${success ? 'held' : 'costly'}).`,
  ].slice(-40);

  const diceText = `${roll.narrative} (${roll.total} vs DC ${roll.targetDc})${
    roll.riftEvent ? ` | Rift ${roll.riftDie}: ${roll.riftEvent}` : ''
  }`;

  return {
    save: nextSave,
    world: worldNext,
    diceText,
    toast: `${player.name}: ${reason} → ${gains.slice(0, 3).join(', ')}`,
    entry,
  };
}

function buildReason(
  event: WorldEvent,
  choice: EventChoice,
  success: boolean,
  world: World,
  tier: string,
  who = 'You',
): string {
  const ok = success ? 'earned' : 'scar-earned';
  const bits: Record<string, string> = {
    spar_hard: success
      ? `${who} took ${event.title} head-on; muscle memory burned under live threat in ${world.name}`
      : `${who} got tagged in the spar — pain taught Endurance anyway`,
    outthink: `${who} studied the rival’s geometry; Defense rose because pride was refused`,
    talk_down: success
      ? `${who} cooled the crowd — Resistance rose from choosing control over spectacle`
      : `The crowd booed, but ${who} held their tongue and still tempered Resistance`,
    drink: success
      ? `${who} metabolized a ${world.fluxBias} well — Force climbed as the world poured in`
      : `The well bit back — ${who} kept a fragment of Force through the burn`,
    map: `${who} turned danger into lore for “${world.storyArc}” — Force rose with understanding`,
    seal: `${who} sealed the well for others — Resistance/Endurance from weight that wasn’t glory`,
    sign: `Patronage sharpened ${who}’s Offense — public backing changes how hard they hit`,
    refuse: `${who} refused the decree — Resistance hardened from standing alone`,
    broker: `${who} juggled sides — Defense/Speed from political footwork`,
    brace: `${who} became a pillar under a falling district — Strength/Endurance remember that`,
    rewrite: `${who} rewrote anchors — Force/Defense from precision`,
    evacuate: `${who} chose lives over landmarks — Speed/Resistance rose with that priority`,
    dirty: success
      ? `${who} took a dirty multiplier shortcut — Tempered Wake lit with a debt`
      : `The shortcut failed, but ${who} still scored Force channels`,
    master: `${who} drilled clean mastery — Resistance/Speed from refusing cheap power`,
    raise_world: `${who} widened ${world.name}’s power ceiling — management changed the world’s rules`,
    body: `Impact lessons left ${who} Strength/Endurance with a named scar-story`,
    breath: `Breath-and-timing work raised ${who}’s Speed/Defense`,
    mind: `${who} read Flux — Force/Resistance as armor`,
    advance: `${who} pushed “${world.storyArc}” forward — Resistance from a story bigger than PL`,
    cash_in: `${who} converted a world truth into personal bite — Offense/Force, hotter threat`,
    share: `${who} shared with a companion — Defense from trust`,
  };
  return (
    bits[choice.id] ??
    `Through “${event.title}” (${choice.label}) ${who} ${ok} growth (${tier}) in ${world.name}`
  );
}

function applyFocusAndChoice(
  world: World,
  event: WorldEvent,
  choice: EventChoice,
  success: boolean,
): World {
  let delta = { stability: 0, threatLevel: 0, storyProgress: 0 };
  if (event.tag === 'survival' || choice.id === 'seal' || choice.id === 'evacuate') {
    delta.stability += success ? 6 : 2;
    delta.threatLevel += success ? -2 : 3;
  }
  if (event.tag === 'rivalry' || choice.id === 'spar_hard' || choice.id === 'cash_in') {
    delta.threatLevel += success ? 4 : 6;
  }
  if (event.tag === 'story' || choice.id === 'map' || choice.id === 'advance') {
    delta.storyProgress += success ? 12 : 4;
  }
  if (choice.id === 'drink' || choice.id === 'dirty') {
    delta.stability -= success ? 8 : 4;
    delta.threatLevel += 5;
  }
  if (choice.id === 'share') delta.storyProgress += 5;
  if (world.focus === 'stabilize') delta.stability += 2;
  if (world.focus === 'empower') delta.threatLevel += 2;
  if (world.focus === 'story') delta.storyProgress += 3;

  return applyWorldDelta(world, {
    ...delta,
    note: `After “${event.title}”, stability ${delta.stability >= 0 ? '+' : ''}${delta.stability}, threat ${delta.threatLevel >= 0 ? '+' : ''}${delta.threatLevel}, story ${delta.storyProgress >= 0 ? '+' : ''}${delta.storyProgress}.`,
  });
}
