import type { ConvictionId } from '../engine/types';

export type ChoiceEffect = {
  setFlags?: Record<string, boolean | number | string>;
  addApproval?: Record<string, number>;
  addTrust?: Record<string, number>;
  spendResolve?: number;
  gainResolve?: number;
  unlockCatalyst?: boolean;
  recruit?: string;
  party?: string[];
  startCombat?: string;
  goTo?: string;
  ending?: string;
  attributeCheck?: {
    attribute: 'might' | 'agility' | 'control' | 'grit' | 'intellect' | 'will' | 'presence';
    dc: number;
    successGoTo: string;
    failGoTo: string;
    useRiftDie?: boolean;
    proficiency?: number;
  };
};

export interface StoryChoice {
  id: string;
  label: string;
  hint?: string;
  requireFlags?: Record<string, boolean | number | string>;
  requireConviction?: ConvictionId;
  requireCompanion?: string;
  requireResolve?: number;
  hideIfFlags?: Record<string, boolean | number | string>;
  effects: ChoiceEffect;
}

export interface StoryScene {
  id: string;
  chapter: number;
  title: string;
  location: string;
  body: string;
  choices: StoryChoice[];
}

export const SCENES: Record<string, StoryScene> = {
  arrival_gate: {
    id: 'arrival_gate',
    chapter: 1,
    title: 'Arrival',
    location: 'Crossfall — Gate District',
    body: `Stone keeps lean against suspended railways. Spell-market lanterns bleed color into machine-district glare. Crossfall smells like rain on hot Lumen glass.

The Trials recruitment booth is crowded. A clerk with three different accents stacked in one throat asks why you're here — and whether you can prove you won't shatter the arena.`,
    choices: [
      {
        id: 'open_ai_early',
        label: 'Skip booth — enter Story AI grind',
        hint: 'Train stats & Power Level first (procedural)',
        effects: {
          setFlags: { 'Ai.Open': true, 'Choice.Trials.Entry': 'ai' },
          goTo: 'ai_runtime',
        },
      },
      {
        id: 'persuade_entry',
        label: 'Persuade your way onto the roster',
        hint: 'Presence check',
        effects: {
          attributeCheck: {
            attribute: 'presence',
            dc: 12,
            successGoTo: 'meet_sori',
            failGoTo: 'entry_favor',
          },
          setFlags: { 'Choice.Trials.Entry': 'persuade' },
        },
      },
      {
        id: 'investigate_entry',
        label: 'Investigate a sabotaged registration slate',
        hint: 'Intellect check',
        effects: {
          attributeCheck: {
            attribute: 'intellect',
            dc: 12,
            successGoTo: 'meet_ivo',
            failGoTo: 'entry_combat_challenge',
          },
          setFlags: { 'Choice.Trials.Entry': 'investigate' },
        },
      },
      {
        id: 'pay_entry',
        label: 'Pay the inflated entry fee',
        effects: {
          setFlags: { 'Choice.Trials.Entry': 'pay', 'World.Crossfall.Broke': true },
          goTo: 'meet_tamsin',
        },
      },
      {
        id: 'fight_entry',
        label: 'Take the combat challenge lane',
        effects: {
          setFlags: { 'Choice.Trials.Entry': 'combat' },
          startCombat: 'entry_bout',
          goTo: 'meet_tamsin',
        },
      },
    ],
  },

  entry_favor: {
    id: 'entry_favor',
    chapter: 1,
    title: 'A Favor Owed',
    location: 'Crossfall — Gate District',
    body: `Your words don't land clean. The clerk sighs and stamps a provisional pass.

"You're in — if you deliver a sealed package to Maelin Orr before sundown. Fail, and the Accord erases your name."`,
    choices: [
      {
        id: 'accept_favor',
        label: 'Accept and find Maelin',
        effects: {
          setFlags: { 'Choice.Trials.Favor': true },
          goTo: 'mentor_assessment',
        },
      },
    ],
  },

  entry_combat_challenge: {
    id: 'entry_combat_challenge',
    chapter: 1,
    title: 'The Side Door',
    location: 'Crossfall — Undercourt',
    body: `The registration slate is too corrupted to read. A steward points you toward the Undercourt: prove you can stand, or leave.`,
    choices: [
      {
        id: 'undercourt_fight',
        label: 'Step into the Undercourt bout',
        effects: {
          startCombat: 'entry_bout',
          goTo: 'meet_tamsin',
        },
      },
    ],
  },

  meet_sori: {
    id: 'meet_sori',
    chapter: 1,
    title: 'Living Memory',
    location: 'Crossfall — Rootwalk Clinic',
    body: `Sori Vale presses two fingers to a cracked pavement vine. "The city remembers tournaments like scars," she says. "If you're here to win by breaking people, I already dislike you."

She offers to walk the Trials with someone who won't treat mercy as weakness.`,
    choices: [
      {
        id: 'recruit_sori',
        label: 'Invite Sori to your trial circle',
        effects: {
          recruit: 'sori',
          party: ['sori'],
          addApproval: { sori: 2 },
          addTrust: { sori: 1 },
          goTo: 'mentor_assessment',
        },
      },
      {
        id: 'soft_no_sori',
        label: 'Wish her well and continue alone for now',
        effects: {
          addApproval: { sori: 0 },
          setFlags: { 'Met.Sori': true },
          goTo: 'mentor_assessment',
        },
      },
    ],
  },

  meet_ivo: {
    id: 'meet_ivo',
    chapter: 1,
    title: 'Echo on the Slate',
    location: 'Crossfall — Registry Annex',
    body: `Ivo Renn reconstructs the sabotaged slate with a palm-sized Lumen lens. A face flickers — almost their sibling, almost not.

"Someone is rewriting who is allowed to compete," Ivo murmurs. "Help me, and I'll help you see what the arena is hiding."`,
    choices: [
      {
        id: 'recruit_ivo',
        label: 'Bring Ivo into your circle',
        effects: {
          recruit: 'ivo',
          party: ['ivo'],
          addApproval: { ivo: 2 },
          addTrust: { ivo: 1 },
          setFlags: { 'Knowledge.Sabotage': true },
          goTo: 'mentor_assessment',
        },
      },
      {
        id: 'take_info_only',
        label: 'Take the evidence and move on',
        effects: {
          setFlags: { 'Knowledge.Sabotage': true, 'Met.Ivo': true },
          goTo: 'mentor_assessment',
        },
      },
    ],
  },

  meet_tamsin: {
    id: 'meet_tamsin',
    chapter: 1,
    title: 'Person, Not Property',
    location: 'Crossfall — Arena Approach',
    body: `Tamsin Rook rolls a shoulder joint until it clicks into a legal-spec configuration. "If I place high enough, the Accord has to recognize me as a citizen," they say. "I need a partner who won't sell that chance."`,
    choices: [
      {
        id: 'recruit_tamsin',
        label: 'Stand with Tamsin',
        effects: {
          recruit: 'tamsin',
          party: ['tamsin'],
          addApproval: { tamsin: 2 },
          addTrust: { tamsin: 1 },
          goTo: 'mentor_assessment',
        },
      },
      {
        id: 'rival_respect',
        label: 'Wish them a clean fight — as rivals',
        effects: {
          setFlags: { 'Met.Tamsin': true },
          addApproval: { tamsin: 1 },
          goTo: 'mentor_assessment',
        },
      },
    ],
  },

  mentor_assessment: {
    id: 'mentor_assessment',
    chapter: 1,
    title: 'Control Over Output',
    location: "Crossfall — Orr's Courtyard",
    body: `Maelin Orr flicks a palm-scanner toward you. Numbers climb, stutter, settle — your Resonance readout hangs in the air like a challenge.

"Anyone can shout Flux into the air until the stones shake," he says. "Few can decide what it becomes. Power bands are not trophies. They are weather systems you either steer… or drown in."

He offers an optional assessment: dice, restraint, a Catalyst seed for Breakthrough — and a lesson in suppressing or surging your output on command.`,
    choices: [
      {
        id: 'take_assessment',
        label: 'Take the mentor assessment',
        hint: 'Will check — can unlock Catalyst',
        effects: {
          attributeCheck: {
            attribute: 'will',
            dc: 12,
            successGoTo: 'assessment_pass',
            failGoTo: 'assessment_fail',
          },
        },
      },
      {
        id: 'skip_assessment',
        label: 'Decline and head to the Trials',
        effects: {
          setFlags: { 'Mentor.Skipped': true },
          goTo: 'trials_intro',
        },
      },
    ],
  },

  assessment_pass: {
    id: 'assessment_pass',
    chapter: 1,
    title: 'Catalyst Seeded',
    location: 'Crossfall — Orr\'s Courtyard',
    body: `You hold the Pulse steady until Maelin nods. "When the Pressure comes, you will have something prepared — not a panic transformation."

A Catalyst settles behind your sternum: Tempered Wake, waiting.`,
    choices: [
      {
        id: 'to_trials_ready',
        label: 'Enter the Trials',
        effects: {
          unlockCatalyst: true,
          gainResolve: 1,
          setFlags: { 'Mentor.Passed': true, 'Catalyst.TemperedWake': true },
          goTo: 'trials_intro',
        },
      },
    ],
  },

  assessment_fail: {
    id: 'assessment_fail',
    chapter: 1,
    title: 'Almost',
    location: 'Crossfall — Orr\'s Courtyard',
    body: `Your control frays. Maelin stops the exercise before the courtyard tiles crack.

"Still useful," he says. "Failure taught the shape of the edge. The Catalyst is half-formed — Pressure may finish it, or break you."`,
    choices: [
      {
        id: 'to_trials_partial',
        label: 'Enter the Trials anyway',
        effects: {
          setFlags: { 'Mentor.Partial': true, 'Catalyst.Partial': true },
          goTo: 'trials_intro',
        },
      },
    ],
  },

  trials_intro: {
    id: 'trials_intro',
    chapter: 2,
    title: 'The Trials',
    location: 'Crossfall Arena',
    body: `The arena opens like a throat. Crowds braid through suspended stands. Across the sand, Vexa Thorn rolls her neck — her Power Level loud enough to taste.

"Strength protects a joined world," she calls. "Everything else is decoration."

A side lane flickers: the Story AI Director offers free roam — train stats, raise Power Level, transform drills — old-school grind between scripted beats.`,
    choices: [
      {
        id: 'opening_bout',
        label: 'Begin the opening tactical bout',
        effects: {
          startCombat: 'opening_bout',
          goTo: 'after_opening',
        },
      },
      {
        id: 'open_story_ai',
        label: 'Open Story AI (train / grind / missions)',
        hint: 'Procedural director — dice + Power Level',
        effects: {
          setFlags: { 'Ai.Open': true },
          goTo: 'ai_runtime',
        },
      },
    ],
  },

  ai_runtime: {
    id: 'ai_runtime',
    chapter: 2,
    title: 'Story AI',
    location: 'Crossfall · Living Director',
    body: `The Director is compiling your next beat…`,
    choices: [],
  },

  after_opening: {
    id: 'after_opening',
    chapter: 2,
    title: 'Dust and Measure',
    location: 'Crossfall Arena',
    body: `The first bout ends. Stewards reset the floor. Vexa watches your technique the way a blade watches a throat — curious, not yet committed to cutting.`,
    choices: [
      {
        id: 'env_challenge',
        label: 'Face the environmental trial',
        effects: { goTo: 'env_challenge' },
      },
    ],
  },

  env_challenge: {
    id: 'env_challenge',
    chapter: 2,
    title: 'Collapsing Span',
    location: 'Crossfall — Skyrail Span',
    body: `A skyrail span begins to peel as residual Flux eats its Lumen anchors. Civilians are trapped mid-crossing. There is more than one way through.`,
    choices: [
      {
        id: 'might_brace',
        label: 'Brace the span with raw force',
        hint: 'Might 16',
        effects: {
          attributeCheck: {
            attribute: 'might',
            dc: 16,
            successGoTo: 'env_success',
            failGoTo: 'env_partial',
          },
          setFlags: { 'Choice.Env': 'might' },
        },
      },
      {
        id: 'control_stabilize',
        label: 'Stabilize the Lumen anchors',
        hint: 'Control 14',
        effects: {
          attributeCheck: {
            attribute: 'control',
            dc: 14,
            successGoTo: 'env_success',
            failGoTo: 'env_partial',
          },
          setFlags: { 'Choice.Env': 'control' },
        },
      },
      {
        id: 'presence_evacuate',
        label: 'Command an evacuation corridor',
        hint: 'Presence 14',
        effects: {
          attributeCheck: {
            attribute: 'presence',
            dc: 14,
            successGoTo: 'env_success',
            failGoTo: 'env_partial',
          },
          setFlags: { 'Choice.Env': 'presence' },
        },
      },
      {
        id: 'intellect_reroute',
        label: 'Reroute the railway mind',
        hint: 'Intellect 15 — better with Ivo',
        effects: {
          attributeCheck: {
            attribute: 'intellect',
            dc: 15,
            successGoTo: 'env_success',
            failGoTo: 'env_partial',
          },
          setFlags: { 'Choice.Env': 'intellect' },
        },
      },
    ],
  },

  env_success: {
    id: 'env_success',
    chapter: 2,
    title: 'Span Holds',
    location: 'Crossfall — Skyrail Span',
    body: `The span holds long enough. Civilians clear. Somewhere below, something in the city's understructure answers your Flux like a tuning fork.`,
    choices: [
      {
        id: 'to_rival',
        label: 'Return to the arena floor',
        effects: {
          gainResolve: 1,
          setFlags: { 'Choice.Env.Success': true, 'Choice.Crossfall.SavedCivilians': true },
          goTo: 'rival_scene',
        },
      },
    ],
  },

  env_partial: {
    id: 'env_partial',
    chapter: 2,
    title: 'Cost Paid',
    location: 'Crossfall — Skyrail Span',
    body: `You save most — not all. The span sheds a carriage into fog. Fail-forward: the wreck reveals a maintenance hatch stamped with Axis glyphs.`,
    choices: [
      {
        id: 'to_rival_cost',
        label: 'Take the hatch knowledge back to the Trials',
        effects: {
          setFlags: { 'Knowledge.Axis.Hatch': true, 'Choice.Env.Partial': true },
          goTo: 'rival_scene',
        },
      },
    ],
  },

  rival_scene: {
    id: 'rival_scene',
    chapter: 2,
    title: 'Vexa Thorn',
    location: 'Crossfall Arena — Ready Room',
    body: `Vexa tosses you a water flask hard enough to sting. "You hesitate for civilians. Cute. When an Axis Engine wakes, hesitation is a body count."

Her Resonance spikes — invitation and threat in one gesture.`,
    choices: [
      {
        id: 'rival_strength',
        label: 'Answer that only strength ends threats',
        requireConviction: 'strength',
        effects: {
          setFlags: { 'Rival.AlignedStrength': true },
          addApproval: { vexa: 2 },
          goTo: 'sabotage_invest',
        },
      },
      {
        id: 'rival_mercy',
        label: 'Tell her mercy is a form of strategy',
        requireConviction: 'mercy',
        effects: {
          setFlags: { 'Rival.Challenged': true },
          addApproval: { sori: 1 },
          goTo: 'sabotage_invest',
        },
      },
      {
        id: 'rival_balance',
        label: 'Argue for control over spectacle',
        effects: {
          setFlags: { 'Rival.Respect': true },
          goTo: 'sabotage_invest',
        },
      },
      {
        id: 'rival_spar',
        label: 'Challenge her to a measured spar',
        effects: {
          startCombat: 'rival_spar',
          goTo: 'sabotage_invest',
        },
      },
    ],
  },

  sabotage_invest: {
    id: 'sabotage_invest',
    chapter: 2,
    title: 'Sabotaged Lumen',
    location: 'Crossfall Arena — Underworks',
    body: `Ivo's earlier warning proves out — or you find it cold: Lumen regulators under the arena floor have been rewritten to invite a Rift spike during the finals.

A saboteur is still here, Flux-burned and defiant.`,
    choices: [
      {
        id: 'spare_saboteur',
        label: 'Spare them for testimony',
        effects: {
          setFlags: { 'Choice.Trials.SparedSaboteur': true, 'Knowledge.Axis.Sabotage': true },
          addApproval: { sori: 1, ivo: 1 },
          goTo: 'second_battle_gate',
        },
      },
      {
        id: 'capture_hard',
        label: 'Break their resistance and drag them up',
        hint: 'Might check',
        effects: {
          attributeCheck: {
            attribute: 'might',
            dc: 14,
            successGoTo: 'second_battle_gate',
            failGoTo: 'second_battle_gate',
          },
          setFlags: { 'Choice.Trials.CapturedSaboteur': true, 'Knowledge.Axis.Sabotage': true },
        },
      },
      {
        id: 'let_run',
        label: 'Let them run — chase the bigger pattern',
        effects: {
          setFlags: { 'Choice.Trials.LetSaboteurRun': true, 'Knowledge.Axis.Sabotage': true },
          addTrust: { ivo: 1 },
          goTo: 'second_battle_gate',
        },
      },
    ],
  },

  second_battle_gate: {
    id: 'second_battle_gate',
    chapter: 2,
    title: 'Second Trial',
    location: 'Crossfall Arena',
    body: `Your next opponents are fused sparring constructs — two minds forced into one chassis. Stewards want a show. You may not have to give them one.`,
    choices: [
      {
        id: 'fight_constructs',
        label: 'Engage in tactical combat',
        effects: {
          startCombat: 'construct_bout',
          goTo: 'riftwake_start',
        },
      },
      {
        id: 'talk_constructs',
        label: 'Try to separate / convince them mid-fight',
        hint: 'Presence — nonviolent path',
        effects: {
          startCombat: 'construct_bout_talk',
          goTo: 'riftwake_start',
        },
      },
    ],
  },

  riftwake_start: {
    id: 'riftwake_start',
    chapter: 3,
    title: 'Riftwake',
    location: 'Crossfall Arena — Depths',
    body: `The finals never start cleanly. A Rift storm claws up through the sand. An Axis Engine wakes beneath the arena and begins overlaying alternate Crossfalls onto the present.

Screams braid with applause. The Custodian's voice arrives from every speaker and none:

"I was built to remember futures that did not happen. Why did you make me choose?"`,
    choices: [
      {
        id: 'priority_civilians',
        label: 'Prioritize evacuating civilians',
        effects: {
          setFlags: { 'Choice.Riftwake.Priority': 'civilians', 'Choice.Crossfall.SavedCivilians': true },
          addApproval: { sori: 2, tamsin: 1 },
          goTo: 'rift_pressure',
        },
      },
      {
        id: 'priority_companion',
        label: 'Prioritize a companion in danger',
        effects: {
          setFlags: { 'Choice.Riftwake.Priority': 'companion' },
          addTrust: { sori: 1, tamsin: 1, ivo: 1 },
          gainResolve: 1,
          goTo: 'rift_pressure',
        },
      },
      {
        id: 'priority_research',
        label: 'Prioritize Axis research access',
        effects: {
          setFlags: { 'Choice.Riftwake.Priority': 'research', 'Knowledge.Axis.CoreAccess': true },
          addApproval: { ivo: 2 },
          goTo: 'rift_pressure',
        },
      },
    ],
  },

  rift_pressure: {
    id: 'rift_pressure',
    chapter: 3,
    title: 'Pressure Crest',
    location: 'Overlay Crossfall',
    body: `Reality double-exposes. Your Pressure climbs with every impossible street. If a Catalyst was prepared, Breakthrough is possible — unstable, irreversible in reputation if not in flesh.`,
    choices: [
      {
        id: 'breakthrough',
        label: 'Attempt Breakthrough — Tempered Wake',
        hint: 'Requires Catalyst; Will contest',
        effects: {
          attributeCheck: {
            attribute: 'will',
            dc: 14,
            successGoTo: 'breakthrough_ok',
            failGoTo: 'breakthrough_wild',
            useRiftDie: true,
          },
          setFlags: { 'Tried.Breakthrough': true },
        },
      },
      {
        id: 'hold_form',
        label: 'Hold your mortal form and press on',
        effects: {
          setFlags: { 'Choice.HeldForm': true },
          gainResolve: 1,
          goTo: 'final_gate',
        },
      },
    ],
  },

  breakthrough_ok: {
    id: 'breakthrough_ok',
    chapter: 3,
    title: 'Tempered Wake',
    location: 'Overlay Crossfall',
    body: `The Ascension locks into a silhouette that is yours alone — luminous wake along the limbs, geometry tightened, no borrowed iconography. Power rises a band. The city flinches, then steadies around your control.`,
    choices: [
      {
        id: 'to_final_ascended',
        label: 'Face what the Engine became',
        effects: {
          setFlags: { 'Ascension.TemperedWake': true, 'Ascension.Controlled': true },
          unlockCatalyst: true,
          goTo: 'final_gate',
        },
      },
    ],
  },

  breakthrough_wild: {
    id: 'breakthrough_wild',
    chapter: 3,
    title: 'Wake Unbound',
    location: 'Overlay Crossfall',
    body: `Power arrives anyway. Control does not. Windows become mirrors of other rains. A companion flinches from your Resonance — trust cracks even as the immediate street clears.`,
    choices: [
      {
        id: 'to_final_wild',
        label: 'Carry the consequences into the Engine',
        effects: {
          setFlags: { 'Ascension.TemperedWake': true, 'Ascension.Uncontrolled': true },
          addTrust: { sori: -2, tamsin: -1, ivo: -1 },
          goTo: 'final_gate',
        },
      },
    ],
  },

  final_gate: {
    id: 'final_gate',
    chapter: 3,
    title: 'The Custodian',
    location: 'Axis Engine Heart',
    body: `The Custodian hangs in a lattice of remembered cities. Vexa is here too — fighting the Engine, or fighting you for the right to decide.

How this ends depends on what you prepared.`,
    choices: [
      {
        id: 'fight_both',
        label: 'Fight through Custodian and Vexa',
        effects: {
          startCombat: 'final_both',
          goTo: 'ending_choose',
        },
      },
      {
        id: 'fight_custodian',
        label: 'Focus the Custodian; leave Vexa an opening to ally',
        effects: {
          startCombat: 'final_custodian',
          setFlags: { 'Vexa.PotentialAlly': true },
          goTo: 'ending_choose',
        },
      },
      {
        id: 'talk_custodian',
        label: 'Attempt contact with the Custodian during battle',
        hint: 'Opens nonviolent final options',
        effects: {
          startCombat: 'final_talk',
          setFlags: { 'Custodian.Contact': true },
          goTo: 'ending_choose',
        },
      },
    ],
  },

  ending_choose: {
    id: 'ending_choose',
    chapter: 3,
    title: 'Decide the Engine',
    location: 'Axis Engine Heart',
    body: `The Engine's heart is exposed. There is no perfect result — only which costs you can still afford.`,
    choices: [
      {
        id: 'end_destroy',
        label: 'Destroy the Engine',
        hint: 'City saved now; regional rifts worsen',
        effects: { ending: 'destroy' },
      },
      {
        id: 'end_stabilize',
        label: 'Stabilize the Engine',
        hint: 'Needs prep: sabotage knowledge + companion/trust or research',
        effects: { ending: 'stabilize' },
      },
      {
        id: 'end_sync',
        label: 'Synchronize with it',
        hint: 'Risky Rift Ascension; political danger',
        effects: { ending: 'synchronize' },
      },
      {
        id: 'end_release',
        label: 'Release the Custodian into a body',
        hint: 'Easier if you made contact',
        effects: { ending: 'release' },
      },
    ],
  },
};

export const ENDINGS: Record<
  string,
  { id: string; title: string; summary: (flags: Record<string, unknown>) => string }
> = {
  destroy: {
    id: 'destroy',
    title: 'Ash Horizon',
    summary: () =>
      'You shatter the Axis Engine. Crossfall stops overlaying itself. In the Meridian Scar, rift activity spikes within days. You are celebrated locally and blamed regionally. Vexa calls it proof that only strength finishes jobs.',
  },
  stabilize: {
    id: 'stabilize',
    title: 'Held Meridian',
    summary: (flags) =>
      flags['Ending.Stabilize.Success']
        ? 'Technical, magical, and companion preparation align. The Custodian remains alive inside a calmed lattice. Crossfall becomes a watched miracle — fragile, studied, contested by every faction.'
        : 'Stabilization slips. You salvage a partial lock: the city holds, but the Custodian dreams louder. The Accord quarantines the arena. Your name becomes a classified file.',
  },
  synchronize: {
    id: 'synchronize',
    title: 'Rift-Bound',
    summary: () =>
      'You synchronize. A Rift Ascension brands your Resonance permanently. Doors open that should not. The Pure Horizon names you threat; the Unbound name you proof. Companions stay — carefully.',
  },
  release: {
    id: 'release',
    title: 'Custodian Unbound',
    summary: (flags) =>
      flags['Custodian.Contact']
        ? 'The Custodian leaves in a constructed body, frightened and curious. Future ally — or future sovereign. Crossfall keeps its skyline. You keep a promise you do not fully understand.'
        : 'You force a release without true contact. The Custodian flees wounded into Skygrave rumor. The city survives. The debt does not.',
  },
  lose: {
    id: 'lose',
    title: 'Partial Crossfall',
    summary: () =>
      'You lose the confrontation. Crossfall partially changes — streets from other rains remain. The campaign would continue in a more unstable world. For this vertical slice, the Trials end with you alive, marked, and unfinished.',
  },
};
