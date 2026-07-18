import {
  companionToCombatant,
  createEncounter,
  makeEnemy,
  playerToCombatant,
  type CombatState,
} from '../engine/combat';
import type { PlayerBuild } from '../engine/types';

function partyCombatants(player: PlayerBuild, partyIds: string[]) {
  const allies = [playerToCombatant(player)];
  partyIds.slice(0, 2).forEach((id, i) => {
    allies.push(companionToCombatant(id, 1 - i));
  });
  return allies;
}

export function buildEncounter(
  id: string,
  player: PlayerBuild,
  partyIds: string[],
): CombatState | null {
  const allies = partyCombatants(player, partyIds);

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

    default:
      return null;
  }
}
