import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/worlds';
import type { PlayerBuild, SaveGame } from '../engine/types';
import { resolveEventChoice, rollWorldEvent } from './events';
import { playerPower } from '../engine/power';

function stubSave(partial?: Partial<SaveGame>): SaveGame {
  const player: PlayerBuild = {
    name: 'Test',
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
  return {
    version: 3,
    player,
    relationships: {},
    flags: {},
    sceneId: 'arrival_gate',
    partyIds: [],
    hubUnlocked: [],
    chapter: 1,
    log: [],
    storySeed: 42,
    trainCount: 0,
    worlds: [],
    activeWorldId: null,
    currentEvent: null,
    developmentLog: [],
    ...partial,
  };
}

describe('world events', () => {
  it('rolls a random event shaped by world focus', () => {
    const world = createWorld({ tone: 'war', seed: 99 });
    world.focus = 'empower';
    const event = rollWorldEvent(stubSave(), world);
    expect(event.title).toBeTruthy();
    expect(event.choices.length).toBeGreaterThanOrEqual(2);
  });

  it('resolves a choice with reasoned gains', () => {
    const world = createWorld({ tone: 'discovery', seed: 7 });
    const save = stubSave({ worlds: [world], activeWorldId: world.id });
    const event = rollWorldEvent(save, world);
    const before = playerPower(save.player).powerLevel;
    const result = resolveEventChoice(save, world, event, event.choices[0].id);
    expect(result.entry.reason.length).toBeGreaterThan(10);
    expect(result.entry.gains.length).toBeGreaterThan(0);
    expect(result.save.developmentLog?.[0]?.eventTitle).toBe(event.title);
    const after = playerPower(result.save.player).powerLevel;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(result.world.eventCount).toBe(world.eventCount + 1);
  });
});
