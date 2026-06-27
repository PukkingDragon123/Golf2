/* ===========================================================================
 * game.js  —  The conductor. Owns the renderer/camera/particles/input, runs
 * the state machine (title → world select → play → results → shop), drives the
 * shot mechanics (aim, power meter, spin, loft, jet boost), the follow camera,
 * the live trajectory preview, scoring and coin rewards.
 * =========================================================================== */
(function (G) {
  'use strict';
  const M = G.M, V = G.V, math = G.math, DEG = math.DEG;

  const C = {
    aimDist: 11, aimPitch: 0.34, watchDist: 16, watchHeight: 8,
    minSpeed: 8, maxSpeed: 46,
    loftMin: 12 * DEG, loftMax: 56 * DEG, loftDefault: 28 * DEG,
    aimRate: 1.5, loftRate: 0.7, spinRate: 1.6, dragAim: 0.005, dragPitch: 0.004,
    jetBoost: 15, powerPeriod: 1.5, safetyTime: 26
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
      this.menuMode = true;
      this.time = 0;
      this.wind = [0, 0, 0];
      this.windInfo = { dir: 0, speed: 0 };
      this.ball = G.Physics.makeBall(0.5);
      this.stats = G.gear.statsFromSave();
      this.loft = C.loftDefault;
      this.spinB = 0; this.spinS = 0;
      this.camYaw = 0; this.camPitch = C.aimPitch;
      this.power = 0; this.charging = false; this.chargeT = 0;
      this.jetRemaining = 0;
      this._camSnap = true;
      this._safety = 0;
      this.course = null;
      this.ctx = null;
      this.onStateChange = null;   // ui hook
      this.toast = null;           // {msg, t}
      this._buildHelpers();
      this.audio.setMuted(G.save.settings.muted);
      this.audio.setVolume(G.save.settings.volume);
    }

    _buildHelpers() {
      const r = this.r, mesh = G.mesh;
      this.ballTex = r.createTexture(G.textures.ball(G.save.ballAccent));
      this.ballMesh = r.createMesh(mesh.sphereGeo(this.ball.radius, 24, 16, [1, 1, 1]));
      this.dotMesh = r.createMesh(mesh.sphereGeo(0.18, 6, 5, [1, 1, 1]));
      this.quadMesh = r.createMesh(mesh.quadGeo(1, 1, [1, 1, 1]));
      this.shadowTex = this.particles.tex;
    }

    refreshStats() {
      this.stats = G.gear.statsFromSave();
      if (this.ctx) this.ctx.stats = this.stats;
      // re-skin ball/cart accent
      this.r.gl.deleteTexture(this.ballTex);
      this.ballTex = this.r.createTexture(G.textures.ball(G.save.ballAccent));
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
      this.loft = C.loftDefault; this.spinB = 0; this.spinS = 0;
      this.camYaw = this._yawToHole();
      this.camPitch = C.aimPitch;
      this.phase = 'aim'; this.charging = false; this.power = 0;
      this.menuMode = false; this.state = 'playing';
      this._camSnap = true;
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
      this.ball.spinB = 0; this.ball.spinS = 0;
    }

    _yawToHole() {
      const c = this.course, b = this.ball.pos;
      return Math.atan2(c.holePos[0] - b[0], c.holePos[2] - b[2]);
    }

    aimDir() { return [Math.sin(this.camYaw), 0, Math.cos(this.camYaw)]; }

    shoot() {
      this.phase = 'watch';
      this.strokes++;
      const power = this.power;
      const speed = math.lerp(C.minSpeed, C.maxSpeed, power) * this.stats.powerMul;
      const dir = this.aimDir();
      const sb = math.clamp(this.spinB * this.stats.spinMul, -1.7, 1.7);
      const ss = math.clamp(this.spinS * this.stats.spinMul, -1.7, 1.7);
      G.Physics.launch(this.ball, dir, speed, this.loft, sb, ss);
      this.jetRemaining = this.stats.jetCharges;
      this._safety = 0;
      this.audio.hit(power);
      // divot puff
      const surf = this.course.surfaceAt(this.ball.pos[0], this.ball.pos[2]);
      const col = surf === 'sand' ? [0.85, 0.78, 0.55] : [0.6, 0.7, 0.4];
      this.particles.burst([this.ball.pos[0], this.ball.pos[1] - 0.3, this.ball.pos[2]], 8,
        { speed: 3, col, life: 0.5, size: 0.4, grav: -6, up: true });
      this._emit('hud');
    }

    _settle() { V.copy(this.lastSafe, this.ball.pos); this.phase = 'aim'; this.camYaw = this._yawToHole(); this.spinB = 0; this.spinS = 0; this._emit('hud'); }

    _penalty(type) {
      this.strokes++;
      const msg = type === 'water' ? 'Splash! +1 penalty' : type === 'lava' ? 'Vaporised! +1 penalty'
        : type === 'acid' ? 'Dissolved! +1 penalty' : type === 'void' ? 'Lost to the void! +1 penalty'
          : 'Out of bounds! +1 penalty';
      this.showToast(msg, 2.6);
      V.copy(this.ball.pos, this.lastSafe);
      V.set(this.ball.vel, 0, 0, 0);
      this.ball.resting = true; this.ball.state = 'rest';
      this.phase = 'aim'; this.camYaw = this._yawToHole();
      this._camSnap = true;
      this._emit('hud');
    }

    _sank() {
      this.audio.sink();
      const hp = this.course.holePos;
      this.particles.burst([hp[0], hp[1] + 0.5, hp[2]], 60,
        { speed: 9, col: [1, 0.9, 0.4], life: 1.4, size: 0.5, grav: -10, up: true, cone: 1.2 });
      const par = this.course.par;
      const diff = par - this.strokes;
      const coins = math.clamp(Math.round(30 + diff * 15), 5, 220);
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
      const bonus = 120 + stars * 50;
      G.save.addCoins(bonus);
      this.coinsEarned += bonus;
      this.audio.win();
      this.state = 'worldresult';
      this._emit('worldresult', {
        world: this.world, total, par, stars, bonus,
        coinsEarned: this.coinsEarned, scores: this.holeScores.slice(),
        unlocked
      });
    }

    /* ----------------------------- update -------------------------------- */
    update(dt) {
      this.time += dt;
      dt = Math.min(dt, 0.05);
      this._computeWind();
      if (this.course) this.course.update(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }

      if (this.state === 'playing') this._updatePlay(dt);
      else if (this.state === 'holeresult' || this.state === 'worldresult') this._updateCamera(dt);
      else this._updateMenu(dt);

      // ambient particles
      if (this.course && this.course.ambientParticles) this.course.ambientParticles(this.particles, dt);
      this.particles.update(dt);
      this.input.endFrame();
      if (this.onFrame) this.onFrame();
    }

    _updateMenu(dt) {
      const c = this.course;
      const center = c ? [0, (c.teePos[1] + c.holePos[1]) / 2 + 6, 0] : [0, 6, 0];
      this.camera.orbitTo(center, this.time * 0.12, 0.42, 86);
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
      if (this.phase === 'aim' || this.phase === 'charge') {
        // aim + camera look from drag & keys
        this.camYaw += inp.aim * C.aimRate * dt + inp.dragX * C.dragAim;
        this.camPitch = math.clamp(this.camPitch - inp.dragY * C.dragPitch, 0.08, 1.25);
        this.loft = math.clamp(this.loft + inp.loft * C.loftRate * dt, C.loftMin, C.loftMax);
        this.spinB = math.clamp(this.spinB + inp.spinB * C.spinRate * dt, -1, 1);
        this.spinS = math.clamp(this.spinS + inp.spinS * C.spinRate * dt, -1, 1);

        if (this.phase === 'aim') {
          if (inp.swing) { this.phase = 'charge'; this.charging = true; this.chargeT = 0; this.power = 0; this.audio.ensure(); }
        } else { // charging
          this.chargeT += dt;
          const period = C.powerPeriod / Math.max(0.3, this.stats.meterCalm);
          const frac = (this.chargeT % period) / period;
          this.power = 1 - Math.abs(frac * 2 - 1);
          if (!inp.swing) { this.charging = false; this.shoot(); }
        }
        this._predict();
      } else if (this.phase === 'watch') {
        this._updateWatch(dt, inp);
      }
      this._updateCamera(dt);
    }

    _updateWatch(dt, inp) {
      const ev = {};
      this.ctx.wind = this.wind;
      this.ctx.stats = this.stats;
      G.Physics.update(this.ball, this.ctx, dt, ev);

      // jet boost
      if (this.jetRemaining > 0 && this.ball.state === 'air' && (this.input.edge('Space') || this.input.edge('jet'))) {
        const h = this.ball.heading;
        this.ball.vel[0] += h[0] * C.jetBoost;
        this.ball.vel[2] += h[2] * C.jetBoost;
        this.ball.vel[1] += 4;
        this.jetRemaining--;
        this.audio.jet();
        this.particles.burst([this.ball.pos[0], this.ball.pos[1], this.ball.pos[2]], 14,
          { speed: 6, col: [1, 0.6, 0.2], life: 0.5, size: 0.5, grav: 0, cone: 0.7 });
        this._emit('hud');
      }

      // flight trail
      const sp = V.len(this.ball.vel);
      if (sp > 6 && Math.random() < 0.6) {
        this.particles.emit({ p: V.clone(this.ball.pos), v: [0, 0, 0], life: 0.4, size: 0.25, col: [0.9, 0.95, 1], drag: 2, grav: 0 });
      }

      // events
      if (ev.bounce) {
        this.audio.bounce(ev.bounce);
        this.particles.burst(ev.bouncePos, 6, { speed: 2.5, col: [0.7, 0.7, 0.6], life: 0.4, size: 0.3, grav: -8, up: true });
      }
      if (ev.pad) { this.audio.boing(); this.particles.burst(ev.pad, 16, { speed: 5, col: [0.3, 1, 0.7], life: 0.6, size: 0.4, grav: -6, up: true }); }
      if (ev.dino) { this.audio.woosh(); this.particles.burst(ev.dino, 12, { speed: 4, col: [0.6, 0.5, 0.3], life: 0.5, size: 0.4, grav: -6 }); }
      if (ev.lipout) this.audio.click();

      this._safety += dt;
      if (this._safety > C.safetyTime) { this.ball.resting = true; ev.stopped = true; V.set(this.ball.vel, 0, 0, 0); }

      if (this.ball.resting) {
        if (ev.sank) this._sank();
        else if (ev.hazard) {
          if (ev.hazard === 'lava' || ev.hazard === 'acid') this.audio.sizzle(); else this.audio.splash();
          this.particles.burst(ev.hazardPos || this.ball.pos, 20,
            { speed: 5, col: ev.hazard === 'lava' ? [1, 0.5, 0.1] : ev.hazard === 'acid' ? [0.4, 1, 0.4] : [0.5, 0.7, 1], life: 0.8, size: 0.5, grav: -8, up: true });
          this._penalty(ev.hazard);
        } else if (ev.oob) {
          this.audio.woosh();
          this._penalty(ev.oob);
        } else {
          this._settle();
        }
      }
    }

    _updateCamera(dt) {
      const b = this.ball.pos;
      let eye = [0, 0, 0], target = [0, 0, 0], stiff = 7;
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
        const top = [b[0], b[1] + 1.0, b[2]];
        eye = [top[0] - aim[0] * cp * C.aimDist, top[1] + sp * C.aimDist, top[2] - aim[2] * cp * C.aimDist];
        target = [b[0] + aim[0] * 3, b[1] + 0.6, b[2] + aim[2] * 3];
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
      const tmp = G.Physics.makeBall(this.ball.radius);
      V.copy(tmp.pos, this.ball.pos);
      const power = this.charging ? this.power : 0.62;
      const speed = math.lerp(C.minSpeed, C.maxSpeed, power) * this.stats.powerMul;
      const dir = this.aimDir();
      G.Physics.launch(tmp, dir, speed,
        this.loft, math.clamp(this.spinB * this.stats.spinMul, -1.7, 1.7), math.clamp(this.spinS * this.stats.spinMul, -1.7, 1.7));
      this.ctx.wind = this.wind;
      const pts = [];
      const h = 1 / 60;
      for (let i = 0; i < 150 && !tmp.resting; i++) {
        G.Physics.update(tmp, this.ctx, h, {});
        if (i % 9 === 0) pts.push(V.clone(tmp.pos));
      }
      this._traj = pts;
    }

    /* ----------------------------- render -------------------------------- */
    render() {
      if (!this.course) return;
      const e = this.world.env;
      const env = {
        lightDir: e.lightDir, lightColor: e.lightColor, ambient: e.ambient,
        fogColor: e.fogColor, fogDensity: e.fogDensity, clearColor: e.clearColor,
        specular: e.specular, rim: e.rim
      };
      this.r.beginFrame(this.camera, env);
      this.course.draw(this.r, this.camera, env, this.particles);

      // ball shadow
      const b = this.ball.pos;
      const gh = this.course.sampleHeight(b[0], b[2]);
      const hgt = Math.max(0, b[1] - this.ball.radius - gh);
      const sc = this.ball.radius * 2.0 * (1 + hgt * 0.04);
      const sm = M.create();
      M.translate(sm, sm, [b[0], gh + 0.06, b[2]]);
      M.rotateX(sm, sm, -Math.PI / 2);
      M.scale(sm, sm, [sc, sc, 1]);
      this.r.draw(this.quadMesh, sm, { texture: this.shadowTex, unlit: true, tint: [0, 0, 0], blend: true, depthWrite: false, opacity: 0.4 / (1 + hgt * 0.08), cull: false });

      // ball
      const bm = M.create();
      M.translate(bm, bm, b);
      M.rotateY(bm, bm, this.time * 0.6);
      this.r.draw(this.ballMesh, bm, { texture: this.ballTex, specular: 0.7, rim: 0.2 });

      // trajectory preview (aim only)
      if (this.state === 'playing' && (this.phase === 'aim' || this.phase === 'charge') && this._traj) {
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

    loop(now) {
      const dt = this._last ? (now - this._last) / 1000 : 0.016;
      this._last = now;
      this.update(dt || 0.016);
      this.render();
      requestAnimationFrame((t) => this.loop(t));
    }
    start() { requestAnimationFrame((t) => { this._last = t; this.loop(t); }); }

    /* ----------------------------- helpers ------------------------------- */
    showToast(msg, t) { this.toast = { msg, t: t || 2.5 }; this._emit('toast', this.toast); }
    _emit(type, data) { if (this.onStateChange) this.onStateChange(type, data); }
  }

  G.Game = Game;
})(window.GOLF = window.GOLF || {});
