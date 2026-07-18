import { describe, expect, it } from 'vitest';
import { finalizeDraft } from '../state/game';
import {
  attributesToBattleStats,
  computePowerLevel,
  formatPL,
  playerPower,
  powerDamageMult,
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
