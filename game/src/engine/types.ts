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
  | 'gallery';

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
  techniques: string[];
  level: number;
  resolve: number;
  powerBand: PowerBand;
  ascensionUnlocked: boolean;
  ascensionMastery: number;
  catalystReady: boolean;
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

export interface SaveGame {
  version: 1;
  player: PlayerBuild;
  relationships: Record<string, Relationship>;
  flags: GameFlags;
  sceneId: string;
  partyIds: string[];
  hubUnlocked: string[];
  chapter: number;
  log: string[];
}
