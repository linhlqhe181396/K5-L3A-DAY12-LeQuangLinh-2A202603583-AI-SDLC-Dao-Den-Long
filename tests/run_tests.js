import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

fs.mkdirSync('docs/proof', { recursive: true });
fs.mkdirSync('tests/scenarios', { recursive: true });

// ==========================================
// 1. KIỂM THỬ HỒI QUY P1-P2 (Cập nhật theo ADR-001: bỏ all_lit, điểm mới)
// ==========================================
const p1Scenario = {
  player: { pos: [0, 0, 0], carried: 1, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [[0, 0, 3], [0, 0, 6], [0, 0, 9]],
  shades: [{ id: 'S1', pos: [0, 0, 20] }],
  lanterns: [{ id: 'L1', pos: [0, 0, 10], deposited: 9 }],
  time_left_s: 240
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
  '--ticks', '150', '--out', 'docs/proof/p3_regression_p1.jsonl'
]);

const p1Records = fs.readFileSync('docs/proof/p3_regression_p1.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const p1Events = p1Records.filter((r) => r.type === 'event');
assert.ok(p1Events.some((e) => e.name === 'lantern_lit' && e.data.relight === false), 'P3 hoi quy: lantern_lit phai co relight=false');
console.log('PASS [1/3]: Hoi quy P1-P2 (da cap nhat theo luat moi ADR-001) dat!');

// ==========================================
// 2. KIỂM THỬ PHASE 3: Cạn dầu, Hút dầu, Thắp lại (5 mote), Châm dầu & Thắng bình minh
// ==========================================
const p3Scenario = {
  player: { pos: [0, 0, 2], carried: 10, flames: 3 },
  random_motes: false,
  random_shades: false,
  lanterns: [
    { id: 'L1', pos: [0, 0, 10], lit: true, fuel: 1.0 },
    { id: 'L2', pos: [23.8, 0, 7.7], lit: true, fuel: 100 },
    { id: 'L3', pos: [14.7, 0, -20.2], lit: true, fuel: 100 }
  ],
  shades: [{ id: 'S1', pos: [0, 0, 10.5], state: 'drain', target_lantern_id: 'L1' }],
  time_left_s: 6
};
const p3Inputs = {
  frames: [
    // S1 đang drain L1 (fuel 1.0 = 60 tick) -> L1 tắt ngay ở tick 10 (lantern_out)
    // Tick 30: Mây chạy từ z=2 lên L1 (z=10)
    { tick: 30, move: [0, 1], cam_yaw_deg: 0 },
    { tick: 110, move: [0, 0], interact: true }, // Thắp lại L1 (relight=true, chỉ tốn 5 mote -> còn dư 5 mote)
    { tick: 111, interact: false },
    { tick: 200, interact: true }, // Châm dầu L1 (refuel)
    { tick: 201, interact: false }
  ]
};

fs.writeFileSync('tests/scenarios/p3_fuel.json', JSON.stringify(p3Scenario, null, 2));
fs.writeFileSync('tests/scenarios/p3_inputs.json', JSON.stringify(p3Inputs, null, 2));

execFileSync('node', [
  'src/headless.js', '--seed', '12', '--night', '1',
  '--scenario', 'tests/scenarios/p3_fuel.json',
  '--inputs', 'tests/scenarios/p3_inputs.json',
  '--ticks', '360', '--out', 'docs/proof/p3_fuel_test.jsonl'
]);

const p3Records = fs.readFileSync('docs/proof/p3_fuel_test.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const p3Events = p3Records.filter((r) => r.type === 'event');

assert.ok(p3Events.some((e) => e.name === 'lantern_out' && e.data.lantern_id === 'L1'), 'P3: thieu su kien lantern_out');
assert.ok(p3Events.some((e) => e.name === 'lantern_lit' && e.data.relight === true), 'P3: thieu su kien thap lai relight=true');
assert.ok(p3Events.some((e) => e.name === 'refuel' && e.data.lantern_id === 'L1'), 'P3: thieu su kien refuel');
assert.ok(p3Events.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'dawn_survived'), 'P3: thieu thang binh minh dawn_survived');

const finalSnap = p3Records.filter((r) => r.type === 'snapshot').pop();
assert.equal(finalSnap.player.capacity, 12, 'P3: suc chua phai tang len 12 sau 1 lan thap thanh cong');
console.log('PASS [2/3]: Cac luat moi Phase 3 (Can dau, Thap lai 5 mote, Cham dau, Suc chua tang, Dawn Survived) dat!');

// ==========================================
// 3. KIỂM THỬ TỐC ĐỘ HEADLESS ĐÊM 3 (18.000 tick <= 30s)
// ==========================================
const t0 = performance.now();
execFileSync('node', [
  'src/headless.js', '--seed', '7', '--night', '3',
  '--ticks', '18000', '--snapshot-every', '60',
  '--out', 'docs/proof/p3_night3_full.jsonl'
]);
const elapsedS = (performance.now() - t0) / 1000;
assert.ok(elapsedS <= 30, `Headless Dem 3 chay qua cham: ${elapsedS.toFixed(2)}s > 30s`);
console.log(`PASS [3/3]: Headless Dem 3 (18.000 tick) hoan thanh trong ${elapsedS.toFixed(3)}s (<= 30s)!`);