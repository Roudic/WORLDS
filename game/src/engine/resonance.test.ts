import { describe, expect, it } from 'vitest';
import { finalizeDraft } from '../state/game';
import { formatResonance, playerResonance, powerGapFlavor } from './resonance';

describe('resonance', () => {
  it('scales hard when output and ascension open', () => {
    const player = finalizeDraft({
      name: 'Spark',
      origin: 'ashbound',
      discipline: 'vanguard',
      convictionA: 'strength',
      convictionB: 'duty',
      motivationId: 'duty',
    });
    const held = playerResonance(player, { output: 0.4, ascended: false });
    const open = playerResonance(
      { ...player, powerBand: 'awakened', ascensionUnlocked: true, ascensionMastery: 1 },
      { output: 1, ascended: true },
    );
    expect(open.displayed).toBeGreaterThan(held.displayed * 5);
    expect(formatResonance(open.displayed)).toMatch(/\d/);
  });

  it('describes power gaps', () => {
    expect(powerGapFlavor('mortal', 'awakened')).toContain('disadvantage');
    expect(powerGapFlavor('mortal', 'ascendant')).toContain('setup');
    expect(powerGapFlavor('awakened', 'mortal')).toContain('outclass');
  });
});
