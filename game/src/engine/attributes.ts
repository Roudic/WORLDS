import type {
  Attributes,
  AttributeId,
  OriginId,
  DisciplineId,
  PowerBand,
  PlayerBuild,
} from './types';
import { modifier } from './dice';

export const POWER_BAND_SCALE: Record<PowerBand, number> = {
  mortal: 1,
  awakened: 10,
  ascendant: 100,
  worldClass: 1000,
  astral: 10000,
  sovereign: 100000,
  mythic: 1000000,
};

export const POWER_BANDS: PowerBand[] = [
  'mortal',
  'awakened',
  'ascendant',
  'worldClass',
  'astral',
  'sovereign',
  'mythic',
];

export const ORIGIN_BASE: Record<
  OriginId,
  { vitality: number; traits: string; attributes: Partial<Attributes> }
> = {
  crossborn: {
    vitality: 28,
    traits: 'Flexible skill selection and social adaptability',
    attributes: { presence: 1, intellect: 1 },
  },
  ashbound: {
    vitality: 34,
    traits: 'Durability and stored-impact techniques',
    attributes: { grit: 2, might: 1 },
  },
  verdant: {
    vitality: 30,
    traits: 'Healing, senses, and environmental control',
    attributes: { will: 1, control: 1 },
  },
  ironwoken: {
    vitality: 32,
    traits: 'Modular body upgrades and status resistance',
    attributes: { grit: 1, intellect: 1 },
  },
  lumenborn: {
    vitality: 26,
    traits: 'Precision, analysis, and energy efficiency',
    attributes: { control: 2, intellect: 1 },
  },
  riftmarked: {
    vitality: 27,
    traits: 'Unpredictable powers and reality manipulation',
    attributes: { will: 2, presence: 1 },
  },
};

export const DISCIPLINE_BASE: Record<
  DisciplineId,
  { flux: number; focus: AttributeId; blurb: string }
> = {
  vanguard: { flux: 10, focus: 'might', blurb: 'Close-range pressure, grapples, launches' },
  channeler: { flux: 16, focus: 'control', blurb: 'Ranged Flux techniques, zones, blasts' },
  slipstream: { flux: 12, focus: 'agility', blurb: 'Speed, repositioning, aerial counters' },
  warden: { flux: 12, focus: 'grit', blurb: 'Protection, interception, barriers' },
  weaver: { flux: 15, focus: 'will', blurb: 'Aether effects, summons, terrain' },
  artificer: { flux: 14, focus: 'intellect', blurb: 'Lumen weapons, drones, traps, scans' },
  envoy: { flux: 11, focus: 'presence', blurb: 'Morale, bonds, commands, deception' },
};

export function baseAttributes(): Attributes {
  return {
    might: 10,
    agility: 10,
    control: 10,
    grit: 10,
    intellect: 10,
    will: 10,
    presence: 10,
  };
}

export function applyPartial(
  base: Attributes,
  partial?: Partial<Attributes>,
): Attributes {
  return {
    might: base.might + (partial?.might ?? 0),
    agility: base.agility + (partial?.agility ?? 0),
    control: base.control + (partial?.control ?? 0),
    grit: base.grit + (partial?.grit ?? 0),
    intellect: base.intellect + (partial?.intellect ?? 0),
    will: base.will + (partial?.will ?? 0),
    presence: base.presence + (partial?.presence ?? 0),
  };
}

export function computeVitality(
  origin: OriginId,
  grit: number,
  level: number,
): number {
  return ORIGIN_BASE[origin].vitality + modifier(grit) * 5 + level * 3;
}

export function computeFlux(
  discipline: DisciplineId,
  control: number,
  will: number,
): number {
  return (
    DISCIPLINE_BASE[discipline].flux +
    modifier(control) * 3 +
    modifier(will) * 2
  );
}

export function computeGuard(agility: number, gear = 0, effects = 0): number {
  return 10 + modifier(agility) + gear + effects;
}

export function computeStagger(grit: number, level: number): number {
  return 12 + modifier(grit) * 2 + level;
}

export function computeResonance(
  coreScore: number,
  band: PowerBand,
  formFactor: number,
  output: number,
  condition: number,
): number {
  return Math.round(
    coreScore * POWER_BAND_SCALE[band] * formFactor * output * condition,
  );
}

export function bandGap(a: PowerBand, b: PowerBand): number {
  return POWER_BANDS.indexOf(a) - POWER_BANDS.indexOf(b);
}

export function shiftBand(band: PowerBand, steps: number): PowerBand {
  const idx = Math.min(
    Math.max(POWER_BANDS.indexOf(band) + steps, 0),
    POWER_BANDS.length - 1,
  );
  return POWER_BANDS[idx];
}

export function buildStarterAttributes(
  origin: OriginId,
  discipline: DisciplineId,
): Attributes {
  let attrs = applyPartial(baseAttributes(), ORIGIN_BASE[origin].attributes);
  const focus = DISCIPLINE_BASE[discipline].focus;
  attrs = applyPartial(attrs, { [focus]: 2 });
  // Distribute remaining growth for a playable starter
  attrs = applyPartial(attrs, { grit: 1, will: 1 });
  return attrs;
}

export function playerDerived(player: PlayerBuild) {
  const vitality = computeVitality(player.origin, player.attributes.grit, player.level);
  const flux = computeFlux(
    player.discipline,
    player.attributes.control,
    player.attributes.will,
  );
  const guard = computeGuard(player.attributes.agility);
  const stagger = computeStagger(player.attributes.grit, player.level);
  const resonance = computeResonance(
    player.level * 8 + player.attributes.will + player.attributes.control,
    player.powerBand,
    1,
    0.6,
    1,
  );
  return { vitality, flux, guard, stagger, resonance };
}
