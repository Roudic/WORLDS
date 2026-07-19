/**
 * Generative story engine — no scripts. Every event is assembled at roll
 * time from random names, motives, stakes, numbers, and complications,
 * in the spirit of high-power martial anime: invaders from the sky,
 * tournaments, brutal training, rivals returning stronger, relic hunts.
 * Every choice carries generated win/lose reasons so gains stay earned.
 */
import type {
  AttributeId,
  PlayerBuild,
  RosterCharacter,
  WorldEvent,
  WorldEventChoice,
} from '../engine/types';
import { formatPL } from '../engine/power';
import type { World } from '../engine/worlds';

export interface GenCtx {
  world: World;
  player: PlayerBuild;
  rand: () => number;
  pl: number;
  others: RosterCharacter[];
  worlds: World[];
}

const pick = <T,>(r: () => number, a: readonly T[]): T =>
  a[Math.floor(r() * a.length) % a.length];

// ---------------------------------------------------------------- names

const SYL_A = ['Ka', 'Ve', 'Zor', 'Na', 'Ry', 'Tal', 'Bru', 'Sha', 'Or', 'Dre', 'Vol', 'Mi', 'Gr', 'Ax', 'Ce', 'Ju'] as const;
const SYL_B = ['el', 'ma', 'ric', 'ka', 'dos', 'wyn', 'za', 'ren', 'ta', 'gor', 'ix', 'un', 'eth', 'ov', 'ash', 'il'] as const;
const SYL_C = ['ar', 'is', 'or', 'ax', 'on', 'us', 'ei', 'oa'] as const;
const EPITHETS = [
  'the Ruinous', 'of the Ninth Fleet', 'the Quiet Fang', 'the Unbent', 'of the Ash Choir',
  'the Ceiling-Breaker', 'the Ninefold', 'of the Long Fall', 'the Patient Storm', 'the Grinning Wall',
] as const;

export function genName(r: () => number): string {
  const base = pick(r, SYL_A) + pick(r, SYL_B) + (r() < 0.35 ? pick(r, SYL_C) : '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function genFoe(r: () => number): string {
  return r() < 0.5 ? `${genName(r)} ${pick(r, EPITHETS)}` : genName(r);
}

// ------------------------------------------------------------- fragments

const ARRIVALS = [
  'a burning pod shears the clouds and craters the plaza',
  'a scanner wave rolls over the district and every screen whites out',
  'the sky splits with a pressure front that flattens market stalls',
  'a silhouette descends slowly, arms crossed, letting everyone watch',
  'three moons of dust rise where something lands beyond the ridge',
] as const;

const DEMANDS = [
  'the strongest fighter on this world, or the district burns',
  'tribute in Flux cores by dawn',
  'a duel with whoever the crowds call champion',
  'the location of a buried Rift Shard',
  'an heir to train — or a city to break',
] as const;

const TRAININGS = [
  'a canyon where gravity plates triple your weight',
  'a breath-hall where you strike until your knuckles read the air',
  'a flooded shaft where every kick fights the current',
  'a scream-forge where output must stay pinned at the redline',
  'a blindfold circuit strung with live current wires',
] as const;

const STAKES = [
  'the winner names the next law of the arena',
  'the loser leaves this world for a season',
  'the purse is a sealed Flux core nobody can price',
  'the crowd decides who gets the mentor’s last lesson',
  'the champion holds the district’s shield-key',
] as const;

const COMPLICATIONS = [
  'halfway through, the ground drops half a meter — the whole ring lurches',
  'a second challenger crashes the bout uninvited',
  'the scanner caps mid-fight and no one can read anyone',
  'civilians wander in right where the shockwaves land',
  'your own energy starts answering to the world’s Flux bias, not to you',
] as const;

const RELICS = [
  'Rift Shard', 'Ember Core', 'Hollow Bell', 'Wake Anchor', 'Null Prism',
] as const;

// --------------------------------------------------------------- helpers

function dc(r: () => number, base = 12): number {
  return base + Math.floor(r() * 4) - 1; // base-1 .. base+2
}

type Lean = NonNullable<WorldEventChoice['lean']>;

function battleChoice(
  r: () => number,
  label: string,
  encounter: string,
  lean: Lean,
  attr: AttributeId,
  win: string,
  lose: string,
): WorldEventChoice {
  return {
    id: `gen_fight_${Math.floor(r() * 1e6).toString(36)}`,
    label,
    hint: 'Battle — real combat decides it',
    attribute: attr,
    dc: dc(r, 11),
    lean,
    startCombat: encounter,
    reasonWin: win,
    reasonLose: lose,
  };
}

function skillChoice(
  r: () => number,
  label: string,
  hint: string,
  attr: AttributeId,
  lean: Lean,
  win: string,
  lose: string,
  extra?: Partial<WorldEventChoice>,
): WorldEventChoice {
  return {
    id: `gen_${attr}_${Math.floor(r() * 1e6).toString(36)}`,
    label,
    hint,
    attribute: attr,
    dc: dc(r),
    lean,
    reasonWin: win,
    reasonLose: lose,
    ...extra,
  };
}

// ----------------------------------------------------------------- beats

type Beat = (ctx: GenCtx) => WorldEvent | null;

const BEATS: Beat[] = [
  // Invader from the sky — the classic
  ({ world, player, rand, pl }) => {
    const foe = genFoe(rand);
    const mult = 0.8 + rand() * 1.1;
    const foePl = formatPL(Math.round(pl * mult));
    const arrival = pick(rand, ARRIVALS);
    const demand = pick(rand, DEMANDS);
    return {
      id: 'gen_invader',
      title: `${foe} Falls From the Sky`,
      tag: 'battle',
      kind: 'battle',
      body: `Over ${world.name}, ${arrival}. ${foe} reads ${foePl} on every scanner and wants ${demand}. ${player.name}'s hands are already curling into fists.`,
      choices: [
        battleChoice(
          rand,
          `Meet ${foe} head-on`,
          mult > 1.3 ? 'world_hunt' : 'world_duel',
          ['offense', 'strength', 'endurance'],
          'might',
          `${player.name} answered ${foe}'s landing with fists — power sharpened under a real invader`,
          `${foe} hit harder than the scanner promised — ${player.name}'s body keeps the lesson`,
        ),
        skillChoice(
          rand,
          'Evacuate the district first',
          'Presence DC — Resistance/Speed, then the fight finds you',
          'presence',
          ['resistance', 'speed'],
          `${player.name} moved a district out of the blast zone before trading a single blow`,
          `The evacuation cost bruises and time — Endurance grew out of the scramble`,
          { startCombat: 'world_skirmish', convictionTouch: 'duty' },
        ),
        skillChoice(
          rand,
          `Study ${foe}'s stance from cover`,
          'Intellect DC — Defense/Force from reading the threat',
          'intellect',
          ['defense', 'force'],
          `${player.name} mapped ${foe}'s form before it mapped them — Defense from patience`,
          `${foe} spotted the tail — ${player.name} escaped with scraped Force channels and notes`,
        ),
      ],
    };
  },

  // Tournament arc
  ({ world, player, rand, pl }) => {
    const crown = `${pick(rand, ['Ember', 'Hollow', 'Skyline', 'Iron', 'Pale'] as const)} Crown`;
    const stake = pick(rand, STAKES);
    const comp = pick(rand, COMPLICATIONS);
    return {
      id: 'gen_tournament',
      title: `The ${crown} Bracket`,
      tag: 'battle',
      kind: 'battle',
      body: `${world.name} chalks a ring and calls the ${crown}: ${stake}. ${player.name} is seeded at ${formatPL(pl)} — and rumor says ${comp}.`,
      choices: [
        battleChoice(
          rand,
          'Enter the bracket',
          'world_duel',
          ['offense', 'speed', 'strength'],
          'agility',
          `${player.name} fought through the ${crown} bracket — crowd-pressure carved the combos in deep`,
          `Knocked out of the ${crown}, ${player.name} kept the footwork the loss paid for`,
        ),
        skillChoice(
          rand,
          'Train until the opening bell',
          'Grit DC — Strength/Endurance from a last hard camp',
          'grit',
          ['strength', 'endurance'],
          `${player.name} burned the pre-bracket nights in a training camp that left dents in the floor`,
          `Overtraining tweaked a shoulder — but the reps still counted`,
        ),
        skillChoice(
          rand,
          'Scout the other seeds',
          'Intellect DC — Defense/Resistance from reading the field',
          'intellect',
          ['defense', 'resistance'],
          `${player.name} charted every seed's habits — Defense from homework nobody else did`,
          `Half the notes were wrong, but the discipline of watching sharpened Resistance`,
        ),
      ],
    };
  },

  // Brutal training
  ({ world, player, rand }) => {
    const mentor = genFoe(rand);
    const place = pick(rand, TRAININGS);
    return {
      id: 'gen_training',
      title: `${mentor}'s Cruel Classroom`,
      tag: 'growth',
      body: `${mentor} takes one look at ${player.name} on ${world.name} and points at ${place}. "Quit whenever you like," they say, and don't smile.`,
      choices: [
        skillChoice(
          rand,
          'Take the full circuit',
          'Grit DC — heavy Strength/Endurance',
          'grit',
          ['strength', 'endurance', 'offense'],
          `${player.name} finished ${mentor}'s circuit — muscle rebuilt itself around the punishment`,
          `${player.name} collapsed on the last leg — the failure still forged Endurance`,
        ),
        skillChoice(
          rand,
          'Master one movement perfectly',
          'Control DC — Speed/Force from precision',
          'control',
          ['speed', 'force'],
          `One movement, ten thousand times — ${player.name}'s Speed stopped being a number`,
          `The movement never clicked, but the chase tuned ${player.name}'s Force channels`,
        ),
        battleChoice(
          rand,
          `Ask ${mentor} to fight instead`,
          'world_duel',
          ['offense', 'defense'],
          'presence',
          `${mentor} said yes with their fists — ${player.name} learned at full contact`,
          `${mentor} folded ${player.name} in three exchanges — every fold was a lesson`,
        ),
      ],
    };
  },

  // Rival returns stronger
  ({ world, player, rand, pl }) => {
    const rival = genFoe(rand);
    const jump = formatPL(Math.round(pl * (1.1 + rand() * 0.6)));
    return {
      id: 'gen_rival_return',
      title: `${rival} Came Back Wrong`,
      tag: 'rivalry',
      kind: 'battle',
      body: `Last season ${rival} left ${world.name} humiliated. They're back at ${jump} — scanners double-take. They call ${player.name} out by name in the middle of the market.`,
      choices: [
        battleChoice(
          rand,
          'Answer the callout now',
          'world_duel',
          ['offense', 'strength', 'speed'],
          'might',
          `${player.name} met ${rival}'s comeback with open hands — rivalry is the fastest teacher`,
          `${rival}'s new power was real — ${player.name} ate the loss and grew around it`,
        ),
        skillChoice(
          rand,
          'Make them wait a day',
          'Will DC — Resistance; fight on your terms',
          'will',
          ['resistance', 'defense'],
          `${player.name} refused the ambush-duel and set the terms — composure is armor`,
          `The crowd read it as fear — carrying that read still hardened Resistance`,
          { startCombat: 'world_duel' },
        ),
        skillChoice(
          rand,
          'Ask what they endured',
          'Presence DC — their training becomes your map',
          'presence',
          ['force', 'endurance'],
          `${rival} talked before fighting — their pain became ${player.name}'s shortcut`,
          `${rival} spat at the question — the rejection taught its own endurance`,
          { convictionTouch: 'truth' },
        ),
      ],
    };
  },

  // Relic hunt
  ({ world, player, rand }) => {
    const relic = pick(rand, RELICS);
    const n = 3 + Math.floor(rand() * 5);
    const rivalTeam = genFoe(rand);
    return {
      id: 'gen_relic',
      title: `${n} ${relic}s, One Map`,
      tag: 'discovery',
      body: `A dying courier presses a map into ${player.name}'s hands: ${n} ${relic}s buried across ${world.name}. ${rivalTeam} holds a copy of the same map, and they dig faster.`,
      choices: [
        skillChoice(
          rand,
          'Race the map point to point',
          'Agility DC — Speed; beat them to the caches',
          'agility',
          ['speed', 'force'],
          `${player.name} out-ran ${rivalTeam} across ${n} dig sites — Speed with a treasure receipt`,
          `${rivalTeam} got there first twice — chasing them still built Speed`,
        ),
        battleChoice(
          rand,
          `Hit ${rivalTeam}'s dig camp`,
          'world_skirmish',
          ['offense', 'endurance'],
          'might',
          `${player.name} took the ${relic}s straight out of ${rivalTeam}'s camp — Offense pays`,
          `The camp raid went sideways — ${player.name} left with scars and one shard`,
        ),
        skillChoice(
          rand,
          'Decode the map’s second layer',
          'Intellect DC — Force; the relics sing to each other',
          'intellect',
          ['force', 'defense'],
          `${player.name} heard the ${relic}s resonate — Force grew from listening, not digging`,
          `The second layer was a trap-glyph — surviving it tuned ${player.name}'s Defense`,
        ),
      ],
    };
  },

  // World pressure / ceiling
  ({ world, player, rand, pl }) => {
    const gap = world.powerCeiling - pl;
    const foe = genFoe(rand);
    return {
      id: 'gen_ceiling',
      title: gap > 0 ? 'The Ceiling Hums' : 'Above the Ceiling',
      tag: 'battle',
      kind: 'battle',
      body:
        gap > 0
          ? `${world.name}'s soft ceiling sits at ${formatPL(world.powerCeiling)} and ${player.name} is under it — for now. ${foe} patrols the gap and hates climbers.`
          : `${player.name} reads over ${world.name}'s ceiling (${formatPL(world.powerCeiling)}). The world itself sends ${foe} to test whether that's earned.`,
      choices: [
        battleChoice(
          rand,
          `Fight ${foe}`,
          gap > 0 ? 'world_ambush' : 'world_hunt',
          ['offense', 'force', 'endurance'],
          'might',
          `${player.name} beat the world's own gatekeeper — the ceiling means less now`,
          `${foe} enforced the ceiling hard — ${player.name} keeps the dents as data`,
        ),
        skillChoice(
          rand,
          'Slip past unseen',
          'Agility DC — Speed/Defense; no fight today',
          'agility',
          ['speed', 'defense'],
          `${player.name} ghosted past ${foe} — Speed as a stealth stat`,
          `Spotted twice, escaped twice — panic footwork still counts as footwork`,
        ),
        skillChoice(
          rand,
          'Petition to raise the ceiling',
          'Presence DC — world management, story progress',
          'presence',
          ['resistance'],
          `${player.name} argued the district into raising its ceiling — worlds bend to voices too`,
          `The petition died in chambers — standing alone in that room built Resistance`,
        ),
      ],
    };
  },

  // Team-up with roster mate
  ({ world, player, rand, others }) => {
    if (!others.length) return null;
    const ally = pick(rand, others);
    const threat = genFoe(rand);
    return {
      id: 'gen_teamup',
      title: `Back to Back with ${ally.build.name}`,
      tag: 'meet',
      kind: 'meet',
      body: `${threat} corners ${player.name} and ${ally.build.name} in the same alley of ${world.name}. Two fighters, one problem, no exits worth taking.`,
      choices: [
        battleChoice(
          rand,
          'Fight it together',
          'world_skirmish',
          ['offense', 'defense', 'speed'],
          'might',
          `${player.name} and ${ally.build.name} synced against ${threat} — trust turned into timing`,
          `${threat} split them apart — the bruises taught them each other's blind sides`,
        ),
        skillChoice(
          rand,
          `Cover ${ally.build.name}'s escape`,
          'Grit DC — Endurance/Resistance; you hold the alley',
          'grit',
          ['endurance', 'resistance'],
          `${player.name} held the alley alone so ${ally.build.name} could flank — the wall held`,
          `The wall cracked but never fell — Endurance out of pure stubbornness`,
          { meetCharacterId: ally.id, convictionTouch: 'belonging' },
        ),
        skillChoice(
          rand,
          'Talk the threat down together',
          'Presence DC — two voices, one front',
          'presence',
          ['resistance', 'defense'],
          `Two reputations stacked — ${threat} backed off without a blow`,
          `${threat} laughed at the diplomacy — the humiliation still hardened both of them`,
          { meetCharacterId: ally.id },
        ),
      ],
    };
  },

  // The world event — disaster with fists
  ({ world, player, rand }) => {
    const comp = pick(rand, COMPLICATIONS);
    return {
      id: 'gen_disaster',
      title: 'The District Screams',
      tag: 'survival',
      body: `Stability on ${world.name} reads ${world.stability} and dropping. Sirens, then silence, then ${comp}. ${player.name} is the closest thing to a shield in range.`,
      choices: [
        skillChoice(
          rand,
          'Hold the breach with your body',
          'Grit DC — Strength/Endurance the hard way',
          'grit',
          ['strength', 'endurance'],
          `${player.name} braced a failing district with bone and Flux — the district remembers`,
          `The breach won this round — ${player.name}'s frame kept the reinforcement anyway`,
        ),
        battleChoice(
          rand,
          'Punch through to the trapped',
          'world_ambush',
          ['offense', 'speed'],
          'might',
          `${player.name} cleared rubble and raiders in the same ten minutes`,
          `Looters got the west block — the running fight still sharpened Speed`,
        ),
        skillChoice(
          rand,
          'Rewire the district anchors',
          'Control DC — Force/Defense from precision under sirens',
          'control',
          ['force', 'defense'],
          `${player.name} rewired anchors mid-collapse — precision with the volume up`,
          `Two anchors fused wrong — reading the failure taught real Defense`,
        ),
      ],
    };
  },
];

export function generateRandomEvent(ctx: GenCtx, prefer: 'any' | 'battle' = 'any'): WorldEvent | null {
  const pool =
    prefer === 'battle'
      ? BEATS.filter((_, i) => [0, 1, 3, 5].includes(i))
      : BEATS;
  for (let i = 0; i < 8; i++) {
    const beat = pick(ctx.rand, pool);
    const ev = beat(ctx);
    if (ev) return ev;
  }
  return BEATS[0](ctx);
}
