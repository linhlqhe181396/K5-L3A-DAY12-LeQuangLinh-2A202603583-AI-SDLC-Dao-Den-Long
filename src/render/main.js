import * as THREE from 'three';
import contract from '../../game.contract.json';
import { GameEngine } from '../core/engine.js';

// ==========================================
// 1. ÂM THANH WEB AUDIO API (Không cần asset ngoài)
// ==========================================
const settings = JSON.parse(localStorage.getItem('ddl_settings') || '{"vol":0.5,"sens":0.3,"cb":false}');
document.getElementById('opt-vol').value = settings.vol;
document.getElementById('opt-sens').value = settings.sens;
document.getElementById('opt-cb').checked = !!settings.cb;

let audioCtx = null;
function playTone(freq, type = 'sine', dur = 0.15, slideTo = null) {
  if (settings.vol <= 0) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
  gain.gain.setValueAtTime(0.2 * settings.vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

const SFX = {
  pick: () => playTone(880, 'sine', 0.12, 1320),
  lit: () => { playTone(523, 'triangle', 0.25, 784); setTimeout(() => playTone(1046, 'sine', 0.35), 120); },
  pulse: () => playTone(320, 'sawtooth', 0.35, 960),
  hit: () => playTone(160, 'sawtooth', 0.3, 65),
  jump: () => playTone(260, 'sine', 0.15, 520),
  dash: () => playTone(600, 'triangle', 0.14, 220),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.25), i * 110)),
  lose: () => [392, 349, 311, 261].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.3), i * 140)),
  spawn: () => playTone(140, 'sine', 0.4, 90),
  tick10: () => playTone(1000, 'square', 0.06)
};

// ==========================================
// 2. KHỞI TẠO THREE.JS & BẢNG MÀU CHUẨN
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0E1430');
scene.fog = new THREE.FogExp2('#1B2350', 0.012);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const hemiLight = new THREE.HemisphereLight('#FFE9B0', '#12384A', 0.15);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight('#FFB347', 0.5);
dirLight.position.set(25, 50, 25);
scene.add(dirLight);

const seaMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(800, 800),
  new THREE.MeshBasicMaterial({ color: '#12384A' })
);
seaMesh.rotation.x = -Math.PI / 2;
seaMesh.position.y = -10;
scene.add(seaMesh);

// Nhóm chứa địa hình động theo từng Đêm
const mapGroup = new THREE.Group();
scene.add(mapGroup);

// Nhân vật Mây (#E8E2D0 áo, #C8102E khăn, #C9B48A nón lá)
const playerGroup = new THREE.Group();
const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 12), new THREE.MeshStandardMaterial({ color: '#E8E2D0' }));
bodyMesh.position.y = 0.75;
const scarfMesh = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.08, 8, 16), new THREE.MeshStandardMaterial({ color: '#C8102E' }));
scarfMesh.rotation.x = Math.PI / 2;
scarfMesh.position.y = 1.15;
const hatMesh = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.35, 16), new THREE.MeshStandardMaterial({ color: '#C9B48A' }));
hatMesh.position.y = 1.45;
const miniLantern = new THREE.PointLight('#FFB347', 3, 12);
miniLantern.position.set(0, 1.3, 0.65);
playerGroup.add(bodyMesh, scarfMesh, hatMesh, miniLantern);
scene.add(playerGroup);

const lanternMeshes = new Map();
const moteMeshes = new Map();
const shadeMeshes = new Map();
const drifterMeshes = new Map();
const charmMeshes = new Map();

function clearGroup(grp) {
  while (grp.children.length > 0) grp.remove(grp.children[0]);
}

function buildNightScene(night) {
  clearGroup(mapGroup);
  lanternMeshes.clear();
  for (const m of moteMeshes.values()) scene.remove(m); moteMeshes.clear();
  for (const s of shadeMeshes.values()) scene.remove(s); shadeMeshes.clear();
  for (const d of drifterMeshes.values()) scene.remove(d); drifterMeshes.clear();
  for (const c of charmMeshes.values()) scene.remove(c); charmMeshes.clear();

  const grassMat = new THREE.MeshStandardMaterial({ color: '#2F5D50' });
  const sandMat = new THREE.MeshStandardMaterial({ color: '#C9B48A' });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#6B4A2F' });

  if (night === 1) {
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(40, 38, 2, 64), grassMat);
    isl.position.y = -1;
    mapGroup.add(isl);
  } else if (night === 2) {
    for (const cx of [0, 70]) {
      const isl = new THREE.Mesh(new THREE.CylinderGeometry(28, 26, 2, 48), sandMat);
      isl.position.set(cx, -1, 0);
      mapGroup.add(isl);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 4), woodMat);
    bridge.position.set(35, -0.2, 0);
    mapGroup.add(bridge);
  } else if (night === 3) {
    const t0 = new THREE.Mesh(new THREE.CylinderGeometry(45, 43, 2, 64), grassMat);
    t0.position.y = -1;
    mapGroup.add(t0);
    // Tầng 1 (vành khăn 12-24m ở z > 0)
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, 0, Math.PI, false);
    shape.absarc(0, 0, 12, Math.PI, 0, true);
    const t1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    t1Geo.rotateX(Math.PI / 2);
    const t1 = new THREE.Mesh(t1Geo, sandMat);
    t1.position.y = 3;
    mapGroup.add(t1);
    // Tầng 2 (r=8m, y=6) & Tháp chuông
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 32), grassMat);
    t2.position.y = 3;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 20), woodMat);
    tower.position.y = 10;
    mapGroup.add(t2, tower);
    // 2 Dốc ở góc 30° và 150°
    for (const deg of [30, 150]) {
      const rad = (deg * Math.PI) / 180;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.3, 3), woodMat);
      ramp.position.set(27 * Math.cos(rad), 1.5, 27 * Math.sin(rad));
      ramp.rotation.y = -rad;
      ramp.rotation.z = Math.atan2(3, 6);
      mapGroup.add(ramp);
    }
  }

  // Bục nhảy
  for (const pad of engine.jumpPads) {
    const pMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 16), new THREE.MeshStandardMaterial({ color: '#F2C14E', emissive: '#FFB347' }));
    pMesh.position.set(pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]);
    mapGroup.add(pMesh);
  }

  // Đèn Lồng Lớn
  for (const l of engine.lanterns) {
    const grp = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5, 12), woodMat);
    pillar.position.y = 1.25;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), new THREE.MeshStandardMaterial({ color: '#5B5F6E' }));
    bulb.position.y = 2.8;
    const light = new THREE.PointLight('#FFB347', 0, 20);
    light.position.y = 2.8;
    grp.add(pillar, bulb, light);
    grp.position.set(...l.pos);
    mapGroup.add(grp);
    lanternMeshes.set(l.id, { grp, bulb, light });
  }
}

// ==========================================
// 3. QUẢN LÝ LUỒNG 3 ĐÊM, MENU & CÀI ĐẶT
// ==========================================
let engine = new GameEngine(contract, 1001, 1);
let totalCampaignScore = 0;
let currentNight = 1;
let uiState = 'menu'; // menu | intro | playing | pause | settings | end
let prevUiState = 'menu';
let camYawDeg = 0;
let lastSecInt = 999;

const STORIES = {
  1: { title: 'Đêm 1 — Đảo Bến', quote: 'Ông Đăng: "Sương đen đã nuốt trọn Đảo Bến rồi cháu ơi. Hãy giữ ít nhất 3 ngọn Đèn Lồng Lớn sáng tới bình minh!"' },
  2: { title: 'Đêm 2 — Đảo Cau', quote: 'Ông Đăng: "Hai bờ Đảo Cau nối nhau bằng chiếc cầu tre mảnh. Coi chừng lũ Gió Lạc ranh ma và Bóng Mực hút dầu đèn!"' },
  3: { title: 'Đêm 3 — Đảo Chuông', quote: 'Ông Đăng: "Đêm cuối trên Đảo Chuông ba tầng gió lộng. Hãy giữ ít nhất 5/7 đèn sáng cho tới lúc mặt trời mọc!"' }
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById('hud').style.display = id === 'playing' ? 'block' : 'none';
  if (id !== 'playing') document.getElementById(`screen-${id}`).classList.add('active');
  uiState = id;
}

window.startStory = (night) => {
  currentNight = night;
  if (night === 1) totalCampaignScore = 0;
  document.getElementById('intro-title').textContent = STORIES[night].title;
  document.getElementById('intro-quote').textContent = STORIES[night].quote;
  showScreen('intro');
};

document.getElementById('btn-enter-night').onclick = () => {
  engine = new GameEngine(contract, Date.now() % 100000, currentNight);
  buildNightScene(currentNight);
  lastSecInt = 999;
  showScreen('playing');
};

window.resumeGame = () => {
  if (engine.state === 'paused') engine.step({ pause: true }, { pause: false });
  showScreen('playing');
};

window.restartNight = () => {
  engine = new GameEngine(contract, Date.now() % 100000, currentNight);
  buildNightScene(currentNight);
  lastSecInt = 999;
  showScreen('playing');
};

window.goMenu = () => showScreen('menu');

window.openSettings = (from) => {
  prevUiState = from;
  showScreen('settings');
};

window.closeSettings = () => {
  settings.vol = parseFloat(document.getElementById('opt-vol').value);
  settings.sens = parseFloat(document.getElementById('opt-sens').value);
  settings.cb = document.getElementById('opt-cb').checked;
  localStorage.setItem('ddl_settings', JSON.stringify(settings));
  showScreen(prevUiState);
};

// Tạo sẵn 10 ô hiển thị đom đóm ở HUD dưới
const slotsEl = document.getElementById('mote-slots');
for (let i = 0; i < 10; i++) {
  const d = document.createElement('div');
  d.className = 'slot';
  slotsEl.appendChild(d);
}

// ==========================================
// 4. ĐIỀU KHIỂN & VÒNG LẶP 60 TICK/S
// ==========================================
const keys = {};
let isDragging = false;
window.addEventListener('keydown', (e) => {
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
    if (uiState === 'playing') {
      engine.step({ pause: true }, { pause: false });
      showScreen('pause');
    } else if (uiState === 'pause') {
      window.resumeGame();
    }
  }
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => (keys[e.code] = false));
window.addEventListener('mousedown', () => (isDragging = true));
window.addEventListener('mouseup', () => (isDragging = false));
window.addEventListener('mousemove', (e) => {
  if (isDragging && uiState === 'playing') camYawDeg -= e.movementX * settings.sens;
});

let prevInput = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
let acc = 0;
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (uiState === 'playing') {
    acc += dt;
    if (keys['KeyQ']) camYawDeg += 120 * dt;
    if (keys['KeyC']) camYawDeg -= 120 * dt; // Dùng Q/C xoay camera để phím E chuyên dùng nạp đèn

    while (acc >= 1 / 60) {
      acc -= 1 / 60;
      if (engine.state === 'playing') {
        const mx = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
        const mz = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
        const input = {
          move: [mx, mz],
          cam_yaw_deg: camYawDeg,
          jump: !!keys['Space'],
          interact: !!keys['KeyF'] || !!keys['KeyE'],
          pulse: !!keys['KeyR'],
          dash: !!keys['ShiftLeft'] || !!keys['ShiftRight'],
          pause: false
        };
        const evs = engine.step(input, prevInput);
        for (const ev of evs) {
          if (ev.name === 'mote_picked' || ev.name === 'charm_picked') SFX.pick();
          else if (ev.name === 'lantern_lit' || ev.name === 'refuel') SFX.lit();
          else if (ev.name === 'pulse') SFX.pulse();
          else if (ev.name === 'player_hit' || ev.name === 'lantern_out') SFX.hit();
          else if (ev.name === 'dash') SFX.dash();
          else if (ev.name === 'shade_spawned') SFX.spawn();
          else if (ev.name === 'game_over') {
            if (ev.data.result === 'won') {
              SFX.win();
              totalCampaignScore += engine.score;
              const btns = document.getElementById('end-buttons');
              if (currentNight < 3) {
                document.getElementById('end-title').textContent = `🌅 Đêm ${currentNight} Đã Sáng!`;
                document.getElementById('end-desc').textContent = `Điểm Đêm ${currentNight}: ${engine.score} | Tổng điểm: ${totalCampaignScore}`;
                btns.innerHTML = `<button onclick="startStory(${currentNight + 1})">Sang Đêm ${currentNight + 1}</button>`;
              } else {
                document.getElementById('end-title').textContent = '🌞 BÌNH MINH TRÊN ĐẢO ĐÈN LỒNG!';
                document.getElementById('end-desc').textContent = `Chúc mừng bạn đã giữ ánh sáng qua cả 3 Đêm! Tổng điểm: ${totalCampaignScore}`;
                btns.innerHTML = `<button onclick="goMenu()">Về Menu chính</button>`;
              }
            } else {
              SFX.lose();
              document.getElementById('end-title').textContent = '🌑 Sương Đen Bao Phủ...';
              document.getElementById('end-desc').textContent = `Lý do: ${ev.data.reason === 'no_flames' ? 'Hết Ngọn Lửa' : 'Không đủ số đèn sáng lúc bình minh'}`;
              document.getElementById('end-buttons').innerHTML = `<button onclick="restartNight()">Chơi lại Đêm ${currentNight}</button><button class="secondary" onclick="goMenu()">Về Menu</button>`;
            }
            showScreen('end');
          }
        }
        if (input.jump && !prevInput.jump && !engine.player.grounded) SFX.jump();
        prevInput = { ...input };
      }
    }
  }

  // Cập nhật đồ họa & HUD
  playerGroup.position.set(...engine.player.pos);
  playerGroup.rotation.y = engine.player.yawRad;
  const rad = (camYawDeg * Math.PI) / 180;
  camera.position.set(
    engine.player.pos[0] + 10 * Math.sin(rad),
    engine.player.pos[1] + 6,
    engine.player.pos[2] + 10 * Math.cos(rad)
  );
  camera.lookAt(engine.player.pos[0], engine.player.pos[1] + 1.2, engine.player.pos[2]);

  // Đèn & ánh sáng môi trường chuẩn: 0.15 + 0.55 * (lit / total)
  let litCount = 0;
  let nearestUnlit = null;
  let nearestDist = Infinity;
  let interactTarget = null;
  let interactMinDist = Infinity;

  for (const l of engine.lanterns) {
    const obj = lanternMeshes.get(l.id);
    if (!obj) continue;
    const fuel = l.fuelTicks / 60;
    const d = Math.hypot(engine.player.pos[0] - l.pos[0], engine.player.pos[2] - l.pos[2]);

    if (l.lit) {
      litCount++;
      obj.bulb.scale.set(1, 1, 1); // Phình đủ kích thước
      const isLow = fuel < 30;
      const blinkOn = !isLow || Math.sin(now * 0.00628) > 0; // Nhấp nháy 1 Hz khi fuel < 30
      obj.bulb.material.color.set(blinkOn ? '#FFE9B0' : '#5B5F6E');
      obj.bulb.material.emissive.set(blinkOn ? '#FFB347' : '#000000');
      obj.light.intensity = blinkOn ? 15 : 2;
      if (l.fuelTicks < 6000 && d <= 2.0 && d < interactMinDist) {
        interactMinDist = d;
        interactTarget = l;
      }
    } else {
      obj.bulb.scale.set(1.1, 0.8, 1.1); // Đèn tắt bị xẹp 20% chiều cao
      obj.bulb.material.color.set('#5B5F6E');
      obj.bulb.material.emissive.set('#000000');
      obj.light.intensity = 0;
      if (d < nearestDist) { nearestDist = d; nearestUnlit = l; }
      if (d <= 2.0 && d < interactMinDist) { interactMinDist = d; interactTarget = l; }
    }
  }
  hemiLight.intensity = 0.15 + 0.55 * (litCount / Math.max(1, engine.lanterns.length));

  // Đồng bộ đom đóm, Bóng Mực, Gió Lạc, Bùa Gió
  const syncPool = (list, pool, createFn, updateFn) => {
    const ids = new Set(list.map((x) => x.id));
    for (const [id, mesh] of pool) { if (!ids.has(id)) { scene.remove(mesh); pool.delete(id); } }
    for (const item of list) {
      let mesh = pool.get(item.id);
      if (!mesh) { mesh = createFn(item); scene.add(mesh); pool.set(item.id, mesh); }
      updateFn(mesh, item);
    }
  };

  syncPool(engine.motes, moteMeshes,
    () => new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: '#FFF6C2' })),
    (mesh, m) => mesh.position.set(m.pos[0], m.pos[1] + 0.6 + 0.15 * Math.sin(now * 0.005), m.pos[2])
  );
  syncPool(engine.shades, shadeMeshes,
    () => new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), new THREE.MeshStandardMaterial({ color: '#120A1A', emissive: '#7A3CFF', emissiveIntensity: 0.7 })),
    (mesh, s) => {
      const activeColor = settings.cb ? '#00B3FF' : '#7A3CFF';
      mesh.material.emissive.set(s.state === 'stunned' ? '#3A3450' : activeColor);
      mesh.position.set(s.pos[0], s.pos[1] + 0.8, s.pos[2]);
    }
  );
  syncPool(engine.drifters, drifterMeshes,
    () => new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: '#8FA3B8', emissive: '#8FA3B8', emissiveIntensity: 0.4 })),
    (mesh, d) => { mesh.position.set(d.pos[0], d.pos[1] + 1.1, d.pos[2]); mesh.rotation.y += 0.08; }
  );
  syncPool(engine.charms.filter((c) => c.available), charmMeshes,
    () => new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: '#C8102E', emissive: '#F2C14E', emissiveIntensity: 0.5 })),
    (mesh, c) => { mesh.position.set(c.pos[0], c.pos[1] + 0.9, c.pos[2]); mesh.rotation.y += 0.04; }
  );

  // Cập nhật HUD
  if (uiState === 'playing') {
    document.getElementById('hud-flames').textContent = `🔥 Ngọn Lửa: ${'❤️'.repeat(Math.max(0, engine.player.flames))}`;
    const secInt = Math.ceil(engine.timeLeftS);
    if (secInt <= 10 && secInt > 0 && secInt !== lastSecInt) SFX.tick10();
    lastSecInt = secInt;

    const mm = String(Math.floor(engine.timeLeftS / 60)).padStart(2, '0');
    const ss = String(Math.floor(engine.timeLeftS % 60)).padStart(2, '0');
    const timeEl = document.getElementById('hud-time');
    const isDanger = engine.timeLeftS <= 30;
    timeEl.textContent = (isDanger && settings.cb ? '⚠ ' : '') + `${mm}:${ss}`;
    timeEl.classList.toggle('danger-blink', isDanger && !settings.cb);
    timeEl.classList.toggle('cb-warn', isDanger && settings.cb);

    const reqLit = Math.ceil(0.6 * engine.lanterns.length);
    document.getElementById('hud-lanterns').textContent = `🏮 Đèn: ${litCount}/${engine.lanterns.length} (Cần ${reqLit})`;
    document.getElementById('hud-score').textContent = `Điểm: ${engine.score}`;
    document.getElementById('hud-charm').textContent = engine.player.charmTicks > 0 ? `🧧 Bùa Gió: ${(engine.player.charmTicks / 60).toFixed(1)}s` : '';

    const windEl = document.getElementById('wind-warn');
    windEl.style.display = engine.wind.warnTicks > 0 || engine.wind.active ? 'block' : 'none';
    windEl.style.color = settings.cb ? '#FFFFFF' : '#FF5A5F';
    windEl.textContent = (settings.cb ? '⚠ ' : '🍃 ') + 'Gió mạnh sắp thổi!';

    const cap = engine.getCapacity();
    document.getElementById('hud-mote-text').textContent = `Đom đóm: ${engine.player.carried} / ${cap}`;
    if (slotsEl.children.length !== cap) {
      slotsEl.innerHTML = '';
      for (let i = 0; i < cap; i++) {
        const d = document.createElement('div');
        d.className = 'slot';
        slotsEl.appendChild(d);
      }
    }
    const slotDivs = slotsEl.children;
    for (let i = 0; i < cap; i++) slotDivs[i].classList.toggle('filled', i < engine.player.carried);

    const dashCd = engine.player.dashCdTicks / 60;
    document.getElementById('cd-dash').textContent = dashCd > 0 ? `Shift: Lướt (${dashCd.toFixed(1)}s)` : 'Shift: Lướt (Sẵn sàng)';
    const pulseCd = engine.player.pulseCdTicks / 60;
    document.getElementById('cd-pulse').textContent = pulseCd > 0 ? `R: Tỏa Sáng (${pulseCd.toFixed(1)}s)` : 'R: Tỏa Sáng (3✨)';

    const promptEl = document.getElementById('prompt-interact');
    if (interactTarget) {
      promptEl.style.display = 'block';
      if (!interactTarget.lit) {
        const req = interactTarget.everLit ? 5 : 10;
        promptEl.textContent = `E — Thắp đèn (${interactTarget.deposited}/${req})`;
      } else {
        promptEl.textContent = `E — Châm dầu (Dầu: ${(interactTarget.fuelTicks / 60).toFixed(0)}/100)`;
      }
    } else {
      promptEl.style.display = 'none';
    }

    // Mũi tên chỉ tới đèn chưa sáng gần nhất khi nằm ngoài màn hình
    const arrowEl = document.getElementById('lantern-arrow');
    if (nearestUnlit) {
      const proj = new THREE.Vector3(nearestUnlit.pos[0], nearestUnlit.pos[1] + 2.5, nearestUnlit.pos[2]).project(camera);
      const offScreen = proj.z > 1 || Math.abs(proj.x) > 0.92 || Math.abs(proj.y) > 0.92;
      if (offScreen) {
        arrowEl.style.display = 'block';
        let sx = proj.z > 1 ? -proj.x : proj.x;
        let sy = proj.z > 1 ? -proj.y : proj.y;
        const ang = Math.atan2(sy, sx);
        const cx = window.innerWidth / 2 + Math.cos(ang) * (window.innerWidth * 0.42);
        const cy = window.innerHeight / 2 - Math.sin(ang) * (window.innerHeight * 0.42);
        arrowEl.style.left = `${cx - 12}px`;
        arrowEl.style.top = `${cy - 11}px`;
        arrowEl.style.transform = `rotate(${90 - (ang * 180) / Math.PI}deg)`;
      } else {
        arrowEl.style.display = 'none';
      }
    } else {
      arrowEl.style.display = 'none';
    }
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);