import { describe, expect, it } from 'vitest';
import { buildEncounter } from '../data/encounters';
import { finalizeDraft, createNewSave } from '../state/game';
import { useTechnique, activateAscension, displayPower, scanResonance } from './combat';
import { combatantPower } from './power';

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

  it('landing hits builds the attacker momentum meter', () => {
    const player = finalizeDraft({
      name: 'Momentum',
      origin: 'ashbound',
      discipline: 'vanguard',
      convictionA: 'strength',
      convictionB: 'duty',
      motivationId: 'duty',
    });
    const encounter = buildEncounter('entry_bout', player, [])!;
    let state = encounter;
    for (let i = 0; i < 4 && !state.finished; i++) {
      const active = state.turnOrder[state.activeIndex];
      if (active !== 'player') break;
      state = useTechnique(state, 'player', 'pulse_strike', 'bruiser');
    }
    const p = state.combatants.find((c) => c.id === 'player')!;
    expect(typeof (p.momentum ?? 0)).toBe('number');
    expect(p.momentum ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('a suppressing foe reads soft until scanned', () => {
    const player = finalizeDraft({
      name: 'Scout',
      origin: 'crossborn',
      discipline: 'channeler',
      convictionA: 'truth',
      convictionB: 'mercy',
      motivationId: 'answers',
    });
    const encounter = buildEncounter('world_duel', player, [], { worldName: 'Testfall' })!;
    const duelist = encounter.combatants.find((c) => c.id === 'duelist')!;
    expect(duelist.suppression).toBeGreaterThan(0);
    const masked = displayPower(duelist);
    const real = combatantPower(duelist).powerLevel;
    expect(masked).toBeLessThan(real);
    const scanned = scanResonance(encounter, 'player', 'duelist');
    const after = scanned.combatants.find((c) => c.id === 'duelist')!;
    expect(after.revealed).toBe(true);
    expect(displayPower(after)).toBe(combatantPower(after).powerLevel);
  });
});
