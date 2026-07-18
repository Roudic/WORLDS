export type OriginId =
  | 'crossborn'
  | 'ashbound'
  | 'verdant'
  | 'ironwoken'
  | 'lumenborn'
  | 'riftmarked';

export type DisciplineId =
  | 'vanguard'
  | 'channeler'
  | 'slipstream'
  | 'warden'
  | 'weaver'
  | 'artificer'
  | 'envoy';

export type ConvictionId =
  | 'freedom'
  | 'duty'
  | 'mercy'
  | 'strength'
  | 'truth'
  | 'belonging'
  | 'ambition'
  | 'balance';

export type AttributeId =
  | 'might'
  | 'agility'
  | 'control'
  | 'grit'
  | 'intellect'
  | 'will'
  | 'presence';

export type PowerBand =
  | 'mortal'
  | 'awakened'
  | 'ascendant'
  | 'worldClass'
  | 'astral'
  | 'sovereign'
  | 'mythic';

export type OutcomeTier =
  | 'severeFailure'
  | 'failure'
  | 'success'
  | 'strongSuccess'
  | 'exceptionalSuccess';

export type DefeatState =
  | 'unconscious'
  | 'injured'
  | 'captured'
  | 'transformed'
  | 'corrupted'
  | 'separated'
  | 'dead'
  | 'fled'
  | 'surrendered';

export interface Attributes {
  might: number;
  agility: number;
  control: number;
  grit: number;
  intellect: number;
  will: number;
  presence: number;
}

export interface TechniqueDef {
  id: string;
  name: string;
  description: string;
  disciplineTags: DisciplineId[];
  actionCost: 'main' | 'quick' | 'reaction';
  fluxCost: number;
  range: number;
  area: number;
  attackAttribute: AttributeId;
  defense: 'guard' | 'control' | 'will' | 'grit' | 'presence' | 'might';
  damageDice: number;
  damageSides: number;
  impact: number;
  heal?: number;
  conditions?: string[];
  clashEligible?: boolean;
  environmental?: string;
}

export interface AscensionDef {
  id: string;
  name: string;
  description: string;
  source: 'tempered' | 'symbiotic' | 'forged' | 'covenant' | 'catalytic' | 'riftborn';
  powerBandShift: number;
  /** BYOND-style Power Level multiplier while transformed */
  powerMultiplier: number;
  attributeBonus: Partial<Attributes>;
  fluxUpkeep: number;
  pressureGain: number;
  controlDifficulty: number;
  failureConsequence: string;
  grantedTechniqueIds: string[];
  visualLanguage: string;
}

export interface Combatant {
  id: string;
  name: string;
  isPlayer: boolean;
  isCompanion: boolean;
  origin?: OriginId;
  discipline?: DisciplineId;
  attributes: Attributes;
  level: number;
  vitality: number;
  maxVitality: number;
  flux: number;
  maxFlux: number;
  guard: number;
  stagger: number;
  maxStagger: number;
  pressure: number;
  resolve: number;
  powerBand: PowerBand;
  output: number;
  techniques: string[];
  statuses: string[];
  ascensionId?: string;
  ascended: boolean;
  position: number;
  alive: boolean;
  defeatState?: DefeatState;
  aiProfile?: 'aggressive' | 'tactical' | 'protector' | 'volatile';
}

export interface DiceResult {
  rollType: string;
  rawDice: number[];
  chosenDie: number;
  attributeModifier: number;
  proficiency: number;
  situationModifiers: number;
  targetDc: number;
  total: number;
  margin: number;
  outcomeTier: OutcomeTier;
  naturalOne: boolean;
  naturalTwenty: boolean;
  riftDie?: number;
  riftEvent?: string;
  sourceTags: string[];
  narrative: string;
}

export interface ClashChoice {
  id: 'push' | 'overcharge' | 'redirect' | 'call' | 'release';
  label: string;
  description: string;
}

export type EndingId =
  | 'destroy'
  | 'stabilize'
  | 'synchronize'
  | 'release'
  | 'lose';

export type ScreenId =
  | 'title'
  | 'create'
  | 'hub'
  | 'scene'
  | 'combat'
  | 'clash'
  | 'ending'
  | 'sheet'
  | 'gallery'
  | 'worlds'
  | 'world_create'
  | 'event';

export interface CompanionDef {
  id: string;
  name: string;
  title: string;
  origin: OriginId;
  discipline: DisciplineId;
  conviction: ConvictionId;
  blurb: string;
  attributes: Attributes;
  techniques: string[];
  fear: string;
  ambition: string;
}

export interface PlayerBuild {
  name: string;
  origin: OriginId;
  discipline: DisciplineId;
  secondaryDiscipline?: DisciplineId;
  convictions: [ConvictionId, ConvictionId];
  motivation: string;
  attributes: Attributes;
  /** Extra points from training (BYOND-style grind) */
  trainedStats?: Partial<{
    strength: number;
    endurance: number;
    speed: number;
    resistance: number;
    offense: number;
    defense: number;
    force: number;
  }>;
  techniques: string[];
  level: number;
  resolve: number;
  powerBand: PowerBand;
  ascensionUnlocked: boolean;
  ascensionMastery: number;
  catalystReady: boolean;
  /** Active transform form id */
  formId?: 'base' | 'tempered_wake' | 'tempered_master' | 'rift_sync' | 'mythic_wake';
}

export interface Relationship {
  approval: number;
  trust: number;
  alive: boolean;
  recruited: boolean;
  inParty: boolean;
}

export interface GameFlags {
  [key: string]: boolean | number | string;
}

export interface AiBeat {
  id: string;
  title: string;
  location: string;
  body: string;
  choices: {
    id: string;
    label: string;
    hint?: string;
    kind:
      | 'train'
      | 'spar'
      | 'story'
      | 'meditate'
      | 'transform'
      | 'rival'
      | 'continue'
      | 'dice';
    stat?: string;
    dc?: number;
    attribute?: AttributeId;
  }[];
}

export type FluxBias = 'pulse' | 'aether' | 'lumen' | 'riftforce' | 'hybrid';
export type WorldTone = 'war' | 'intrigue' | 'discovery' | 'survival' | 'ascension' | 'politics';
export type WorldFocus = 'stabilize' | 'empower' | 'story' | 'balance';

export interface ManagedWorld {
  id: string;
  name: string;
  seed: number;
  era: string;
  fluxBias: FluxBias;
  tone: WorldTone;
  /** Soft PL ceiling — events & threats scale under this band */
  powerCeiling: number;
  stability: number;
  threatLevel: number;
  storyArc: string;
  storyProgress: number;
  factions: string[];
  history: string[];
  eventCount: number;
  focus: WorldFocus;
  createdAt: number;
}

export interface WorldEventChoice {
  id: string;
  label: string;
  hint?: string;
  attribute?: AttributeId;
  dc?: number;
  lean?: Array<
    | 'strength'
    | 'endurance'
    | 'speed'
    | 'resistance'
    | 'offense'
    | 'defense'
    | 'force'
  >;
  convictionTouch?: string;
}

export interface WorldEvent {
  id: string;
  title: string;
  tag: string;
  body: string;
  choices: WorldEventChoice[];
}

export interface DevEntry {
  id: string;
  at: number;
  worldId: string;
  worldName: string;
  eventTitle: string;
  reason: string;
  gains: string[];
}

export interface SaveGame {
  version: 1 | 2 | 3;
  player: PlayerBuild;
  relationships: Record<string, Relationship>;
  flags: GameFlags;
  sceneId: string;
  partyIds: string[];
  hubUnlocked: string[];
  chapter: number;
  log: string[];
  /** Live Story AI beat (procedural director) */
  aiBeat?: AiBeat | null;
  storySeed?: number;
  trainCount?: number;
  /** Managed worlds sandbox */
  worlds?: ManagedWorld[];
  activeWorldId?: string | null;
  /** Active random AI event */
  currentEvent?: WorldEvent | null;
  /** Character development journal — gains with reasons */
  developmentLog?: DevEntry[];
}
