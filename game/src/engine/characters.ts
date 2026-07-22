import type {
  PlayerBuild,
  RosterCharacter,
  SaveGame,
} from './types';

export function createRosterCharacter(build: PlayerBuild, seed?: number): RosterCharacter {
  const n = seed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  return {
    id: `char_${n.toString(36)}`,
    build: structuredClone(build),
    worldId: null,
    trainCount: 0,
    flags: {},
    developmentLog: [],
    currentEvent: null,
    createdAt: Date.now(),
  };
}

export function activeCharacter(save: SaveGame): RosterCharacter | null {
  const list = save.characters ?? [];
  if (!list.length) return null;
  return list.find((c) => c.id === save.activeCharacterId) ?? list[0];
}

/** Keep legacy `player` / trainCount / currentEvent mirrors in sync with the active roster entry. */
export function syncActiveCharacter(save: SaveGame): SaveGame {
  const ch = activeCharacter(save);
  if (!ch) return save;
  return {
    ...save,
    activeCharacterId: ch.id,
    player: structuredClone(ch.build),
    trainCount: ch.trainCount,
    currentEvent: ch.currentEvent,
    flags: { ...save.flags, ...ch.flags },
  };
}

export function patchCharacter(
  save: SaveGame,
  character: RosterCharacter,
): SaveGame {
  const characters = (save.characters ?? []).map((c) =>
    c.id === character.id ? character : c,
  );
  const next: SaveGame = {
    ...save,
    characters,
    activeCharacterId: character.id,
  };
  return syncActiveCharacter(next);
}

export function selectCharacter(save: SaveGame, characterId: string): SaveGame | null {
  const ch = (save.characters ?? []).find((c) => c.id === characterId);
  if (!ch) return null;
  const next: SaveGame = {
    ...save,
    activeCharacterId: ch.id,
    // Follow them to their stationed world when present
    activeWorldId: ch.worldId ?? save.activeWorldId,
  };
  return syncActiveCharacter(next);
}

export function placeCharacter(
  save: SaveGame,
  characterId: string,
  worldId: string | null,
): SaveGame | null {
  const ch = (save.characters ?? []).find((c) => c.id === characterId);
  if (!ch) return null;
  if (worldId && !(save.worlds ?? []).some((w) => w.id === worldId)) return null;
  const updated: RosterCharacter = { ...ch, worldId };
  let next = patchCharacter(save, updated);
  if (worldId) next = { ...next, activeWorldId: worldId };
  return next;
}

export function charactersOnWorld(save: SaveGame, worldId: string): RosterCharacter[] {
  return (save.characters ?? []).filter((c) => c.worldId === worldId);
}

export function ensureRoster(save: SaveGame): SaveGame {
  if (save.characters && save.characters.length > 0) {
    return syncActiveCharacter({
      ...save,
      activeCharacterId: save.activeCharacterId ?? save.characters[0].id,
    });
  }
  const first = createRosterCharacter(save.player);
  first.trainCount = save.trainCount ?? 0;
  first.flags = { ...save.flags };
  first.developmentLog = [...(save.developmentLog ?? [])];
  first.currentEvent = save.currentEvent ?? null;
  first.worldId = save.activeWorldId ?? null;
  return {
    ...save,
    version: 4,
    characters: [first],
    activeCharacterId: first.id,
  };
}
