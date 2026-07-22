import { describe, expect, it } from 'vitest';
import { buildEncounter } from '../data/encounters';
import { finalizeDraft } from '../state/game';
import { activeCombatant, runEnemyTurns, useTechnique } from './combat';

describe('combat turn flow', () => {
  it('returns control to the player after rival opener AI', () => {
    const player = finalizeDraft({
      name: 'Test',
      origin: 'crossborn',
      discipline: 'channeler',
      convictionA: 'mercy',
      convictionB: 'truth',
      motivationId: 'answers',
    });
    let enc = buildEncounter('rival_spar', player, [])!;
    enc = runEnemyTurns(enc);
    const active = activeCombatant(enc);
    // Either player can act, or a clash needs player input — never soft-lock AI
    if (enc.pendingClash) {
      expect(
        enc.pendingClash.attackerId === 'player' ||
          enc.pendingClash.defenderId === 'player',
      ).toBe(true);
    } else {
      expect(active.isPlayer).toBe(true);
    }
  });

  it('lets the player act after their own technique', () => {
    const player = finalizeDraft({
      name: 'Test',
      origin: 'lumenborn',
      discipline: 'artificer',
      convictionA: 'truth',
      convictionB: 'duty',
      motivationId: 'answers',
    });
    let enc = buildEncounter('opening_bout', player, [])!;
    // Force player first
    enc.turnOrder = ['player', ...enc.turnOrder.filter((id) => id !== 'player')];
    enc.activeIndex = 0;
    enc = useTechnique(enc, 'player', 'pulse_strike', 'drone_a');
    enc = runEnemyTurns(enc);
    expect(enc.finished || activeCombatant(enc).isPlayer || enc.pendingClash).toBeTruthy();
  });
});
