import { describe, expect, it } from 'vitest';
import { makeCheck, modifier, outcomeFromMargin } from './dice';

describe('modifier', () => {
  it('matches the foundation formula', () => {
    expect(modifier(10)).toBe(0);
    expect(modifier(12)).toBe(1);
    expect(modifier(9)).toBe(-1);
    expect(modifier(20)).toBe(5);
  });
});

describe('outcome ladder', () => {
  it('maps margins to tiers', () => {
    expect(outcomeFromMargin(-10)).toBe('severeFailure');
    expect(outcomeFromMargin(-1)).toBe('failure');
    expect(outcomeFromMargin(0)).toBe('success');
    expect(outcomeFromMargin(5)).toBe('strongSuccess');
    expect(outcomeFromMargin(10)).toBe('exceptionalSuccess');
  });
});

describe('makeCheck', () => {
  it('returns a complete result object', () => {
    let i = 0;
    const seq = [0.95, 0.1]; // ~20 then low
    const rng = () => seq[i++ % seq.length];
    const result = makeCheck({
      rollType: 'Test',
      attributeValue: 14,
      proficiency: 2,
      dc: 12,
      rng,
      useRiftDie: true,
    });
    expect(result.chosenDie).toBeGreaterThanOrEqual(1);
    expect(result.total).toBe(
      result.chosenDie + result.attributeModifier + result.proficiency + result.situationModifiers,
    );
    expect(result.riftDie).toBeGreaterThanOrEqual(1);
    expect(result.riftDie).toBeLessThanOrEqual(6);
    expect(result.narrative).toContain('Test');
  });
});
