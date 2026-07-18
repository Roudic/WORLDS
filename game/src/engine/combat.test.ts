import { describe, expect, it } from 'vitest';
import { buildEncounter } from '../data/encounters';
import { finalizeDraft, createNewSave } from '../state/game';
import { useTechnique, activateAscension } from './combat';

describe('combat encounter', () => {
  it('runs an opening bout attack without crashing', () => {
    const player = finalizeDraft({
      name: 'Test',
      origin: 'crossborn',
      discipline: 'channeler',
      convictionA: 'mercy',
      convictionB: 'truth',
      motivationId: 'answers',
    });
    const save = createNewSave(player);
    const encounter = buildEncounter('opening_bout', save.player, []);
    expect(encounter).not.toBeNull();
    const after = useTechnique(encounter!, 'player', 'rift_lance', 'drone_a');
    expect(after.log.length).toBeGreaterThan(1);
    expect(after.combatants.find((c) => c.id === 'player')!.flux).toBeLessThan(
      encounter!.combatants.find((c) => c.id === 'player')!.flux + 1,
    );
  });

  it('can activate Tempered Wake', () => {
    const player = finalizeDraft({
      name: 'Test',
      origin: 'ashbound',
      discipline: 'vanguard',
      convictionA: 'strength',
      convictionB: 'duty',
      motivationId: 'duty',
    });
    player.catalystReady = true;
    const encounter = buildEncounter('entry_bout', player, ['tamsin'])!;
    const ascended = activateAscension(encounter, 'player', 'tempered_wake', true);
    const p = ascended.combatants.find((c) => c.id === 'player')!;
    expect(p.ascended).toBe(true);
    expect(p.techniques).toContain('tempered_flare');
  });
});
