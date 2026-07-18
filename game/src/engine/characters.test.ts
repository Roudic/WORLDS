import { describe, expect, it } from 'vitest';
import type { PlayerBuild, SaveGame } from './types';
import {
  createRosterCharacter,
  ensureRoster,
  placeCharacter,
  selectCharacter,
} from './characters';
import { createWorld } from './worlds';

function stubBuild(name: string): PlayerBuild {
  return {
    name,
    origin: 'crossborn',
    discipline: 'channeler',
    convictions: ['mercy', 'truth'],
    motivation: 'answers',
    attributes: {
      might: 3,
      agility: 3,
      control: 4,
      grit: 3,
      intellect: 3,
      will: 3,
      presence: 2,
    },
    techniques: [],
    level: 3,
    resolve: 3,
    powerBand: 'mortal',
    ascensionUnlocked: false,
    ascensionMastery: 0,
    catalystReady: false,
    trainedStats: {},
    formId: 'base',
  };
}

describe('character roster', () => {
  it('migrates a legacy save into a roster', () => {
    const save = ensureRoster({
      version: 3,
      player: stubBuild('Ashen'),
      relationships: {},
      flags: {},
      sceneId: 'arrival_gate',
      partyIds: [],
      hubUnlocked: [],
      chapter: 1,
      log: [],
      trainCount: 2,
    } as SaveGame);
    expect(save.characters?.length).toBe(1);
    expect(save.characters?.[0].build.name).toBe('Ashen');
    expect(save.activeCharacterId).toBe(save.characters?.[0].id);
  });

  it('places and selects characters across worlds', () => {
    const a = createRosterCharacter(stubBuild('Kael'));
    const b = createRosterCharacter(stubBuild('Nira'));
    const w1 = createWorld({ tone: 'war', seed: 1 });
    const w2 = createWorld({ tone: 'discovery', seed: 2 });
    let save: SaveGame = {
      version: 4,
      player: a.build,
      relationships: {},
      flags: {},
      sceneId: 'arrival_gate',
      partyIds: [],
      hubUnlocked: [],
      chapter: 1,
      log: [],
      worlds: [w1, w2],
      activeWorldId: w1.id,
      characters: [a, b],
      activeCharacterId: a.id,
      developmentLog: [],
      currentEvent: null,
    };
    save = placeCharacter(save, a.id, w1.id)!;
    save = placeCharacter(save, b.id, w2.id)!;
    expect(save.characters?.find((c) => c.id === a.id)?.worldId).toBe(w1.id);
    expect(save.characters?.find((c) => c.id === b.id)?.worldId).toBe(w2.id);

    save = selectCharacter(save, b.id)!;
    expect(save.activeCharacterId).toBe(b.id);
    expect(save.player.name).toBe('Nira');
    expect(save.activeWorldId).toBe(w2.id);
  });
});
