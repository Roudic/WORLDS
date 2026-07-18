export interface VisualRef {
  id: string;
  src: string;
  title: string;
  caption: string;
}

export const VISUAL_REFS: VisualRef[] = [
  {
    id: 'crossfall',
    src: './refs/ref-crossfall-skyline.png',
    title: 'Crossfall Skyline',
    caption: 'Joined realities in one frame — stone keeps, neon rails, living hulls.',
  },
  {
    id: 'flux',
    src: './refs/ref-flux-types.png',
    title: 'Flux Forms',
    caption: 'Pulse · Aether · Lumen · Riftforce — one field, four behaviors.',
  },
  {
    id: 'arena',
    src: './refs/ref-arena-clash.png',
    title: 'Arena Clash',
    caption: 'Tactical camera, beam Clash, crowd of two worlds watching.',
  },
  {
    id: 'wake',
    src: './refs/ref-tempered-wake.png',
    title: 'Tempered Wake',
    caption: 'Starter Ascension — geometry and wake, not hair-color power-ups.',
  },
  {
    id: 'axis',
    src: './refs/ref-axis-engine.png',
    title: 'Axis Engine',
    caption: 'Custodian space — remembered futures stacked under the arena.',
  },
  {
    id: 'companions',
    src: './refs/ref-companion-lineup.png',
    title: 'Companion Line',
    caption: 'Sori, Tamsin, Ivo, Vexa — original silhouettes and body language.',
  },
];

/** Scene / chapter → atmospheric plate */
export function artForScene(sceneId: string, chapter: number): string {
  if (
    sceneId.includes('rift') ||
    sceneId.includes('final') ||
    sceneId.includes('breakthrough') ||
    sceneId.includes('ending') ||
    sceneId.includes('custodian') ||
    chapter >= 3
  ) {
    return './refs/ref-axis-engine.png';
  }
  if (
    sceneId.includes('trial') ||
    sceneId.includes('rival') ||
    sceneId.includes('opening') ||
    sceneId.includes('second_battle') ||
    sceneId.includes('after_opening')
  ) {
    return './refs/ref-arena-clash.png';
  }
  if (sceneId.includes('mentor') || sceneId.includes('assessment')) {
    return './refs/ref-tempered-wake.png';
  }
  if (sceneId.includes('meet_') || sceneId.includes('sabotage')) {
    return './refs/ref-companion-lineup.png';
  }
  return './refs/ref-crossfall-skyline.png';
}

export function artForCombat(combatId: string): string {
  if (combatId.startsWith('final') || combatId.includes('custodian')) {
    return './refs/ref-axis-engine.png';
  }
  if (combatId.includes('rival')) {
    return './refs/ref-arena-clash.png';
  }
  return './refs/ref-arena-clash.png';
}
