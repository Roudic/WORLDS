import {
  bandGap,
  computeFlux,
  computeGuard,
  computeStagger,
  computeVitality,
  shiftBand,
  applyPartial,
} from './attributes';
import { damageRoll, isSuccess, makeCheck, modifier } from './dice';
import {
  combatantResonance,
  formatResonance,
  outputLabel,
  powerGapFlavor,
} from './resonance';
import type {
  AscensionDef,
  Combatant,
  DiceResult,
  PlayerBuild,
  PowerBand,
  TechniqueDef,
} from './types';
import { ASCENSIONS, COMPANIONS, TECHNIQUES } from '../data/catalog';

export interface CombatLogEntry {
  text: string;
  kind: 'info' | 'attack' | 'heal' | 'system' | 'rift' | 'ascend' | 'defeat';
}

export interface EncounterObjective {
  id: string;
  label: string;
  type: 'defeat_all' | 'survive_rounds' | 'protect' | 'convince' | 'stabilize';
  targetRounds?: number;
  protectId?: string;
}

export interface CombatState {
  id: string;
  name: string;
  description: string;
  combatants: Combatant[];
  turnOrder: string[];
  activeIndex: number;
  round: number;
  log: CombatLogEntry[];
  objective: EncounterObjective;
  riftActive: boolean;
  finished: boolean;
  victory: boolean;
  pendingClash?: {
    attackerId: string;
    defenderId: string;
    techniqueId: string;
    beats: { attacker: string; defender: string; winner: 'attacker' | 'defender' | 'tie' }[];
  };
  lastRoll?: DiceResult;
  tags: string[];
}

export function playerToCombatant(player: PlayerBuild): Combatant {
  const maxV = computeVitality(player.origin, player.attributes.grit, player.level);
  const maxF = computeFlux(
    player.discipline,
    player.attributes.control,
    player.attributes.will,
  );
  return {
    id: 'player',
    name: player.name,
    isPlayer: true,
    isCompanion: false,
    origin: player.origin,
    discipline: player.discipline,
    attributes: { ...player.attributes },
    level: player.level,
    vitality: maxV,
    maxVitality: maxV,
    flux: maxF,
    maxFlux: maxF,
    guard: computeGuard(player.attributes.agility),
    stagger: 0,
    maxStagger: computeStagger(player.attributes.grit, player.level),
    pressure: 0,
    resolve: player.resolve,
    powerBand: player.powerBand,
    output: 0.6,
    techniques: [...player.techniques],
    statuses: [],
    ascended: false,
    position: 2,
    alive: true,
  };
}

export function companionToCombatant(id: string, position: number): Combatant {
  const c = COMPANIONS[id];
  const maxV = computeVitality(c.origin, c.attributes.grit, 3);
  const maxF = computeFlux(c.discipline, c.attributes.control, c.attributes.will);
  return {
    id: c.id,
    name: c.name,
    isPlayer: false,
    isCompanion: true,
    origin: c.origin,
    discipline: c.discipline,
    attributes: { ...c.attributes },
    level: 3,
    vitality: maxV,
    maxVitality: maxV,
    flux: maxF,
    maxFlux: maxF,
    guard: computeGuard(c.attributes.agility),
    stagger: 0,
    maxStagger: computeStagger(c.attributes.grit, 3),
    pressure: 0,
    resolve: 2,
    powerBand: 'mortal',
    output: 0.5,
    techniques: [...c.techniques],
    statuses: [],
    ascended: false,
    position,
    alive: true,
    aiProfile: 'protector',
  };
}

export function makeEnemy(opts: {
  id: string;
  name: string;
  attributes: Combatant['attributes'];
  techniques: string[];
  powerBand?: PowerBand;
  level?: number;
  position?: number;
  aiProfile?: Combatant['aiProfile'];
  output?: number;
}): Combatant {
  const level = opts.level ?? 3;
  const grit = opts.attributes.grit;
  const maxV = 24 + modifier(grit) * 5 + level * 3;
  const maxF = 12 + modifier(opts.attributes.control) * 3 + modifier(opts.attributes.will) * 2;
  const output = opts.output ?? 0.55;
  return {
    id: opts.id,
    name: opts.name,
    isPlayer: false,
    isCompanion: false,
    attributes: { ...opts.attributes },
    level,
    vitality: maxV,
    maxVitality: maxV,
    flux: maxF,
    maxFlux: maxF,
    guard: computeGuard(opts.attributes.agility),
    stagger: 0,
    maxStagger: computeStagger(grit, level),
    pressure: 0,
    resolve: 1,
    powerBand: opts.powerBand ?? 'mortal',
    output,
    techniques: opts.techniques,
    statuses: output >= 0.9 ? ['aura'] : [],
    ascended: false,
    position: opts.position ?? 5,
    alive: true,
    aiProfile: opts.aiProfile ?? 'aggressive',
  };
}

export function createEncounter(opts: {
  id: string;
  name: string;
  description: string;
  allies: Combatant[];
  enemies: Combatant[];
  objective: EncounterObjective;
  riftActive?: boolean;
  tags?: string[];
}): CombatState {
  const combatants = [...opts.allies, ...opts.enemies];
  const turnOrder = [...combatants]
    .sort(
      (a, b) =>
        b.attributes.agility + modifier(b.attributes.agility) -
        (a.attributes.agility + modifier(a.attributes.agility)),
    )
    .map((c) => c.id);

  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    combatants,
    turnOrder,
    activeIndex: 0,
    round: 1,
    log: [{ text: `${opts.name} begins. ${opts.description}`, kind: 'system' }],
    objective: opts.objective,
    riftActive: opts.riftActive ?? false,
    finished: false,
    victory: false,
    tags: opts.tags ?? [],
  };
}

function get(state: CombatState, id: string): Combatant {
  const c = state.combatants.find((x) => x.id === id);
  if (!c) throw new Error(`Missing combatant ${id}`);
  return c;
}

export function activeCombatant(state: CombatState): Combatant {
  return get(state, state.turnOrder[state.activeIndex]);
}

function pushLog(state: CombatState, text: string, kind: CombatLogEntry['kind'] = 'info') {
  state.log.push({ text, kind });
}

function defenseValue(target: Combatant, defense: TechniqueDef['defense']): number {
  switch (defense) {
    case 'guard':
      return target.guard + (target.statuses.includes('guarded') ? 2 : 0);
    case 'control':
      return 10 + modifier(target.attributes.control);
    case 'will':
      return 10 + modifier(target.attributes.will);
    case 'grit':
      return 10 + modifier(target.attributes.grit);
    case 'presence':
      return 10 + modifier(target.attributes.presence);
    case 'might':
      return 10 + modifier(target.attributes.might);
  }
}

function applyBandPenalty(
  attacker: Combatant,
  defender: Combatant,
): { disadvantage: boolean; damageMult: number; blocked: boolean } {
  const gap = bandGap(defender.powerBand, attacker.powerBand);
  if (gap >= 3) return { disadvantage: true, damageMult: 0, blocked: true };
  if (gap === 2) return { disadvantage: true, damageMult: 0.25, blocked: false };
  if (gap === 1) return { disadvantage: true, damageMult: 0.7, blocked: false };
  return { disadvantage: false, damageMult: 1, blocked: false };
}

export function useTechnique(
  state: CombatState,
  actorId: string,
  techniqueId: string,
  targetId: string,
): CombatState {
  const next = structuredClone(state) as CombatState;
  const actor = get(next, actorId);
  const target = get(next, targetId);
  const tech = TECHNIQUES[techniqueId];
  if (!tech) {
    pushLog(next, `Unknown technique ${techniqueId}`, 'system');
    return next;
  }
  if (!actor.alive || next.finished) return next;
  if (actor.flux < tech.fluxCost) {
    pushLog(next, `${actor.name} lacks Flux for ${tech.name}.`, 'system');
    return next;
  }

  actor.flux -= tech.fluxCost;

  if (tech.heal) {
    const healed = Math.min(tech.heal, target.maxVitality - target.vitality);
    target.vitality += healed;
    if (tech.conditions?.includes('focused')) {
      target.pressure = Math.max(0, target.pressure - 2);
      target.resolve += 1;
    }
    pushLog(next, `${actor.name} uses ${tech.name} on ${target.name} (+${healed} Vitality).`, 'heal');
    endTurn(next);
    return next;
  }

  if (tech.conditions?.includes('guarded') && tech.damageDice === 0) {
    actor.statuses = Array.from(new Set([...actor.statuses, 'guarded']));
    pushLog(next, `${actor.name} raises ${tech.name}. Guard reinforced.`, 'info');
    endTurn(next);
    return next;
  }

  if (tech.conditions?.includes('exposed') && tech.damageDice === 0) {
    target.statuses = Array.from(new Set([...target.statuses, 'exposed']));
    pushLog(next, `${actor.name} scans ${target.name}. Weakness exposed.`, 'info');
    next.tags.push(`exposed:${target.id}`);
    endTurn(next);
    return next;
  }

  if (tech.conditions?.includes('focused') && tech.damageDice === 0) {
    target.resolve += 1;
    target.pressure = Math.max(0, target.pressure - 3);
    pushLog(next, `${actor.name} steadies ${target.name} with ${tech.name}.`, 'heal');
    endTurn(next);
    return next;
  }

  const band = applyBandPenalty(actor, target);
  if (band.blocked) {
    pushLog(
      next,
      `${actor.name}'s ${tech.name} cannot harm ${target.name} across this power gap. Survive, expose, or change the board.`,
      'system',
    );
    actor.pressure += 2;
    endTurn(next);
    return next;
  }

  const attr = actor.attributes[tech.attackAttribute];
  const advantage = target.statuses.includes('exposed');
  const roll = makeCheck({
    rollType: tech.name,
    attributeValue: attr,
    proficiency: Math.floor(actor.level / 2) + (actor.ascended ? 2 : 0),
    situation: actor.statuses.includes('flanking') ? 2 : 0,
    dc: defenseValue(target, tech.defense),
    advantage,
    disadvantage: band.disadvantage,
    useRiftDie: next.riftActive || tech.environmental === 'rift',
    sourceTags: [`tech:${tech.id}`, `actor:${actor.id}`],
  });
  next.lastRoll = roll;

  if (!isSuccess(roll.outcomeTier)) {
    pushLog(next, `${actor.name} misses with ${tech.name}. ${roll.narrative}`, 'attack');
    if (roll.riftEvent) pushLog(next, `Rift Die ${roll.riftDie}: ${roll.riftEvent}`, 'rift');
    actor.pressure += 1;
    endTurn(next);
    return next;
  }

  // Clash opportunity
  if (
    tech.clashEligible &&
    target.alive &&
    !target.isCompanion &&
    !actor.isCompanion &&
    (target.techniques.some((t) => TECHNIQUES[t]?.clashEligible) || target.id === 'custodian')
  ) {
    next.pendingClash = {
      attackerId: actor.id,
      defenderId: target.id,
      techniqueId: tech.id,
      beats: [],
    };
    pushLog(next, `${actor.name} and ${target.name} lock into a Clash!`, 'system');
    return next;
  }

  const dmgBonus = modifier(attr) + (actor.ascended ? 3 : 0);
  const dmg = damageRoll(tech.damageDice, tech.damageSides, dmgBonus);
  const outputMult = 0.55 + actor.output * 0.9;
  let total = Math.max(1, Math.round(dmg.total * band.damageMult * outputMult));
  if (roll.outcomeTier === 'strongSuccess') total = Math.round(total * 1.25);
  if (roll.outcomeTier === 'exceptionalSuccess') total = Math.round(total * 1.5);

  target.vitality = Math.max(0, target.vitality - total);
  target.stagger += tech.impact + (roll.outcomeTier === 'exceptionalSuccess' ? 2 : 0);
  target.pressure += 1;
  actor.pressure += tech.fluxCost > 0 ? 1 : 0;
  target.statuses = target.statuses.filter((s) => s !== 'exposed');

  if (tech.conditions?.includes('bound')) {
    target.statuses = Array.from(new Set([...target.statuses, 'bound']));
  }

  pushLog(
    next,
    `${actor.name} hits ${target.name} with ${tech.name} for ${total} damage (Stagger +${tech.impact}). ${roll.narrative}`,
    'attack',
  );
  if (roll.riftEvent) {
    pushLog(next, `Rift Die ${roll.riftDie}: ${roll.riftEvent}`, 'rift');
    applyRiftSideEffect(next, roll.riftDie!, actor, target);
  }

  if (target.stagger >= target.maxStagger) {
    target.stagger = 0;
    target.statuses = Array.from(new Set([...target.statuses, 'staggered']));
    target.guard = Math.max(8, target.guard - 2);
    pushLog(next, `${target.name} is staggered — armor breaks, opening created!`, 'system');
  }

  if (target.vitality <= 0) {
    target.alive = false;
    target.defeatState = target.id === 'custodian' ? 'transformed' : 'unconscious';
    pushLog(next, `${target.name} falls (${target.defeatState}).`, 'defeat');
  }

  checkEnd(next);
  if (!next.finished) endTurn(next);
  return next;
}

function applyRiftSideEffect(
  state: CombatState,
  riftDie: number,
  actor: Combatant,
  target: Combatant,
) {
  switch (riftDie) {
    case 1:
      target.pressure += 2;
      pushLog(state, 'A fracture spike lashes the field. Pressure rises.', 'rift');
      break;
    case 2:
      actor.flux = Math.max(0, actor.flux - 2);
      pushLog(state, 'Rift cost: Flux bleeds away.', 'rift');
      break;
    case 3:
      state.tags.push('objective_shift');
      pushLog(state, 'The arena geometry shifts. Objectives feel different.', 'rift');
      break;
    case 4:
      target.statuses = Array.from(new Set([...target.statuses, 'exposed']));
      pushLog(state, 'An opening appears — target exposed.', 'rift');
      break;
    case 5:
      actor.vitality = Math.min(actor.maxVitality, actor.vitality + 6);
      pushLog(state, 'A boon memory knits your wounds (+6 Vitality).', 'rift');
      break;
    case 6:
      state.tags.push('anomaly_longterm');
      actor.resolve += 1;
      pushLog(state, 'Anomaly: a long-term thread binds to you (+1 Resolve).', 'rift');
      break;
  }
}

export function powerUp(state: CombatState, actorId: string): CombatState {
  const next = structuredClone(state) as CombatState;
  const actor = get(next, actorId);
  if (!actor.alive || next.finished) return next;
  const before = actor.output;
  actor.output = Math.min(1, actor.output + 0.2);
  actor.pressure += 1;
  actor.flux = Math.max(0, actor.flux - 1);
  if (actor.output >= 0.95) {
    actor.statuses = Array.from(new Set([...actor.statuses, 'aura']));
  }
  pushLog(
    next,
    `${actor.name} drives Flux wide open — output ${(before * 100).toFixed(0)}% → ${(actor.output * 100).toFixed(0)}%. Resonance spikes.`,
    'ascend',
  );
  endTurn(next);
  return next;
}

export function suppressOutput(state: CombatState, actorId: string): CombatState {
  const next = structuredClone(state) as CombatState;
  const actor = get(next, actorId);
  if (!actor.alive || next.finished) return next;
  const before = actor.output;
  actor.output = Math.max(0.2, actor.output - 0.2);
  actor.statuses = actor.statuses.filter((s) => s !== 'aura');
  actor.pressure = Math.max(0, actor.pressure - 1);
  pushLog(
    next,
    `${actor.name} clamps their Resonance — output ${(before * 100).toFixed(0)}% → ${(actor.output * 100).toFixed(0)}%.`,
    'info',
  );
  endTurn(next);
  return next;
}

export function scanResonance(
  state: CombatState,
  actorId: string,
  targetId: string,
): CombatState {
  const next = structuredClone(state) as CombatState;
  const actor = get(next, actorId);
  const target = get(next, targetId);
  if (!actor.alive || next.finished) return next;
  if (actor.flux < 1) {
    pushLog(next, `${actor.name} needs Flux to run a Resonance scan.`, 'system');
    return next;
  }
  actor.flux -= 1;
  const reading = combatantResonance(target);
  next.tags = Array.from(new Set([...next.tags, `scanned:${target.id}`]));
  next.tags.push(`res:${target.id}:${reading.displayed}`);
  pushLog(
    next,
    `SCAN → ${target.name}: RES ${formatResonance(reading.displayed)} · ${reading.bandLabel} · Output ${outputLabel(target.output)} (${Math.round(target.output * 100)}%). ${powerGapFlavor(actor.powerBand, target.powerBand)}`,
    'system',
  );
  if (actor.attributes.intellect >= 13) {
    target.statuses = Array.from(new Set([...target.statuses, 'exposed']));
    pushLog(next, 'Precision read exposes a structural weakness.', 'info');
  }
  endTurn(next);
  return next;
}

export function activateAscension(
  state: CombatState,
  actorId: string,
  ascensionId: string,
  catalystReady: boolean,
): CombatState {
  const next = structuredClone(state) as CombatState;
  const actor = get(next, actorId);
  const def: AscensionDef | undefined = ASCENSIONS[ascensionId];
  if (!def || !actor.alive || actor.ascended) return next;
  if (!catalystReady && actor.pressure < 6) {
    pushLog(next, 'Ascension needs a prepared Catalyst or extreme Pressure.', 'system');
    return next;
  }

  const control = makeCheck({
    rollType: 'Ascension Control',
    attributeValue: actor.attributes.will,
    proficiency: 2,
    dc: def.controlDifficulty,
    sourceTags: [`ascension:${def.id}`],
  });
  next.lastRoll = control;

  actor.ascended = true;
  actor.ascensionId = def.id;
  actor.attributes = applyPartial(actor.attributes, def.attributeBonus);
  actor.powerBand = shiftBand(actor.powerBand, def.powerBandShift);
  actor.flux = Math.min(actor.maxFlux + 6, actor.flux + 6);
  actor.maxFlux += 6;
  actor.pressure += def.pressureGain;
  actor.techniques = Array.from(new Set([...actor.techniques, ...def.grantedTechniqueIds]));
  actor.output = 1;
  actor.statuses = Array.from(new Set([...actor.statuses, 'aura']));
  const surge = combatantResonance(actor);
  pushLog(
    next,
    `RESONANCE SURGE → ${formatResonance(surge.displayed)} (${surge.bandLabel})`,
    'ascend',
  );

  if (isSuccess(control.outcomeTier)) {
    pushLog(next, `${actor.name} awakens ${def.name}. Control holds. ${control.narrative}`, 'ascend');
  } else {
    actor.vitality = Math.max(1, actor.vitality - 8);
    actor.pressure += 3;
    next.tags.push('ascension_uncontrolled');
    pushLog(
      next,
      `${actor.name} forces ${def.name} — power floods out, control slips. ${def.failureConsequence}`,
      'ascend',
    );
  }
  return next;
}

export function resolveClashBeat(
  state: CombatState,
  attackerChoice: string,
  defenderChoice: string,
): CombatState {
  const next = structuredClone(state) as CombatState;
  if (!next.pendingClash) return next;
  const atk = get(next, next.pendingClash.attackerId);
  const def = get(next, next.pendingClash.defenderId);

  const score = (who: Combatant, choice: string): number => {
    switch (choice) {
      case 'push':
        who.flux = Math.max(0, who.flux - 2);
        return makeCheck({
          rollType: 'Clash Push',
          attributeValue: who.attributes.control,
          proficiency: who.ascended ? 2 : 0,
          dc: 12,
        }).total;
      case 'overcharge':
        who.pressure += 2;
        who.flux = Math.max(0, who.flux - 1);
        {
          const grit = makeCheck({
            rollType: 'Overcharge Safety',
            attributeValue: who.attributes.grit,
            dc: 12,
          });
          if (!isSuccess(grit.outcomeTier)) who.vitality = Math.max(1, who.vitality - 4);
          return grit.total + 3;
        }
      case 'redirect':
        return makeCheck({
          rollType: 'Clash Redirect',
          attributeValue: Math.max(who.attributes.intellect, who.attributes.control),
          dc: 12,
        }).total + 1;
      case 'call':
        who.resolve = Math.max(0, who.resolve - 1);
        return 12 + modifier(who.attributes.presence);
      case 'release':
        return 8;
      default:
        return 10;
    }
  };

  const aScore = score(atk, attackerChoice);
  const dScore = score(def, defenderChoice);
  let winner: 'attacker' | 'defender' | 'tie' = 'tie';
  if (aScore > dScore + 1) winner = 'attacker';
  else if (dScore > aScore + 1) winner = 'defender';

  next.pendingClash.beats.push({
    attacker: attackerChoice,
    defender: defenderChoice,
    winner,
  });
  pushLog(
    next,
    `Clash beat ${next.pendingClash.beats.length}: ${atk.name} (${attackerChoice}) vs ${def.name} (${defenderChoice}) → ${winner}`,
    'system',
  );

  if (next.pendingClash.beats.length >= 2) {
    const aWins = next.pendingClash.beats.filter((b) => b.winner === 'attacker').length;
    const dWins = next.pendingClash.beats.filter((b) => b.winner === 'defender').length;
    const tech = TECHNIQUES[next.pendingClash.techniqueId];
    if (aWins >= dWins) {
      const dmg = 12 + modifier(atk.attributes.control) + (atk.ascended ? 6 : 0);
      def.vitality = Math.max(0, def.vitality - dmg);
      def.stagger += tech.impact + 3;
      pushLog(next, `${atk.name} wins the Clash! ${def.name} takes ${dmg} and is exposed.`, 'attack');
      def.statuses = Array.from(new Set([...def.statuses, 'staggered', 'exposed']));
      if (def.vitality <= 0) {
        def.alive = false;
        def.defeatState = 'unconscious';
        pushLog(next, `${def.name} falls from the Clash.`, 'defeat');
      }
    } else {
      const dmg = 10 + modifier(def.attributes.control);
      atk.vitality = Math.max(0, atk.vitality - dmg);
      atk.pressure += 2;
      pushLog(next, `${def.name} turns the Clash! ${atk.name} takes ${dmg}.`, 'attack');
      if (atk.vitality <= 0) {
        atk.alive = false;
        atk.defeatState = 'injured';
        pushLog(next, `${atk.name} is forced down.`, 'defeat');
      }
    }
    next.pendingClash = undefined;
    checkEnd(next);
    if (!next.finished) endTurn(next);
  }
  return next;
}

export function aiChooseTechnique(state: CombatState, actor: Combatant): { techId: string; targetId: string } {
  const foes = state.combatants.filter(
    (c) => c.alive && (actor.isCompanion ? !c.isPlayer && !c.isCompanion : c.isPlayer || c.isCompanion),
  );
  const allies = state.combatants.filter(
    (c) => c.alive && (actor.isCompanion ? c.isPlayer || c.isCompanion : !c.isPlayer && !c.isCompanion),
  );
  const target =
    foes.sort((a, b) => a.vitality - b.vitality)[0] ??
    state.combatants.find((c) => c.alive && c.id !== actor.id)!;

  const usable = actor.techniques
    .map((id) => TECHNIQUES[id])
    .filter((t) => t && actor.flux >= t.fluxCost);

  if (actor.aiProfile === 'protector') {
    const hurtAlly = allies.find((a) => a.vitality < a.maxVitality * 0.55);
    const heal = usable.find((t) => t.heal);
    if (hurtAlly && heal) return { techId: heal.id, targetId: hurtAlly.id };
    const guard = usable.find((t) => t.conditions?.includes('guarded'));
    if (guard && actor.vitality < actor.maxVitality * 0.5) {
      return { techId: guard.id, targetId: actor.id };
    }
  }

  const attack = usable
    .filter((t) => t.damageDice > 0)
    .sort((a, b) => b.damageDice * b.damageSides - a.damageDice * a.damageSides)[0];
  if (attack) return { techId: attack.id, targetId: target.id };

  const any = usable[0] ?? TECHNIQUES.pulse_strike;
  return { techId: any.id, targetId: target.id };
}

export function runEnemyTurns(state: CombatState): CombatState {
  let next = state;
  let guard = 0;
  while (!next.finished && guard < 12) {
    const actor = activeCombatant(next);
    if (actor.isPlayer) break;
    if (!actor.alive) {
      endTurn(next);
      guard++;
      continue;
    }
    const choice = aiChooseTechnique(next, actor);
    next = useTechnique(next, actor.id, choice.techId, choice.targetId);
    if (next.pendingClash) {
      // AI auto-resolves clash beats against player later via UI; if both AI, auto
      const clash = next.pendingClash;
      const atk = get(next, clash.attackerId);
      const def = get(next, clash.defenderId);
      if (!atk.isPlayer && !def.isPlayer) {
        while (next.pendingClash) {
          next = resolveClashBeat(next, 'push', 'overcharge');
        }
      } else {
        break;
      }
    }
    guard++;
  }
  return next;
}

function endTurn(state: CombatState) {
  const actor = activeCombatant(state);
  if (actor.ascended && actor.ascensionId) {
    const def = ASCENSIONS[actor.ascensionId];
    actor.flux = Math.max(0, actor.flux - def.fluxUpkeep);
    if (actor.flux === 0) {
      pushLog(state, `${actor.name}'s Ascension guttered — Flux spent.`, 'system');
    }
  }
  actor.statuses = actor.statuses.filter((s) => s !== 'flanking');

  let idx = state.activeIndex;
  for (let i = 0; i < state.turnOrder.length; i++) {
    idx = (idx + 1) % state.turnOrder.length;
    if (idx === 0) state.round += 1;
    if (get(state, state.turnOrder[idx]).alive) break;
  }
  state.activeIndex = idx;
  checkEnd(state);
}

function checkEnd(state: CombatState) {
  const allies = state.combatants.filter((c) => c.isPlayer || c.isCompanion);
  const enemies = state.combatants.filter((c) => !c.isPlayer && !c.isCompanion);
  const alliesAlive = allies.some((c) => c.alive);
  const enemiesAlive = enemies.some((c) => c.alive);

  if (state.objective.type === 'survive_rounds' && state.round > (state.objective.targetRounds ?? 3)) {
    state.finished = true;
    state.victory = alliesAlive;
    pushLog(state, 'Holdout complete.', 'system');
    return;
  }
  if (state.objective.type === 'convince' && state.tags.includes('convinced')) {
    state.finished = true;
    state.victory = true;
    pushLog(state, 'The confrontation turns — words win the field.', 'system');
    return;
  }
  if (!alliesAlive) {
    state.finished = true;
    state.victory = false;
    pushLog(state, 'The party is broken.', 'defeat');
    return;
  }
  if (!enemiesAlive && state.objective.type === 'defeat_all') {
    state.finished = true;
    state.victory = true;
    pushLog(state, 'Enemies defeated.', 'system');
  }
}

export function attemptConvince(
  state: CombatState,
  speakerId: string,
  targetId: string,
  presence: number,
  dc: number,
): CombatState {
  const next = structuredClone(state) as CombatState;
  const roll = makeCheck({
    rollType: 'Combat Conversation',
    attributeValue: presence,
    proficiency: 2,
    dc,
    sourceTags: ['combat_talk', `target:${targetId}`],
  });
  next.lastRoll = roll;
  const speaker = get(next, speakerId);
  pushLog(next, `${speaker.name} tries to reach ${get(next, targetId).name}. ${roll.narrative}`, 'info');
  if (isSuccess(roll.outcomeTier)) {
    next.tags.push('convinced');
    const target = get(next, targetId);
    target.alive = false;
    target.defeatState = 'surrendered';
    pushLog(next, `${target.name} stands down.`, 'defeat');
    checkEnd(next);
  } else {
    speaker.pressure += 1;
    if (!next.finished) endTurn(next);
  }
  return next;
}
