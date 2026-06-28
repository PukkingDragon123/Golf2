/* ===========================================================================
 * game.js  —  The conductor. Owns the renderer/camera/particles/input, runs the
 * state machine (title → world select → play → results → shop) and the shot
 * mechanics: pick a club, drag the power, pass the accuracy skill-check, watch
 * the golfer swing and the ball fly. Also drives the follow camera, the live
 * trajectory preview, scoring, coins and the 3D shop scene.
 * =========================================================================== */
(function (G) {
  'use strict';
  const M = G.M, V = G.V, math = G.math, DEG = math.DEG;

  const C = {
    aimDist: 10, aimPitch: 0.30, watchDist: 16, watchHeight: 8,
    minSpeed: 8, maxSpeed: 46,
    aimRate: 1.5, dragAim: 0.005, dragPitch: 0.004,
    jetBoost: 15, safetyTime: 26,
    powerRate: 0.8,         // keyboard hold-fill per second
    accBaseSpeed: 2.1,      // accuracy sweeps per second
    accDead: 0.10,          // accuracy "safe zone" half-width (matches the green band)
    swingDur: 0.64, backswingEnd: 0.34, impactT: 0.5,
    ballRadius: 0.32
  };

  class Game {
    constructor(renderer, canvas) {
      this.r = renderer;
      this.canvas = canvas;
      this.camera = new G.Camera();
      this.particles = new G.Particles(renderer, 700);
      this.input = new G.Input(canvas);
      this.audio = G.audio;
      this.state = 'title';
      this.phase = 'aim';
      this.holeIndex = 0;
      this.menuMode = true;
      this.time = 0;
      this.wind = [0, 0, 0];
      this.windInfo = { dir: 0, speed: 0 };
      this.ball = G.Physics.makeBall(C.ballRadius);
      this.stats = G.gear.statsFromSave();
      this.club = 'driver';
      this.power = 0; this._powerSource = null;
      this.accPos = 0; this.accDir = 1; this.accOffset = 0;
      this.swingT = 0; this.swingActive = false; this._launched = false;
      this.maxDist = 0;
      this.camYaw = 0; this.camPitch = C.aimPitch;
      this.jetRemaining = 0;
      this._camSnap = true;
      this._safety = 0;
      this.course = null;
      this.ctx = null;
      this.shopScene = null;
      this.onStateChange = null;
      this.toast = null;
      this._buildHelpers();
      this.audio.setMuted(G.save.settings.muted);
      this.audio.setVolume(G.save.settings.volume);
    }

    _buildHelpers() {
      const r = this.r, mesh = G.mesh;
      this.ballTex = r.createTexture(G.textures.ball(G.save.ballAccent));
      this.ballMesh = r.createMesh(mesh.sphereGeo(this.ball.radius, 22, 14, [1, 1, 1]));
      this.dotMesh = r.createMesh(mesh.sphereGeo(0.14, 6, 5, [1, 1, 1]));
      this.quadMesh = r.createMesh(mesh.quadGeo(1, 1, [1, 1, 1]));
      this.shadowTex = this.particles.tex;
      const golfer = G.decor.golfer(G.save.ballAccent.map((c) => c / 255));
      this.golferBody = r.createMesh(golfer.body);
      this.golferArms = r.createMesh(golfer.arms);
      this.golferShoulderY = golfer.shoulderY;
    }

    refreshStats() {
      this.stats = G.gear.statsFromSave();
      if (this.ctx) this.ctx.stats = this.stats;
      const gl = this.r.gl;
      gl.deleteTexture(this.ballTex);
      this.ballTex = this.r.createTexture(G.textures.ball(G.save.ballAccent));
      // re-skin the golfer to the chosen accent
      const del = (m) => { if (m) ['position', 'normal', 'color', 'uv', 'index'].forEach((k) => { if (m[k]) gl.deleteBuffer(m[k]); }); };
      del(this.golferBody); del(this.golferArms);
      const golfer = G.decor.golfer(G.save.ballAccent.map((c) => c / 255));
      this.golferBody = this.r.createMesh(golfer.body);
      this.golferArms = this.r.createMesh(golfer.arms);
      this.golferShoulderY = golfer.shoulderY;
      this._computeMaxDist();
    }

    clubEff() { return G.computeClub(this.club, this.stats); }

    selectClub(id) {
      if (!G.clubById[id]) return;
      if (this.phase !== 'aim') return;
      this.club = id;
      this.audio.click();
      this._computeMaxDist();
      this._predict();
      this._emit('hud');
    }

    /* ----------------------------- showcase ------------------------------ */
    startShowcase() {
      this.menuMode = true;
      this.state = 'title';
      const ids = G.WORLD_ORDER.filter((id) => G.save.isUnlocked(id));
      const pick = ids[Math.floor(Math.random() * ids.length)] || 'earth';
      this.world = G.WORLDS[pick] || G.WORLDS.earth;
      this._loadCourse(this.world, 0);
      this._placeBallOnTee();
    }

    /* ----------------------------- play flow ----------------------------- */
    startWorld(id) {
      const world = G.WORLDS[id];
      if (!world) return;
      this.worldId = id; this.world = world;
      this.holeIndex = 0; this.totalStrokes = 0; this.totalPar = 0;
      this.holeScores = []; this.coinsEarned = 0;
      this.refreshStats();
      this.startHole(0);
    }

    startHole(i) {
      this.holeIndex = i;
      this._loadCourse(this.world, i);
      this.totalPar += this.course.par;
      this.strokes = 0;
      this._placeBallOnTee();
      this.lastSafe = V.clone(this.ball.pos);
      this.camYaw = this._yawToHole();
      this.camPitch = C.aimPitch;
      this.phase = 'aim'; this.power = 0; this.accOffset = 0; this.swingActive = false;
      this.menuMode = false; this.state = 'playing';
      this._camSnap = true;
      this.club = (this.course.par === 3) ? 'wedge' : 'driver';
      this._computeMaxDist();
      this.audio.setAmbient(this.world.ambient.intensity, this.world.ambient.tone);
      this.showToast(this.world.gimmickHint, 4.2);
      this._emit('hud');
    }

    _loadCourse(world, i) {
      if (this.course) this.course.dispose();
      this.particles.clear();
      this.course = new G.Course(this.r, world, i);
      this.world = world;
      this.ctx = this.course.context(this.stats);
    }

    _placeBallOnTee() {
      const c = this.course;
      const y = c.sampleHeight(c.teePos[0], c.teePos[2]);
      V.set(this.ball.pos, c.teePos[0], y + this.ball.radius, c.teePos[2]);
      V.set(this.ball.vel, 0, 0, 0);
      this.ball.resting = true; this.ball.state = 'rest';
    }

    _yawToHole() {
      const c = this.course, b = this.ball.pos;
      return Math.atan2(c.holePos[0] - b[0], c.holePos[2] - b[2]);
    }

    aimDir() { return [Math.sin(this.camYaw), 0, Math.cos(this.camYaw)]; }

    // estimate full-power carry+roll for the current club & world (for the HUD)
    _computeMaxDist() {
      if (!this.ctx) { this.maxDist = 0; return; }
      const club = this.clubEff();
      const tmp = G.Physics.makeBall(this.ball.radius);
      V.copy(tmp.pos, this.ball.pos);
      const speed = C.maxSpeed * this.stats.powerMul * (this.world.physics.powerScale || 1) * club.power;
      const dir = this.aimDir();
      G.Physics.launch(tmp, dir, speed, club.loftRad, club.back, 0);
      const sx = tmp.pos[0], sz = tmp.pos[2];
      const savedWind = this.ctx.wind; this.ctx.wind = [0, 0, 0];
      for (let i = 0; i < 400 && !tmp.resting; i++) G.Physics.update(tmp, this.ctx, 1 / 60, {});
      this.ctx.wind = savedWind;
      this.maxDist = Math.round(Math.hypot(tmp.pos[0] - sx, tmp.pos[2] - sz));
    }

    projectedDist() {
      const s = math.lerp(C.minSpeed, C.maxSpeed, this.power) / C.maxSpeed;
      return Math.round(this.maxDist * s * s);
    }

    /* --------------------------- shot skill check ------------------------ */
    beginPower(source) {
      if (this.phase !== 'aim') return;
      this.phase = 'power';
      this._powerSource = source;
      if (source !== 'pointer') this.power = 0;
      this.audio.ensure();
      this._emit('hud');
    }
    setPower(p) { if (this.phase === 'power') { this.power = math.clamp(p, 0, 1); this._predict(); this._emit('hud'); } }
    confirmPower() {
      if (this.phase !== 'power') return;
      this.phase = 'accuracy';
      this.accPos = 0; this.accDir = 1;
      this.audio.putt();
      this._emit('hud');
    }
    lockAccuracy() {
      if (this.phase !== 'accuracy') return;
      this.accOffset = this.accPos;
      this.phase = 'swing';
      this.swingT = 0; this.swingActive = true; this._launched = false;
      const perfect = Math.abs(this.accOffset) < C.accDead;
      if (perfect) { this.showToast('Perfect strike!', 1.2); this.audio.click(); }
      this._emit('hud');
    }

    _doLaunch() {
      this._launched = true;
      this.phase = 'watch';
      this.strokes++;
      const club = this.clubEff();
      // green "safe zone": no penalty within accDead of centre, scaling in beyond it
      const off = this.accOffset;
      const effOff = Math.sign(off) * Math.max(0, Math.abs(off) - C.accDead);
      const yaw = this.camYaw + effOff * club.deflect;
      const dir = [Math.sin(yaw), 0, Math.cos(yaw)];
      const powerLoss = 1 - 0.16 * Math.abs(effOff);
      const speed = math.lerp(C.minSpeed, C.maxSpeed, this.power) *
        this.stats.powerMul * (this.world.physics.powerScale || 1) * club.power * powerLoss;
      G.Physics.launch(this.ball, dir, speed, club.loftRad, club.back, effOff * 0.6);
      this.jetRemaining = this.stats.jetCharges;
      this._safety = 0;
      this.audio.hit(this.power);
      const surf = this.course.surfaceAt(this.ball.pos[0], this.ball.pos[2]);
      const col = surf === 'sand' ? [0.85, 0.78, 0.55] : [0.6, 0.7, 0.4];
      this.particles.burst([this.ball.pos[0], this.ball.pos[1] - 0.2, this.ball.pos[2]], 8,
        { speed: 3, col, life: 0.5, size: 0.3, grav: -6, up: true });
      this._emit('hud');
    }

    _settle() { V.copy(this.lastSafe, this.ball.pos); this.phase = 'aim'; this.power = 0; this.accOffset = 0; this.swingActive = false; this._launched = false; this.camYaw = this._yawToHole(); if (this.course.surfaceAt(this.ball.pos[0], this.ball.pos[2]) === 'green') this.club = 'putter'; this._computeMaxDist(); this._emit('hud'); }

    cancelPower() { if (this.phase === 'power') { this.phase = 'aim'; this.power = 0; this._emit('hud'); } }

    _penalty(type) {
      this.strokes++;
      const msg = type === 'water' ? 'Splash! +1 penalty' : type === 'lava' ? 'Vaporised! +1 penalty'
        : type === 'acid' ? 'Dissolved! +1 penalty' : type === 'void' ? 'Lost to the void! +1 penalty'
          : 'Out of bounds! +1 penalty';
      this.showToast(msg, 2.6);
      V.copy(this.ball.pos, this.lastSafe);
      V.set(this.ball.vel, 0, 0, 0);
      this.ball.resting = true; this.ball.state = 'rest';
      this.phase = 'aim'; this.power = 0; this.accOffset = 0; this.swingActive = false; this._launched = false;
      this.camYaw = this._yawToHole();
      this._camSnap = true; this._computeMaxDist();
      this._emit('hud');
    }

    _sank() {
      this.audio.sink();
      const hp = this.course.holePos;
      this.particles.burst([hp[0], hp[1] + 0.5, hp[2]], 60,
        { speed: 9, col: [1, 0.9, 0.4], life: 1.4, size: 0.5, grav: -10, up: true, cone: 1.2 });
      const par = this.course.par;
      const diff = par - this.strokes;
      const coins = math.clamp(Math.round(24 + diff * 15), 5, 200);
      G.save.addCoins(coins);
      this.coinsEarned += coins;
      this.holeScores.push(this.strokes);
      this.totalStrokes += this.strokes;
      const label = this._scoreLabel(diff, this.strokes);
      this.state = 'holeresult';
      this._emit('holeresult', {
        label, strokes: this.strokes, par, coins,
        hole: this.holeIndex + 1, holes: this.world.holes,
        last: this.holeIndex + 1 >= this.world.holes
      });
    }

    _scoreLabel(diff, strokes) {
      if (strokes === 1) return 'Hole in One! 🌟';
      if (diff >= 3) return 'Albatross! 🦅';
      if (diff === 2) return 'Eagle! 🦅';
      if (diff === 1) return 'Birdie! 🐦';
      if (diff === 0) return 'Par';
      if (diff === -1) return 'Bogey';
      if (diff === -2) return 'Double Bogey';
      return (-diff) + ' over';
    }

    nextHole() {
      if (this.holeIndex + 1 >= this.world.holes) { this._finishWorld(); return; }
      this.startHole(this.holeIndex + 1);
    }

    _finishWorld() {
      const par = this.totalPar, total = this.totalStrokes;
      let stars = 1;
      if (total <= par) stars = 3;
      else if (total <= par + this.world.holes) stars = 2;
      G.save.recordWorld(this.worldId, total, par, stars);
      const next = G.nextWorld(this.worldId);
      let unlocked = null;
      if (next && !G.save.isUnlocked(next)) { G.save.unlock(next); unlocked = G.WORLDS[next]; }
      const bonus = 90 + stars * 40;
      G.save.addCoins(bonus);
      this.coinsEarned += bonus;
      this.audio.win();
      this.state = 'worldresult';
      this._emit('worldresult', {
        world: this.world, total, par, stars, bonus,
        coinsEarned: this.coinsEarned, scores: this.holeScores.slice(), unlocked
      });
    }

    /* ------------------------------- shop -------------------------------- */
    enterShop() {
      if (!this.shopScene) this.shopScene = new G.ShopScene(this.r);
      this.state = 'shop';
      this._camSnap = true;
    }
    setShopPreview(kind) { if (this.shopScene) this.shopScene.setPreview(kind); }

    /* ----------------------------- update -------------------------------- */
    update(dt) {
      this.time += dt;
      dt = Math.min(dt, 0.05);
      this._computeWind();
      if (this.course) this.course.update(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }

      if (this.state === 'playing') this._updatePlay(dt);
      else if (this.state === 'holeresult' || this.state === 'worldresult') this._updateCamera(dt);
      else if (this.state === 'shop') this._updateShop(dt);
      else this._updateMenu(dt);

      if (this.course && this.course.ambientParticles && this.state !== 'shop') this.course.ambientParticles(this.particles, dt);
      this.particles.update(dt);
      this.input.endFrame();
      if (this.onFrame) this.onFrame();
    }

    _updateMenu(dt) {
      const c = this.course;
      const center = c ? [0, (c.teePos[1] + c.holePos[1]) / 2 + 6, 0] : [0, 6, 0];
      this.camera.orbitTo(center, this.time * 0.12, 0.42, 86);
    }

    _updateShop(dt) {
      this.shopScene.update(dt);
      this.shopScene.placeCamera(this.camera, this.time);
    }

    _computeWind() {
      const w = this.world ? this.world.physics.wind : { base: 0, gust: 0 };
      if (!w || (w.base === 0 && w.gust === 0)) { this.wind = [0, 0, 0]; this.windInfo = { dir: 0, speed: 0 }; return; }
      const base = this.course ? this.course.windDir : 0;
      const n = G.noise.fbm2(this.time * 0.15, 3.3, 7, 3);
      const dir = base + (n - 0.5) * 0.7;
      const speed = w.base + w.gust * G.noise.fbm2(this.time * 0.22, 9.1, 21, 3);
      this.wind = [Math.cos(dir) * speed, 0, Math.sin(dir) * speed];
      this.windInfo = { dir, speed };
    }

    _updatePlay(dt) {
      if (this.paused) { this._updateCamera(dt); return; }
      const inp = this.input.poll();
      this._handleClubKeys();

      if (this.swingActive) {
        this.swingT += dt;
        if (!this._launched && this.swingT >= C.impactT) this._doLaunch();
        if (this.swingT >= C.swingDur + 0.3) this.swingActive = false;
      }

      if (this.phase === 'aim') {
        this.camYaw += inp.aim * C.aimRate * dt + inp.dragX * C.dragAim;
        this.camPitch = math.clamp(this.camPitch - inp.dragY * C.dragPitch, 0.08, 1.2);
        if (inp.swing && this.input.edge('Space')) this.beginPower('key');
        this._predict();
      } else if (this.phase === 'power') {
        if (this._powerSource === 'key') {
          const rate = C.powerRate * Math.max(0.4, this.stats.meterCalm);
          this.power = math.clamp(this.power + rate * dt, 0, 1);
          this._predict();
          if (!inp.swing) this.confirmPower();
        }
      } else if (this.phase === 'accuracy') {
        const spd = C.accBaseSpeed * Math.max(0.4, this.stats.meterCalm);
        this.accPos += this.accDir * spd * dt;
        if (this.accPos > 1) { this.accPos = 1; this.accDir = -1; }
        else if (this.accPos < -1) { this.accPos = -1; this.accDir = 1; }
        if (this.input.edge('Space') || this.input.edge('action') || this.input.pointerTap) this.lockAccuracy();
      } else if (this.phase === 'watch') {
        this._updateWatch(dt, inp);
      }
      this._updateCamera(dt);
    }

    _handleClubKeys() {
      if (this.phase !== 'aim') return;
      if (this.input.edge('Digit1')) this.selectClub('driver');
      else if (this.input.edge('Digit2')) this.selectClub('wedge');
      else if (this.input.edge('Digit3')) this.selectClub('putter');
    }

    _updateWatch(dt, inp) {
      const ev = {};
      this.ctx.wind = this.wind;
      this.ctx.stats = this.stats;
      G.Physics.update(this.ball, this.ctx, dt, ev);

      if (this.jetRemaining > 0 && this.ball.state === 'air' &&
        (this.input.edge('Space') || this.input.edge('jet') || this.input.edge('action') || this.input.pointerTap)) {
        let hx = this.ball.vel[0], hz = this.ball.vel[2];
        const hl = Math.hypot(hx, hz);
        if (hl > 1e-4) { hx /= hl; hz /= hl; } else { hx = this.ball.heading[0]; hz = this.ball.heading[2]; }
        this.ball.vel[0] += hx * C.jetBoost;
        this.ball.vel[2] += hz * C.jetBoost;
        this.ball.vel[1] += 4;
        this.jetRemaining--;
        this.audio.jet();
        this.particles.burst([this.ball.pos[0], this.ball.pos[1], this.ball.pos[2]], 14,
          { speed: 6, col: [1, 0.6, 0.2], life: 0.5, size: 0.4, grav: 0, cone: 0.7 });
        this._emit('hud');
      }

      const sp = V.len(this.ball.vel);
      if (sp > 6 && Math.random() < 0.6) {
        this.particles.emit({ p: V.clone(this.ball.pos), v: [0, 0, 0], life: 0.4, size: 0.2, col: [0.9, 0.95, 1], drag: 2, grav: 0 });
      }

      if (ev.bounce) { this.audio.bounce(ev.bounce); this.particles.burst(ev.bouncePos, 6, { speed: 2.5, col: [0.7, 0.7, 0.6], life: 0.4, size: 0.25, grav: -8, up: true }); }
      if (ev.pad) { this.audio.boing(); this.particles.burst(ev.pad, 16, { speed: 5, col: [0.3, 1, 0.7], life: 0.6, size: 0.4, grav: -6, up: true }); }
      if (ev.dino) { this.audio.woosh(); this.particles.burst(ev.dino, 12, { speed: 4, col: [0.6, 0.5, 0.3], life: 0.5, size: 0.4, grav: -6 }); }
      if (ev.lipout) this.audio.click();

      this._safety += dt;
      if (this._safety > C.safetyTime) {
        const p = this.ball.pos;
        const gh = this.course.sampleHeight(p[0], p[2]);
        p[1] = gh + this.ball.radius;
        V.set(this.ball.vel, 0, 0, 0);
        this.ball.resting = true; this.ball.state = 'rest'; ev.stopped = true;
        const hz = this.course.hazardAt(p[0], p[2]);
        if (hz) { ev.hazard = hz; ev.hazardPos = [p[0], gh, p[2]]; }
        else if (!this.course.inBounds(p[0], p[2])) { ev.oob = 'oob'; }
      }

      if (this.ball.resting) {
        if (ev.sank) this._sank();
        else if (ev.hazard) {
          if (ev.hazard === 'lava' || ev.hazard === 'acid') this.audio.sizzle(); else this.audio.splash();
          this.particles.burst(ev.hazardPos || this.ball.pos, 20,
            { speed: 5, col: ev.hazard === 'lava' ? [1, 0.5, 0.1] : ev.hazard === 'acid' ? [0.4, 1, 0.4] : [0.5, 0.7, 1], life: 0.8, size: 0.5, grav: -8, up: true });
          this._penalty(ev.hazard);
        } else if (ev.oob) { this.audio.woosh(); this._penalty(ev.oob); }
        else this._settle();
      }
    }

    _updateCamera(dt) {
      const b = this.ball.pos;
      let eye, target, stiff;
      if (this.phase === 'watch') {
        let dir = [this.ball.vel[0], 0, this.ball.vel[2]];
        if (V.len(dir) < 0.5) dir = this.aimDir();
        V.normalize(dir, dir);
        eye = [b[0] - dir[0] * C.watchDist, b[1] + C.watchHeight, b[2] - dir[2] * C.watchDist];
        target = [b[0] + dir[0] * 2, b[1] + 1, b[2] + dir[2] * 2];
        stiff = 4;
      } else {
        const aim = this.aimDir();
        const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
        const top = [b[0], b[1] + 1.2, b[2]];
        eye = [top[0] - aim[0] * cp * C.aimDist, top[1] + sp * C.aimDist, top[2] - aim[2] * cp * C.aimDist];
        target = [b[0] + aim[0] * 4, b[1] + 0.8, b[2] + aim[2] * 4];
        stiff = 9;
      }
      if (this._camSnap) {
        V.copy(this.camera.position, eye); V.copy(this.camera.target, target);
        this.camera.updateView(); this._camSnap = false;
      } else {
        this.camera.follow(eye, target, dt, stiff);
      }
    }

    _predict() {
      if (!this.ctx) return;
      const club = this.clubEff();
      const tmp = G.Physics.makeBall(this.ball.radius);
      V.copy(tmp.pos, this.ball.pos);
      const power = (this.phase === 'power') ? this.power : 0.6;
      const speed = math.lerp(C.minSpeed, C.maxSpeed, power) *
        this.stats.powerMul * (this.world.physics.powerScale || 1) * club.power;
      const dir = this.aimDir();
      G.Physics.launch(tmp, dir, speed, club.loftRad, club.back, 0);
      this.ctx.wind = this.wind;
      const pts = [];
      for (let i = 0; i < 170 && !tmp.resting; i++) {
        G.Physics.update(tmp, this.ctx, 1 / 60, {});
        if (i % 8 === 0) pts.push(V.clone(tmp.pos));
      }
      this._traj = pts;
    }

    // golfer arm-swing angle (radians) from the swing timer
    _swingAngle() {
      if (!this.swingActive) return 0.55; // address
      const t = this.swingT;
      if (t < C.backswingEnd) return math.lerp(0.55, -2.1, t / C.backswingEnd);
      if (t < C.impactT) return math.lerp(-2.1, 0.85, (t - C.backswingEnd) / (C.impactT - C.backswingEnd));
      if (t < C.swingDur) return math.lerp(0.85, -0.4, (t - C.impactT) / (C.swingDur - C.impactT));
      return -0.4;
    }

    /* ----------------------------- render -------------------------------- */
    render() {
      if (this.state === 'shop' && this.shopScene) { this.shopScene.draw(this.camera, this.time); return; }
      if (!this.course) return;
      const e = this.world.env;
      const env = {
        lightDir: e.lightDir, lightColor: e.lightColor, ambient: e.ambient,
        fogColor: e.fogColor, fogDensity: e.fogDensity, clearColor: e.clearColor,
        specular: e.specular, rim: e.rim
      };
      this.r.beginFrame(this.camera, env);
      this.course.draw(this.r, this.camera, env, this.particles);

      const b = this.ball.pos;
      const gh = this.course.sampleHeight(b[0], b[2]);

      // golfer (during the address/aim/swing of a shot)
      const showGolfer = this.state === 'playing' && (this.phase !== 'watch' || this.swingActive);
      if (showGolfer) this._drawGolfer(b, gh, env);

      // ball shadow
      const hgt = Math.max(0, b[1] - this.ball.radius - gh);
      const sc = this.ball.radius * 2.4 * (1 + hgt * 0.04);
      const sm = M.create();
      M.translate(sm, sm, [b[0], gh + 0.05, b[2]]);
      M.rotateX(sm, sm, -Math.PI / 2);
      M.scale(sm, sm, [sc, sc, 1]);
      this.r.draw(this.quadMesh, sm, { texture: this.shadowTex, unlit: true, tint: [0, 0, 0], blend: true, depthWrite: false, opacity: 0.4 / (1 + hgt * 0.08), cull: false });

      // ball
      const bm = M.create();
      M.translate(bm, bm, b);
      M.rotateY(bm, bm, this.time * 0.6);
      this.r.draw(this.ballMesh, bm, { texture: this.ballTex, specular: 0.7, rim: 0.25 });

      // trajectory preview
      if (this.state === 'playing' && (this.phase === 'aim' || this.phase === 'power') && this._traj) {
        for (let i = 0; i < this._traj.length; i++) {
          const p = this._traj[i];
          const dm = M.create();
          const s = 1 - i / (this._traj.length * 1.4);
          M.translate(dm, dm, p);
          M.scale(dm, dm, [s, s, s]);
          this.r.draw(this.dotMesh, dm, { unlit: true, emissive: [0.5 * s, 0.95 * s, 1.0 * s], blend: true, additive: true, depthWrite: false });
        }
      }

      this.particles.draw(this.camera);
    }

    _drawGolfer(b, gh, env) {
      const aim = this.aimDir();
      const gx = b[0] - aim[0] * 1.25, gz = b[2] - aim[2] * 1.25;
      const gy = this.course.sampleHeight(gx, gz);
      const face = this.camYaw;
      const body = M.create();
      M.translate(body, body, [gx, gy, gz]);
      M.rotateY(body, body, face);
      this.r.draw(this.golferBody, body, { specular: 0.15, rim: env.rim * 0.7 });
      const arms = M.create();
      M.translate(arms, arms, [gx, gy, gz]);
      M.rotateY(arms, arms, face);
      M.translate(arms, arms, [0, this.golferShoulderY, 0]);
      M.rotateX(arms, arms, this._swingAngle());
      this.r.draw(this.golferArms, arms, { specular: 0.2, rim: env.rim * 0.7 });
    }

    loop(now) {
      const dt = this._last ? (now - this._last) / 1000 : 0.016;
      this._last = now;
      this.update(dt || 0.016);
      this.render();
      requestAnimationFrame((t) => this.loop(t));
    }
    start() { requestAnimationFrame((t) => { this._last = t; this.loop(t); }); }

    showToast(msg, t) { this.toast = { msg, t: t || 2.5 }; this._emit('toast', this.toast); }
    _emit(type, data) { if (this.onStateChange) this.onStateChange(type, data); }
  }

  G.Game = Game;
})(window.GOLF = window.GOLF || {});
