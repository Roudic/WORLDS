#!/usr/bin/env node
'use strict';
/**
 * Route one prompt from the terminal.
 *
 *   node cli.js "why is my docker build slow"
 *   node cli.js --dry "explain closures"      # classify + decide, don't spend
 *   node cli.js --tier opus "..."             # pin a tier
 */

const path = require('node:path');
const { loadDotEnv } = require('./config');
const { route } = require('./router');

loadDotEnv(path.join(__dirname, '.env'));

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const OFF = '\x1b[0m';
const COLOR = { haiku: '\x1b[36m', sonnet: '\x1b[34m', opus: '\x1b[35m' };

function parseArgs(argv) {
  const opts = { dryRun: false, forceTier: null, system: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry' || arg === '-d') opts.dryRun = true;
    else if (arg === '--tier' || arg === '-t') opts.forceTier = argv[++i];
    else if (arg === '--system' || arg === '-s') opts.system = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else rest.push(arg);
  }
  opts.prompt = rest.join(' ');
  return opts;
}

function bar(p, width = 20) {
  const filled = Math.round(Math.max(0, Math.min(1, p)) * width);
  return '█'.repeat(filled) + '·'.repeat(width - filled);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help || !opts.prompt) {
    console.log(`
${BOLD}worlds route${OFF} — pick the cheapest Claude tier that can handle a request

  node cli.js [options] "your prompt"

  -d, --dry            classify and decide, but don't call the model
  -t, --tier <key>     pin a tier: haiku | sonnet | opus
  -s, --system <text>  system prompt to include
  -h, --help           this message
`);
    process.exit(opts.help ? 0 : 1);
  }

  const typesafeKey = process.env.TYPESAFE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!typesafeKey) {
    console.error('TYPESAFE_API_KEY is not set. Add it to .env — see .env.example.');
    process.exit(1);
  }
  if (!anthropicKey && !opts.dryRun) {
    console.error('ANTHROPIC_API_KEY is not set. Add it to .env, or use --dry to route without executing.');
    process.exit(1);
  }

  let result;
  try {
    result = await route({
      prompt: opts.prompt,
      systemPrompt: opts.system,
      typesafeKey,
      anthropicKey,
      forceTier: opts.forceTier,
      dryRun: opts.dryRun,
    });
  } catch (err) {
    console.error(`\n  ${err.message}\n`);
    process.exit(1);
  }

  const { decision, signals, economics, response } = result;
  const color = COLOR[decision.tier] || '';

  console.log(`\n${DIM}─── routed ────────────────────────────────────────${OFF}`);
  console.log(`  ${color}${BOLD}${decision.name}${OFF}  ${DIM}${decision.model}${OFF}`);
  for (const r of decision.reasons) {
    console.log(`    ${DIM}·${OFF} ${r.detail}  ${DIM}(${r.rule})${OFF}`);
  }

  console.log(`\n${DIM}─── signals ───────────────────────────────────────${OFF}`);
  const d = signals.reasoning_depth;
  console.log(`  reasoning_depth      ${bar(d.score / 3)} ${d.score.toFixed(2)}  ${DIM}conf ${d.confidence.toFixed(2)}${OFF}`);
  console.log(`  task_type            ${signals.task_type.choice}  ${DIM}conf ${signals.task_type.confidence.toFixed(2)}${OFF}`);
  console.log(`  is_high_stakes       ${bar(signals.is_high_stakes)} ${signals.is_high_stakes.toFixed(2)}`);
  console.log(`  is_underspecified    ${bar(signals.is_underspecified)} ${signals.is_underspecified.toFixed(2)}`);
  console.log(`  ${DIM}classified in ${result.classifyMs} ms${OFF}`);

  if (opts.dryRun) {
    console.log(`\n${DIM}  dry run — no model was called${OFF}\n`);
    return;
  }

  console.log(`\n${DIM}─── response ──────────────────────────────────────${OFF}\n`);
  console.log(response.text);

  if (response.stopReason === 'refusal') {
    console.log(`\n${DIM}  stopped: refusal (${response.stopDetails?.category ?? 'unspecified'})${OFF}`);
  }

  console.log(`\n${DIM}─── cost ──────────────────────────────────────────${OFF}`);
  console.log(`  this request   $${economics.actualCost.toFixed(6)}`);
  console.log(`  all-Opus       $${economics.baselineCost.toFixed(6)}`);
  const saved = economics.saved;
  console.log(
    saved > 0
      ? `  ${BOLD}saved          $${saved.toFixed(6)}  (${economics.savedPct.toFixed(1)}%)${OFF}`
      : `  ${DIM}no saving — this request earned the top tier${OFF}`
  );
  console.log(`  ${DIM}${response.usage.input_tokens} in / ${response.usage.output_tokens} out · ${response.latencyMs} ms${OFF}\n`);
}

main();
