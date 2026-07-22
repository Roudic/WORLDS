import { describe, expect, it } from 'vitest';
import { finalizeDraft } from '../state/game';
import {
  attributesToBattleStats,
  combatProfile,
  computePowerLevel,
  effectivePowerLevel,
  formatPL,
  hiddenDepthFactor,
  momentumDamageMult,
  playerPower,
  powerDamageMult,
  suppressedReading,
} from './power';

describe('BYOND-style power level', () => {
  it('sums all battle stats then applies form multiplier', () => {
    const player = finalizeDraft({
      name: 'Goku-ish',
      origin: 'ashbound',
      discipline: 'vanguard',
      convictionA: 'strength',
      convictionB: 'duty',
      motivationId: 'duty',
    });
    const base = playerPower(player, { output: 1, formId: 'base' });
    const wake = playerPower(player, { output: 1, formId: 'tempered_wake' });
    expect(wake.formMultiplier).toBe(2.5);
    expect(wake.powerLevel).toBeGreaterThan(base.powerLevel * 2.4);
    expect(wake.powerLevel).toBeLessThan(base.powerLevel * 2.6 + 3);
  });

  it('training raises the shared power pool', () => {
    const stats = attributesToBattleStats({
      might: 12,
      agility: 12,
      control: 12,
      grit: 12,
      intellect: 10,
      will: 12,
      presence: 10,
    });
    const a = computePowerLevel({ stats, formId: 'base', output: 1 });
    const trained = { ...stats, strength: stats.strength + 50, force: stats.force + 50 };
    const b = computePowerLevel({ stats: trained, formId: 'base', output: 1 });
    expect(b.powerLevel).toBeGreaterThan(a.powerLevel);
  });

  it('formats and scales damage by PL gap', () => {
    expect(formatPL(15000)).toContain('15');
    expect(formatPL(1500).replace(',', '')).toContain('1500');
    expect(powerDamageMult(9000, 1000)).toBeGreaterThan(1);
    expect(powerDamageMult(500, 9000)).toBeLessThan(0.5);
  });
});

describe('Power Level v2 — depth, tempo, deception', () => {
  it('hidden depth stays within a believable reserve band', () => {
    const low = hiddenDepthFactor(8, 8, 1);
    const high = hiddenDepthFactor(20, 20, 10);
    expect(low).toBeGreaterThanOrEqual(0.15);
    expect(high).toBeLessThanOrEqual(0.5);
    expect(high).toBeGreaterThan(low);
  });

  it('momentum swings damage both ways around neutral', () => {
    expect(momentumDamageMult(0)).toBeCloseTo(1, 5);
    expect(momentumDamageMult(100)).toBeGreaterThan(1.3);
    expect(momentumDamageMult(-100)).toBeLessThan(0.75);
  });

  it('awakened depths and hot tempo raise effective power', () => {
    const base = 1000;
    const calm = effectivePowerLevel(base, { momentum: 0 });
    const surged = effectivePowerLevel(base, {
      momentum: 90,
      depthsAwakened: true,
      hiddenDepth: 0.3,
      vitalityPct: 0.2,
    });
    expect(calm).toBe(1000);
    expect(surged).toBeGreaterThan(base * 1.4);
  });

  it('suppression makes a scanner read low until revealed', () => {
    expect(suppressedReading(1000, 0.6)).toBe(400);
    expect(suppressedReading(1000, 0)).toBe(1000);
    expect(suppressedReading(1000, 2)).toBe(100);
  });

  it('reads distinct combat profiles from stat spreads', () => {
    const striker = combatProfile({
      strength: 200,
      endurance: 20,
      speed: 200,
      resistance: 20,
      offense: 260,
      defense: 20,
      force: 20,
    });
    const bulwark = combatProfile({
      strength: 20,
      endurance: 220,
      speed: 20,
      resistance: 220,
      offense: 20,
      defense: 260,
      force: 20,
    });
    expect(striker.id).toBe('striker');
    expect(bulwark.id).toBe('bulwark');
  });
});
