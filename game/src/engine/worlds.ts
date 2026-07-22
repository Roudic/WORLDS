import type {
  FluxBias,
  ManagedWorld,
  WorldFocus,
  WorldTone,
} from './types';

/** Alias used by the event director */
export type World = ManagedWorld;

const WORLD_NAMES = [
  'Ashveil Reach',
  'Cobalt Meridian',
  'Thornwake Expanse',
  'Glassline Basin',
  'Red Orchard Belt',
  'Nullharbor Drift',
  'Iron Choir Ridge',
  'Pale Current Isles',
];

const ERAS = [
  'First Fracture',
  'Quiet Accord',
  'Skyrail Century',
  'Post-Axis Dawn',
  'Merchant Wake',
];

const FACTIONS: Record<WorldTone, string[]> = {
  war: ['Iron Wake Host', 'Scar Banner', 'Null Choir', 'Riftwardens'],
  intrigue: ['Glass Synod', 'Ash Trade Guild', 'Skycoil Cartel', 'Quiet Path League'],
  discovery: ['Chartwright Circle', 'Wild Choir', 'Harbor Compact', 'Pulse Archive'],
  survival: ['Grainward Circle', 'Dust Compact', 'Last Rail Union', 'Shelter Vow'],
  ascension: ['Tempered Order', 'Wake Tutors', 'Axis Remnant', 'Mythic Cell'],
  politics: ['Harbor Compact', 'Decree Chamber', 'Crossfall Seat', 'Faction of Three'],
};

const ARCS: Record<WorldTone, string> = {
  war: 'Open war of currents',
  intrigue: 'Knives under accords',
  discovery: 'Mapping the wells',
  survival: 'Hold the districts',
  ascension: 'Who earns the multiplier',
  politics: 'Names on the decree',
};

export function createWorld(input: {
  name?: string;
  tone: WorldTone;
  fluxBias?: FluxBias;
  seed?: number;
}): ManagedWorld {
  const seed = input.seed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const name =
    input.name?.trim() ||
    `${WORLD_NAMES[seed % WORLD_NAMES.length]} ${String.fromCharCode(65 + (seed % 26))}`;
  const tone = input.tone;
  const fluxBias =
    input.fluxBias ??
    (['pulse', 'aether', 'lumen', 'riftforce', 'hybrid'] as FluxBias[])[seed % 5];

  const powerCeiling =
    tone === 'war' || tone === 'ascension'
      ? 9000
      : tone === 'survival'
        ? 3500
        : tone === 'discovery'
          ? 5000
          : 4200;

  const pool = FACTIONS[tone];
  return {
    id: `world_${seed.toString(36)}`,
    name,
    seed,
    era: ERAS[seed % ERAS.length],
    fluxBias,
    tone,
    powerCeiling,
    stability: tone === 'war' ? 28 : tone === 'survival' ? 35 : tone === 'intrigue' ? 48 : 55,
    threatLevel: tone === 'war' ? 70 : tone === 'ascension' ? 55 : tone === 'survival' ? 50 : 35,
    storyArc: ARCS[tone],
    storyProgress: 0,
    factions: [pool[seed % pool.length], pool[(seed >> 3) % pool.length]],
    history: [`World forged — ${tone} tone, ${fluxBias} bias, ceiling ${powerCeiling}.`],
    eventCount: 0,
    focus: 'balance',
    createdAt: Date.now(),
  };
}

export function setWorldFocus(world: ManagedWorld, focus: WorldFocus): ManagedWorld {
  return {
    ...world,
    focus,
    history: [...world.history.slice(-39), `Focus set to ${focus}.`],
  };
}

export function raiseCeiling(world: ManagedWorld, amount = 1200): ManagedWorld {
  const powerCeiling = world.powerCeiling + amount;
  const storyProgress = Math.min(100, world.storyProgress + 4);
  return {
    ...world,
    powerCeiling,
    storyProgress,
    storyArc:
      storyProgress >= 75
        ? 'Endgame pressure'
        : storyProgress >= 40
          ? 'Faction rupture'
          : world.storyArc,
    history: [
      ...world.history.slice(-39),
      `Power ceiling raised to ${powerCeiling}. Stronger events can appear.`,
    ],
  };
}

export function applyWorldDelta(
  world: ManagedWorld,
  delta: {
    stability?: number;
    threatLevel?: number;
    storyProgress?: number;
    powerCeiling?: number;
    note?: string;
  },
): ManagedWorld {
  const next: ManagedWorld = {
    ...world,
    stability: clamp(world.stability + (delta.stability ?? 0), 0, 100),
    threatLevel: clamp(world.threatLevel + (delta.threatLevel ?? 0), 0, 100),
    storyProgress: clamp(world.storyProgress + (delta.storyProgress ?? 0), 0, 100),
    powerCeiling: Math.max(500, world.powerCeiling + (delta.powerCeiling ?? 0)),
  };
  if (next.storyProgress >= 75) next.storyArc = 'Endgame pressure';
  else if (next.storyProgress >= 40) next.storyArc = 'Faction rupture';
  else if (next.storyProgress >= 15 && next.storyArc === ARCS[world.tone]) {
    next.storyArc = 'Rising currents';
  }
  if (delta.note) {
    next.history = [...next.history.slice(-39), delta.note];
  }
  return next;
}

export function activeWorld(save: {
  worlds?: ManagedWorld[];
  activeWorldId?: string | null;
}): ManagedWorld | null {
  const worlds = save.worlds ?? [];
  if (!worlds.length) return null;
  return worlds.find((w) => w.id === save.activeWorldId) ?? worlds[0];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
