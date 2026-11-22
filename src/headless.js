import fs from 'node:fs';
import { GameEngine } from './core/engine.js';

function fail(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { snapshotEvery: 10, seed: 1, night: 1 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--seed') { args.seed = Number(v); i++; }
    else if (k === '--night') { args.night = Number(v); i++; }
    else if (k === '--scenario') { args.scenario = v; i++; }
    else if (k === '--inputs') { args.inputs = v; i++; }
    else if (k === '--ticks') { args.ticks = Number(v); i++; }
    else if (k === '--out') { args.out = v; i++; }
    else if (k === '--snapshot-every') { args.snapshotEvery = Number(v); i++; }
  }
  if (![1, 2, 3].includes(args.night)) {
    fail('Invalid --night (must be 1, 2, or 3)', 1);
  }
  if (!Number.isInteger(args.ticks) || args.ticks < 0 || !args.out) {
    fail('Missing or invalid --ticks / --out', 1);
  }
  return args;
}

function loadJsonChecked(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON in ${filePath}: ${e.message}`, 2);
  }
}

const args = parseArgs(process.argv);
const contract = JSON.parse(fs.readFileSync('game.contract.json', 'utf8'));
const engine = new GameEngine(contract, args.seed, args.night);

if (args.scenario) {
  const sc = loadJsonChecked(args.scenario);
  if (!sc || typeof sc !== 'object' || Array.isArray(sc)) {
    fail('Scenario must be a JSON object', 2);
  }
  engine.applyScenario(sc);
}

const frameMap = new Map();
if (args.inputs) {
  const inp = loadJsonChecked(args.inputs);
  if (!inp || !Array.isArray(inp.frames)) {
    fail('Inputs must contain frames array', 2);
  }
  let lastTick = -1;
  for (const f of inp.frames) {
    if (!Number.isInteger(f.tick) || f.tick <= lastTick) {
      fail('Input frame ticks must be strictly increasing integers', 2);
    }
    lastTick = f.tick;
    frameMap.set(f.tick, f);
  }
}

const lines = [];

// Sự kiện bắt đầu đêm
lines.push(JSON.stringify({
  type: 'event',
  tick: 0,
  name: 'night_start',
  data: { night: engine.night }
}));

// Snapshot tick 0 sau khi dựng scenario
if (args.snapshotEvery > 0) {
  lines.push(JSON.stringify(engine.getSnapshot()));
}

let currentInput = {
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false
};
let prevInput = { ...currentInput };

for (let k = 0; k < args.ticks; k++) {
  if (engine.state === 'won' || engine.state === 'lost') break;
  if (frameMap.has(k)) {
    const f = frameMap.get(k);
    currentInput = { ...currentInput, ...f };
  }
  const events = engine.step(currentInput, prevInput);
  for (const ev of events) {
    lines.push(JSON.stringify(ev));
  }

  if (args.snapshotEvery > 0 && engine.tick % args.snapshotEvery === 0) {
    lines.push(JSON.stringify(engine.getSnapshot()));
  }
  prevInput = { ...currentInput };
}

lines.push(JSON.stringify({
  type: 'end',
  ticks: engine.tick,
  state: engine.state,
  score: engine.score
}));

fs.writeFileSync(args.out, lines.join('\n') + '\n', 'utf8');
process.exit(0);