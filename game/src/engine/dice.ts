import type { DiceResult, OutcomeTier } from './types';

export function rollDie(sides: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollDice(
  count: number,
  sides: number,
  rng: () => number = Math.random,
): number[] {
  return Array.from({ length: count }, () => rollDie(sides, rng));
}

export function modifier(attribute: number): number {
  return Math.floor((attribute - 10) / 2);
}

export function outcomeFromMargin(margin: number): OutcomeTier {
  if (margin <= -10) return 'severeFailure';
  if (margin < 0) return 'failure';
  if (margin >= 10) return 'exceptionalSuccess';
  if (margin >= 5) return 'strongSuccess';
  return 'success';
}

const RIFT_EVENTS: Record<number, string> = {
  1: 'Fracture: a new danger or reality breach appears',
  2: 'Cost: the result consumes extra Flux, time, equipment, or trust',
  3: 'Shift: the environment or objective changes',
  4: 'Opening: a new route, weakness, or conversation becomes available',
  5: 'Boon: an unexpected ally, memory, or resource intervenes',
  6: 'Anomaly: a rare event with long-term story consequences',
};

export interface CheckRequest {
  rollType: string;
  attributeValue: number;
  proficiency?: number;
  situation?: number;
  dc: number;
  advantage?: boolean;
  disadvantage?: boolean;
  useRiftDie?: boolean;
  sourceTags?: string[];
  rng?: () => number;
}

export function makeCheck(req: CheckRequest): DiceResult {
  const rng = req.rng ?? Math.random;
  const attrMod = modifier(req.attributeValue);
  const proficiency = req.proficiency ?? 0;
  const situation = req.situation ?? 0;

  let raw: number[];
  if (req.advantage && !req.disadvantage) {
    raw = [rollDie(20, rng), rollDie(20, rng)];
  } else if (req.disadvantage && !req.advantage) {
    raw = [rollDie(20, rng), rollDie(20, rng)];
  } else {
    raw = [rollDie(20, rng)];
  }

  let chosen = raw[0];
  if (req.advantage && !req.disadvantage) chosen = Math.max(...raw);
  if (req.disadvantage && !req.advantage) chosen = Math.min(...raw);

  const naturalOne = chosen === 1;
  const naturalTwenty = chosen === 20;
  let total = chosen + attrMod + proficiency + situation;
  let margin = total - req.dc;
  let tier = outcomeFromMargin(margin);

  if (naturalTwenty) {
    tier = upgradeTier(tier);
  }
  if (naturalOne) {
    tier = downgradeTier(tier);
  }

  let riftDie: number | undefined;
  let riftEvent: string | undefined;
  if (req.useRiftDie) {
    riftDie = rollDie(6, rng);
    riftEvent = RIFT_EVENTS[riftDie];
  }

  const narrative = describeOutcome(req.rollType, tier, margin, naturalOne, naturalTwenty);

  return {
    rollType: req.rollType,
    rawDice: raw,
    chosenDie: chosen,
    attributeModifier: attrMod,
    proficiency,
    situationModifiers: situation,
    targetDc: req.dc,
    total,
    margin,
    outcomeTier: tier,
    naturalOne,
    naturalTwenty,
    riftDie,
    riftEvent,
    sourceTags: req.sourceTags ?? [],
    narrative,
  };
}

function upgradeTier(tier: OutcomeTier): OutcomeTier {
  const order: OutcomeTier[] = [
    'severeFailure',
    'failure',
    'success',
    'strongSuccess',
    'exceptionalSuccess',
  ];
  return order[Math.min(order.indexOf(tier) + 1, order.length - 1)];
}

function downgradeTier(tier: OutcomeTier): OutcomeTier {
  const order: OutcomeTier[] = [
    'severeFailure',
    'failure',
    'success',
    'strongSuccess',
    'exceptionalSuccess',
  ];
  return order[Math.max(order.indexOf(tier) - 1, 0)];
}

function describeOutcome(
  rollType: string,
  tier: OutcomeTier,
  margin: number,
  nat1: boolean,
  nat20: boolean,
): string {
  const special = nat20 ? ' Natural 20.' : nat1 ? ' Natural 1.' : '';
  switch (tier) {
    case 'severeFailure':
      return `${rollType} collapses into severe failure (margin ${margin}).${special}`;
    case 'failure':
      return `${rollType} fails, but the story moves (margin ${margin}).${special}`;
    case 'success':
      return `${rollType} succeeds (margin ${margin}).${special}`;
    case 'strongSuccess':
      return `${rollType} lands cleanly with advantage (margin ${margin}).${special}`;
    case 'exceptionalSuccess':
      return `${rollType} reshapes the moment (margin ${margin}).${special}`;
  }
}

export function damageRoll(
  count: number,
  sides: number,
  bonus: number,
  rng: () => number = Math.random,
): { rolls: number[]; total: number } {
  const rolls = rollDice(count, sides, rng);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + bonus };
}

export function isSuccess(tier: OutcomeTier): boolean {
  return (
    tier === 'success' ||
    tier === 'strongSuccess' ||
    tier === 'exceptionalSuccess'
  );
}
