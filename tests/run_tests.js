import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

fs.mkdirSync('docs/proof', { recursive: true });
fs.mkdirSync('tests/scenarios', { recursive: true });

// ==========================================
// 1. KIỂM THỬ HỒI QUY PHASE 1 (Đêm 1 + Tất định)
// ==========================================
const p1Scenario = {
  player: { pos: [0, 0, 0], carried: 1, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [[0, 0, 3], [0, 0, 6], [0, 0, 9]],
  shades: [{ id: 'S1', pos: [0, 0, 20] }],
  lanterns: [{ id: 'L1', pos: [0, 0, 10], deposited: 9 }],
  time_left_s: 300
};
const p1Inputs = {
  frames: [
    { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
    { tick: 95, move: [0, 0], pulse: true },
    { tick: 96, pulse: false },
    { tick: 105, interact: true },
    { tick: 106, interact: false }
  ]
};

fs.writeFileSync('tests/scenarios/p1_core.json', JSON.stringify(p1Scenario, null, 2));
fs.writeFileSync('tests/scenarios/p1_inputs.json', JSON.stringify(p1Inputs, null, 2));

execFileSync('node', [
  'src/headless.js', '--seed', '42', '--night', '1',
  '--scenario', 'tests/scenarios/p1_core.json',
  '--inputs', 'tests/scenarios/p1_inputs.json',
  '--ticks', '150', '--out', 'docs/proof/p2_regression_p1_run1.jsonl'
]);
execFileSync('node', [
  'src/headless.js', '--seed', '42', '--night', '1',
  '--scenario', 'tests/scenarios/p1_core.json',
  '--inputs', 'tests/scenarios/p1_inputs.json',
  '--ticks', '150', '--out', 'docs/proof/p2_regression_p1_run2.jsonl'
]);

const p1Out1 = fs.readFileSync('docs/proof/p2_regression_p1_run1.jsonl', 'utf8');
const p1Out2 = fs.readFileSync('docs/proof/p2_regression_p1_run2.jsonl', 'utf8');
assert.equal(p1Out1, p1Out2, 'Loi tinh tat dinh o hoi quy Phase 1!');

const p1Events = p1Out1.trim().split('\n').map(JSON.parse).filter((r) => r.type === 'event').map((r) => r.name);
assert.ok(p1Events.includes('mote_picked'), 'Hoi quy P1: thieu mote_picked');
assert.ok(p1Events.includes('pulse'), 'Hoi quy P1: thieu pulse');
assert.ok(p1Events.includes('deposit'), 'Hoi quy P1: thieu deposit');
assert.ok(p1Events.includes('lantern_lit'), 'Hoi quy P1: thieu lantern_lit');
console.log('PASS [1/3]: Hoi quy Phase 1 & tinh tat dinh dat!');

// ==========================================
// 2. KIỂM THỬ PHASE 2 (Dash, Bùa Gió, Gió Lạc, Pause)
// ==========================================
const p2Scenario = {
  player: { pos: [0, 0, 0], carried: 6, flames: 3 },
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  charms: [{ id: 'C1', pos: [0, 0, 2], available: true }],
  drifters: [{ id: 'D1', pos: [0, 0, 8], state: 'idle', stolen: 0 }],
  time_left_s: 330
};
const p2Inputs = {
  frames: [
    { tick: 0, move: [0, 1], cam_yaw_deg: 0, dash: true },
    { tick: 1, dash: false },
    { tick: 40, move: [0, 0] },
    // Đợi D1 lao tới cướp (khoảng tick 45-65), rồi Tỏa Sáng bắt D1 thả đom đóm
    { tick: 70, pulse: true },
    { tick: 71, pulse: false },
    // Kiểm tra tạm dừng (pause) và tiếp tục (resume)
    { tick: 80, pause: true },
    { tick: 81, pause: false },
    { tick: 90, pause: true },
    { tick: 91, pause: false }
  ]
};

fs.writeFileSync('tests/scenarios/p2_features.json', JSON.stringify(p2Scenario, null, 2));
fs.writeFileSync('tests/scenarios/p2_inputs.json', JSON.stringify(p2Inputs, null, 2));

execFileSync('node', [
  'src/headless.js', '--seed', '99', '--night', '2',
  '--scenario', 'tests/scenarios/p2_features.json',
  '--inputs', 'tests/scenarios/p2_inputs.json',
  '--ticks', '100', '--out', 'docs/proof/p2_features.jsonl'
]);

const p2Records = fs.readFileSync('docs/proof/p2_features.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const p2Events = p2Records.filter((r) => r.type === 'event').map((r) => r.name);

assert.ok(p2Events.includes('night_start'), 'P2: thieu night_start');
assert.ok(p2Events.includes('dash'), 'P2: thieu dash');
assert.ok(p2Events.includes('charm_picked'), 'P2: thieu charm_picked');
assert.ok(p2Events.includes('drifter_steal'), 'P2: thieu drifter_steal');
assert.ok(p2Events.includes('drifter_drop'), 'P2: thieu drifter_drop');
assert.ok(p2Events.includes('paused'), 'P2: thieu paused');
assert.ok(p2Events.includes('resumed'), 'P2: thieu resumed');

const pausedSnap = p2Records.find((r) => r.type === 'snapshot' && r.tick === 90);
assert.equal(pausedSnap?.state, 'paused', 'P2: snapshot khi tam dung phai co state="paused"');
console.log('PASS [2/3]: Cac tinh nang moi Phase 2 (Dash, Bua, Gio Lac, Pause) dat!');

// ==========================================
// 3. KIỂM THỬ TỐC ĐỘ HEADLESS ĐÊM 3 (21.600 tick <= 30s)
// ==========================================
const t0 = performance.now();
execFileSync('node', [
  'src/headless.js', '--seed', '7', '--night', '3',
  '--ticks', '21600', '--snapshot-every', '60',
  '--out', 'docs/proof/p2_night3_full.jsonl'
]);
const elapsedS = (performance.now() - t0) / 1000;
assert.ok(elapsedS <= 30, `Headless Dem 3 chay qua cham: ${elapsedS.toFixed(2)}s > 30s`);
console.log(`PASS [3/3]: Headless Dem 3 (21.600 tick) hoan thanh trong ${elapsedS.toFixed(3)}s (<= 30s)!`);