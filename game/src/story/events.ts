/**
 * Random AI events — fun, character-developing, never empty grind.
 * Every gain carries a reason tied to the choice and the active world.
 */
import type {
  DevEntry,
  EventKind,
  PlayerBuild,
  RosterCharacter,
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
  others: RosterCharacter[];
  worlds: World[];
}) => WorldEvent | null;

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
      kind: 'battle',
      choices: [
        {
          id: 'spar_hard',
          label: 'Accept a hard spar',
          hint: 'Enter battle — Offense/Strength from real pressure',
          attribute: 'might',
          dc: 11,
          lean: ['offense', 'strength', 'endurance'],
          startCombat: 'world_duel',
        },
        {
          id: 'outthink',
          label: 'Study their form first',
          hint: 'Intellect DC — Defense/Force; skip the fight',
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
  // —— Battle-forward events ——
  ({ world, pl }) => ({
    id: 'ambush_road',
    title: 'Ambush on the Line',
    tag: 'battle',
    kind: 'battle' as EventKind,
    body: `Scanners scream at PL ${formatPL(pl)}. Raiders cut the skyrail into ${world.name}. Fight through, slip past, or turn their trap.`,
    choices: [
      {
        id: 'fight_ambush',
        label: 'Fight through',
        hint: 'Battle — Strength/Offense under fire',
        attribute: 'might',
        dc: 11,
        lean: ['strength', 'offense', 'endurance'],
        startCombat: 'world_ambush',
      },
      {
        id: 'slip_past',
        label: 'Slip the net',
        hint: 'Agility DC — Speed; avoid combat',
        attribute: 'agility',
        dc: 14,
        lean: ['speed', 'defense'],
      },
      {
        id: 'turn_trap',
        label: 'Turn their trap',
        hint: 'Intellect DC then battle — Defense/Force',
        attribute: 'intellect',
        dc: 13,
        lean: ['defense', 'force'],
        startCombat: 'world_ambush',
      },
    ],
  }),
  ({ world, pl }) => ({
    id: 'skirmish_street',
    title: 'Street Skirmish',
    tag: 'battle',
    kind: 'battle' as EventKind,
    body: `Two crews collide in ${world.name}. Your PL (${formatPL(pl)}) makes you a prize or a problem. Step in or steer clear.`,
    choices: [
      {
        id: 'join_skirmish',
        label: 'Step into the skirmish',
        hint: 'Battle vs two foes — Offense/Speed',
        attribute: 'agility',
        dc: 12,
        lean: ['offense', 'speed'],
        startCombat: 'world_skirmish',
      },
      {
        id: 'protect_crowd',
        label: 'Shield the crowd',
        hint: 'Grit DC — Endurance/Resistance; may still fight',
        attribute: 'grit',
        dc: 13,
        lean: ['endurance', 'resistance'],
        startCombat: 'world_skirmish',
        convictionTouch: 'duty',
      },
      {
        id: 'leave_street',
        label: 'Leave them to it',
        hint: 'Will DC — mild Resistance; no battle',
        attribute: 'will',
        dc: 12,
        lean: ['resistance'],
      },
    ],
  }),
  ({ world, pl }) => ({
    id: 'ceiling_hunt',
    title: 'Something Above the Ceiling',
    tag: 'battle',
    kind: 'battle' as EventKind,
    body: `A hunter above ${world.name}’s soft ceiling (${formatPL(world.powerCeiling)}) sniffs your PL (${formatPL(pl)}). Run, bait it, or meet it clean.`,
    choices: [
      {
        id: 'meet_hunter',
        label: 'Meet the hunter',
        hint: 'Hard battle — Offense/Force',
        attribute: 'might',
        dc: 12,
        lean: ['offense', 'force', 'endurance'],
        startCombat: 'world_hunt',
      },
      {
        id: 'bait_hunter',
        label: 'Bait it into a trap',
        hint: 'Control DC then battle — Defense/Speed',
        attribute: 'control',
        dc: 14,
        lean: ['defense', 'speed'],
        startCombat: 'world_hunt',
      },
      {
        id: 'run_hunter',
        label: 'Run the district',
        hint: 'Agility DC — Speed; skip the fight',
        attribute: 'agility',
        dc: 14,
        lean: ['speed'],
      },
    ],
  }),
  // —— Meet (other roster characters on this world) ——
  ({ world, others, rand }) => {
    if (!others.length) return null;
    const other = pick(rand, others);
    return {
      id: 'crossing_paths',
      title: `Crossing Paths — ${other.build.name}`,
      tag: 'meet',
      kind: 'meet' as EventKind,
      body: `${other.build.name} is also on ${world.name}. Scanners ping. This can be a spar, a lesson, or a quiet alliance.`,
      choices: [
        {
          id: 'roster_spar',
          label: `Spar ${other.build.name}`,
          hint: 'Battle your roster mate — real combat',
          attribute: 'might',
          dc: 11,
          lean: ['offense', 'strength', 'speed'],
          startCombat: 'roster_spar',
          meetCharacterId: other.id,
        },
        {
          id: 'train_together',
          label: 'Train together',
          hint: 'Will DC — shared Endurance/Force gains',
          attribute: 'will',
          dc: 12,
          lean: ['endurance', 'force'],
          meetCharacterId: other.id,
          convictionTouch: 'belonging',
        },
        {
          id: 'quiet_talk',
          label: 'Talk it out',
          hint: 'Presence DC — Resistance/Defense; no battle',
          attribute: 'presence',
          dc: 12,
          lean: ['resistance', 'defense'],
          meetCharacterId: other.id,
          convictionTouch: 'truth',
        },
      ],
    };
  },
  // —— Travel hooks ——
  ({ world, worlds, rand, player }) => {
    const destinations = worlds.filter((w) => w.id !== world.id);
    if (!destinations.length) return null;
    const dest = pick(rand, destinations);
    return {
      id: 'travel_call',
      title: `Road to ${dest.name}`,
      tag: 'travel',
      kind: 'travel' as EventKind,
      body: `${player.name} feels a pull off ${world.name} toward ${dest.name} (${dest.tone}, ceiling ${formatPL(dest.powerCeiling)}). The road itself may fight back.`,
      choices: [
        {
          id: 'travel_safe',
          label: `Travel quietly to ${dest.name}`,
          hint: 'Agility DC — Speed; arrive without battle',
          attribute: 'agility',
          dc: 12,
          lean: ['speed'],
          travelWorldId: dest.id,
        },
        {
          id: 'travel_fight',
          label: 'Take the hot road',
          hint: 'Battle on the way, then arrive',
          attribute: 'might',
          dc: 11,
          lean: ['strength', 'endurance'],
          startCombat: 'world_ambush',
          travelWorldId: dest.id,
        },
        {
          id: 'stay_put',
          label: `Stay on ${world.name}`,
          hint: 'Will DC — Resistance; no travel',
          attribute: 'will',
          dc: 11,
          lean: ['resistance'],
        },
      ],
    };
  },
];

/** Factory indices: 0 rival, 7–9 battle, 10 meet, 11 travel */
const BATTLE_IDX = [0, 7, 8, 9];
const MEET_IDX = [10];
const TRAVEL_IDX = [11];

export function rollWorldEvent(
  save: SaveGame,
  world: World,
  prefer: EventKind | 'any' = 'any',
): WorldEvent {
  const ch = (save.characters ?? []).find((c) => c.id === save.activeCharacterId);
  const train = ch?.trainCount ?? save.trainCount ?? 0;
  const seed =
    (save.storySeed ?? 1) +
    world.eventCount * 97 +
    world.seed +
    train * 13 +
    (ch ? ch.id.length * 17 : 0) +
    (prefer === 'any' ? 0 : prefer.length * 31);
  const rand = rng(seed);
  const player = ch?.build ?? save.player;
  const pl = playerPower(player, { formId: player.formId ?? 'base' }).powerLevel;
  const others = (save.characters ?? []).filter(
    (c) => c.id !== ch?.id && c.worldId === world.id,
  );
  const worlds = save.worlds ?? [];
  const ctx = { world, player, rand, pl, others, worlds };

  let indices = FACTORIES.map((_, i) => i);
  if (prefer === 'battle') indices = [...BATTLE_IDX];
  else if (prefer === 'meet') indices = others.length ? [...MEET_IDX] : [...BATTLE_IDX];
  else if (prefer === 'travel') {
    indices = worlds.length > 1 ? [...TRAVEL_IDX] : [...BATTLE_IDX];
  } else {
    if (world.focus === 'empower' || world.tone === 'war') {
      indices = [...BATTLE_IDX, ...indices];
    }
    if (others.length) indices = [...MEET_IDX, ...indices];
    if (worlds.length > 1) indices = [...TRAVEL_IDX, ...indices];
  }

  let event: WorldEvent | null = null;
  for (let i = 0; i < 10 && !event; i++) {
    const idx = pick(rand, indices);
    event = FACTORIES[idx](ctx);
  }
  if (!event) event = FACTORIES[0](ctx)!;

  const who = player.name;
  return {
    ...event,
    body: `${who} is on ${world.name}. ${event.body}`,
  };
}

/** Build a meet event between the active character and a specific other. */
export function buildMeetEvent(
  save: SaveGame,
  world: World,
  otherId: string,
): WorldEvent | null {
  const other = (save.characters ?? []).find((c) => c.id === otherId);
  const ch = (save.characters ?? []).find((c) => c.id === save.activeCharacterId);
  if (!other || !ch) return null;
  const player = ch.build;
  return {
    id: 'crossing_paths',
    title: `Crossing Paths — ${other.build.name}`,
    tag: 'meet',
    kind: 'meet',
    body: `${player.name} seeks out ${other.build.name} on ${world.name}. Spar, train, or talk — the choice writes both of your stories.`,
    choices: [
      {
        id: 'roster_spar',
        label: `Spar ${other.build.name}`,
        hint: 'Enter combat against your roster mate',
        attribute: 'might',
        dc: 11,
        lean: ['offense', 'strength', 'speed'],
        startCombat: 'roster_spar',
        meetCharacterId: other.id,
      },
      {
        id: 'train_together',
        label: 'Train together',
        hint: 'Will DC — Endurance/Force for you (they remember too)',
        attribute: 'will',
        dc: 12,
        lean: ['endurance', 'force'],
        meetCharacterId: other.id,
        convictionTouch: 'belonging',
      },
      {
        id: 'quiet_talk',
        label: 'Talk it out',
        hint: 'Presence DC — Resistance/Defense',
        attribute: 'presence',
        dc: 12,
        lean: ['resistance', 'defense'],
        meetCharacterId: other.id,
      },
    ],
  };
}

/** Build a travel event toward a destination world. */
export function buildTravelEvent(
  save: SaveGame,
  from: World,
  dest: World,
): WorldEvent {
  const ch = (save.characters ?? []).find((c) => c.id === save.activeCharacterId);
  const who = ch?.build.name ?? save.player.name;
  return {
    id: 'travel_call',
    title: `Road to ${dest.name}`,
    tag: 'travel',
    kind: 'travel',
    body: `${who} leaves ${from.name} for ${dest.name} (${dest.tone}). Safe roads are rare — the hot road means a fight.`,
    choices: [
      {
        id: 'travel_safe',
        label: `Travel quietly to ${dest.name}`,
        hint: 'Agility DC — Speed; arrive without battle',
        attribute: 'agility',
        dc: 12,
        lean: ['speed'],
        travelWorldId: dest.id,
      },
      {
        id: 'travel_fight',
        label: 'Take the hot road',
        hint: 'Battle on the way, then arrive',
        attribute: 'might',
        dc: 11,
        lean: ['strength', 'endurance', 'offense'],
        startCombat: 'world_ambush',
        travelWorldId: dest.id,
      },
      {
        id: 'stay_put',
        label: `Stay on ${from.name}`,
        hint: 'Will DC — no travel',
        attribute: 'will',
        dc: 11,
        lean: ['resistance'],
      },
    ],
  };
}

export interface EventResolveResult {
  save: SaveGame;
  world: World;
  diceText: string;
  toast: string;
  entry: DevEntry;
  combatId?: string;
  rivalCharacterId?: string;
  travelWorldId?: string;
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

  // Travel: move after the check (even on costly success path if travel chosen)
  let travelWorldId = choice.travelWorldId;
  if (travelWorldId && choice.id === 'stay_put') travelWorldId = undefined;
  if (travelWorldId && !success && choice.id === 'travel_safe') {
    // Failed safe travel — still can go, but bruised (already got scar gains)
  }

  // Meet: mild mirrored train on the other character
  if (choice.meetCharacterId && (choice.id === 'train_together' || choice.id === 'quiet_talk')) {
    const oi = nextSave.characters.findIndex((c) => c.id === choice.meetCharacterId);
    if (oi >= 0) {
      const other = nextSave.characters[oi];
      let ob = structuredClone(other.build);
      ob.trainedStats = ob.trainedStats ?? {};
      const mirror = success ? 6 : 2;
      for (const stat of lean.slice(0, 2)) {
        ob.trainedStats = trainStat(ob.trainedStats, stat, mirror);
      }
      nextSave.characters[oi] = {
        ...other,
        build: ob,
        developmentLog: [
          {
            id: `dev_m_${Date.now().toString(36)}`,
            at: Date.now(),
            characterId: other.id,
            characterName: other.build.name,
            worldId: world.id,
            worldName: world.name,
            eventTitle: `Met ${player.name}`,
            reason: `Shared a ${choice.id === 'train_together' ? 'training' : 'talk'} beat with ${player.name} on ${world.name}`,
            gains: lean.slice(0, 2).map((s) => `+${mirror} ${s}`),
          },
          ...other.developmentLog,
        ].slice(0, 60),
      };
      gains.push(`${other.build.name} also grew`);
    }
  }

  player.level = 3 + Math.floor(trainCount / 4);
  if (success) player.resolve += strong ? 2 : 1;

  const pl = playerPower(player, { formId: player.formId ?? 'base' });
  gains.push(`PL now ${formatPL(pl.powerLevel)}`);

  let nextWorldId = ch?.worldId ?? world.id;
  if (travelWorldId) {
    nextWorldId = travelWorldId;
    const dest = (nextSave.worlds ?? []).find((w) => w.id === travelWorldId);
    if (dest) gains.push(`traveled → ${dest.name}`);
  }

  const entry: DevEntry = {
    id: `dev_${Date.now().toString(36)}`,
    at: Date.now(),
    characterId: ch?.id,
    characterName: player.name,
    worldId: nextWorldId,
    worldName:
      (nextSave.worlds ?? []).find((w) => w.id === nextWorldId)?.name ?? world.name,
    eventTitle: event.title,
    reason,
    gains,
  };

  // Combat: queue after event; travel destination applied before fight for ambush flavor
  const combatId = choice.startCombat;
  const rivalCharacterId =
    choice.startCombat === 'roster_spar' ? choice.meetCharacterId : undefined;
  if (combatId) {
    nextSave.pendingCombat = { encounterId: combatId, rivalCharacterId };
    gains.push('battle begins');
  } else {
    nextSave.pendingCombat = null;
  }

  nextSave.player = player;
  nextSave.trainCount = trainCount;
  nextSave.currentEvent = null;
  nextSave.activeWorldId = nextWorldId;
  nextSave.developmentLog = [entry, ...nextSave.developmentLog].slice(0, 80);
  nextSave.log.push(
    `${player.name} @ ${entry.worldName} — ${event.title}: ${reason} (${gains.join(', ')})`,
  );

  if (chIndex >= 0 && ch) {
    nextSave.characters[chIndex] = {
      ...ch,
      build: player,
      trainCount,
      flags: charFlags,
      currentEvent: null,
      worldId: nextWorldId,
      developmentLog: [entry, ...ch.developmentLog].slice(0, 60),
    };
  }

  worldNext.history = [
    ...worldNext.history,
    `${player.name}: “${event.title}” → ${choice.label} (${success ? 'held' : 'costly'}${combatId ? ', into battle' : ''}).`,
  ].slice(-40);

  const diceText = `${roll.narrative} (${roll.total} vs DC ${roll.targetDc})${
    roll.riftEvent ? ` | Rift ${roll.riftDie}: ${roll.riftEvent}` : ''
  }`;

  return {
    save: nextSave,
    world: worldNext,
    diceText,
    toast: combatId
      ? `${player.name}: ${reason} — into battle!`
      : `${player.name}: ${reason} → ${gains.slice(0, 3).join(', ')}`,
    entry,
    combatId,
    rivalCharacterId,
    travelWorldId,
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
    fight_ambush: `${who} chose the fight on the line — Strength/Offense from surviving an ambush`,
    slip_past: `${who} slipped the net — Speed/Defense from reading the trap`,
    turn_trap: `${who} turned the ambush — Defense/Force from flipping the geometry`,
    join_skirmish: `${who} stepped into a street skirmish — Offense/Speed under crossfire`,
    protect_crowd: `${who} shielded civilians mid-fight — Endurance/Resistance with purpose`,
    leave_street: `${who} walked away from the skirmish — Resistance from choosing the long game`,
    meet_hunter: `${who} met a ceiling hunter head-on — Offense/Force against a harder band`,
    bait_hunter: `${who} baited the hunter — Defense/Speed from owning the trap`,
    run_hunter: `${who} ran the district — Speed earned by refusing a bad fight`,
    roster_spar: `${who} sparred a roster mate — Offense/Strength/Speed from a real clash`,
    train_together: `${who} trained with another wanderer — Endurance/Force from shared drills`,
    quiet_talk: `${who} talked a path open — Resistance/Defense from words that held`,
    travel_safe: `${who} took the quiet road — Speed from traveling light`,
    travel_fight: `${who} took the hot road — Strength/Endurance from fighting the way there`,
    stay_put: `${who} stayed put — Resistance from refusing the pull of the road`,
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
  if (
    event.tag === 'rivalry' ||
    event.tag === 'battle' ||
    choice.id === 'spar_hard' ||
    choice.id === 'cash_in' ||
    choice.startCombat
  ) {
    delta.threatLevel += success ? 4 : 6;
  }
  if (event.kind === 'travel' || choice.travelWorldId) {
    delta.storyProgress += 3;
  }
  if (event.kind === 'meet') {
    delta.storyProgress += success ? 5 : 2;
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
