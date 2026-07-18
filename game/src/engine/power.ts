/**
 * BYOND-era style battle power:
 * every combat stat feeds one Power Level, then transformations multiply it.
 * Original Riftwake names; classic Finales-style math.
 */
import type { Attributes, Combatant, PlayerBuild, PowerBand } from './types';
import { POWER_BANDS } from './attributes';

export interface BattleStats {
  strength: number;
  endurance: number;
  speed: number;
  resistance: number;
  offense: number;
  defense: number;
  force: number;
}

export type FormId = 'base' | 'tempered_wake' | 'tempered_master' | 'rift_sync' | 'mythic_wake';

export interface FormDef {
  id: FormId;
  name: string;
  multiplier: number;
  energyDrain: number;
  unlockFlag?: string;
  minMastery?: number;
  description: string;
}

/** Classic platform-game style forms — multipliers stack on total Power Level */
export const FORMS: Record<FormId, FormDef> = {
  base: {
    id: 'base',
    name: 'Base Form',
    multiplier: 1,
    energyDrain: 0,
    description: 'Your natural output. No multiplier.',
  },
  tempered_wake: {
    id: 'tempered_wake',
    name: 'Tempered Wake',
    multiplier: 2.5,
    energyDrain: 2,
    unlockFlag: 'Ascension.TemperedWake',
    description: 'First controlled transform. Power Level ×2.5',
  },
  tempered_master: {
    id: 'tempered_master',
    name: 'Tempered Wake (Mastered)',
    multiplier: 4,
    energyDrain: 1,
    unlockFlag: 'Ascension.TemperedWake',
    minMastery: 2,
    description: 'Stabilized wake. Power Level ×4, lower drain.',
  },
  rift_sync: {
    id: 'rift_sync',
    name: 'Rift Sync',
    multiplier: 8,
    energyDrain: 3,
    unlockFlag: 'Ascension.RiftSync',
    description: 'Dangerous sync with Axis feedback. Power Level ×8',
  },
  mythic_wake: {
    id: 'mythic_wake',
    name: 'Mythic Wake',
    multiplier: 15,
    energyDrain: 4,
    unlockFlag: 'Form.MythicWake',
    description: 'Endgame surge. Power Level ×15',
  },
};

export const STAT_LABELS: Record<keyof BattleStats, string> = {
  strength: 'Strength',
  endurance: 'Endurance',
  speed: 'Speed',
  resistance: 'Resistance',
  offense: 'Offense',
  defense: 'Defense',
  force: 'Force',
};

/** Convert RPG attributes into trainable BYOND-style battle stats */
export function attributesToBattleStats(a: Attributes, trained?: Partial<BattleStats>): BattleStats {
  const base: BattleStats = {
    strength: a.might * 12,
    endurance: a.grit * 12,
    speed: a.agility * 12,
    resistance: a.will * 12,
    offense: Math.round((a.might + a.presence) * 6),
    defense: Math.round((a.grit + a.agility) * 6),
    force: a.control * 12,
  };
  if (!trained) return base;
  return {
    strength: base.strength + (trained.strength ?? 0),
    endurance: base.endurance + (trained.endurance ?? 0),
    speed: base.speed + (trained.speed ?? 0),
    resistance: base.resistance + (trained.resistance ?? 0),
    offense: base.offense + (trained.offense ?? 0),
    defense: base.defense + (trained.defense ?? 0),
    force: base.force + (trained.force ?? 0),
  };
}

export function statSum(stats: BattleStats): number {
  return (
    stats.strength +
    stats.endurance +
    stats.speed +
    stats.resistance +
    stats.offense +
    stats.defense +
    stats.force
  );
}

/** Anger / stress multiplier — old games loved this */
export function angerMultiplier(pressure: number): number {
  return 1 + Math.min(0.5, pressure * 0.04);
}

export interface PowerReading {
  stats: BattleStats;
  statTotal: number;
  formId: FormId;
  formName: string;
  formMultiplier: number;
  output: number;
  angerMult: number;
  /** True displayed Power Level */
  powerLevel: number;
  /** Held-back reading (scouters / suppression) */
  shownPowerLevel: number;
  band: PowerBand;
  bandLabel: string;
}

export function bandFromPowerLevel(pl: number): PowerBand {
  if (pl >= 5_000_000) return 'mythic';
  if (pl >= 800_000) return 'sovereign';
  if (pl >= 120_000) return 'astral';
  if (pl >= 25_000) return 'worldClass';
  if (pl >= 6_000) return 'ascendant';
  if (pl >= 1_200) return 'awakened';
  return 'mortal';
}

const BAND_LABELS: Record<PowerBand, string> = {
  mortal: 'Mortal',
  awakened: 'Awakened',
  ascendant: 'Ascendant',
  worldClass: 'World-Class',
  astral: 'Astral',
  sovereign: 'Sovereign',
  mythic: 'Mythic',
};

export function computePowerLevel(opts: {
  stats: BattleStats;
  formId: FormId;
  output: number; // 0.2–1
  pressure?: number;
  level?: number;
}): PowerReading {
  const form = FORMS[opts.formId] ?? FORMS.base;
  const total = statSum(opts.stats);
  const angerMult = angerMultiplier(opts.pressure ?? 0);
  const levelPad = 1 + ((opts.level ?? 1) - 1) * 0.03;
  // Classic feel: all stats → one number, then form multiplies hard
  const powerLevel = Math.max(
    1,
    Math.floor(total * form.multiplier * opts.output * angerMult * levelPad),
  );
  const shown = Math.max(1, Math.floor(powerLevel * Math.min(1, opts.output / 0.6)));
  const band = bandFromPowerLevel(powerLevel);
  return {
    stats: opts.stats,
    statTotal: total,
    formId: form.id,
    formName: form.name,
    formMultiplier: form.multiplier,
    output: opts.output,
    angerMult,
    powerLevel,
    shownPowerLevel: shown,
    band,
    bandLabel: BAND_LABELS[band],
  };
}

export function playerPower(
  player: PlayerBuild & { trainedStats?: Partial<BattleStats>; formId?: FormId },
  opts?: { output?: number; pressure?: number; formId?: FormId; ascended?: boolean },
): PowerReading {
  const stats = attributesToBattleStats(player.attributes, player.trainedStats);
  let formId: FormId = opts?.formId ?? player.formId ?? 'base';
  if (opts?.ascended && formId === 'base') {
    if ((player.ascensionMastery ?? 0) >= 2) formId = 'tempered_master';
    else if (player.ascensionUnlocked) formId = 'tempered_wake';
  }
  return computePowerLevel({
    stats,
    formId,
    output: opts?.output ?? 0.6,
    pressure: opts?.pressure ?? 0,
    level: player.level,
  });
}

export function combatantPower(c: Combatant, formId: FormId = 'base'): PowerReading {
  const form: FormId = c.ascended
    ? c.ascensionId === 'rift_sync'
      ? 'rift_sync'
      : c.ascensionId === 'tempered_wake'
        ? 'tempered_wake'
        : 'tempered_wake'
    : formId;
  const stats = attributesToBattleStats(c.attributes);
  return computePowerLevel({
    stats,
    formId: form,
    output: c.output,
    pressure: c.pressure,
    level: c.level,
  });
}

export function formatPL(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString('en-US');
}

/** Damage scale from power gap — weaker fighters tickle unless they set up */
export function powerDamageMult(attackerPL: number, defenderPL: number): number {
  if (defenderPL <= 0) return 1;
  const ratio = attackerPL / defenderPL;
  if (ratio >= 3) return 2.2;
  if (ratio >= 1.5) return 1.4;
  if (ratio >= 0.85) return 1;
  if (ratio >= 0.5) return 0.55;
  if (ratio >= 0.25) return 0.25;
  return 0.08;
}

export function availableForms(flags: Record<string, unknown>, mastery: number): FormDef[] {
  return Object.values(FORMS).filter((f) => {
    if (!f.unlockFlag && f.id === 'base') return true;
    if (!f.unlockFlag) return true;
    if (!flags[f.unlockFlag]) return false;
    if (f.minMastery && mastery < f.minMastery) return false;
    return true;
  });
}

export function trainStat(
  trained: Partial<BattleStats>,
  stat: keyof BattleStats,
  amount: number,
): Partial<BattleStats> {
  return { ...trained, [stat]: (trained[stat] ?? 0) + amount };
}

export { BAND_LABELS, POWER_BANDS };
