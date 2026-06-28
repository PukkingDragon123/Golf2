/* ===========================================================================
 * game.js  —  Conductor for the party game. Local hot-seat multiplayer, a
 * goofy drag-and-fling (slingshot) swing with a floppy ragdoll arm and a dash
 * of chaos, and a Mario-Party-style run of minigames across cool-named maps.
 * No upgrades, no clubs — just fling and have fun.
 * =========================================================================== */
(function (G) {
  'use strict';
  const M = G.M, V = G.V, math = G.math;

  const C = {
    aimDist: 10, aimPitch: 0.30, watchDist: 16, watchHeight: 8,
    minSpeed: 8, maxSpeed: 47,
    maxDragPx: 240,
    swingDur: 0.5, backswingEnd: 0.0, impactT: 0.16,   // drag = backswing; release fires the downswing
    safetyTime: 22, ballRadius: 0.24, strokeCap: 7
  };
  // base physics stats (no upgrades anymore)
  const STATS = { powerMul: 1, dragMul: 1, spinMul: 1, rollControl: 0, antiGrav: 0, magnetRange: 0, magnetStrength: 0, jetCharges: 0 };

  const MINIGAMES = {
    longbomb: { id: 'longbomb', name: 'Long Bomb', emoji: '💥', blurb: 'One mega-swing — furthest landing wins!', unit: 'm', better: 'high' },
    pinseeker: { id: 'pinseeker', name: 'Pin Seeker', emoji: '🎯', blurb: 'One shot. Closest to the flag wins!', unit: 'm to pin', better: 'low' },
    holerush: { id: 'holerush', name: 'Hole Rush', emoji: '🏁', blurb: 'Sink it in the fewest swings!', unit: 'strokes', better: 'low' }
  };
  const ROUNDS_TOTAL = 5;

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
      this.ball = G.Physics.makeBall(C.ballRadius);
      this.stats = STATS;
      this.power = 0; this.aimYaw = 0; this.camYaw = 0; this.camPitch = C.aimPitch;
      this.loft = 0.36; this._dragBaseYaw = 0;
      this.swingActive = false; this.swingT = 0; this._launched = false;
      this.ballRot = M.create(); this._rotTmp = M.create();
      this._camSnap = true; this._safety = 0; this._turnEndT = 0;
      this.players = []; this.activeIdx = 0; this.turnOrder = []; this.turnPos = 0;
      this.partyRounds = []; this.roundIdx = 0; this.mode = 'longbomb';
      this.strokes = 0; this.holeIndex = 0;
      this.course = null; this.ctx = null; this.gMesh = null;
      this.onStateChange = null; this.onFrame = null; this.toast = null;
      this._traj = null; this._projDist = 0;
      this._buildHelpers();
      this.audio.setMuted(G.save.settings.muted);
      this.audio.setVolume(G.save.settings.volume);
    }

    _buildHelpers() {
      const r = this.r, mesh = G.mesh;
      this.ballTex = r.createTexture(G.textures.ball([245, 245, 248]));
      this.ballMesh = r.createMesh(mesh.sphereGeo(this.ball.radius, 22, 14, [1, 1, 1]));
      this.dotMesh = r.createMesh(mesh.sphereGeo(0.14, 6, 5, [1, 1, 1]));
      this.quadMesh = r.createMesh(mesh.quadGeo(1, 1, [1, 1, 1]));
      this.shadowTex = this.particles.tex;
    }

    /* ----------------------------- showcase ------------------------------ */
    startShowcase() {
      this.menuMode = true; this.state = 'title';
      this.world = G.WORLDS[G.WORLD_ORDER[Math.floor(Math.random() * G.WORLD_ORDER.length)]];
      this._loadCourse(this.world, Math.floor(Math.random() * 3));
      this._placeBallOnTee();
      this.gMesh = null;
    }

    /* ------------------------------- party ------------------------------- */
    startParty(players) {
      this.players = players;
      players.forEach((p) => { p.score = 0; p.result = null; p.strokes = 0; G.players.buildMeshes(this.r, p); });
      this.partyRounds = this._makeRounds(ROUNDS_TOTAL);
      this.roundIdx = 0;
      this.beginRound();
    }

    _makeRounds(n) {
      const games = Object.keys(MINIGAMES), maps = G.WORLD_ORDER.slice();
      const rounds = []; let lg = null, lm = null;
      for (let i = 0; i < n; i++) {
        let g, m, t = 0;
        do { g = games[Math.floor(Math.random() * games.length)]; } while (g === lg && ++t < 8);
        t = 0;
        do { m = maps[Math.floor(Math.random() * maps.length)]; } while (m === lm && ++t < 8);
        rounds.push({ game: g, map: m }); lg = g; lm = m;
      }
      return rounds;
    }

    beginRound() {
      const r = this.partyRounds[this.roundIdx];
      this.mode = r.game; this.world = G.WORLDS[r.map];
      this._loadCourse(this.world, this.roundIdx % this.world.holes);
      this.players.forEach((p) => { p.result = null; p.strokes = 0; });
      this.turnOrder = this.players.map((_, i) => i);
      this.turnPos = 0;
      this.state = 'roundintro'; this.menuMode = true;
      this.audio.setAmbient(this.world.ambient.intensity, this.world.ambient.tone);
      this._emit('roundintro', { round: this.roundIdx + 1, total: this.partyRounds.length, game: MINIGAMES[this.mode], map: this.world });
    }

    startRoundTurns() { this.beginTurn(); }

    beginTurn() {
      this.activeIdx = this.turnOrder[this.turnPos];
      const p = this.players[this.activeIdx];
      this.gMesh = p._m;
      this._placeBallOnTee();
      this.strokes = 0; p.strokes = 0;
      this.lastSafe = V.clone(this.ball.pos);
      this.camYaw = this.aimYaw = this._yawToHole();
      this.camPitch = C.aimPitch;
      this.phase = 'aim'; this.power = 0; this.swingActive = false; this._launched = false;
      this.state = 'play'; this.menuMode = false; this._camSnap = true;
      this.showToast('🏌️ ' + p.name + ' — ' + MINIGAMES[this.mode].emoji + ' ' + MINIGAMES[this.mode].name, 2.0);
      this._predict();
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
      M.identity(this.ballRot);
      this.shotStart = [this.ball.pos[0], this.ball.pos[2]];
    }

    _yawToHole() {
      const c = this.course, b = this.ball.pos;
      return Math.atan2(c.holePos[0] - b[0], c.holePos[2] - b[2]);
    }
    aimDir() { return [Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw)]; }
    activePlayer() { return this.players[this.activeIdx]; }
    miniGame() { return MINIGAMES[this.mode]; }

    /* --------------------------- drag-fling shot ------------------------- */
    _readDrag() {
      const dx = this.input.dragTotalX, dy = this.input.dragTotalY;
      const len = Math.hypot(dx, dy);
      this.power = Math.min(1, len / C.maxDragPx);
      const yaw = this._dragBaseYaw;
      const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
      const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
      // slingshot: launch opposite to the pull
      let lx = fwd[0] * dy - right[0] * dx;
      let lz = fwd[2] * dy - right[2] * dx;
      if (Math.hypot(lx, lz) < 0.0001) { lx = fwd[0]; lz = fwd[2]; }
      this.aimYaw = Math.atan2(lx, lz);
      this.loft = this.course.surfaceAt(this.ball.pos[0], this.ball.pos[2]) === 'green' ? 0.09 : 0.36;
    }

    _beginSwing() {
      this._shotPower = this.power; this._shotAim = this.aimYaw; this._shotLoft = this.loft;
      this.phase = 'swing'; this.swingActive = true; this.swingT = C.backswingEnd; this._launched = false;
      this.audio.woosh();
    }

    _doLaunch() {
      this._launched = true; this.phase = 'watch';
      this.strokes++; this.activePlayer().strokes = this.strokes;
      const power = this._shotPower;
      const chaosAim = (Math.random() - 0.5) * 0.05 * (0.4 + power);
      const chaosPow = 0.93 + Math.random() * 0.14;
      const yaw = this._shotAim + chaosAim;
      const dir = [Math.sin(yaw), 0, Math.cos(yaw)];
      const speed = math.lerp(C.minSpeed, C.maxSpeed, power) * (this.world.physics.powerScale || 1) * chaosPow;
      const sidespin = (Math.random() - 0.5) * 0.5 * power;
      G.Physics.launch(this.ball, dir, speed, this._shotLoft, 0.25, sidespin);
      this._safety = 0;
      this.audio.hit(power);
      const surf = this.course.surfaceAt(this.ball.pos[0], this.ball.pos[2]);
      const col = surf === 'sand' ? [0.85, 0.78, 0.55] : [0.6, 0.7, 0.4];
      this.particles.burst([this.ball.pos[0], this.ball.pos[1] - 0.15, this.ball.pos[2]], 8, { speed: 3, col, life: 0.5, size: 0.3, grav: -6, up: true });
      this._emit('hud');
    }

    _beginAim() {
      this.phase = 'aim'; this.power = 0;
      this.camYaw = this.aimYaw = this._yawToHole();
      this._predict(); this._emit('hud');
    }

    /* ----------------------------- update -------------------------------- */
    update(dt) {
      this.time += dt; dt = Math.min(dt, 0.05);
      this._computeWind();
      if (this.course) this.course.update(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }

      if (this.state === 'play') this._updatePlay(dt);
      else this._updateMenu(dt);

      if (this.course && this.course.ambientParticles) this.course.ambientParticles(this.particles, dt);
      const v = this.ball.vel, spd = Math.hypot(v[0], v[1], v[2]);
      if (spd > 0.05) {
        const ang = Math.min(0.7, spd * dt / this.ball.radius);
        M.fromAxisAngle(this._rotTmp, [v[2], 0, -v[0]], ang);
        M.multiply(this.ballRot, this._rotTmp, this.ballRot);
      }
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
      const dir = base + (G.noise.fbm2(this.time * 0.15, 3.3, 7, 3) - 0.5) * 0.7;
      const speed = w.base + w.gust * G.noise.fbm2(this.time * 0.22, 9.1, 21, 3);
      this.wind = [Math.cos(dir) * speed, 0, Math.sin(dir) * speed];
      this.windInfo = { dir, speed };
    }

    _updatePlay(dt) {
      if (this.paused) { this._updateCamera(dt); return; }
      if (this.swingActive) {
        this.swingT += dt;
        if (!this._launched && this.swingT >= C.impactT) this._doLaunch();
        if (this.swingT >= C.swingDur + 0.3) this.swingActive = false;
      }

      if (this.phase === 'aim') {
        if (this.input.pointerActive) { this.phase = 'drag'; this._dragBaseYaw = this.camYaw; this.audio.ensure(); }
      } else if (this.phase === 'drag') {
        this._readDrag();
        this._predict();
        if (!this.input.pointerActive) {
          if (this.power > 0.06) this._beginSwing(); else this.phase = 'aim';
        }
      } else if (this.phase === 'watch') {
        this._updateWatch(dt);
      } else if (this.phase === 'turnend') {
        this._turnEndT -= dt;
        if (this._turnEndT <= 0) this._advanceTurn();
      }
      this._updateCamera(dt);
    }

    _updateWatch(dt) {
      const ev = {};
      this.ctx.wind = this.wind; this.ctx.stats = this.stats;
      G.Physics.update(this.ball, this.ctx, dt, ev);

      const sp = V.len(this.ball.vel);
      if (sp > 6 && Math.random() < 0.6) this.particles.emit({ p: V.clone(this.ball.pos), v: [0, 0, 0], life: 0.4, size: 0.2, col: [0.9, 0.95, 1], drag: 2, grav: 0 });
      if (ev.bounce) { this.audio.bounce(ev.bounce); this.particles.burst(ev.bouncePos, 6, { speed: 2.5, col: [0.7, 0.7, 0.6], life: 0.4, size: 0.25, grav: -8, up: true }); }
      if (ev.pad) { this.audio.boing(); this.particles.burst(ev.pad, 16, { speed: 5, col: [0.3, 1, 0.7], life: 0.6, size: 0.4, grav: -6, up: true }); }
      if (ev.dino) { this.audio.woosh(); this.particles.burst(ev.dino, 12, { speed: 4, col: [0.6, 0.5, 0.3], life: 0.5, size: 0.4, grav: -6 }); }
      if (ev.lipout) this.audio.click();

      this._safety += dt;
      if (this._safety > C.safetyTime) {
        const p = this.ball.pos, gh = this.course.sampleHeight(p[0], p[2]);
        p[1] = gh + this.ball.radius; V.set(this.ball.vel, 0, 0, 0);
        this.ball.resting = true; this.ball.state = 'rest'; ev.stopped = true;
        const hz = this.course.hazardAt(p[0], p[2]);
        if (hz) ev.hazard = hz; else if (!this.course.inBounds(p[0], p[2])) ev.oob = 'oob';
      }
      if (this.ball.resting) this._onShotDone(ev);
    }

    _onShotDone(ev) {
      const p = this.activePlayer(), b = this.ball.pos;
      const teeD = Math.hypot(b[0] - this.shotStart[0], b[2] - this.shotStart[1]);
      const pinD = Math.hypot(this.course.holePos[0] - b[0], this.course.holePos[2] - b[2]);
      const bad = ev.hazard || ev.oob;
      if (bad) { this.audio[(ev.hazard === 'lava' || ev.hazard === 'acid') ? 'sizzle' : 'splash'](); this.particles.burst(ev.hazardPos || b, 18, { speed: 5, col: [0.6, 0.8, 1], life: 0.7, size: 0.4, grav: -8, up: true }); }
      else if (ev.sank) { this.audio.sink(); this.particles.burst([this.course.holePos[0], this.course.holePos[1] + 0.5, this.course.holePos[2]], 50, { speed: 9, col: [1, 0.9, 0.4], life: 1.3, size: 0.5, grav: -10, up: true, cone: 1.2 }); }

      if (this.mode === 'holerush') {
        if (ev.sank) { p.result = this.strokes; this._finishTurn(p.name + ' sank it in ' + this.strokes + '!'); }
        else if (bad) {
          this.strokes++; p.strokes = this.strokes;
          V.copy(this.ball.pos, this.lastSafe); V.set(this.ball.vel, 0, 0, 0); this.ball.resting = true; this.ball.state = 'rest';
          if (this.strokes >= C.strokeCap) { p.result = C.strokeCap + 1; this._finishTurn(p.name + ' maxed out!'); }
          else { this.showToast('Penalty! +1 stroke', 1.6); this._beginAim(); }
        } else {
          V.copy(this.lastSafe, this.ball.pos);
          if (this.strokes >= C.strokeCap) { p.result = C.strokeCap + 1; this._finishTurn(p.name + ' maxed out!'); }
          else this._beginAim();
        }
      } else { // 1-shot games
        let r, msg;
        if (this.mode === 'longbomb') { r = bad ? 0 : teeD; msg = bad ? p.name + ' flopped it!' : p.name + ': ' + Math.round(teeD) + ' m'; }
        else { r = (ev.sank ? 0 : (bad ? 9999 : pinD)); msg = bad ? p.name + ' lost it!' : (ev.sank ? p.name + ' — IN! 0 m' : p.name + ': ' + pinD.toFixed(1) + ' m to pin'); }
        p.result = r; this._finishTurn(msg);
      }
    }

    _finishTurn(msg) {
      this.showToast(msg, 2.2);
      this.phase = 'turnend'; this._turnEndT = 1.6;
      this._emit('hud');
    }

    _advanceTurn() {
      this.turnPos++;
      if (this.turnPos >= this.players.length) this._endRound();
      else this.beginTurn();
    }

    _endRound() {
      const mg = MINIGAMES[this.mode];
      const order = this.players.map((p, i) => ({ p, i, r: p.result == null ? (mg.better === 'high' ? -1 : 1e9) : p.result }));
      order.sort((a, b) => mg.better === 'high' ? b.r - a.r : a.r - b.r);
      const n = this.players.length;
      const ranking = order.map((o, rank) => {
        const pts = n - rank;   // 1st gets n points, last gets 1
        o.p.score += pts;
        let val;
        if (mg.id === 'holerush') val = (o.p.result == null) ? '—' : (o.p.result >= C.strokeCap + 1 ? 'DNF' : o.p.result + ' strokes');
        else if (mg.id === 'longbomb') val = (o.p.result ? Math.round(o.p.result) + ' m' : 'flop');
        else val = (o.p.result == null) ? '—' : (o.p.result >= 9999 ? 'lost' : o.p.result.toFixed(1) + ' m');
        return { name: o.p.name, color: G.players.colorCss(o.p), value: val, points: pts, total: o.p.score };
      });
      this.audio.win();
      this.state = 'roundresult'; this.menuMode = true;
      this._emit('roundresult', { round: this.roundIdx + 1, total: this.partyRounds.length, game: mg, map: this.world, ranking });
    }

    nextRound() {
      this.roundIdx++;
      if (this.roundIdx >= this.partyRounds.length) this._podium();
      else this.beginRound();
    }

    _podium() {
      const standings = this.players.map((p) => ({ name: p.name, color: G.players.colorCss(p), score: p.score }))
        .sort((a, b) => b.score - a.score);
      this.state = 'podium'; this.menuMode = true;
      this.audio.win();
      this._emit('podium', { standings });
    }

    endParty() {
      this.players.forEach((p) => G.players.freeMeshes(this.r, p));
      this.players = [];
      this.startShowcase();
    }

    /* ----------------------------- camera -------------------------------- */
    _updateCamera(dt) {
      const b = this.ball.pos;
      let eye, target, stiff;
      if (this.phase === 'watch' || this.phase === 'turnend') {
        let dir = [this.ball.vel[0], 0, this.ball.vel[2]];
        if (V.len(dir) < 0.5) dir = this.aimDir();
        V.normalize(dir, dir);
        eye = [b[0] - dir[0] * C.watchDist, b[1] + C.watchHeight, b[2] - dir[2] * C.watchDist];
        target = [b[0] + dir[0] * 2, b[1] + 1, b[2] + dir[2] * 2];
        stiff = 4;
      } else {
        const aim = [Math.sin(this.camYaw), 0, Math.cos(this.camYaw)];
        const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
        const top = [b[0], b[1] + 1.2, b[2]];
        eye = [top[0] - aim[0] * cp * C.aimDist, top[1] + sp * C.aimDist, top[2] - aim[2] * cp * C.aimDist];
        target = [b[0] + aim[0] * 4, b[1] + 0.8, b[2] + aim[2] * 4];
        stiff = 9;
      }
      if (this._camSnap) { V.copy(this.camera.position, eye); V.copy(this.camera.target, target); this.camera.updateView(); this._camSnap = false; }
      else this.camera.follow(eye, target, dt, stiff);
    }

    _predict() {
      if (!this.ctx) return;
      const tmp = G.Physics.makeBall(this.ball.radius);
      V.copy(tmp.pos, this.ball.pos);
      const power = (this.phase === 'drag') ? this.power : 0.55;
      const speed = math.lerp(C.minSpeed, C.maxSpeed, power) * (this.world.physics.powerScale || 1);
      const dir = this.aimDir();
      G.Physics.launch(tmp, dir, speed, this.loft, 0.25, 0);
      this.ctx.wind = this.wind;
      const pts = [];
      for (let i = 0; i < 170 && !tmp.resting; i++) { G.Physics.update(tmp, this.ctx, 1 / 60, {}); if (i % 8 === 0) pts.push(V.clone(tmp.pos)); }
      this._traj = pts;
      this._projDist = Math.round(Math.hypot(tmp.pos[0] - this.ball.pos[0], tmp.pos[2] - this.ball.pos[2]));
    }

    _golferPose() {
      const ss = math.smoothstep, lp = math.lerp;
      if (this.swingActive) {
        const T = this.swingT, IM = C.impactT, SD = C.swingDur;
        if (T < IM) { const f = ss(0, IM, T); return { coil: lp(0.8, -0.3, f), tilt: 0.07, arm: lp(-2.0, 0.85, f * f), wrist: lp(-1.2, 0, f), weight: lp(-0.12, 0.18, f) }; }
        const f = ss(IM, SD, Math.min(T, SD));
        return { coil: lp(-0.3, -1.0, f), tilt: 0.07, arm: lp(0.85, 1.7, f), wrist: lp(0, 0.8, f), weight: lp(0.18, 0.08, f) };
      }
      if (this.phase === 'drag') {
        const w = this.power;
        return { coil: w * 0.7, tilt: 0.07, arm: 0.5 - w * 2.4, wrist: -w * 1.1, weight: -w * 0.12 };
      }
      const t = this.time;
      return { coil: Math.sin(t * 1.3) * 0.04, tilt: 0.06, arm: 0.5 + Math.sin(t * 1.3) * 0.04, wrist: -0.05, weight: 0 };
    }

    /* ----------------------------- render -------------------------------- */
    render() {
      if (!this.course) return;
      const e = this.world.env;
      const env = { lightDir: e.lightDir, lightColor: e.lightColor, ambient: e.ambient, fogColor: e.fogColor, fogDensity: e.fogDensity, clearColor: e.clearColor, specular: e.specular, rim: e.rim };
      this.r.beginFrame(this.camera, env);
      this.course.draw(this.r, this.camera, env, this.particles);

      const b = this.ball.pos;
      const gh = this.course.sampleHeight(b[0], b[2]);
      if (this.state === 'play' && this.gMesh && (this.phase !== 'watch' || this.swingActive)) this._drawGolfer(b, env);

      // shadow
      const hgt = Math.max(0, b[1] - this.ball.radius - gh);
      const sc = this.ball.radius * 3.0 * (1 + hgt * 0.05);
      const sm = M.create(); M.translate(sm, sm, [b[0], gh + 0.05, b[2]]); M.rotateX(sm, sm, -Math.PI / 2); M.scale(sm, sm, [sc, sc, 1]);
      this.r.draw(this.quadMesh, sm, { texture: this.shadowTex, unlit: true, tint: [0, 0, 0], blend: true, depthWrite: false, opacity: 0.4 / (1 + hgt * 0.08), cull: false });

      // ball
      const bm = M.create(); M.translate(bm, bm, b); M.multiply(bm, bm, this.ballRot);
      this.r.draw(this.ballMesh, bm, { texture: this.ballTex, specular: 0.7, rim: 0.25 });

      // trajectory preview (aim/drag)
      if (this.state === 'play' && (this.phase === 'aim' || this.phase === 'drag') && this._traj) {
        for (let i = 0; i < this._traj.length; i++) {
          const p = this._traj[i], dm = M.create();
          const s = 1 - i / (this._traj.length * 1.4);
          M.translate(dm, dm, p); M.scale(dm, dm, [s, s, s]);
          this.r.draw(this.dotMesh, dm, { unlit: true, emissive: [0.5 * s, 0.95 * s, 1.0 * s], blend: true, additive: true, depthWrite: false });
        }
      }
      this.particles.draw(this.camera);
    }

    _drawGolfer(b, env) {
      const aim = this.aimDir();
      const gx = b[0] - aim[0] * 1.3, gz = b[2] - aim[2] * 1.3;
      const gy = this.course.sampleHeight(gx, gz);
      const p = this._golferPose(), g = this.gMesh;
      const base = M.create(); M.translate(base, base, [gx, gy, gz]); M.rotateY(base, base, this.camYaw); M.translate(base, base, [0, 0, p.weight]);
      const lower = M.create(); M.copy(lower, base); M.rotateY(lower, lower, p.coil * 0.35);
      this.r.draw(g.lower, lower, { specular: 0.12, rim: env.rim * 0.6 });
      const torso = M.create(); M.copy(torso, base); M.translate(torso, torso, [0, g.hipY, 0]); M.rotateY(torso, torso, p.coil); M.rotateZ(torso, torso, p.tilt);
      this.r.draw(g.torso, torso, { specular: 0.14, rim: env.rim * 0.7 });
      const arms = M.create(); M.copy(arms, torso); M.translate(arms, arms, [0, g.shoulderLocal, 0]); M.rotateX(arms, arms, p.arm);
      this.r.draw(g.arms, arms, { specular: 0.18, rim: env.rim * 0.7 });
      const club = M.create(); M.copy(club, arms); M.translate(club, club, g.hand); M.rotateX(club, club, p.wrist);
      this.r.draw(g.club, club, { specular: 0.4, rim: env.rim * 0.6 });
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

  G.MINIGAMES = MINIGAMES;
  G.Game = Game;
})(window.GOLF = window.GOLF || {});
