/**
 * Story AI director — procedural narrative brain (no cloud LLM required).
 * Picks the next beat from power level, dice, training, and flags —
 * the old BYOND “living world” feel: train, spar, escalate, rival, story.
 */
import type { AiBeat, AttributeId, SaveGame } from '../engine/types';
import { formatPL, playerPower, type BattleStats } from '../engine/power';
import { makeCheck, isSuccess } from '../engine/dice';

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

const TRAIN_STATS: (keyof BattleStats)[] = [
  'strength',
  'endurance',
  'speed',
  'resistance',
  'offense',
  'defense',
  'force',
];

const ATTR_FOR_STAT: Record<keyof BattleStats, AttributeId> = {
  strength: 'might',
  endurance: 'grit',
  speed: 'agility',
  resistance: 'will',
  offense: 'presence',
  defense: 'grit',
  force: 'control',
};

export function ensureStorySeed(save: SaveGame): number {
  if (save.storySeed) return save.storySeed;
  return (Date.now() % 1_000_000) + save.player.name.length * 97;
}

/** Build the free-roam AI hub after authored beats, or when player asks for Story AI */
export function generateAiHub(save: SaveGame): AiBeat {
  const seed = ensureStorySeed(save);
  const rand = rng(seed + (save.trainCount ?? 0) * 17 + save.log.length);
  const reading = playerPower(save.player, {
    output: 0.6,
    ascended: !!save.flags['Ascension.TemperedWake'],
    formId: save.player.formId,
  });
  const rivalPL = Math.floor(800 + (save.trainCount ?? 0) * 40 + reading.powerLevel * 0.35);
  const lines = [
    `Scanner tick. Your Power Level reads ${formatPL(reading.powerLevel)} in ${reading.formName} (×${reading.formMultiplier}).`,
    `Street talk puts Vexa near ${formatPL(rivalPL)}. The Trials, the Engine, the grind — all still moving.`,
    pick(rand, [
      'A training yard opens under the skyrail. Gravity plates hum.',
      'Ivo pings a Lumen tip: someone is selling fake power suppressors.',
      'Sori says the city vines are leaning toward fighters who hold back.',
      'Maelin leaves a note: “Multiplier without control is just a brighter funeral.”',
    ]),
  ];

  const choices: AiBeat['choices'] = [
    {
      id: 'train_menu',
      label: 'Train a battle stat',
      hint: 'Dice + grind — raises Power Level',
      kind: 'train',
    },
    {
      id: 'spar_drone',
      label: 'Spar in the Undercourt',
      hint: 'Combat — earn stress & growth',
      kind: 'spar',
    },
    {
      id: 'story_pulse',
      label: 'Follow the Story AI thread',
      hint: 'Procedural mission from your power & choices',
      kind: 'story',
    },
    {
      id: 'meditate',
      label: 'Meditate / suppress power',
      hint: 'Will check — calm Stress, refine control',
      kind: 'meditate',
      attribute: 'will',
      dc: 12,
    },
  ];

  if (save.player.ascensionUnlocked || save.flags['Catalyst.TemperedWake']) {
    choices.push({
      id: 'transform_drill',
      label: 'Transformation drill',
      hint: `Practice form multipliers (current ×${reading.formMultiplier})`,
      kind: 'transform',
    });
  }

  if (reading.powerLevel >= rivalPL * 0.55) {
    choices.push({
      id: 'rival_call',
      label: 'Answer Vexa’s challenge',
      hint: `Rival ~${formatPL(rivalPL)} PL`,
      kind: 'rival',
    });
  }

  choices.push({
    id: 'back_story',
    label: 'Return to main Trials story',
    kind: 'continue',
  });

  return {
    id: `ai_hub_${save.trainCount ?? 0}`,
    title: 'Story AI — Crossfall Pulse',
    location: 'Crossfall · Living Director',
    body: lines.join('\n\n'),
    choices,
  };
}

export function generateTrainMenu(save: SaveGame): AiBeat {
  const reading = playerPower(save.player, { formId: save.player.formId ?? 'base' });
  return {
    id: 'ai_train',
    title: 'Training Yard',
    location: 'Crossfall · Gravity Plates',
    body: `Every stat feeds your Power Level. Train one. Dice decide how hard the gain hits.\n\nCurrent PL: ${formatPL(reading.powerLevel)} · Stat total ${reading.statTotal} · Form ×${reading.formMultiplier}`,
    choices: [
      ...TRAIN_STATS.map((stat) => ({
        id: `train_${stat}`,
        label: `Train ${stat[0].toUpperCase()}${stat.slice(1)}`,
        hint: `${ATTR_FOR_STAT[stat]} check · +stat → higher PL`,
        kind: 'train' as const,
        stat,
        attribute: ATTR_FOR_STAT[stat],
        dc: 11 + Math.floor((save.trainCount ?? 0) / 4),
      })),
      { id: 'train_back', label: 'Back to Story AI hub', kind: 'continue' as const },
    ],
  };
}

export function generateStoryMission(save: SaveGame): AiBeat {
  const seed = ensureStorySeed(save) + (save.trainCount ?? 0) * 31;
  const rand = rng(seed);
  const reading = playerPower(save.player, { formId: save.player.formId ?? 'base' });
  const templates = [
    {
      title: 'Saboteur in the Machine District',
      location: 'Glassline Edge',
      body: `A Lumen core is screaming. Your PL (${formatPL(reading.powerLevel)}) makes the street scanners chirp. Someone wants the Axis research erased before the finals.`,
      attr: 'intellect' as AttributeId,
      dc: 13,
    },
    {
      title: 'Gravity Collapse Drill',
      location: 'Cinderstep Exchange',
      body: `Ashbound trainers drop the plate weight. Survive the crush, or burn Energy to stand. Old-school grind — stats first, glory later.`,
      attr: 'grit' as AttributeId,
      dc: 14,
    },
    {
      title: 'Whisper from an Alternate You',
      location: 'Skygrave Echo',
      body: `A Rift flicker shows another version of you already transformed. It mouths a number: ${formatPL(reading.powerLevel * 3)}. The Story AI files it as prophecy or bait.`,
      attr: 'will' as AttributeId,
      dc: 15,
    },
    {
      title: 'Crowd Favor',
      location: 'Arena Approach',
      body: `Fans want a spectacle. Hold your power back for style points, or flash a multiplier and scare the bracket.`,
      attr: 'presence' as AttributeId,
      dc: 12,
    },
  ];
  const t = pick(rand, templates);
  return {
    id: `ai_mission_${seed}`,
    title: t.title,
    location: t.location,
    body: `${t.body}\n\nThe Director waits on your dice.`,
    choices: [
      {
        id: 'mission_roll',
        label: 'Commit — roll the dice',
        hint: `${t.attr} DC ${t.dc}`,
        kind: 'dice',
        attribute: t.attr,
        dc: t.dc,
      },
      {
        id: 'mission_power',
        label: 'Force it with raw Power Level',
        hint: 'Spend Energy; easier if PL is high',
        kind: 'dice',
        attribute: 'might',
        dc: Math.max(8, t.dc - Math.floor(reading.powerLevel / 2000)),
      },
      { id: 'mission_back', label: 'Abort to hub', kind: 'continue' },
    ],
  };
}

export function generateTransformDrill(save: SaveGame): AiBeat {
  const mastery = save.player.ascensionMastery ?? 0;
  const forms = [
    { id: 'base', label: 'Drop to Base (×1)', form: 'base' },
    { id: 'wake', label: 'Tempered Wake (×2.5)', form: 'tempered_wake' },
    ...(mastery >= 2
      ? [{ id: 'master', label: 'Mastered Wake (×4)', form: 'tempered_master' }]
      : []),
    ...(save.flags['Ascension.RiftSync']
      ? [{ id: 'sync', label: 'Rift Sync (×8)', form: 'rift_sync' }]
      : []),
  ];
  return {
    id: 'ai_transform',
    title: 'Transformation Drill',
    location: 'Orr’s Courtyard',
    body: `Forms multiply your whole Power Level — every stat still matters.\nBase → Wake ×2.5 → Mastered ×4 → Rift Sync ×8.\nMastery: ${mastery}`,
    choices: [
      ...forms.map((f) => ({
        id: `form_${f.form}`,
        label: f.label,
        kind: 'transform' as const,
        hint: 'Set active form multiplier',
        stat: f.form,
      })),
      {
        id: 'mastery_push',
        label: 'Push mastery (Will dice)',
        hint: 'DC 14 — raises transform mastery',
        kind: 'dice',
        attribute: 'will',
        dc: 14,
      },
      { id: 'form_back', label: 'Back to hub', kind: 'continue' },
    ],
  };
}

export interface DirectorResult {
  save: SaveGame;
  diceText?: string;
  combatId?: string;
  toast?: string;
  goAuthored?: string;
}

export function applyAiChoice(save: SaveGame, choiceId: string): DirectorResult {
  const next: SaveGame = structuredClone(save);
  next.storySeed = ensureStorySeed(next);
  next.trainCount = next.trainCount ?? 0;
  next.player.trainedStats = next.player.trainedStats ?? {};
  const beat = next.aiBeat;
  const choice = beat?.choices.find((c) => c.id === choiceId);

  // Hub navigation without choice record
  if (choiceId === 'train_menu') {
    next.aiBeat = generateTrainMenu(next);
    return { save: next };
  }
  if (choiceId === 'story_pulse') {
    next.aiBeat = generateStoryMission(next);
    return { save: next };
  }
  if (choiceId === 'transform_drill') {
    next.aiBeat = generateTransformDrill(next);
    return { save: next };
  }
  if (choiceId === 'spar_drone' || choiceId === 'rival_call') {
    next.aiBeat = generateAiHub(next);
    return {
      save: next,
      combatId: choiceId === 'rival_call' ? 'rival_spar' : 'opening_bout',
      toast: choiceId === 'rival_call' ? 'Vexa answers.' : 'Undercourt spar loaded.',
    };
  }
  if (
    choiceId === 'back_story' ||
    choiceId === 'train_back' ||
    choiceId === 'mission_back' ||
    choiceId === 'form_back'
  ) {
    if (choiceId === 'back_story') {
      next.aiBeat = null;
      if (!next.flags['Ai.Visited']) {
        next.flags['Ai.Visited'] = true;
      }
      // Resume authored story if mid-Trials; else stay on a safe scene
      if (!next.sceneId || next.sceneId === 'ai_runtime') {
        next.sceneId = (next.flags['Story.Resume'] as string) || 'trials_intro';
      }
      return { save: next, goAuthored: next.sceneId, toast: 'Back to the Trials script.' };
    }
    next.aiBeat = generateAiHub(next);
    return { save: next };
  }

  if (!choice) {
    next.aiBeat = generateAiHub(next);
    return { save: next, toast: 'Director reset.' };
  }

  // Train
  if (choice.kind === 'train' && choice.stat && choice.attribute) {
    const roll = makeCheck({
      rollType: `Train ${choice.stat}`,
      attributeValue: next.player.attributes[choice.attribute],
      proficiency: Math.floor(next.player.level / 2),
      dc: choice.dc ?? 12,
    });
    const diceText = `${roll.narrative} (${roll.total} vs DC ${roll.targetDc})`;
    let gain = isSuccess(roll.outcomeTier) ? 8 : 3;
    if (roll.outcomeTier === 'strongSuccess') gain = 12;
    if (roll.outcomeTier === 'exceptionalSuccess') gain = 18;
    const stat = choice.stat as keyof BattleStats;
    next.player.trainedStats[stat] = (next.player.trainedStats[stat] ?? 0) + gain;
    next.trainCount += 1;
    next.player.level = 3 + Math.floor(next.trainCount / 5);
    const pl = playerPower(next.player, { formId: next.player.formId ?? 'base' });
    next.log.push(`Trained ${stat} +${gain}. PL now ${formatPL(pl.powerLevel)}.`);
    next.aiBeat = generateAiHub(next);
    return {
      save: next,
      diceText,
      toast: `+${gain} ${stat}. Power Level ${formatPL(pl.powerLevel)}.`,
    };
  }

  // Meditate / dice mission
  if (choice.kind === 'meditate' || choice.kind === 'dice') {
    const attr = choice.attribute ?? 'will';
    const roll = makeCheck({
      rollType: choice.label,
      attributeValue: next.player.attributes[attr],
      proficiency: Math.floor(next.player.level / 2),
      dc: choice.dc ?? 12,
      useRiftDie: choiceId.startsWith('mission_'),
    });
    const diceText = `${roll.narrative} (${roll.total} vs DC ${roll.targetDc})${
      roll.riftEvent ? ` | Rift ${roll.riftDie}: ${roll.riftEvent}` : ''
    }`;
    if (choiceId === 'mastery_push' && isSuccess(roll.outcomeTier)) {
      next.player.ascensionMastery = (next.player.ascensionMastery ?? 0) + 1;
      next.flags['Ascension.TemperedWake'] = true;
      next.player.ascensionUnlocked = true;
      if (next.player.ascensionMastery >= 2) {
        next.player.formId = 'tempered_master';
      }
    }
    if (isSuccess(roll.outcomeTier)) {
      next.player.resolve += 1;
      if (choice.kind === 'meditate') {
        next.flags['Pressure.High'] = false;
      }
      if (choiceId.startsWith('mission_')) {
        next.player.trainedStats.force = (next.player.trainedStats.force ?? 0) + 5;
        next.flags[`Ai.Mission.${beat?.id}`] = 'won';
      }
    } else if (choiceId.startsWith('mission_')) {
      next.flags[`Ai.Mission.${beat?.id}`] = 'fail';
      next.player.trainedStats.endurance = (next.player.trainedStats.endurance ?? 0) + 2;
    }
    next.trainCount += 1;
    next.aiBeat = generateAiHub(next);
    return { save: next, diceText, toast: isSuccess(roll.outcomeTier) ? 'Beat holds.' : 'Fail-forward — still grew.' };
  }

  // Transform form select
  if (choice.kind === 'transform' && choice.stat) {
    const form = choice.stat as SaveGame['player']['formId'];
    next.player.formId = form;
    if (form && form !== 'base') {
      next.player.ascensionUnlocked = true;
      next.flags['Ascension.TemperedWake'] = true;
    }
    const pl = playerPower(next.player, { formId: form, output: 1, ascended: form !== 'base' });
    next.log.push(`Form set: ${form}. PL ${formatPL(pl.powerLevel)} (×${pl.formMultiplier}).`);
    next.aiBeat = generateAiHub(next);
    return {
      save: next,
      toast: `${pl.formName} active — Power Level ${formatPL(pl.powerLevel)} (×${pl.formMultiplier}).`,
    };
  }

  next.aiBeat = generateAiHub(next);
  return { save: next };
}

/** Open Story AI from authored story */
export function openStoryAi(save: SaveGame): SaveGame {
  const next = structuredClone(save);
  next.flags['Story.Resume'] = next.sceneId;
  next.storySeed = ensureStorySeed(next);
  next.sceneId = 'ai_runtime';
  next.aiBeat = generateAiHub(next);
  return next;
}
