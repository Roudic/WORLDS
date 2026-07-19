import {
  companionToCombatant,
  createEncounter,
  makeEnemy,
  playerToCombatant,
  type CombatState,
} from '../engine/combat';
import { playerPower } from '../engine/power';
import type { Attributes, PlayerBuild, PowerBand } from '../engine/types';

function partyCombatants(player: PlayerBuild, partyIds: string[]) {
  const allies = [playerToCombatant(player)];
  partyIds.slice(0, 2).forEach((id, i) => {
    allies.push(companionToCombatant(id, 1 - i));
  });
  return allies;
}

function clampAttr(n: number): number {
  return Math.max(6, Math.min(20, Math.round(n)));
}

function scaleAttrs(base: Attributes, delta: number): Attributes {
  return {
    might: clampAttr(base.might + delta),
    agility: clampAttr(base.agility + delta),
    control: clampAttr(base.control + delta),
    grit: clampAttr(base.grit + delta),
    intellect: clampAttr(base.intellect + delta),
    will: clampAttr(base.will + delta),
    presence: clampAttr(base.presence + delta),
  };
}

function bandForPl(pl: number): PowerBand {
  if (pl >= 12000) return 'astral';
  if (pl >= 6000) return 'worldClass';
  if (pl >= 2500) return 'ascendant';
  if (pl >= 900) return 'awakened';
  return 'mortal';
}

function rosterRivalEnemy(rival: PlayerBuild): ReturnType<typeof makeEnemy> {
  const c = playerToCombatant(rival);
  return {
    ...c,
    id: 'roster_rival',
    isPlayer: false,
    isCompanion: false,
    aiProfile: 'tactical',
    output: Math.min(0.95, Math.max(0.55, rival.formId && rival.formId !== 'base' ? 0.9 : 0.7)),
    ascended: !!(rival.formId && rival.formId !== 'base'),
  };
}

export interface EncounterOpts {
  rivalBuild?: PlayerBuild;
  worldName?: string;
}

export function buildEncounter(
  id: string,
  player: PlayerBuild,
  partyIds: string[],
  opts: EncounterOpts = {},
): CombatState | null {
  const allies = partyCombatants(player, partyIds);
  const pl = playerPower(player, { formId: player.formId ?? 'base' }).powerLevel;
  const place = opts.worldName ?? 'the field';

  switch (id) {
    case 'entry_bout':
      return createEncounter({
        id,
        name: 'Undercourt Bout',
        description: 'Prove you can stand. One aggressive contender.',
        allies,
        enemies: [
          makeEnemy({
            id: 'bruiser',
            name: 'Undercourt Bruiser',
            attributes: {
              might: 14,
              agility: 11,
              control: 9,
              grit: 13,
              intellect: 8,
              will: 10,
              presence: 9,
            },
            techniques: ['pulse_strike', 'overdrive_burst'],
            position: 5,
          }),
        ],
        objective: { id: 'win', label: 'Defeat the bruiser', type: 'defeat_all' },
      });

    case 'opening_bout':
      return createEncounter({
        id,
        name: 'Opening Trial',
        description: 'Introductory tactical battle against Flux-sparring drones.',
        allies,
        enemies: [
          makeEnemy({
            id: 'drone_a',
            name: 'Spar Drone A',
            attributes: {
              might: 11,
              agility: 12,
              control: 12,
              grit: 11,
              intellect: 10,
              will: 10,
              presence: 8,
            },
            techniques: ['drone_shot', 'pulse_strike'],
            position: 5,
          }),
          makeEnemy({
            id: 'drone_b',
            name: 'Spar Drone B',
            attributes: {
              might: 10,
              agility: 13,
              control: 11,
              grit: 10,
              intellect: 11,
              will: 10,
              presence: 8,
            },
            techniques: ['slipstep', 'drone_shot'],
            position: 6,
            aiProfile: 'tactical',
          }),
        ],
        objective: { id: 'win', label: 'Clear the drones', type: 'defeat_all' },
      });

    case 'rival_spar':
      return createEncounter({
        id,
        name: 'Measured Spar — Vexa',
        description: 'Vexa tests your ceiling. Survive her pressure.',
        allies,
        enemies: [
          makeEnemy({
            id: 'vexa',
            name: 'Vexa Thorn',
            attributes: {
              might: 15,
              agility: 13,
              control: 12,
              grit: 14,
              intellect: 11,
              will: 13,
              presence: 14,
            },
            techniques: ['rival_surge', 'pulse_strike', 'overdrive_burst'],
            powerBand: 'awakened',
            level: 5,
            position: 5,
            aiProfile: 'aggressive',
            output: 0.92,
          }),
        ],
        objective: { id: 'win', label: 'Win or endure the spar', type: 'defeat_all' },
        tags: ['rival'],
      });

    case 'construct_bout':
      return createEncounter({
        id,
        name: 'Fused Constructs',
        description: 'Two minds forced into one chassis. Break or free them.',
        allies,
        enemies: [
          makeEnemy({
            id: 'fused',
            name: 'Fused Construct',
            attributes: {
              might: 14,
              agility: 10,
              control: 13,
              grit: 15,
              intellect: 9,
              will: 12,
              presence: 7,
            },
            techniques: ['pulse_strike', 'aegis_wall', 'overdrive_burst'],
            level: 4,
            position: 5,
            aiProfile: 'tactical',
          }),
        ],
        objective: { id: 'win', label: 'Defeat the fused construct', type: 'defeat_all' },
      });

    case 'construct_bout_talk':
      return createEncounter({
        id,
        name: 'Fused Constructs — Words Allowed',
        description: 'Combat conversation available: convince them to separate.',
        allies,
        enemies: [
          makeEnemy({
            id: 'fused',
            name: 'Fused Construct',
            attributes: {
              might: 14,
              agility: 10,
              control: 13,
              grit: 15,
              intellect: 9,
              will: 12,
              presence: 7,
            },
            techniques: ['pulse_strike', 'aegis_wall', 'rival_surge'],
            level: 4,
            position: 5,
          }),
        ],
        objective: {
          id: 'convince',
          label: 'Defeat or convince the construct',
          type: 'convince',
        },
        tags: ['talk_ok'],
      });

    case 'final_both':
      return createEncounter({
        id,
        name: 'Riftwake Finale',
        description: 'Custodian and Vexa — the arena becomes three cities at once.',
        allies,
        enemies: [
          makeEnemy({
            id: 'custodian',
            name: 'The Custodian',
            attributes: {
              might: 12,
              agility: 12,
              control: 16,
              grit: 14,
              intellect: 15,
              will: 16,
              presence: 14,
            },
            techniques: ['custodian_rewrite', 'rift_lance', 'aegis_wall'],
            powerBand: player.powerBand === 'awakened' ? 'awakened' : 'mortal',
            level: 6,
            position: 6,
            aiProfile: 'volatile',
            output: 0.95,
          }),
          makeEnemy({
            id: 'vexa',
            name: 'Vexa Thorn',
            attributes: {
              might: 15,
              agility: 13,
              control: 12,
              grit: 14,
              intellect: 11,
              will: 13,
              presence: 14,
            },
            techniques: ['rival_surge', 'overdrive_burst', 'pulse_strike'],
            powerBand: 'awakened',
            level: 5,
            position: 5,
            output: 0.9,
          }),
        ],
        objective: { id: 'win', label: 'Survive and break their hold', type: 'defeat_all' },
        riftActive: true,
      });

    case 'final_custodian':
      return createEncounter({
        id,
        name: 'Engine Heart',
        description: 'Focus the Custodian while Vexa watches the edges.',
        allies,
        enemies: [
          makeEnemy({
            id: 'custodian',
            name: 'The Custodian',
            attributes: {
              might: 12,
              agility: 12,
              control: 17,
              grit: 14,
              intellect: 15,
              will: 16,
              presence: 14,
            },
            techniques: ['custodian_rewrite', 'rift_lance', 'tempered_flare'],
            powerBand: 'awakened',
            level: 6,
            position: 6,
            aiProfile: 'volatile',
            output: 0.95,
          }),
        ],
        objective: { id: 'win', label: 'Bring the Custodian down or open contact', type: 'defeat_all' },
        riftActive: true,
      });

    case 'final_talk':
      return createEncounter({
        id,
        name: 'Contact Protocol',
        description: 'Fight and speak. The Custodian can be reached.',
        allies,
        enemies: [
          makeEnemy({
            id: 'custodian',
            name: 'The Custodian',
            attributes: {
              might: 11,
              agility: 12,
              control: 16,
              grit: 13,
              intellect: 15,
              will: 15,
              presence: 15,
            },
            techniques: ['custodian_rewrite', 'rift_lance', 'living_mend'],
            powerBand: 'awakened',
            level: 6,
            position: 6,
            aiProfile: 'tactical',
            output: 0.88,
          }),
        ],
        objective: {
          id: 'contact',
          label: 'Convince or defeat the Custodian',
          type: 'convince',
        },
        riftActive: true,
        tags: ['talk_ok'],
      });

    case 'world_ambush':
      return createEncounter({
        id,
        name: `Ambush — ${place}`,
        description: 'Travelers and locals collide. Power decides the road.',
        allies,
        enemies: [
          makeEnemy({
            id: 'ambusher',
            name: 'Road Ambusher',
            attributes: scaleAttrs(player.attributes, -1),
            techniques: ['pulse_strike', 'slipstep', 'overdrive_burst'],
            powerBand: bandForPl(pl * 0.7),
            level: Math.max(2, player.level - 1),
            position: 5,
            output: 0.65,
          }),
        ],
        objective: { id: 'win', label: 'Break the ambush', type: 'defeat_all' },
        tags: ['sandbox', 'battle'],
      });

    case 'world_duel':
      return createEncounter({
        id,
        name: `Public Duel — ${place}`,
        description: 'A scanner duel. Crowds watch. Output climbs.',
        allies,
        enemies: [
          makeEnemy({
            id: 'duelist',
            name: 'Wandering Duelist',
            attributes: scaleAttrs(player.attributes, 1),
            techniques: ['rival_surge', 'pulse_strike', 'overdrive_burst'],
            powerBand: bandForPl(pl),
            level: player.level + 1,
            position: 5,
            aiProfile: 'aggressive',
            output: 0.88,
          }),
        ],
        objective: { id: 'win', label: 'Win the duel', type: 'defeat_all' },
        tags: ['sandbox', 'battle', 'rival'],
      });

    case 'world_skirmish':
      return createEncounter({
        id,
        name: `Skirmish — ${place}`,
        description: 'Two threats press at once. Footwork and targets matter.',
        allies,
        enemies: [
          makeEnemy({
            id: 'skirm_a',
            name: 'Scar Banner Blade',
            attributes: scaleAttrs(player.attributes, 0),
            techniques: ['pulse_strike', 'overdrive_burst'],
            powerBand: bandForPl(pl * 0.85),
            level: player.level,
            position: 5,
            output: 0.7,
          }),
          makeEnemy({
            id: 'skirm_b',
            name: 'Null Choir Scout',
            attributes: scaleAttrs(player.attributes, -1),
            techniques: ['slipstep', 'drone_shot', 'rift_lance'],
            powerBand: bandForPl(pl * 0.75),
            level: Math.max(2, player.level - 1),
            position: 6,
            aiProfile: 'tactical',
            output: 0.6,
          }),
        ],
        objective: { id: 'win', label: 'Clear the skirmish', type: 'defeat_all' },
        tags: ['sandbox', 'battle'],
      });

    case 'world_hunt':
      return createEncounter({
        id,
        name: `Hunt — ${place}`,
        description: 'Something above your band is hunting the district.',
        allies,
        enemies: [
          makeEnemy({
            id: 'hunter',
            name: 'Ceiling Hunter',
            attributes: scaleAttrs(player.attributes, 2),
            techniques: ['rival_surge', 'rift_lance', 'overdrive_burst', 'aegis_wall'],
            powerBand: bandForPl(pl * 1.2),
            level: player.level + 2,
            position: 5,
            aiProfile: 'volatile',
            output: 0.92,
          }),
        ],
        objective: { id: 'win', label: 'Survive the hunt', type: 'defeat_all' },
        tags: ['sandbox', 'battle'],
      });

    case 'roster_spar': {
      const rival = opts.rivalBuild;
      if (!rival) return null;
      return createEncounter({
        id,
        name: `Roster Spar — ${rival.name}`,
        description: `${player.name} and ${rival.name} test each other in ${place}.`,
        allies,
        enemies: [rosterRivalEnemy(rival)],
        objective: { id: 'win', label: 'Win the spar (or endure)', type: 'defeat_all' },
        tags: ['sandbox', 'battle', 'meet', 'talk_ok'],
      });
    }

    default:
      return null;
  }
}
