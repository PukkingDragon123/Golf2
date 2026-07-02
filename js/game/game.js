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
    longbomb: { id: 'longbomb', name: 'Long Bomb', emoji: '💥', blurb: 'One mega-swing — furthest landing wins!', better: 'high' },
    pinseeker: { id: 'pinseeker', name: 'Pin Seeker', emoji: '🎯', blurb: 'One shot. Closest to the flag wins!', better: 'low' },
    holerush: { id: 'holerush', name: 'Hole Rush', emoji: '🏁', blurb: 'Sink it in the fewest swings!', better: 'low' },
    starsmash: { id: 'starsmash', name: 'Star Smash', emoji: '⭐', blurb: 'Fly through as many floating stars as you can in one fling!', better: 'high' },
    bullseye: { id: 'bullseye', name: 'Bullseye', emoji: '🎯', blurb: 'Land in the target rings round the pin — centre scores big!', better: 'high' },
    twoshot: { id: 'twoshot', name: 'Take Two', emoji: '🔁', blurb: 'Two shots — your closest to the pin counts.', better: 'low' },
    race: { id: 'race', name: 'Ball Dash', emoji: '🏃', blurb: 'Everyone runs at once — mash to sprint, first potato to the ball hits first!', better: 'low' }
  };
  const ROUNDS_TOTAL = 5;

  // Ball Dash race tuning + per-player key pairs (spread across the board so up
  // to four people can crowd one keyboard). Touch uses DOM pads (see hud/ui).
  const RACE = { len: 20, step: 0.95, stepHalf: 0.5, decay: 3.0, vmax: 9, cap: 14, laneGap: 1.95, countdown: 3.2, dnf: 100 };
  const RACE_KEYS = [['KeyA', 'KeyS'], ['KeyF', 'KeyG'], ['KeyH', 'KeyJ'], ['KeyK', 'KeyL']];

  const _n3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const STUDIO_ENV = {
    lightDir: _n3([0.4, 0.82, 0.5]), lightColor: [1.05, 1.0, 0.92], ambient: [0.42, 0.44, 0.52],
    fogColor: [0.09, 0.06, 0.16], fogDensity: 0, clearColor: [0.09, 0.06, 0.16], specular: 0.32, rim: 0.55
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
      this.ball = G.Physics.makeBall(C.ballRadius);
      this.stats = STATS;
      this.power = 0; this.aimYaw = 0; this.camYaw = 0; this.camPitch = C.aimPitch;
      this.loft = 0.36; this._dragBaseYaw = 0;
      this.swingActive = false; this.swingT = 0; this._launched = false;
      this.ballRot = M.create(); this._rotTmp = M.create();
      this._camSnap = true; this._safety = 0; this._turnEndT = 0;
      this.players = []; this.activeIdx = 0; this.turnOrder = []; this.turnPos = 0;
      this.partyRounds = []; this.roundIdx = 0; this.mode = 'longbomb'; this.roundsTotal = ROUNDS_TOTAL;
      this.strokes = 0; this.holeIndex = 0;
      this.stars = []; this.targetRings = null; this._achToasts = []; this._partyRoundWins = [];
      this._starCount = 0; this._shotsThisTurn = 0; this._bestPin = Infinity;
      // studio (character select) + race (Ball Dash) state
      this.studioMode = false; this.studioIdx = 0; this._studioReact = 0;
      this.racers = null; this.raceState = null; this._raceT = 0; this._raceCountdown = 0;
      this._raceDir = [0, 0, 1]; this._racePerp = [1, 0, 0]; this._raceStart = [0, 0, 0]; this._raceGroundY = 0;
      this._raceFinished = 0; this._raceDoneT = 0;
      this.course = null; this.ctx = null; this.gMesh = null;
      this.onStateChange = null; this.onFrame = null; this.toast = null;
      this._traj = null; this._projDist = 0;
      this._buildHelpers();
      this.audio.setMuted(G.save.settings.muted);
      this.audio.setVolume(G.save.settings.volume);
    }

    _buildHelpers() {
      const r = this.r, mesh = G.mesh;
      this._defaultBallTex = r.createTexture(G.textures.ball('classic'));
      this.ballTex = this._defaultBallTex;
      this.ballMesh = r.createMesh(mesh.sphereGeo(this.ball.radius, 22, 14, [1, 1, 1]));
      this.dotMesh = r.createMesh(mesh.sphereGeo(0.14, 6, 5, [1, 1, 1]));
      this.quadMesh = r.createMesh(mesh.quadGeo(1, 1, [1, 1, 1]));
      this.starMesh = r.createMesh(mesh.sphereGeo(0.55, 10, 7, [1, 0.85, 0.3]));
      this.ringMesh = r.createMesh(mesh.cylinderGeo(1, 1, 0.06, 28, [1, 1, 1], true));
      this.shadowTex = this.particles.tex;
      // studio stage + race track props (built once, drawn only in their mode)
      this.pedestalMesh = r.createMesh(mesh.cylinderGeo(1.1, 1.42, 0.5, 28, [0.15, 0.11, 0.22], true));
      this.pedTopMesh = r.createMesh(mesh.cylinderGeo(1.16, 1.16, 0.09, 32, [1, 1, 1], true));
      this.backdropMesh = r.createMesh(mesh.sphereGeo(60, 24, 16, [1, 1, 1]));
      this.studioBackTex = r.createTexture(G.textures.studioBackdrop());
      this.laneMesh = r.createMesh(mesh.boxGeo(1, 1, 1, [1, 1, 1]));
      this.teeMesh = r.createMesh(mesh.cylinderGeo(0.12, 0.32, 0.5, 12, [0.55, 0.42, 0.26], true));
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
      this._partyRoundWins = players.map(() => 0);
      this.partyRounds = this._makeRounds(this.roundsTotal);
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
      G.save.setInStat('mapsPlayed', this.world.id);
      this._setupMode();
      this.players.forEach((p) => { p.result = null; p.strokes = 0; });
      this.turnOrder = this.players.map((_, i) => i);
      this.turnPos = 0;
      this.state = 'roundintro'; this.menuMode = true;
      this.audio.setAmbient(this.world.ambient.intensity, this.world.ambient.tone);
      this._emit('roundintro', { round: this.roundIdx + 1, total: this.partyRounds.length, game: MINIGAMES[this.mode], map: this.world });
    }

    _setupMode() {
      this.stars = []; this.targetRings = null;
      const c = this.course, tee = c.teePos, hole = c.holePos;
      if (this.mode === 'starsmash') {
        let dx = hole[0] - tee[0], dz = hole[2] - tee[2];
        const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        const px = -dz, pz = dx, K = 7;
        for (let k = 0; k < K; k++) {
          const f = (k + 1) / (K + 1);
          const bx = tee[0] + (hole[0] - tee[0]) * f, bz = tee[2] + (hole[2] - tee[2]) * f;
          const off = Math.sin(k * 1.7) * 4;
          const x = bx + px * off, z = bz + pz * off;
          const h = 3 + 8 * Math.sin(f * Math.PI);
          this.stars.push({ pos: [x, c.sampleHeight(x, z) + h, z], r: 1.8, hit: false });
        }
      } else if (this.mode === 'bullseye') {
        this.targetRings = [
          { r: 9.0, col: [0.30, 0.45, 0.85], pts: 1 },
          { r: 6.0, col: [0.35, 0.7, 0.95], pts: 2 },
          { r: 3.5, col: [0.4, 0.85, 0.7], pts: 3 },
          { r: 1.6, col: [1.0, 0.82, 0.25], pts: 5 }
        ];
      }
    }

    startRoundTurns() { if (this.mode === 'race') this._startRace(); else this.beginTurn(); }

    beginTurn() {
      this.activeIdx = this.turnOrder[this.turnPos];
      const p = this.players[this.activeIdx];
      this.gMesh = p._m;
      this.ballTex = p._ballTex || this._defaultBallTex;
      this._placeBallOnTee();
      this.strokes = 0; p.strokes = 0;
      this._starCount = 0; this._shotsThisTurn = 0; this._bestPin = Infinity;
      if (this.stars) this.stars.forEach((s) => { s.hit = false; });
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
      if (this.state === 'play' && !this.toast && this._achToasts.length) this.showToast(this._achToasts.shift(), 2.8);

      if (this.state === 'play') this._updatePlay(dt);
      else if (this.state === 'studio') this._updateStudio(dt);
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
      if (this.paused) { if (this.mode === 'race') this._raceCamera(dt); else this._updateCamera(dt); return; }
      if (this.mode === 'race') { this._updateRace(dt); this._raceCamera(dt); return; }
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

      if (this.mode === 'starsmash' && this.stars.length) {
        const b = this.ball.pos;
        for (const st of this.stars) {
          if (st.hit) continue;
          const dx = b[0] - st.pos[0], dy = b[1] - st.pos[1], dz = b[2] - st.pos[2];
          if (dx * dx + dy * dy + dz * dz < st.r * st.r) {
            st.hit = true; this._starCount++; this.audio.click();
            this.particles.burst(st.pos, 16, { speed: 4, col: [1, 0.85, 0.3], life: 0.6, size: 0.4, grav: -3, up: true });
          }
        }
      }

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
      if (!bad) G.save.maxStat('longest', teeD);

      if (this.mode === 'holerush') {
        if (ev.sank) { if (this.strokes === 1) G.save.addStat('ace'); p.result = this.strokes; this._finishTurn(p.name + ' sank it in ' + this.strokes + '!'); }
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
      } else if (this.mode === 'twoshot') {
        const d = bad ? 9999 : (ev.sank ? 0 : pinD);
        this._bestPin = Math.min(this._bestPin, d);
        this._shotsThisTurn++;
        if (this._shotsThisTurn >= 2) { p.result = this._bestPin; this._finishTurn(p.name + ': best ' + (this._bestPin >= 9999 ? 'lost' : this._bestPin.toFixed(1) + ' m')); }
        else { this.showToast('Shot 1: ' + (bad ? 'lost' : d.toFixed(1) + ' m') + ' — one more!', 1.8); this._placeBallOnTee(); this._beginAim(); }
      } else if (this.mode === 'starsmash') {
        p.result = this._starCount; G.save.maxStat('bestStars', this._starCount);
        this._finishTurn(p.name + ' grabbed ' + this._starCount + ' ⭐');
      } else if (this.mode === 'bullseye') {
        let pts = 0; const rings = this.targetRings;
        if (!bad) for (let i = rings.length - 1; i >= 0; i--) { if (pinD <= rings[i].r) { pts = rings[i].pts; break; } }
        if (!bad && pinD <= rings[rings.length - 1].r) G.save.addStat('bull');
        p.result = pts; this._finishTurn(p.name + ' scored ' + pts + (pts ? ' 🎯' : ' (miss)'));
      } else { // longbomb / pinseeker
        let r, msg;
        if (this.mode === 'longbomb') { r = bad ? 0 : teeD; msg = bad ? p.name + ' flopped it!' : p.name + ': ' + Math.round(teeD) + ' m'; }
        else { r = (ev.sank ? 0 : (bad ? 9999 : pinD)); if (!bad && r < 1) G.save.addStat('pin1'); msg = bad ? p.name + ' lost it!' : (ev.sank ? p.name + ' — IN! 0 m' : p.name + ': ' + pinD.toFixed(1) + ' m'); }
        p.result = r; this._finishTurn(msg);
      }
      this._checkAch();
    }

    _checkAch() {
      const fresh = G.achievements.evaluate();
      fresh.forEach((f) => this._achToasts.push('🏆 ' + f.icon + ' ' + f.name + ' — unlocked ' + f.rewards.join(' + ') + '!'));
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
      // credit a round win only to a clear winner (not on a tie for first)
      if (order.length && (order.length < 2 || order[0].r !== order[1].r)) this._partyRoundWins[order[0].i] = (this._partyRoundWins[order[0].i] || 0) + 1;
      let prevR = null, prevPts = 0;
      const ranking = order.map((o, rank) => {
        // tied results share the better (higher) points of the tie group
        const pts = (rank > 0 && o.r === prevR) ? prevPts : n - rank;
        prevR = o.r; prevPts = pts;
        o.p.score += pts;
        const v = o.p.result;
        let val;
        if (v == null) val = '—';
        else if (mg.id === 'holerush') val = (v >= C.strokeCap + 1 ? 'DNF' : v + (v === 1 ? ' swing' : ' swings'));
        else if (mg.id === 'longbomb') val = (v ? Math.round(v) + ' m' : 'flop');
        else if (mg.id === 'starsmash') val = v + ' ⭐';
        else if (mg.id === 'bullseye') val = v + ' pts';
        else if (mg.id === 'race') val = (v >= RACE.dnf ? 'DNF' : v.toFixed(2) + 's');
        else val = (v >= 9999 ? 'lost' : v.toFixed(1) + ' m');
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
      G.save.addStat('parties');
      // "Win a party": only when the host (player 0) finishes top (ties count)
      const topScore = standings.length ? standings[0].score : -1;
      if (this.players[0] && this.players[0].score === topScore) G.save.addStat('wins');
      G.save.maxStat('bestRoundWins', Math.max(0, ...this._partyRoundWins));
      const fresh = G.achievements.evaluate();
      this.state = 'podium'; this.menuMode = true;
      this.audio.win();
      this._emit('podium', { standings, unlocked: fresh });
    }

    endParty() {
      this.players.forEach((p) => G.players.freeMeshes(this.r, p));
      this.players = [];
      this.ballTex = this._defaultBallTex; this.stars = []; this.targetRings = null; this._achToasts = [];
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
      const ss = math.smoothstep, lp = math.lerp, t = this.time;
      if (this.swingActive) {
        const T = this.swingT, IM = C.impactT, SD = C.swingDur;
        if (T < IM) { const f = ss(0, IM, T); const sy = lp(1.0, 0.92, f); return { coil: lp(0.85, -0.35, f), tilt: 0.07, arm: lp(-2.0, 0.85, f * f), wrist: lp(-1.2, 0, f), weight: lp(-0.14, 0.2, f), sy: sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy) }; }
        const f = ss(IM, SD, Math.min(T, SD));
        const hump = Math.sin(Math.min(1, f) * Math.PI);            // 0→1→0 impact stretch
        const sy = 1 + hump * 0.08;
        return { coil: lp(-0.35, -1.05, f), tilt: 0.07, arm: lp(0.85, 1.7, f), wrist: lp(0, 0.8, f), weight: lp(0.2, 0.08, f), bob: hump * 0.05, sy: sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy) };
      }
      if (this.phase === 'drag') {
        const w = this.power, sy = 1 - w * 0.08;
        return { coil: w * 0.7, tilt: 0.07, arm: 0.5 - w * 2.4, wrist: -w * 1.1, weight: -w * 0.14, sy: sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy) };
      }
      // idle: breathing squash + gentle sway
      const sy = 1 + Math.sin(t * 2.0) * 0.03, xz = 1 / Math.sqrt(sy);
      return { coil: Math.sin(t * 0.9) * 0.05, tilt: 0.05 + Math.sin(t * 1.1) * 0.02, arm: 0.5 + Math.sin(t * 1.3) * 0.05, wrist: -0.05, weight: 0, bob: Math.sin(t * 2.0) * 0.02, sy: sy, sx: xz, sz: xz };
    }

    // A frantic Fall-Guys waddle-hop for the race (legs are one mesh, so a big
    // hop + waddle + arm-pump reads as sprinting).
    _runPose(phase, speed01) {
      const hop = Math.abs(Math.sin(phase)), sy = 0.9 + hop * 0.16, xz = 1 / Math.sqrt(sy);
      return {
        coil: Math.sin(phase * 0.5) * 0.08, tilt: Math.sin(phase) * 0.13, arm: 0.6 + Math.sin(phase) * 0.55,
        wrist: 0.2, weight: 0, pitch: 0.3 + speed01 * 0.18, bob: hop * 0.18, legSwing: Math.sin(phase) * 0.5,
        sy: sy, sx: xz, sz: xz
      };
    }

    // Studio idle turntable pose + a squash-pop hop when react (1→0) is active.
    _studioPose(t, react) {
      const sy0 = 1 + Math.sin(t * 2.0) * 0.03, xz0 = 1 / Math.sqrt(sy0);
      const pose = { coil: Math.sin(t * 0.8) * 0.05, tilt: 0.03 + Math.sin(t * 1.1) * 0.02, arm: 0.5 + Math.sin(t * 1.3) * 0.06, wrist: -0.05, weight: 0, bob: Math.sin(t * 2.0) * 0.02, sy: sy0, sx: xz0, sz: xz0 };
      if (react > 0) { const jump = Math.sin(react * Math.PI); pose.bob += jump * 0.35; const s = 1 + jump * 0.2; pose.sy = s; pose.sx = pose.sz = 1 / Math.sqrt(s); }
      return pose;
    }

    /* ----------------------------- render -------------------------------- */
    render() {
      if (this.state === 'studio') { this._drawStudio(); return; }
      if (!this.course) return;
      const e = this.world.env;
      const env = { lightDir: e.lightDir, lightColor: e.lightColor, ambient: e.ambient, fogColor: e.fogColor, fogDensity: e.fogDensity, clearColor: e.clearColor, specular: e.specular, rim: e.rim };
      this.r.beginFrame(this.camera, env);
      this.course.draw(this.r, this.camera, env, this.particles);
      this._drawModeObjects();

      // Ball Dash: draw the runway + racers instead of the single golfer/ball.
      if (this.state === 'play' && this.mode === 'race') { this._drawRace(env); this.particles.draw(this.camera); return; }

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

    _drawModeObjects() {
      if (this.state !== 'play' && this.state !== 'roundintro') return;
      const t = this.time;
      if (this.mode === 'starsmash' && this.stars.length) {
        for (const s of this.stars) {
          if (s.hit) continue;
          const m = M.create();
          M.translate(m, m, [s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.2, s.pos[2]]);
          M.rotateY(m, m, t * 1.6);
          const pulse = 0.6 + 0.4 * Math.sin(t * 5 + s.pos[2]);
          this.r.draw(this.starMesh, m, { unlit: true, emissive: [1 * pulse, 0.8 * pulse, 0.2 * pulse], blend: true, additive: true, depthWrite: false });
        }
      } else if (this.mode === 'bullseye' && this.targetRings) {
        const hole = this.course.holePos;
        const gy = this.course.greenBaseH != null ? this.course.greenBaseH : this.course.sampleHeight(hole[0], hole[2]);
        for (let i = 0; i < this.targetRings.length; i++) {
          const ring = this.targetRings[i], m = M.create();
          M.translate(m, m, [hole[0], gy + 0.06 + i * 0.03, hole[2]]);
          M.scale(m, m, [ring.r, 1, ring.r]);
          this.r.draw(this.ringMesh, m, { unlit: true, tint: ring.col, emissive: [ring.col[0] * 0.5, ring.col[1] * 0.5, ring.col[2] * 0.5], blend: true, depthWrite: false, opacity: 0.55, cull: false });
        }
      }
    }

    _drawGolfer(b, env) {
      const aim = this.aimDir();
      const gx = b[0] - aim[0] * 1.3, gz = b[2] - aim[2] * 1.3;
      const gy = this.course.sampleHeight(gx, gz);
      const base = M.create(); M.translate(base, base, [gx, gy, gz]); M.rotateY(base, base, this.camYaw);
      this._drawGolferAt(base, this._golferPose(), this.gMesh, env);
    }

    // Compose the 4-part rig from a base matrix (translate + yaw already applied)
    // and a pose. Additive channels bob/pitch/legSwing/sx/sy/sz default to
    // neutral. Squash (sx/sy/sz) scales the torso DRAW only, so it never leaks
    // into the arms/club through the parenting chain.
    _drawGolferAt(base, p, g, env, opts) {
      opts = opts || {};
      const rimK = opts.rim != null ? opts.rim : 1;
      const sx = p.sx == null ? 1 : p.sx, sy = p.sy == null ? 1 : p.sy, sz = p.sz == null ? 1 : p.sz;
      const root = M.create(); M.copy(root, base); M.translate(root, root, [0, p.bob || 0, p.weight || 0]);
      const lower = M.create(); M.copy(lower, root); M.rotateY(lower, lower, (p.coil || 0) * 0.35); if (p.legSwing) M.rotateX(lower, lower, p.legSwing);
      this.r.draw(g.lower, lower, { specular: 0.12, rim: env.rim * 0.6 * rimK });
      const node = M.create(); M.copy(node, root); M.translate(node, node, [0, g.hipY, 0]); M.rotateY(node, node, p.coil || 0); M.rotateZ(node, node, p.tilt || 0); if (p.pitch) M.rotateX(node, node, p.pitch);
      const torso = M.create(); M.copy(torso, node); if (sx !== 1 || sy !== 1 || sz !== 1) M.scale(torso, torso, [sx, sy, sz]);
      this.r.draw(g.torso, torso, { specular: 0.16, rim: env.rim * 0.75 * rimK });
      const arms = M.create(); M.copy(arms, node); M.translate(arms, arms, [0, g.shoulderLocal, 0]); M.rotateX(arms, arms, p.arm || 0);
      this.r.draw(g.arms, arms, { specular: 0.18, rim: env.rim * 0.7 * rimK });
      if (!opts.noClub) { const club = M.create(); M.copy(club, arms); M.translate(club, club, g.hand); M.rotateX(club, club, p.wrist || 0); this.r.draw(g.club, club, { specular: 0.4, rim: env.rim * 0.6 * rimK }); }
    }

    /* --------------------------- character studio ------------------------ */
    enterStudio(players, idx) {
      if (players) this.players = players;
      this.studioIdx = Math.max(0, Math.min((this.players.length || 1) - 1, idx || 0));
      this.state = 'studio'; this.menuMode = true; this.studioMode = true; this._studioReact = 0;
      this.players.forEach((p) => { if (!p._m) G.players.buildMeshes(this.r, p); });
      this.particles.clear();
    }
    setStudioPlayer(i) {
      if (i < 0 || i >= this.players.length) return;
      this.studioIdx = i;
      const p = this.players[i]; if (!p._m) G.players.buildMeshes(this.r, p);
      this._studioReact = 1; this.audio.click();
    }
    // kind: 'ball' re-textures only; anything else rebuilds the body mesh.
    studioReact(kind) {
      const p = this.players[this.studioIdx]; if (!p) return;
      if (kind === 'ball') G.players.rebuildBall(this.r, p); else G.players.rebuildBody(this.r, p);
      this._studioReact = 1;
      this.particles.burst([0, 1.75, 0], 24, { speed: 5, col: G.players.color01(p), life: 0.9, size: 0.32, grav: -6, up: true, cone: 1.4 });
      this.audio.boing();
    }
    exitStudio() {
      this.studioMode = false;
      this.players.forEach((p) => G.players.freeMeshes(this.r, p));
      this.startShowcase();
    }
    _updateStudio(dt) {
      if (this._studioReact > 0) this._studioReact = Math.max(0, this._studioReact - dt / 0.5);
      const p = this.players[this.studioIdx];
      if (p && Math.random() < 0.5) this.particles.emit({ p: [(Math.random() - 0.5) * 3, 4.5, (Math.random() - 0.5) * 2 - 0.4], v: [0, -0.6, 0], life: 3.2, size: 0.14, col: G.players.color01(p), drag: 0.4, grav: -0.3 });
      // subject is drawn at x=0; a +x camera offset renders it left-of-centre so
      // the right control panel never covers it (centre it on narrow screens).
      const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
      const off = (w / h > 0.95) ? 0.95 : 0.0;
      const cam = this.camera;
      V.set(cam.position, off, 1.9, 5.05); V.set(cam.target, off, 1.35, 0); cam.updateView();
    }
    _drawStudio() {
      const r = this.r, env = STUDIO_ENV;
      r.beginFrame(this.camera, env);
      const bm = M.create(); M.translate(bm, bm, this.camera.position);
      r.draw(this.backdropMesh, bm, { texture: this.studioBackTex, unlit: true, cull: false, depthWrite: false });
      const p = this.players[this.studioIdx];
      const col = p ? G.players.color01(p) : [0.8, 0.8, 0.85];
      const ped = M.create(); M.translate(ped, ped, [0, 0.25, 0]);
      r.draw(this.pedestalMesh, ped, { specular: 0.12, rim: 0.3 });
      const top = M.create(); M.translate(top, top, [0, 0.52, 0]);
      r.draw(this.pedTopMesh, top, { tint: [col[0] * 0.55 + 0.2, col[1] * 0.55 + 0.2, col[2] * 0.55 + 0.2], specular: 0.25 });
      const flash = this._studioReact > 0 ? 1 + this._studioReact : 1;
      const ring = M.create(); M.translate(ring, ring, [0, 0.58, 0]); M.scale(ring, ring, [1.28, 1, 1.28]);
      r.draw(this.ringMesh, ring, { unlit: true, emissive: [col[0] * flash, col[1] * flash, col[2] * flash], blend: true, additive: true, depthWrite: false, cull: false });
      const spot = M.create(); M.translate(spot, spot, [0, 0.6, 0]); M.rotateX(spot, spot, -Math.PI / 2); M.scale(spot, spot, [5.5, 5.5, 1]);
      r.draw(this.quadMesh, spot, { texture: this.shadowTex, unlit: true, emissive: [0.42, 0.38, 0.32], blend: true, additive: true, depthWrite: false, cull: false });
      if (p && p._m) {
        // sway around front-facing (+ a flourish spin during a reaction) so the
        // face stays toward the camera in the character select.
        const yaw = Math.sin(this.time * 0.5) * 0.55 + this._studioReact * this._studioReact * 1.2;
        const base = M.create(); M.translate(base, base, [0, 0.56, 0]); M.rotateY(base, base, yaw); M.scale(base, base, [1.42, 1.42, 1.42]);
        this._drawGolferAt(base, this._studioPose(this.time, this._studioReact), p._m, env, { noClub: true, rim: 1.4 });
        if (p._ballTex) {
          const ba = M.create(); M.translate(ba, ba, [1.15, 1.15 + Math.sin(this.time * 1.5) * 0.08, 0.2]); M.rotateY(ba, ba, this.time * 1.4); M.scale(ba, ba, [1.8, 1.8, 1.8]);
          r.draw(this.ballMesh, ba, { texture: p._ballTex, specular: 0.7, rim: 0.3 });
        }
      }
      this.particles.draw(this.camera);
    }

    /* ------------------------------ Ball Dash ---------------------------- */
    _startRace() {
      const c = this.course;
      let dx = c.holePos[0] - c.teePos[0], dz = c.holePos[2] - c.teePos[2];
      const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      this._raceDir = [dx, 0, dz]; this._racePerp = [-dz, 0, dx];
      this._raceGroundY = c.sampleHeight(c.teePos[0], c.teePos[2]);
      this._raceStart = [c.teePos[0], this._raceGroundY, c.teePos[2]];
      this.racers = this.players.map((p, i) => ({ i: i, pos: 0, vel: 0, last: null, finishT: null, stumble: 0, phase: i * 1.7, pad: 0 }));
      this.raceState = 'countdown'; this._raceCountdown = RACE.countdown; this._raceT = 0; this._raceFinished = 0;
      this.state = 'play'; this.menuMode = false; this.phase = 'race'; this._camSnap = true;
      this.showToast('🏃 Ball Dash — mash to sprint!', 1.6);
      this._emit('hud');
    }
    raceTap(i) { if (this.mode === 'race' && this.racers && this.racers[i]) this.racers[i].pad++; }
    _raceWorld(i, pos, dy) {
      const n = this.players.length, off = (i - (n - 1) / 2) * RACE.laneGap;
      const s = this._raceStart, d = this._raceDir, pp = this._racePerp;
      return [s[0] + d[0] * pos + pp[0] * off, this._raceGroundY + (dy || 0), s[2] + d[2] * pos + pp[2] * off];
    }
    _collectRaceInput(countdown) {
      const R = RACE, out = [];
      for (const rc of this.racers) {
        const i = rc.i; out[i] = 0;
        const pair = RACE_KEYS[i]; let tapped = null;
        if (pair) { if (this.input.pressed.has(pair[0])) tapped = pair[0]; if (this.input.pressed.has(pair[1])) tapped = pair[1]; }
        const padTaps = rc.pad; rc.pad = 0;
        if (countdown) { if (tapped || padTaps) rc.stumble = 0.6; continue; }
        if (tapped) { out[i] += (tapped !== rc.last ? R.step : R.stepHalf); rc.last = tapped; }
        if (padTaps) { out[i] += padTaps * R.step; rc.last = null; }
      }
      return out;
    }
    _updateRace(dt) {
      const R = RACE, n = this.players.length;
      if (this.raceState === 'countdown') {
        const prev = Math.ceil(this._raceCountdown); this._raceCountdown -= dt; const now = Math.ceil(this._raceCountdown);
        if (now !== prev && now >= 1) this.audio.click();
        this._collectRaceInput(true);
        if (this._raceCountdown <= 0) { this.raceState = 'run'; this._raceT = 0; this.audio.woosh(); this._emit('hud'); }
        return;
      }
      if (this.raceState === 'done') { this._raceDoneT -= dt; if (this._raceDoneT <= 0) this._finishRace(); return; }
      this._raceT += dt;
      const steps = this._collectRaceInput(false);
      for (const rc of this.racers) {
        if (rc.finishT != null) continue;
        if (rc.stumble > 0) { rc.stumble -= dt; rc.vel *= Math.exp(-6 * dt); }
        else { rc.vel += steps[rc.i] || 0; if (rc.vel > R.vmax) rc.vel = R.vmax; }
        rc.vel *= Math.exp(-R.decay * dt);
        rc.pos += rc.vel * dt;
        rc.phase += (0.6 + rc.vel) * dt * 6;
        if (rc.vel > 2 && Math.random() < 0.5) this.particles.burst(this._raceWorld(rc.i, Math.max(0, rc.pos - 0.2), 0.05), 2, { speed: 1.5, col: [0.82, 0.76, 0.6], life: 0.4, size: 0.2, grav: -5, up: true });
        if (rc.pos >= R.len) { rc.pos = R.len; rc.finishT = this._raceT; this._raceFinished++; this.audio.boing(); }
      }
      if (this._raceFinished >= n || this._raceT >= R.cap) {
        this.raceState = 'done'; this._raceDoneT = 1.8; this.audio.win();
        const w = this.racers.slice().filter((r) => r.finishT != null).sort((a, b) => a.finishT - b.finishT)[0];
        if (w) { const wp = this._raceWorld(w.i, R.len, 0.6); this.particles.burst(wp, 44, { speed: 7, col: G.players.color01(this.players[w.i]), life: 1.2, size: 0.4, grav: -8, up: true, cone: 1.2 }); this.showToast('🏁 ' + this.players[w.i].name + ' — first to the ball!', 2.0); }
      }
      this._emit('hud');
    }
    _finishRace() {
      const R = RACE;
      this.players.forEach((p, i) => {
        const rc = this.racers[i];
        p.result = (rc && rc.finishT != null) ? rc.finishT : (R.dnf + (R.len - (rc ? rc.pos : 0)));
      });
      this.racers = null; this.raceState = null; this.phase = 'aim';
      this._emit('hud');
      this._endRound();
    }
    _raceCamera(dt) {
      const R = RACE;
      let lead = 0; if (this.racers) for (const r of this.racers) if (r.pos > lead) lead = r.pos;
      const midZ = Math.min(R.len, lead + 3.5);
      const s = this._raceStart, d = this._raceDir, pp = this._racePerp;
      const cx = s[0] + d[0] * midZ, cz = s[2] + d[2] * midZ;
      const eye = [cx - d[0] * 12 - pp[0] * 2.5, this._raceGroundY + 7.5, cz - d[2] * 12 - pp[2] * 2.5];
      const target = [cx, this._raceGroundY + 1.1, cz];
      if (this._camSnap) { V.copy(this.camera.position, eye); V.copy(this.camera.target, target); this.camera.updateView(); this._camSnap = false; }
      else this.camera.follow(eye, target, dt, 3);
    }
    _drawRace(env) {
      const R = RACE, n = this.players.length;
      const yaw = Math.atan2(this._raceDir[0], this._raceDir[2]);
      for (let i = 0; i < n; i++) {
        const col = G.players.color01(this.players[i]);
        const mid = this._raceWorld(i, R.len / 2, 0);
        const m = M.create(); M.translate(m, m, [mid[0], this._raceGroundY + 0.06, mid[2]]); M.rotateY(m, m, yaw); M.scale(m, m, [1.5, 0.12, R.len + 2]);
        this.r.draw(this.laneMesh, m, { tint: [col[0] * 0.45 + 0.06, col[1] * 0.45 + 0.06, col[2] * 0.45 + 0.06], specular: 0.15, rim: env.rim * 0.5 });
      }
      const fin = [this._raceStart[0] + this._raceDir[0] * R.len, this._raceGroundY, this._raceStart[2] + this._raceDir[2] * R.len];
      const tee = M.create(); M.translate(tee, tee, [fin[0], this._raceGroundY + 0.25, fin[2]]);
      this.r.draw(this.teeMesh, tee, { specular: 0.2 });
      const fb = M.create(); M.translate(fb, fb, [fin[0], this._raceGroundY + 0.62, fin[2]]); M.rotateY(fb, fb, this.time * 2); M.scale(fb, fb, [2, 2, 2]);
      this.r.draw(this.ballMesh, fb, { texture: this._defaultBallTex, specular: 0.7, rim: 0.3 });
      for (const rc of this.racers || []) {
        const p = this.players[rc.i]; if (!p._m) continue;
        const wp = this._raceWorld(rc.i, rc.pos, 0);
        const pose = (this.raceState === 'run') ? this._runPose(rc.phase, Math.min(1, rc.vel / R.vmax)) : this._golferPose();
        if (rc.stumble > 0) { pose.tilt = 0.6; pose.pitch = 0.8; pose.bob = 0; }
        // contact shadow
        const sm = M.create(); M.translate(sm, sm, [wp[0], this._raceGroundY + 0.09, wp[2]]); M.rotateX(sm, sm, -Math.PI / 2); M.scale(sm, sm, [0.9, 0.9, 1]);
        this.r.draw(this.quadMesh, sm, { texture: this.shadowTex, unlit: true, tint: [0, 0, 0], blend: true, depthWrite: false, opacity: 0.32, cull: false });
        const base = M.create(); M.translate(base, base, wp); M.rotateY(base, base, yaw);
        this._drawGolferAt(base, pose, p._m, env, { noClub: true });
      }
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
