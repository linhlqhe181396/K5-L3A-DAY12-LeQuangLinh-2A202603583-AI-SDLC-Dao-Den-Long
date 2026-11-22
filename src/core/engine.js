import { SeededRNG } from './rng.js';

const DT = 1 / 60;
const round3 = (n) => Math.round(n * 1000) / 1000;
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class GameEngine {
  constructor(contract, seed = 1, night = 1) {
    this.tuning = contract.tuning;
    this.rng = new SeededRNG(seed);
    this.setNight(night);
  }

  setNight(night) {
    this.night = [1, 2, 3].includes(night) ? night : 1;
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing'; // playing | paused | won | lost
    this.score = 0;

    const durMap = {
      1: this.tuning.night1_duration_s,
      2: this.tuning.night2_duration_s,
      3: this.tuning.night3_duration_s
    };
    this.durationTicks = durMap[this.night] * 60;
    this.timeLeftS = durMap[this.night];

    this.player = {
      pos: [0, 0, 0],
      vel: [0, 0, 0],
      grounded: true,
      yawRad: 0,
      flames: this.tuning.flames,
      carried: 0,
      invulnTicks: 0,
      dashTicks: 0,
      dashDir: [0, 1],
      dashCdTicks: 0,
      pulseCdTicks: 0,
      charmTicks: 0,
      fallWaitTicks: 0,
      padLaunched: false
    };

    this.wind = { active: false, dirDeg: 0, timerTicks: 0, warnTicks: 0 };
    this.events = [];
    this.randomMotes = true;
    this.randomShades = true;
    this.randomDrifters = true;
    this.windEnabled = this.night === 3;

    this._setupNightMap();
    this._spawnInitialMotes(20);
  }

  _setupNightMap() {
    this.lanterns = [];
    this.moteSpawns = [];
    this.shadeSpawns = [];
    this.jumpPads = [];
    this.charms = [];
    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.nextDrifterId = 1;

    if (this.night === 1) {
      const coords = [[0,0,25], [23.8,0,7.7], [14.7,0,-20.2], [-14.7,0,-20.2], [-23.8,0,7.7]];
      coords.forEach((p, i) => this.lanterns.push({ id: `L${i + 1}`, pos: p, lit: false, deposited: 0 }));

      for (let i = 0; i < 8; i++) {
        const a = (i * 45 * Math.PI) / 180;
        this.moteSpawns.push([round3(12 * Math.cos(a)), 0, round3(12 * Math.sin(a))]);
      }
      for (let i = 0; i < 16; i++) {
        const a = (i * 22.5 * Math.PI) / 180;
        this.moteSpawns.push([round3(33 * Math.cos(a)), 0, round3(33 * Math.sin(a))]);
      }
      for (let i = 0; i < 12; i++) {
        const a = ((15 + i * 30) * Math.PI) / 180;
        this.shadeSpawns.push([round3(37 * Math.cos(a)), 0, round3(37 * Math.sin(a))]);
      }
    } else if (this.night === 2) {
      const coords = [[0,0,20], [17,0,-10], [-17,0,-10], [70,0,20], [87,0,-10], [53,0,-10]];
      coords.forEach((p, i) => this.lanterns.push({ id: `L${i + 1}`, pos: p, lit: false, deposited: 0 }));

      this.jumpPads = [
        { pos: [20, 0, 18], target: [70, 0, 0], vy: 14, vh: 24 },
        { pos: [50, 0, -18], target: [0, 0, 0], vy: 14, vh: 24 }
      ];
      this.charms = [{ id: 'C1', pos: [35, 0, 0], available: true, respawnTicks: 0 }];

      for (const cx of [0, 70]) {
        for (let i = 0; i < 4; i++) {
          const a = (i * 90 * Math.PI) / 180;
          this.moteSpawns.push([round3(cx + 10 * Math.cos(a)), 0, round3(10 * Math.sin(a))]);
        }
        for (let i = 0; i < 8; i++) {
          const a = (i * 45 * Math.PI) / 180;
          this.moteSpawns.push([round3(cx + 22 * Math.cos(a)), 0, round3(22 * Math.sin(a))]);
        }
        for (let i = 0; i < 8; i++) {
          const a = ((22.5 + i * 45) * Math.PI) / 180;
          this.shadeSpawns.push([round3(cx + 26 * Math.cos(a)), 0, round3(26 * Math.sin(a))]);
        }
      }
    } else if (this.night === 3) {
      const coords = [[0,6,6], [18,3,10], [-18,3,10], [35,0,-10], [-35,0,-10], [20,0,-35], [-20,0,-35]];
      coords.forEach((p, i) => this.lanterns.push({ id: `L${i + 1}`, pos: p, lit: false, deposited: 0 }));

      this.jumpPads = [{ pos: [0, 3, 13], target: [0, 6, 0], vy: 12, vh: 8 }];
      this.charms = [
        { id: 'C1', pos: [30, 0, 25], available: true, respawnTicks: 0 },
        { id: 'C2', pos: [-30, 0, 25], available: true, respawnTicks: 0 }
      ];

      for (let i = 0; i < 18; i++) {
        const a = (i * 20 * Math.PI) / 180;
        this.moteSpawns.push([round3(34 * Math.cos(a)), 0, round3(34 * Math.sin(a))]);
      }
      for (let i = 1; i <= 8; i++) {
        const a = (i * 20 * Math.PI) / 180;
        this.moteSpawns.push([round3(18 * Math.cos(a)), 3, round3(18 * Math.sin(a))]);
      }
      for (const deg of [45, 135, 225, 315]) {
        const a = (deg * Math.PI) / 180;
        this.moteSpawns.push([round3(5 * Math.cos(a)), 6, round3(5 * Math.sin(a))]);
      }
      for (let i = 0; i < 16; i++) {
        const a = (i * 22.5 * Math.PI) / 180;
        this.shadeSpawns.push([round3(43 * Math.cos(a)), 0, round3(43 * Math.sin(a))]);
      }
    }
  }

  _getGroundHeight(x, z, curY) {
    if (this.night === 1) {
      return Math.hypot(x, z) <= 40 ? 0 : -999;
    }
    if (this.night === 2) {
      const inA = Math.hypot(x, z) <= 28;
      const inB = Math.hypot(x - 70, z) <= 28;
      const onBridge = x >= 26 && x <= 44 && z >= -2 && z <= 2;
      return inA || inB || onBridge ? 0 : -999;
    }
    if (this.night === 3) {
      const r = Math.hypot(x, z);
      if (r > 45) return -999;
      // Dốc ở góc 30° và 150°, rộng 3m (nửa rộng 1.5m), r từ 24 đến 30
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180;
        const ux = Math.cos(rad), uz = Math.sin(rad);
        const along = x * ux + z * uz;
        const perp = Math.abs(-x * uz + z * ux);
        if (along >= 24 && along <= 30 && perp <= 1.5) {
          return ((30 - along) / 6) * 3;
        }
      }
      if (r <= 8 && curY >= 5.5) return 6;
      if (r >= 12 && r <= 24 && z > 0 && curY >= 2.5) return 3;
      return 0;
    }
    return 0;
  }

  _spawnInitialMotes(count) {
    const indices = this.moteSpawns.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < Math.min(count, indices.length); i++) {
      this.motes.push({ id: `M${this.nextMoteId++}`, pos: [...this.moteSpawns[indices[i]]], kind: 'random', ttlTicks: -1 });
    }
  }

  applyScenario(sc) {
    if (!sc || typeof sc !== 'object') return;
    if (sc.player) {
      if (Array.isArray(sc.player.pos)) this.player.pos = [...sc.player.pos];
      if (typeof sc.player.carried === 'number') this.player.carried = sc.player.carried;
      if (typeof sc.player.flames === 'number') this.player.flames = sc.player.flames;
      if (typeof sc.player.invuln_ticks === 'number') this.player.invulnTicks = sc.player.invuln_ticks;
      if (typeof sc.player.dash_cd_ticks === 'number') this.player.dashCdTicks = sc.player.dash_cd_ticks;
      if (typeof sc.player.pulse_cd_ticks === 'number') this.player.pulseCdTicks = sc.player.pulse_cd_ticks;
      if (typeof sc.player.charm_ticks === 'number') this.player.charmTicks = sc.player.charm_ticks;
    }
    if (typeof sc.random_motes === 'boolean') this.randomMotes = sc.random_motes;
    if (typeof sc.random_shades === 'boolean') this.randomShades = sc.random_shades;
    if (typeof sc.random_drifters === 'boolean') this.randomDrifters = sc.random_drifters;
    if (typeof sc.wind_enabled === 'boolean') this.windEnabled = sc.wind_enabled;

    if (Array.isArray(sc.lanterns)) {
      for (const item of sc.lanterns) {
        const l = this.lanterns.find((x) => x.id === item.id);
        if (l) {
          if (Array.isArray(item.pos)) l.pos = [...item.pos];
          if (typeof item.deposited === 'number') l.deposited = item.deposited;
          if (typeof item.lit === 'boolean') l.lit = item.lit;
        }
      }
    }
    if (Array.isArray(sc.motes)) {
      this.motes = sc.motes.map((m, idx) => ({
        id: m.id || `M${idx + 1}`,
        pos: Array.isArray(m) ? [...m] : [...m.pos],
        kind: m.kind || 'random',
        ttlTicks: typeof m.ttl_s === 'number' ? Math.round(m.ttl_s * 60) : -1
      }));
      this.nextMoteId = this.motes.length + 1;
    }
    if (Array.isArray(sc.shades)) {
      this.shades = sc.shades.map((s, idx) => ({
        id: s.id || `S${idx + 1}`,
        pos: [...s.pos],
        state: s.state || 'chase',
        stateTicksLeft: s.state_ticks_left || 0,
        pushTicks: 0,
        pushDir: [0, 0]
      }));
      this.nextShadeId = this.shades.length + 1;
    }
    if (Array.isArray(sc.drifters)) {
      this.drifters = sc.drifters.map((d, idx) => ({
        id: d.id || `D${idx + 1}`,
        pos: [...d.pos],
        state: d.state || 'idle',
        stolen: d.stolen || 0,
        ticksLeft: d.ticks_left || 0,
        angle: 0
      }));
      this.nextDrifterId = this.drifters.length + 1;
    }
    if (Array.isArray(sc.charms)) {
      this.charms = sc.charms.map((c) => ({
        id: c.id,
        pos: c.pos ? [...c.pos] : [0, 0, 0],
        available: c.available !== false,
        respawnTicks: typeof c.respawn_s === 'number' ? Math.round(c.respawn_s * 60) : 0
      }));
    }
    if (typeof sc.time_left_s === 'number') {
      this.timeLeftS = sc.time_left_s;
      this.durationTicks = Math.round(sc.time_left_s * 60);
    }
  }

  step(input, prevInput) {
    if (this.state === 'won' || this.state === 'lost') return [];
    this.events = [];
    this.tick += 1;

    // Bước 1: Đọc input (xử lý pause trước)
    if (input.pause && !prevInput.pause) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.events.push({ type: 'event', tick: this.tick, name: 'paused', data: {} });
        return this.events;
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.events.push({ type: 'event', tick: this.tick, name: 'resumed', data: {} });
      }
    }
    if (this.state === 'paused') return [];

    this.simTick += 1;
    this.timeLeftS = Math.max(0, round3((this.durationTicks - this.simTick) / 60));

    // Bước 2: Giảm các bộ đếm
    if (this.player.invulnTicks > 0) this.player.invulnTicks--;
    if (this.player.dashCdTicks > 0) this.player.dashCdTicks--;
    if (this.player.pulseCdTicks > 0) this.player.pulseCdTicks--;
    if (this.player.charmTicks > 0) this.player.charmTicks--;

    for (let i = this.motes.length - 1; i >= 0; i--) {
      if (this.motes[i].ttlTicks > 0) {
        this.motes[i].ttlTicks--;
        if (this.motes[i].ttlTicks === 0) this.motes.splice(i, 1);
      }
    }
    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks--;
        if (c.respawnTicks === 0) c.available = true;
      }
    }

    // Gió mạnh Đêm 3 (mỗi 30s = 1800 tick, kéo dài 5s = 300 tick)
    if (this.windEnabled) {
      const mod = this.simTick % 1800;
      if (mod === 1680) {
        this.wind.dirDeg = this.rng.int(0, 359);
        this.wind.warnTicks = 120;
      }
      if (this.wind.warnTicks > 0) this.wind.warnTicks--;
      if (mod === 0 && this.simTick > 0) {
        this.wind.active = true;
        this.wind.timerTicks = 300;
      }
      if (this.wind.timerTicks > 0) {
        this.wind.timerTicks--;
        if (this.wind.timerTicks === 0) this.wind.active = false;
      }
    }

    // Bước 3: Di chuyển Mây (nhảy, lướt, bục nhảy, gió) & kiểm tra rơi
    if (this.player.fallWaitTicks > 0) {
      this.player.fallWaitTicks--;
      if (this.player.fallWaitTicks === 0) {
        this.player.pos = [0, 0, 0];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.padLaunched = false;
        this.player.invulnTicks = Math.round(this.tuning.invuln_s * 60);
      }
    } else {
      let [mx, mz] = input.move || [0, 0];
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      const theta = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
      const wx = mx * Math.cos(theta) + mz * Math.sin(theta);
      const wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
      if (Math.hypot(wx, wz) > 0.01) {
        this.player.yawRad = Math.atan2(wx, wz);
      }

      // Kích hoạt Lướt (dash)
      const canDash = this.player.dashTicks === 0 && (this.player.dashCdTicks === 0 || this.player.charmTicks > 0);
      if (input.dash && !prevInput.dash && canDash) {
        this.player.dashTicks = Math.round(this.tuning.dash_duration_s * 60); // 12 tick
        this.player.dashCdTicks = this.player.charmTicks > 0 ? 0 : Math.round(this.tuning.dash_cooldown_s * 60);
        const dirLen = Math.hypot(wx, wz);
        this.player.dashDir = dirLen > 0.01 ? [wx / dirLen, wz / dirLen] : [Math.sin(this.player.yawRad), Math.cos(this.player.yawRad)];
        this.events.push({ type: 'event', tick: this.tick, name: 'dash', data: {} });
      }

      const moveSpeed = this.player.charmTicks > 0 ? 7.2 : this.tuning.player_speed;

      if (this.player.dashTicks > 0) {
        this.player.dashTicks--;
        this.player.vel[0] = this.player.dashDir[0] * this.tuning.dash_speed;
        this.player.vel[2] = this.player.dashDir[1] * this.tuning.dash_speed;
        this.player.vel[1] = 0; // Lướt trên không giữ nguyên độ cao
      } else {
        if (!this.player.padLaunched) {
          this.player.vel[0] = wx * moveSpeed;
          this.player.vel[2] = wz * moveSpeed;
        }
        if (input.jump && !prevInput.jump && this.player.grounded) {
          this.player.vel[1] = 7.0;
          this.player.grounded = false;
        }
        if (!this.player.grounded) {
          this.player.vel[1] += -20.0 * DT;
        }
      }

      // Gió đẩy Đêm 3
      let windVx = 0, windVz = 0;
      if (this.wind.active) {
        const wr = (this.wind.dirDeg * Math.PI) / 180;
        windVx = 2.0 * Math.cos(wr);
        windVz = 2.0 * Math.sin(wr);
      }

      let nextX = this.player.pos[0] + (this.player.vel[0] + windVx) * DT;
      let nextY = this.player.pos[1] + this.player.vel[1] * DT;
      let nextZ = this.player.pos[2] + (this.player.vel[2] + windVz) * DT;

      // Tháp chuông tâm tầng 2 Đêm 3 (r = 2m, y >= 6)
      if (this.night === 3 && nextY >= 5.5) {
        const rTower = Math.hypot(nextX, nextZ);
        if (rTower < 2.0) {
          const ang = Math.atan2(nextZ, nextX);
          nextX = 2.0 * Math.cos(ang);
          nextZ = 2.0 * Math.sin(ang);
        }
      }

      const groundY = this._getGroundHeight(nextX, nextZ, this.player.pos[1]);
      if (groundY > -100 && nextY <= groundY && this.player.vel[1] <= 0) {
        nextY = groundY;
        this.player.vel[1] = 0;
        this.player.grounded = true;
        this.player.padLaunched = false;
      } else if (groundY < -100 || nextY > groundY + 0.05) {
        this.player.grounded = false;
      }

      this.player.pos = [nextX, nextY, nextZ];

      // Kiểm tra bục nhảy
      for (const pad of this.jumpPads) {
        if (distXZ(this.player.pos, pad.pos) <= 1.0 && Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.5 && !this.player.padLaunched) {
          const dx = pad.target[0] - pad.pos[0];
          const dz = pad.target[2] - pad.pos[2];
          const d = Math.hypot(dx, dz) || 1;
          this.player.vel = [(dx / d) * pad.vh, pad.vy, (dz / d) * pad.vh];
          this.player.grounded = false;
          this.player.padLaunched = true;
        }
      }

      // Kiểm tra rơi khỏi đảo
      if (this.tuning.fall_enabled && this.player.pos[1] < -10) {
        const lost = this.player.carried;
        this.player.flames -= 1;
        this.player.carried = 0;
        this.events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: { by: 'fall', flames: this.player.flames, dropped: 0, lost }
        });
        if (this.player.flames > 0) this.player.fallWaitTicks = 60;
      }
    }

    // Bước 4: Nhặt đom đóm & Bùa Gió
    if (this.player.fallWaitTicks === 0) {
      if (this.player.carried < this.tuning.carry_capacity) {
        for (let i = this.motes.length - 1; i >= 0; i--) {
          const m = this.motes[i];
          if (m.justDropped) { m.justDropped = false; continue; }
          if (distXZ(this.player.pos, m.pos) <= this.tuning.pickup_radius && Math.abs(this.player.pos[1] - m.pos[1]) <= 1.5) {
            this.motes.splice(i, 1);
            this.player.carried += 1;
            this.score += this.tuning.score.per_mote;
            this.events.push({ type: 'event', tick: this.tick, name: 'mote_picked', data: { carried: this.player.carried } });
            if (this.player.carried >= this.tuning.carry_capacity) break;
          }
        }
      }
      for (const c of this.charms) {
        if (c.available && distXZ(this.player.pos, c.pos) <= this.tuning.pickup_radius && Math.abs(this.player.pos[1] - c.pos[1]) <= 1.5) {
          c.available = false;
          c.respawnTicks = 2700;
          this.player.charmTicks = 600;
          this.events.push({ type: 'event', tick: this.tick, name: 'charm_picked', data: { charm_id: c.id, charm_ticks: 600 } });
        }
      }
    }

    // Bước 5: Tương tác nạp đèn
    if (this.player.fallWaitTicks === 0 && input.interact && !prevInput.interact && this.player.carried > 0) {
      let best = null, bestD = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = distXZ(this.player.pos, l.pos);
        if (d <= this.tuning.interact_radius && Math.abs(this.player.pos[1] - l.pos[1]) <= 1.5) {
          if (d < bestD || (Math.abs(d - bestD) < 1e-6 && l.id < best.id)) { bestD = d; best = l; }
        }
      }
      if (best) {
        const amt = Math.min(this.player.carried, this.tuning.lantern_cost - best.deposited);
        this.player.carried -= amt;
        best.deposited += amt;
        this.events.push({ type: 'event', tick: this.tick, name: 'deposit', data: { lantern_id: best.id, amount: amt, deposited: best.deposited } });
        if (best.deposited >= this.tuning.lantern_cost) {
          best.lit = true;
          this.score += this.tuning.score.per_lantern;
          this.events.push({ type: 'event', tick: this.tick, name: 'lantern_lit', data: { lantern_id: best.id } });
        }
      }
    }

    // Bước 6: Vùng an toàn 6m
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      for (const s of this.shades) {
        const dx = s.pos[0] - l.pos[0], dz = s.pos[2] - l.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < this.tuning.safe_radius) {
          const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
          s.pos[0] = l.pos[0] + nx * this.tuning.safe_radius;
          s.pos[2] = l.pos[2] + nz * this.tuning.safe_radius;
        }
      }
    }

    // Bước 7: Tỏa Sáng (Pulse)
    if (this.player.fallWaitTicks === 0 && input.pulse && !prevInput.pulse && this.player.pulseCdTicks === 0 && this.player.carried >= this.tuning.pulse_cost) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCdTicks = Math.round(this.tuning.pulse_cooldown_s * 60);
      const stunnedIds = [];
      const pCenter = [this.player.pos[0], this.player.pos[1] + 0.8, this.player.pos[2]];

      for (const s of this.shades) {
        if (Math.hypot(s.pos[0] - pCenter[0], s.pos[1] - pCenter[1], s.pos[2] - pCenter[2]) <= this.tuning.pulse_radius) {
          s.state = 'stunned';
          s.stateTicksLeft = Math.round(this.tuning.pulse_stun_s * 60);
          s.pushTicks = 15;
          const dx = s.pos[0] - this.player.pos[0], dz = s.pos[2] - this.player.pos[2];
          const dXZ = Math.hypot(dx, dz);
          s.pushDir = dXZ > 1e-6 ? [dx / dXZ, dz / dXZ] : [1, 0];
          stunnedIds.push(s.id);
          this.score += this.tuning.score.per_stun;
        }
      }

      for (const d of this.drifters) {
        if (Math.hypot(d.pos[0] - pCenter[0], d.pos[1] - pCenter[1], d.pos[2] - pCenter[2]) <= this.tuning.pulse_radius) {
          if (d.state === 'chase') {
            d.state = 'flee';
            d.ticksLeft = 240;
          } else if (d.state === 'flee' && d.stolen > 0) {
            const droppedAmt = d.stolen;
            for (let k = 0; k < droppedAmt; k++) {
              this.motes.push({ id: `M${this.nextMoteId++}`, pos: [...d.pos], kind: 'dropped', ttlTicks: 480, justDropped: true });
            }
            d.stolen = 0;
            d.ticksLeft = 120;
            this.events.push({ type: 'event', tick: this.tick, name: 'drifter_drop', data: { drifter_id: d.id, amount: droppedAmt } });
          }
        }
      }
      this.events.push({ type: 'event', tick: this.tick, name: 'pulse', data: { stunned_ids: stunnedIds } });
    }

    // Bước 8: Di chuyển Bóng Mực & Gió Lạc
    const shadeSpd = this.night === 3 ? 4.5 : this.tuning.shade_speed;
    for (const s of this.shades) {
      if (s.pushTicks > 0) {
        const stepPush = this.tuning.pulse_push_m / 15;
        s.pos[0] += s.pushDir[0] * stepPush;
        s.pos[2] += s.pushDir[1] * stepPush;
        s.pushTicks--;
      }
      if (s.state === 'stunned' || s.state === 'recoil') {
        if (s.stateTicksLeft > 0) {
          s.stateTicksLeft--;
          if (s.stateTicksLeft === 0) s.state = 'wander';
        }
        continue;
      }

      const dToPlayer = distXZ(this.player.pos, s.pos);
      if (dToPlayer <= 12) s.state = 'chase';
      else if (dToPlayer > 18) s.state = 'wander';

      let target = this.player.pos;
      if (s.state === 'wander') {
        const unlit = this.lanterns.filter((l) => !l.lit);
        if (unlit.length > 0) {
          unlit.sort((a, b) => distXZ(a.pos, s.pos) - distXZ(b.pos, s.pos) || a.id.localeCompare(b.id));
          target = unlit[0].pos;
        }
      }

      const dx = target[0] - s.pos[0], dz = target[2] - s.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        const nx = s.pos[0] + (dx / d) * shadeSpd * DT;
        const nz = s.pos[2] + (dz / d) * shadeSpd * DT;
        const blocked = this.lanterns.some((l) => l.lit && Math.hypot(nx - l.pos[0], nz - l.pos[2]) < this.tuning.safe_radius);
        if (!blocked) { s.pos[0] = nx; s.pos[2] = nz; }
      }
    }

    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const d = this.drifters[i];
      if (d.state === 'flee') {
        d.ticksLeft--;
        if (d.ticksLeft <= 0) { this.drifters.splice(i, 1); continue; }
        const dx = d.pos[0] - this.player.pos[0], dz = d.pos[2] - this.player.pos[2];
        const dist = Math.hypot(dx, dz) || 1;
        d.pos[0] += (dx / dist) * 7.0 * DT;
        d.pos[2] += (dz / dist) * 7.0 * DT;
      } else {
        const dist = distXZ(d.pos, this.player.pos);
        d.state = this.player.carried >= 5 && dist <= 15 ? 'chase' : 'idle';
        if (d.state === 'chase') {
          const dx = this.player.pos[0] - d.pos[0], dz = this.player.pos[2] - d.pos[2];
          d.pos[0] += (dx / (dist || 1)) * 7.0 * DT;
          d.pos[2] += (dz / (dist || 1)) * 7.0 * DT;
        } else {
          d.angle += 0.03;
          d.pos[0] += Math.cos(d.angle) * 2.0 * DT;
          d.pos[2] += Math.sin(d.angle) * 2.0 * DT;
        }
      }
    }

    // Bước 9: Va chạm (Gió Lạc cướp trước, Bóng Mực đánh sau)
    if (this.player.fallWaitTicks === 0) {
      for (const d of this.drifters) {
        if (d.state === 'chase' && distXZ(this.player.pos, d.pos) <= 1.2) {
          const amt = Math.min(3, this.player.carried);
          this.player.carried -= amt;
          d.stolen = amt;
          d.state = 'flee';
          d.ticksLeft = 240;
          this.events.push({ type: 'event', tick: this.tick, name: 'drifter_steal', data: { drifter_id: d.id, amount: amt, carried: this.player.carried } });
        }
      }

      if (this.player.invulnTicks === 0) {
        const sortedShades = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
        for (const s of sortedShades) {
          if (s.state === 'stunned' || s.state === 'recoil') continue;
          if (distXZ(this.player.pos, s.pos) <= this.tuning.shade_hit_radius && Math.abs(this.player.pos[1] - s.pos[1]) <= 1.5) {
            this.player.flames -= 1;
            this.player.invulnTicks = Math.round(this.tuning.invuln_s * 60);
            s.state = 'recoil';
            s.stateTicksLeft = 60;
            const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
            this.player.carried -= dropped;
            for (let k = 0; k < dropped; k++) {
              const ang = this.rng.range(0, Math.PI * 2);
              const rad = this.rng.range(1.5, 2.5);
              this.motes.push({
                id: `M${this.nextMoteId++}`,
                pos: [round3(this.player.pos[0] + rad * Math.cos(ang)), this.player.pos[1], round3(this.player.pos[2] + rad * Math.sin(ang))],
                kind: 'dropped',
                ttlTicks: 480,
                justDropped: true
              });
            }
            this.events.push({ type: 'event', tick: this.tick, name: 'player_hit', data: { by: 'shade', flames: this.player.flames, dropped } });
            break;
          }
        }
      }
    }

    // Bước 10: Sinh thực thể theo lịch
    if (this.randomMotes && this.simTick % 240 === 0 && this.motes.length < 30) {
      const free = this.moteSpawns.filter((sp) => !this.motes.some((m) => distXZ(m.pos, sp) < 0.5));
      if (free.length > 0) {
        const chosen = free[this.rng.int(0, free.length - 1)];
        this.motes.push({ id: `M${this.nextMoteId++}`, pos: [...chosen], kind: 'random', ttlTicks: -1 });
      }
    }

    const maxShades = this.night === 1 ? 6 : this.night === 2 ? 8 : 10;
    const interval = this.night === 1 ? 480 : this.night === 2 ? 420 : 360;
    if (this.randomShades && this.shades.length < maxShades) {
      const count = this.simTick === 300 ? 2 : this.simTick > 300 && (this.simTick - 300) % interval === 0 ? 1 : 0;
      for (let c = 0; c < count && this.shades.length < maxShades; c++) {
        const valid = this.shadeSpawns.filter((sp) => distXZ(sp, this.player.pos) >= 15);
        if (valid.length > 0) {
          const chosen = valid[this.rng.int(0, valid.length - 1)];
          const id = `S${this.nextShadeId++}`;
          this.shades.push({ id, pos: [...chosen], state: 'wander', stateTicksLeft: 0, pushTicks: 0, pushDir: [0, 0] });
          this.events.push({ type: 'event', tick: this.tick, name: 'shade_spawned', data: { id } });
        }
      }
    }

    if (this.randomDrifters && (this.night === 2 || this.night === 3) && this.simTick % 1200 === 0 && this.drifters.length < 2) {
      const sp = this.moteSpawns[this.rng.int(0, this.moteSpawns.length - 1)];
      this.drifters.push({ id: `D${this.nextDrifterId++}`, pos: [...sp], state: 'idle', stolen: 0, ticksLeft: 0, angle: 0 });
    }

    // Bước 11: Xét thắng / thua
    if (this.player.flames <= 0) {
      this.state = 'lost';
      this.events.push({ type: 'event', tick: this.tick, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
    } else if (this.lanterns.every((l) => l.lit)) {
      this.state = 'won';
      this.score += Math.floor(this.timeLeftS) * this.tuning.score.per_second_left + this.player.flames * this.tuning.score.per_flame_left;
      this.events.push({ type: 'event', tick: this.tick, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
    } else if (this.simTick >= this.durationTicks) {
      this.state = 'lost';
      this.events.push({ type: 'event', tick: this.tick, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
    }

    return this.events;
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: this.timeLeftS,
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.dirDeg },
      player: {
        pos: this.player.pos.map(round3),
        vel: this.player.vel.map(round3),
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCdTicks / 60),
        pulse_cd_s: round3(this.player.pulseCdTicks / 60),
        charm_s: round3(this.player.charmTicks / 60)
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: l.pos.map(round3),
        lit: l.lit,
        deposited: l.deposited
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: s.pos.map(round3),
        state: s.state
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: m.pos.map(round3),
        kind: m.kind,
        ttl_s: m.ttlTicks < 0 ? null : round3(m.ttlTicks / 60)
      })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: d.pos.map(round3),
        state: d.state,
        stolen: d.stolen
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / 60)
      }))
    };
  }
}