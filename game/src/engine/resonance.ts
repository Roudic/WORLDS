import type { Attributes, Combatant, PlayerBuild, PowerBand } from './types';
import { POWER_BAND_SCALE, POWER_BANDS, bandGap, computeResonance } from './attributes';
import { modifier } from './dice';

export const BAND_LABELS: Record<PowerBand, string> = {
  mortal: 'Mortal',
  awakened: 'Awakened',
  ascendant: 'Ascendant',
  worldClass: 'World-Class',
  astral: 'Astral',
  sovereign: 'Sovereign',
  mythic: 'Mythic',
};

export const BAND_SCOPE: Record<PowerBand, string> = {
  mortal: 'Skilled fighters and local threats',
  awakened: 'District-shaking superhuman output',
  ascendant: 'Army-breaking champions',
  worldClass: 'Nation / continent reshapers',
  astral: 'Planetary and dimensional forces',
  sovereign: 'Multi-world Axis masters',
  mythic: 'Reality-defining entities',
};

export interface ResonanceBreakdown {
  coreScore: number;
  scaleFactor: number;
  formFactor: number;
  output: number;
  condition: number;
  displayed: number;
  band: PowerBand;
  bandLabel: string;
  suppressed: boolean;
  spiked: boolean;
}

export function coreScoreFromAttrs(level: number, attrs: Attributes, masteryBonus = 0): number {
  return (
    level * 10 +
    attrs.might +
    attrs.agility +
    attrs.control +
    attrs.grit +
    attrs.will +
    Math.floor((attrs.intellect + attrs.presence) / 2) +
    masteryBonus
  );
}

export function conditionFactor(opts: {
  vitalityRatio: number;
  pressure: number;
  statuses: string[];
}): number {
  let c = 0.75 + opts.vitalityRatio * 0.35;
  if (opts.pressure >= 8) c += 0.08;
  if (opts.statuses.includes('staggered')) c -= 0.12;
  if (opts.statuses.includes('bound')) c -= 0.08;
  if (opts.statuses.includes('focused')) c += 0.05;
  return Math.max(0.35, Math.min(1.25, c));
}

export function formFactor(ascended: boolean, ascensionMastery = 0): number {
  if (!ascended) return 1;
  return 1.8 + ascensionMastery * 0.15;
}

export function readResonance(opts: {
  level: number;
  attributes: Attributes;
  powerBand: PowerBand;
  output: number;
  ascended: boolean;
  vitality: number;
  maxVitality: number;
  pressure: number;
  statuses: string[];
  masteryBonus?: number;
  ascensionMastery?: number;
}): ResonanceBreakdown {
  const core = coreScoreFromAttrs(opts.level, opts.attributes, opts.masteryBonus ?? 0);
  const form = formFactor(opts.ascended, opts.ascensionMastery ?? 0);
  const condition = conditionFactor({
    vitalityRatio: opts.vitality / Math.max(1, opts.maxVitality),
    pressure: opts.pressure,
    statuses: opts.statuses,
  });
  const displayed = computeResonance(
    core,
    opts.powerBand,
    form,
    opts.output,
    condition,
  );
  return {
    coreScore: core,
    scaleFactor: POWER_BAND_SCALE[opts.powerBand],
    formFactor: form,
    output: opts.output,
    condition,
    displayed,
    band: opts.powerBand,
    bandLabel: BAND_LABELS[opts.powerBand],
    suppressed: opts.output <= 0.35,
    spiked: opts.output >= 0.95,
  };
}

export function combatantResonance(c: Combatant, mastery = 0): ResonanceBreakdown {
  return readResonance({
    level: c.level,
    attributes: c.attributes,
    powerBand: c.powerBand,
    output: c.output,
    ascended: c.ascended,
    vitality: c.vitality,
    maxVitality: c.maxVitality,
    pressure: c.pressure,
    statuses: c.statuses,
    masteryBonus: mastery,
    ascensionMastery: c.ascended ? 1 : 0,
  });
}

export function playerResonance(player: PlayerBuild, opts?: { output?: number; ascended?: boolean }): ResonanceBreakdown {
  return readResonance({
    level: player.level,
    attributes: player.attributes,
    powerBand: player.powerBand,
    output: opts?.output ?? 0.6,
    ascended: opts?.ascended ?? player.ascensionUnlocked,
    vitality: 100,
    maxVitality: 100,
    pressure: 0,
    statuses: [],
    masteryBonus: player.ascensionMastery * 4,
    ascensionMastery: player.ascensionMastery,
  });
}

export function formatResonance(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function powerGapFlavor(attackerBand: PowerBand, defenderBand: PowerBand): string {
  const gap = bandGap(defenderBand, attackerBand);
  if (gap >= 3) return 'They are far above your class — normal hits will not hurt them. Find another way.';
  if (gap === 2) return 'Bad matchup — you need a weakness, setup, or all-out transform.';
  if (gap === 1) return 'They are stronger — power up or scan for an opening.';
  if (gap === 0) return 'Even match — fight on equal footing.';
  if (gap === -1) return 'You are stronger — keep the pressure on.';
  return 'Huge advantage — finish it, or hold back.';
}

export function outputLabel(output: number): string {
  if (output <= 0.25) return 'Hidden';
  if (output <= 0.45) return 'Held back';
  if (output <= 0.65) return 'Normal';
  if (output <= 0.85) return 'Pushing hard';
  return 'All-out';
}

export function attributeBars(attrs: Attributes): { id: keyof Attributes; label: string; value: number; mod: number }[] {
  const labels: Record<keyof Attributes, string> = {
    might: 'Might',
    agility: 'Agility',
    control: 'Control',
    grit: 'Grit',
    intellect: 'Intellect',
    will: 'Will',
    presence: 'Presence',
  };
  return (Object.keys(labels) as (keyof Attributes)[]).map((id) => ({
    id,
    label: labels[id],
    value: attrs[id],
    mod: modifier(attrs[id]),
  }));
}

export function bandTrack(band: PowerBand): { id: PowerBand; label: string; active: boolean; reached: boolean }[] {
  const idx = POWER_BANDS.indexOf(band);
  return POWER_BANDS.map((b, i) => ({
    id: b,
    label: BAND_LABELS[b],
    active: i === idx,
    reached: i <= idx,
  }));
}

/** Famous Crossfall scanner baselines for fantasy comparison */
export const RESONANCE_BENCHMARKS = [
  { name: 'Street duelist', value: 120, band: 'mortal' as PowerBand },
  { name: 'Trial contender', value: 480, band: 'mortal' as PowerBand },
  { name: 'Vexa (held)', value: 4200, band: 'awakened' as PowerBand },
  { name: 'Vexa (open)', value: 9800, band: 'awakened' as PowerBand },
  { name: 'Axis Custodian spike', value: 22000, band: 'awakened' as PowerBand },
  { name: 'Regional Ascendant', value: 85000, band: 'ascendant' as PowerBand },
];
