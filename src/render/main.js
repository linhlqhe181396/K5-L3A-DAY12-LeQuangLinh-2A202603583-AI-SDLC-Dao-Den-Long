import * as THREE from 'three';
import contract from '../../game.contract.json';
import { GameEngine } from '../core/engine.js';

let engine = new GameEngine(contract, Date.now() % 100000, 1);

// 1. Khởi tạo Scene, Camera, Renderer (bảng màu cổ tích đêm)
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0E1430');
scene.fog = new THREE.FogExp2('#1B2350', 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Ánh sáng môi trường tăng dần khi thắp đèn
const hemiLight = new THREE.HemisphereLight('#FFE9B0', '#12384A', 0.35);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight('#FFB347', 0.6);
dirLight.position.set(20, 40, 20);
scene.add(dirLight);

// 2. Mặt đảo tròn (r = 40m) và biển mây
const islandMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(40, 38, 2, 64),
  new THREE.MeshStandardMaterial({ color: '#2F5D50' })
);
islandMesh.position.y = -1;
scene.add(islandMesh);

const seaMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshBasicMaterial({ color: '#12384A' })
);
seaMesh.rotation.x = -Math.PI / 2;
seaMesh.position.y = -10;
scene.add(seaMesh);

// 3. Nhân vật Mây (áo kem #E8E2D0, khăn đỏ #C8102E, nón lá + đèn nhỏ)
const playerGroup = new THREE.Group();
const bodyMesh = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.8, 4, 12),
  new THREE.MeshStandardMaterial({ color: '#E8E2D0' })
);
bodyMesh.position.y = 0.75;
playerGroup.add(bodyMesh);

const hatMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.65, 0.35, 16),
  new THREE.MeshStandardMaterial({ color: '#C9B48A' })
);
hatMesh.position.y = 1.45;
playerGroup.add(hatMesh);

const miniLantern = new THREE.PointLight('#FFB347', 3, 12);
miniLantern.position.set(0, 1.3, 0.65);
playerGroup.add(miniLantern);
scene.add(playerGroup);

// 4. 5 Đèn Lồng Lớn
const lanternMeshes = new Map();
for (const l of engine.lanterns) {
  const grp = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2.5, 12),
    new THREE.MeshStandardMaterial({ color: '#6B4A2F' })
  );
  pillar.position.y = 1.25;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 16),
    new THREE.MeshStandardMaterial({ color: '#5B5F6E', emissive: '#000000' })
  );
  bulb.position.y = 2.8;
  const light = new THREE.PointLight('#FFB347', 0, 18);
  light.position.y = 2.8;

  grp.add(pillar, bulb, light);
  grp.position.set(...l.pos);
  scene.add(grp);
  lanternMeshes.set(l.id, { grp, bulb, light });
}

// Pool mesh cho đom đóm & Bóng Mực
const moteMeshes = new Map();
const shadeMeshes = new Map();

// 5. Điều khiển bàn phím & chuột
const keys = {};
let camYawDeg = 0;
let isDragging = false;
window.addEventListener('keydown', (e) => (keys[e.code] = true));
window.addEventListener('keyup', (e) => (keys[e.code] = false));
window.addEventListener('mousedown', () => (isDragging = true));
window.addEventListener('mouseup', () => (isDragging = false));
window.addEventListener('mousemove', (e) => {
  if (isDragging) camYawDeg -= e.movementX * 0.3;
});

document.getElementById('btn-restart').onclick = () => {
  engine = new GameEngine(contract, Date.now() % 100000, 1);
  document.getElementById('overlay').style.display = 'none';
};

// 6. Vòng lặp 60 tick/s cố định
let prevInput = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
let acc = 0;
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  acc += dt;

  if (keys['KeyQ']) camYawDeg += 120 * dt;
  if (keys['KeyE']) camYawDeg -= 120 * dt;

  while (acc >= 1 / 60) {
    acc -= 1 / 60;
    if (engine.state === 'playing') {
      const mx = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
      const mz = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
      const input = {
        move: [mx, mz],
        cam_yaw_deg: camYawDeg,
        jump: !!keys['Space'],
        interact: !!keys['KeyF'],
        pulse: !!keys['KeyR']
      };
      engine.step(input, prevInput);
      prevInput = { ...input };
    }
  }

  // Cập nhật vị trí nhân vật & camera góc nhìn thứ 3
  playerGroup.position.set(...engine.player.pos);
  const rad = (camYawDeg * Math.PI) / 180;
  camera.position.set(
    engine.player.pos[0] + 10 * Math.sin(rad),
    engine.player.pos[1] + 6,
    engine.player.pos[2] + 10 * Math.cos(rad)
  );
  camera.lookAt(engine.player.pos[0], engine.player.pos[1] + 1.2, engine.player.pos[2]);

  // Cập nhật đèn lồng
  let litCount = 0;
  for (const l of engine.lanterns) {
    const obj = lanternMeshes.get(l.id);
    if (l.lit) {
      litCount++;
      obj.bulb.material.color.set('#FFE9B0');
      obj.bulb.material.emissive.set('#FFB347');
      obj.light.intensity = 15;
    } else {
      obj.bulb.material.color.set('#5B5F6E');
      obj.bulb.material.emissive.set('#000000');
      obj.light.intensity = 0;
    }
  }
  hemiLight.intensity = 0.2 + 0.55 * (litCount / engine.lanterns.length);

  // Đồng bộ đom đóm
  const activeMoteIds = new Set(engine.motes.map((m) => m.id));
  for (const [id, mesh] of moteMeshes) {
    if (!activeMoteIds.has(id)) { scene.remove(mesh); moteMeshes.delete(id); }
  }
  for (const m of engine.motes) {
    let mesh = moteMeshes.get(m.id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#FFF6C2' })
      );
      scene.add(mesh);
      moteMeshes.set(m.id, mesh);
    }
    mesh.position.set(m.pos[0], m.pos[1] + 0.6 + 0.15 * Math.sin(now * 0.005), m.pos[2]);
  }

  // Đồng bộ Bóng Mực
  const activeShadeIds = new Set(engine.shades.map((s) => s.id));
  for (const [id, mesh] of shadeMeshes) {
    if (!activeShadeIds.has(id)) { scene.remove(mesh); shadeMeshes.delete(id); }
  }
  for (const s of engine.shades) {
    let mesh = shadeMeshes.get(s.id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 12, 12),
        new THREE.MeshStandardMaterial({ color: '#120A1A', emissive: '#7A3CFF', emissiveIntensity: 0.6 })
      );
      scene.add(mesh);
      shadeMeshes.set(s.id, mesh);
    }
    mesh.material.emissive.set(s.state === 'stunned' ? '#3A3450' : '#7A3CFF');
    mesh.position.set(s.pos[0], s.pos[1] + 0.8, s.pos[2]);
  }

  // Cập nhật HUD
  const mm = String(Math.floor(engine.timeLeftS / 60)).padStart(2, '0');
  const ss = String(Math.floor(engine.timeLeftS % 60)).padStart(2, '0');
  document.getElementById('hud-flames').textContent = `🔥 Ngọn Lửa: ${engine.player.flames}`;
  document.getElementById('hud-time').textContent = `⏱ ${mm}:${ss}`;
  document.getElementById('hud-score').textContent = `🏮 Đèn: ${litCount}/5 | ⭐ Điểm: ${engine.score}`;
  document.getElementById('hud-motes').textContent = `✨ Đom đóm: ${engine.player.carried} / 10`;

  if (engine.state !== 'playing') {
    const ov = document.getElementById('overlay');
    ov.style.display = 'flex';
    document.getElementById('end-title').textContent = engine.state === 'won' ? '🌅 Đảo Đã Sáng!' : '🌑 Sương Đen Bao Phủ...';
    document.getElementById('end-desc').textContent = `Điểm tổng kết: ${engine.score}`;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);