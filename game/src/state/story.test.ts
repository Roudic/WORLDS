import { describe, expect, it } from 'vitest';
import { SCENES } from '../data/story';
import { applyEffects, createNewSave, finalizeDraft, visibleChoices } from './game';

describe('Crossfall Trials graph', () => {
  it('has no dangling goTo / check targets', () => {
    for (const scene of Object.values(SCENES)) {
      for (const choice of scene.choices) {
        const go = choice.effects.goTo;
        if (go) expect(SCENES[go], `missing ${go} from ${scene.id}`).toBeTruthy();
        const chk = choice.effects.attributeCheck;
        if (chk) {
          expect(SCENES[chk.successGoTo], chk.successGoTo).toBeTruthy();
          expect(SCENES[chk.failGoTo], chk.failGoTo).toBeTruthy();
        }
      }
    }
  });

  it('can walk a full path to an ending choice', () => {
    const player = finalizeDraft({
      name: 'Walker',
      origin: 'crossborn',
      discipline: 'channeler',
      convictionA: 'mercy',
      convictionB: 'truth',
      motivationId: 'answers',
    });
    let save = createNewSave(player);
    // Force a linear-ish walk by applying known choice effects without combat
    const path = [
      ['arrival_gate', 'pay_entry'],
      ['meet_tamsin', 'recruit_tamsin'],
      ['mentor_assessment', 'skip_assessment'],
    ] as const;

    for (const [sceneId, choiceId] of path) {
      expect(save.sceneId).toBe(sceneId);
      const scene = SCENES[sceneId];
      const choice = visibleChoices(save, scene.choices).find((c) => c.id === choiceId);
      expect(choice).toBeTruthy();
      const result = applyEffects(save, choice!.effects);
      save = result.save;
      if (result.goTo) save.sceneId = result.goTo;
    }
    expect(save.sceneId).toBe('trials_intro');
    expect(save.partyIds).toContain('tamsin');
  });
});
