import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/worlds';
import type { PlayerBuild } from '../engine/types';
import { generateRandomEvent, genName } from './generator';

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function stubBuild(): PlayerBuild {
  return {
    name: 'Test',
    origin: 'crossborn',
    discipline: 'channeler',
    convictions: ['mercy', 'truth'],
    motivation: 'answers',
    attributes: { might: 3, agility: 3, control: 4, grit: 3, intellect: 3, will: 3, presence: 2 },
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

describe('generative story engine', () => {
  it('assembles different events from different seeds', () => {
    const world = createWorld({ tone: 'war', seed: 5 });
    const bodies = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const ev = generateRandomEvent({
        world,
        player: stubBuild(),
        rand: rng(seed * 7919),
        pl: 600,
        others: [],
        worlds: [world],
      });
      expect(ev).toBeTruthy();
      expect(ev!.choices.length).toBeGreaterThanOrEqual(3);
      bodies.add(ev!.body);
    }
    // strong variety — most rolls produce distinct prose
    expect(bodies.size).toBeGreaterThanOrEqual(6);
  });

  it('battle preference always yields a combat path with reasons', () => {
    const world = createWorld({ tone: 'discovery', seed: 9 });
    for (let seed = 1; seed <= 8; seed++) {
      const ev = generateRandomEvent(
        {
          world,
          player: stubBuild(),
          rand: rng(seed * 104729),
          pl: 900,
          others: [],
          worlds: [world],
        },
        'battle',
      );
      const fight = ev!.choices.find((c) => c.startCombat);
      expect(fight).toBeTruthy();
      expect(fight!.reasonWin!.length).toBeGreaterThan(10);
      expect(fight!.reasonLose!.length).toBeGreaterThan(10);
    }
  });

  it('generates plausible names', () => {
    const r = rng(42);
    for (let i = 0; i < 10; i++) {
      const n = genName(r);
      expect(n.length).toBeGreaterThanOrEqual(3);
      expect(n[0]).toBe(n[0].toUpperCase());
    }
  });
});
