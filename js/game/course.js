/* ===========================================================================
 * course.js  —  Procedurally generates one playable hole for a world+seed:
 * terrain, fairway/green/tee/bunkers, hazards, scattered scenery, the cup &
 * flag, the parked extraterrestrial cart, and every gimmick object (craters,
 * gravity-well planets, bounce pads, updraft geysers, roaming dinosaurs).
 *
 * It also exposes the sampler API the physics layer needs (sampleHeight /
 * sampleNormal / surfaceAt / hazardAt / inBounds).
 * =========================================================================== */
(function (G) {
  'use strict';
  const M = G.M, V = G.V, mesh = G.mesh, noise = G.noise;
  const sstep = G.math.smoothstep, clamp = G.math.clamp, lerp = G.math.lerp, TAU = G.math.TAU;

  const plateau = (d, r, blend) => 1 - sstep(r, r + blend, d);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  class Course {
    constructor(renderer, world, holeIndex) {
      this.r = renderer;
      this.world = world;
      this.holeIndex = holeIndex;
      this.seed = world.seedBase + holeIndex * 131 + 7;
      this.size = 214;
      this.half = this.size / 2;
      this.meshes = [];      // for disposal
      this.textures = [];
      this.wells = []; this.pads = []; this.geysers = []; this.dinos = [];
      this.hazards = []; this.bunkers = []; this.craters = [];
      this.time = 0;
      this._layout();
      this._buildAll();
    }

    /* --------------------------- layout ---------------------------------- */
    _layout() {
      const rng = G.makeRNG(this.seed);
      this.rng = rng;
      const len = rng.range(64, 110);
      const ang = rng() * TAU;
      const dx = Math.cos(ang), dz = Math.sin(ang);
      const px = -dz, pz = dx; // perpendicular
      const tee = [-dx * len / 2, -dz * len / 2];
      const hole = [dx * len / 2, dz * len / 2];
      const dog = rng.signed() * rng.range(0, len * 0.22);
      const mid = [(tee[0] + hole[0]) / 2 + px * dog, (tee[1] + hole[1]) / 2 + pz * dog];
      this.path = [tee, mid, hole];
      this._pathLens = [];
      let total = 0;
      for (let i = 0; i < this.path.length - 1; i++) {
        const l = Math.hypot(this.path[i + 1][0] - this.path[i][0], this.path[i + 1][1] - this.path[i][1]);
        this._pathLens.push(l); total += l;
      }
      this._pathTotal = total;

      this.teeR = 4.5; this.greenR = 7.5; this.fairwayWidth = 7.5; this.holeRadius = 1.55;
      this.teeBaseH = this._baseHeight(tee[0], tee[1]) + 0.3;
      this.greenBaseH = this._baseHeight(hole[0], hole[1]);
      this.teePos = [tee[0], this.teeBaseH, tee[1]];
      this.holePos = [hole[0], this.greenBaseH, hole[1]];
      this.length = len;
      this.par = len < 72 ? 3 : len < 100 ? 4 : 5;
      if (this.world.id === 'moon') this.par = Math.max(3, this.par); // long but easy
      this.windDir = rng() * TAU;

      // hazards
      const hzType = this.world.hazard;
      if (hzType && hzType !== 'none' && hzType !== 'void') {
        const n = rng.int(1, 2);
        for (let i = 0; i < n; i++) {
          const t = rng.range(0.34, 0.82);
          const pt = this.pathPoint(t);
          const off = rng.signed() * rng.range(this.fairwayWidth - 2, this.fairwayWidth + 9);
          const cx = pt[0] + px * off, cz = pt[1] + pz * off;
          if (Math.hypot(cx - hole[0], cz - hole[1]) < this.greenR + 8) continue;
          if (Math.hypot(cx - tee[0], cz - tee[1]) < this.teeR + 8) continue;
          const rr = rng.range(5, 8.5);
          this.hazards.push({ cx, cz, r: rr, type: hzType, floorY: this._baseHeight(cx, cz) - 2.4 });
        }
      }
      // bunkers near green
      const bn = rng.int(1, 3);
      for (let i = 0; i < bn; i++) {
        const a = rng() * TAU, d = this.greenR + rng.range(1.5, 4.5);
        const cx = hole[0] + Math.cos(a) * d, cz = hole[1] + Math.sin(a) * d;
        this.bunkers.push({ cx, cz, r: rng.range(3, 5) });
      }
      // craters (moon)
      if (this.world.gimmick.type === 'lowgrav') {
        const cn = this.world.gimmick.craters || 5;
        for (let i = 0; i < cn; i++) {
          const cx = rng.range(-this.half * 0.7, this.half * 0.7);
          const cz = rng.range(-this.half * 0.7, this.half * 0.7);
          if (Math.hypot(cx - hole[0], cz - hole[1]) < this.greenR + 6) continue;
          if (Math.hypot(cx - tee[0], cz - tee[1]) < this.teeR + 6) continue;
          this.craters.push({ cx, cz, r: rng.range(8, 15), depth: rng.range(3, 6) });
        }
      }
    }

    pathPoint(t) {
      // global t in [0,1] along the polyline
      let d = t * this._pathTotal;
      for (let i = 0; i < this._pathLens.length; i++) {
        if (d <= this._pathLens[i] || i === this._pathLens.length - 1) {
          const f = clamp(d / this._pathLens[i], 0, 1);
          const a = this.path[i], b = this.path[i + 1];
          return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
        }
        d -= this._pathLens[i];
      }
      return this.path[this.path.length - 1];
    }

    corridorNearest(x, z) {
      let best = 1e9, bestT = 0, acc = 0;
      for (let i = 0; i < this.path.length - 1; i++) {
        const a = this.path[i], b = this.path[i + 1];
        const abx = b[0] - a[0], abz = b[1] - a[1];
        const l2 = abx * abx + abz * abz || 1;
        let t = ((x - a[0]) * abx + (z - a[1]) * abz) / l2;
        t = clamp(t, 0, 1);
        const cxp = a[0] + abx * t, czp = a[1] + abz * t;
        const d = Math.hypot(x - cxp, z - czp);
        if (d < best) { best = d; bestT = (acc + t * this._pathLens[i]) / this._pathTotal; }
        acc += this._pathLens[i];
      }
      return { dist: best, t: bestT };
    }

    /* --------------------------- height field ---------------------------- */
    _baseHeight(x, z) {
      const T = this.world.terrain;
      let n = noise.fbm2(x * T.freq, z * T.freq, this.seed, T.octaves);
      if (T.ridged) n = lerp(n, noise.ridged2(x * T.freq, z * T.freq, this.seed + 5, T.octaves), T.ridged);
      let y = (n - 0.5) * 2 * T.amp;
      y += (noise.fbm2(x * 0.012, z * 0.012, this.seed + 91, 3) - 0.5) * T.amp * 1.6;
      return y;
    }

    sampleHeight(x, z) {
      let y = this._baseHeight(x, z);
      // craters (bowls with raised rims)
      for (let i = 0; i < this.craters.length; i++) {
        const c = this.craters[i];
        const d = Math.hypot(x - c.cx, z - c.cz);
        if (d < c.r) {
          const t = d / c.r;
          y += -c.depth * (1 - t * t);
          y += c.depth * 0.35 * Math.exp(-Math.pow((t - 0.85) / 0.12, 2));
        }
      }
      // corridor gentling toward a tee->green ramp
      const cn = this.corridorNearest(x, z);
      const corrInf = plateau(cn.dist, this.fairwayWidth, 11) * 0.55;
      const corrH = lerp(this.teeBaseH, this.greenBaseH, cn.t);
      y = lerp(y, corrH, corrInf);
      // hazard basins
      for (let i = 0; i < this.hazards.length; i++) {
        const h = this.hazards[i];
        const d = Math.hypot(x - h.cx, z - h.cz);
        if (d < h.r) y = lerp(y, h.floorY, plateau(d, h.r * 0.65, h.r * 0.4));
      }
      // bunkers (shallow depressions)
      for (let i = 0; i < this.bunkers.length; i++) {
        const bk = this.bunkers[i];
        const d = Math.hypot(x - bk.cx, z - bk.cz);
        if (d < bk.r) y -= 0.7 * plateau(d, bk.r * 0.6, bk.r * 0.45);
      }
      // green & tee plateaus
      const dg = Math.hypot(x - this.holePos[0], z - this.holePos[2]);
      y = lerp(y, this.greenBaseH, plateau(dg, this.greenR * 0.85, this.greenR * 0.6));
      const dt = Math.hypot(x - this.teePos[0], z - this.teePos[2]);
      y = lerp(y, this.teeBaseH, plateau(dt, this.teeR, this.teeR * 0.8));
      // floating platform (solar)
      if (this.world.terrain.platform) {
        const pm = this._platformMask(x, z, cn, dg, dt);
        y = lerp(-60, y, sstep(0.3, 0.55, pm));
      }
      return y;
    }

    _platformMask(x, z, cn, dg, dt) {
      cn = cn || this.corridorNearest(x, z);
      dg = dg != null ? dg : Math.hypot(x - this.holePos[0], z - this.holePos[2]);
      dt = dt != null ? dt : Math.hypot(x - this.teePos[0], z - this.teePos[2]);
      const band = 1 - sstep(this.fairwayWidth + 7, this.fairwayWidth + 13, cn.dist);
      const green = 1 - sstep(this.greenR + 8, this.greenR + 14, dg);
      const tee = 1 - sstep(this.teeR + 6, this.teeR + 11, dt);
      return Math.max(band, green, tee);
    }

    sampleNormal(out, x, z) {
      const e = 0.6;
      const hl = this.sampleHeight(x - e, z), hr = this.sampleHeight(x + e, z);
      const hd = this.sampleHeight(x, z - e), hu = this.sampleHeight(x, z + e);
      out[0] = hl - hr; out[1] = 2 * e; out[2] = hd - hu;
      const inv = 1 / (Math.hypot(out[0], out[1], out[2]) || 1);
      out[0] *= inv; out[1] *= inv; out[2] *= inv;
      return out;
    }

    surfaceAt(x, z) {
      if (Math.hypot(x - this.holePos[0], z - this.holePos[2]) < this.greenR) return 'green';
      if (Math.hypot(x - this.teePos[0], z - this.teePos[2]) < this.teeR) return 'tee';
      for (let i = 0; i < this.bunkers.length; i++) {
        const bk = this.bunkers[i];
        if (Math.hypot(x - bk.cx, z - bk.cz) < bk.r) return 'sand';
      }
      if (this.corridorNearest(x, z).dist < this.fairwayWidth) return 'fairway';
      return 'rough';
    }

    hazardAt(x, z) {
      for (let i = 0; i < this.hazards.length; i++) {
        const h = this.hazards[i];
        if (Math.hypot(x - h.cx, z - h.cz) < h.r * 0.92) return h.type;
      }
      return null;
    }

    inBounds(x, z) {
      return Math.abs(x) < this.half - 2 && Math.abs(z) < this.half - 2;
    }

    /* --------------------------- mesh building --------------------------- */
    _track(m) { this.meshes.push(m); return m; }
    _trackTex(t) { this.textures.push(t); return t; }

    _buildAll() {
      const r = this.r, world = this.world, pal = world.palette;
      // sky
      this.skyMesh = this._track(r.createMesh(mesh.sphereGeo(1, 32, 20, [1, 1, 1])));
      this.skyTex = this._trackTex(r.createTexture(G.textures.sky(world.sky), { repeat: true, wrapT: r.gl.CLAMP_TO_EDGE, mipmap: true }));

      // terrain
      const self = this;
      const colorFn = (x, z, y, nx, ny, nz) => {
        const surf = self.surfaceAt(x, z);
        let base;
        if (surf === 'green') base = pal.green;
        else if (surf === 'tee') base = pal.fairway;
        else if (surf === 'fairway') base = pal.fairway;
        else if (surf === 'sand') base = pal.sand;
        else base = pal.rough;
        const steep = 1 - sstep(0.55, 0.82, ny);
        base = mix3(base, pal.dirt, steep * 0.8);
        if (world.terrain.platform && y < -18) base = [0.03, 0.03, 0.07];
        const v = (noise.valueNoise2(x * 0.35, z * 0.35, self.seed + 3) - 0.5) * 0.07;
        let stripe = 0;
        if (surf === 'fairway' || surf === 'green') stripe = (Math.sin((x + z) * 0.45) > 0 ? 0.05 : -0.02);
        return [clamp(base[0] + v + stripe, 0, 1), clamp(base[1] + v + stripe, 0, 1), clamp(base[2] + v + stripe, 0, 1)];
      };
      const terGeo = mesh.buildTerrain({ size: this.size, res: 132, heightFn: (x, z) => self.sampleHeight(x, z), colorFn, uvTile: this.size / 7 });
      this.terrainMesh = this._track(r.createMesh(terGeo));
      this.groundTex = this._trackTex(r.createTexture(G.textures.groundDetail(this.seed, world.id === 'moon' ? 0.25 : 0.16)));

      // hazard planes (unit XZ quad, scaled per hazard)
      this.unitQuad = this._track(r.createMesh(mesh.quadGeo(1, 1, [1, 1, 1])));
      if (this.hazards.length) {
        const t = world.hazard;
        const texCanvas = t === 'lava' ? G.textures.lava()
          : t === 'acid' ? G.textures.water([60, 200, 90])
            : G.textures.water([40, 110, 175]);
        this.hazardTex = this._trackTex(r.createTexture(texCanvas));
      }

      // scenery (instanced into one mesh)
      this._buildScenery();

      // cup + flag
      this.cupMesh = this._track(r.createMesh(mesh.cylinderGeo(this.holeRadius, this.holeRadius, 1.6, 16, [0.03, 0.03, 0.05])));
      this.poleMesh = this._track(r.createMesh(mesh.cylinderGeo(0.05, 0.06, 4, 6, [0.92, 0.92, 0.95])));
      const flagColor = world.id === 'alien' ? [0.3, 1, 0.7] : world.id === 'solar' ? [0.5, 0.8, 1] : [0.9, 0.2, 0.25];
      const fb = new mesh.Builder();
      fb.addGeometry(mesh.quadGeo(1.7, 0.65, flagColor), 0.85, 0, 0);
      this.flagMesh = this._track(r.createMesh(fb.result()));
      this.flagColor = flagColor;

      // cart
      this.cartMesh = this._track(r.createMesh(G.decor.cart(G.save.ballAccent.map((c) => c / 255))));
      const toGreen = Math.atan2(this.holePos[0] - this.teePos[0], this.holePos[2] - this.teePos[2]);
      this.cartYaw = toGreen + Math.PI / 2;
      // park beside the tee
      const side = 4.0;
      this.cartPos = [this.teePos[0] + Math.cos(toGreen + Math.PI / 2) * side, 0, this.teePos[2] + Math.sin(toGreen + Math.PI / 2) * side];
      this.cartPos[1] = this.sampleHeight(this.cartPos[0], this.cartPos[2]);

      // gimmick objects
      this._buildGimmicks();
    }

    _buildScenery() {
      const r = this.r, world = this.world, pal = world.palette;
      const kinds = world.decor.kinds;
      const cache = {};
      kinds.forEach((k) => { if (!cache[k]) cache[k] = G.decor.make(k, pal); });
      const b = new mesh.Builder();
      const rng = G.makeRNG(this.seed + 555);
      const target = Math.floor(world.decor.density * 60);
      let placed = 0, tries = 0;
      while (placed < target && tries < target * 6) {
        tries++;
        const x = rng.range(-this.half * 0.92, this.half * 0.92);
        const z = rng.range(-this.half * 0.92, this.half * 0.92);
        if (this.surfaceAt(x, z) !== 'rough') continue;
        if (this.hazardAt(x, z)) continue;
        if (this.corridorNearest(x, z).dist < this.fairwayWidth + 1.5) continue;
        if (world.terrain.platform && this._platformMask(x, z) < 0.6) continue;
        const nrm = [0, 0, 0]; this.sampleNormal(nrm, x, z);
        if (nrm[1] < 0.75) continue; // too steep
        const y = this.sampleHeight(x, z);
        const kind = rng.pick(kinds);
        const sc = rng.range(0.8, 1.6) * (kind === 'tree' || kind === 'palm' ? 1.1 : 1);
        const tint = 0.85 + rng() * 0.3;
        b.addGeometryT(cache[kind], x, y - 0.1, z, sc, rng() * TAU, [tint, tint, tint]);
        placed++;
        if (b.vertexCount > 60000) break;
      }
      this.sceneryMesh = b.vertexCount > 0 ? this._track(r.createMesh(b.result())) : null;
    }

    _buildGimmicks() {
      const r = this.r, g = this.world.gimmick, rng = G.makeRNG(this.seed + 999);
      const px = -Math.cos(this.windDir), pz = -Math.sin(this.windDir);

      if (g.type === 'gravitywells') {
        const palettes = [[[0.9, 0.5, 0.3], [0.5, 0.25, 0.15], [0.9, 0.7, 0.4]],
        [[0.4, 0.6, 0.95], [0.2, 0.3, 0.6], null],
        [[0.7, 0.4, 0.8], [0.4, 0.2, 0.5], [0.8, 0.6, 0.9]]];
        const n = g.wells || 3;
        for (let i = 0; i < n; i++) {
          const t = (i + 1) / (n + 1);
          const pt = this.pathPoint(t * 0.8 + 0.1);
          const ppx = -(this.path[1][1] - this.path[0][1]), ppz = (this.path[1][0] - this.path[0][0]);
          const pl = Math.hypot(ppx, ppz) || 1;
          const off = (i % 2 === 0 ? 1 : -1) * rng.range(8, 14);
          const cx = pt[0] + (ppx / pl) * off, cz = pt[1] + (ppz / pl) * off;
          const rad = rng.range(3.5, 5.5);
          const y = this.sampleHeight(cx, cz) + rng.range(5, 10);
          const pp = palettes[i % palettes.length];
          const geo = G.decor.planet(rad, pp[0], pp[1], pp[2]);
          this.wells.push({
            pos: [cx, y, cz], strength: rng.range(150, 240), radius: rad,
            mesh: this._track(r.createMesh(geo)), spin: rng.range(0.2, 0.6), emissive: pp[0]
          });
        }
      }

      if (g.type === 'bouncepads') {
        const padGeo = G.decor.bouncePad();
        const np = g.pads || 5;
        for (let i = 0; i < np; i++) {
          const t = rng.range(0.2, 0.85);
          const pt = this.pathPoint(t);
          const off = rng.signed() * rng.range(0, this.fairwayWidth);
          const cx = pt[0] + px * off, cz = pt[1] + pz * off;
          const y = this.sampleHeight(cx, cz);
          this.pads.push({ pos: [cx, y, cz], radius: 1.9, power: rng.range(15, 21), mesh: this._track(r.createMesh(padGeo)), phase: rng() * TAU });
        }
        const ng = g.geysers || 3;
        for (let i = 0; i < ng; i++) {
          const t = rng.range(0.3, 0.8);
          const pt = this.pathPoint(t);
          const off = rng.signed() * rng.range(this.fairwayWidth - 2, this.fairwayWidth + 4);
          const cx = pt[0] + px * off, cz = pt[1] + pz * off;
          const y = this.sampleHeight(cx, cz);
          this.geysers.push({ pos: [cx, y, cz], radius: 3.0, power: this.world.physics.gravity * 2.6, height: 16, phase: rng() * TAU });
        }
        // column mesh for geysers (thin translucent cylinder)
        this.geyserMesh = this._track(r.createMesh(mesh.cylinderGeo(2.0, 2.6, 16, 12, [0.5, 1.0, 0.8], false)));
      }

      if (g.type === 'denseair' && g.dinos) {
        const dinoGeo = G.decor.dino(this.world.palette);
        this.dinoMesh = this._track(r.createMesh(dinoGeo));
        for (let i = 0; i < g.dinos; i++) {
          const t = rng.range(0.25, 0.8);
          const pt = this.pathPoint(t);
          const off = (i % 2 === 0 ? 1 : -1) * rng.range(this.fairwayWidth + 4, this.fairwayWidth + 16);
          const cx = pt[0] + px * off, cz = pt[1] + pz * off;
          const range = rng.range(6, 14);
          this.dinos.push({
            center: [cx, cz], axis: [px, pz], range, t: rng() * TAU,
            speed: rng.range(0.3, 0.7), pos: [cx, this.sampleHeight(cx, cz), cz],
            radius: 3.4, facing: 0
          });
        }
      }
    }

    /* --------------------------- physics context ------------------------- */
    context(stats) {
      const self = this;
      return {
        gravity: this.world.physics.gravity,
        airDensity: this.world.physics.airDensity,
        restitution: this.world.physics.restitution,
        friction: this.world.physics.friction,
        rollFriction: this.world.physics.rollFriction,
        wind: [0, 0, 0],
        stats: stats,
        course: {
          sampleHeight: (x, z) => self.sampleHeight(x, z),
          sampleNormal: (o, x, z) => self.sampleNormal(o, x, z),
          surfaceAt: (x, z) => self.surfaceAt(x, z),
          hazardAt: (x, z) => self.hazardAt(x, z),
          inBounds: (x, z) => self.inBounds(x, z)
        },
        wells: this.wells.length ? this.wells : null,
        pads: this.pads.length ? this.pads : null,
        geysers: this.geysers.length ? this.geysers : null,
        dinos: this.dinos.length ? this.dinos : null,
        holePos: this.holePos,
        holeRadius: this.holeRadius,
        voidY: this.world.terrain.platform ? -14 : null
      };
    }

    /* ------------------------------ update ------------------------------- */
    update(dt) {
      this.time += dt;
      for (let i = 0; i < this.dinos.length; i++) {
        const d = this.dinos[i];
        const prevx = d.pos[0], prevz = d.pos[2];
        d.t += d.speed * dt;
        const s = Math.sin(d.t) * d.range;
        d.pos[0] = d.center[0] + d.axis[0] * s;
        d.pos[2] = d.center[1] + d.axis[1] * s;
        d.pos[1] = this.sampleHeight(d.pos[0], d.pos[2]);
        const mvx = d.pos[0] - prevx, mvz = d.pos[2] - prevz;
        if (Math.abs(mvx) + Math.abs(mvz) > 1e-4) d.facing = Math.atan2(mvx, mvz);
        d.bob = Math.sin(d.t * 4) * 0.15;
      }
    }

    /* ------------------------------- draw -------------------------------- */
    draw(r, camera, env, particles) {
      const t = this.time;
      // sky
      const skyModel = M.create();
      M.translate(skyModel, skyModel, camera.position);
      M.scale(skyModel, skyModel, [620, 620, 620]);
      r.drawSky(this.skyMesh, skyModel, this.skyTex);

      const I = M.create();

      // terrain
      r.draw(this.terrainMesh, I, {
        texture: this.groundTex, uvScale: [1, 1],
        specular: env.specular || 0.15, rim: env.rim || 0.1
      });

      // scenery
      if (this.sceneryMesh) r.draw(this.sceneryMesh, I, { specular: 0.05, rim: env.rim * 0.5 });

      // gravity-well planets
      for (let i = 0; i < this.wells.length; i++) {
        const w = this.wells[i];
        const m = M.create();
        M.translate(m, m, w.pos);
        M.rotateY(m, m, t * w.spin);
        r.draw(w.mesh, m, { emissive: [w.emissive[0] * 0.25, w.emissive[1] * 0.25, w.emissive[2] * 0.25], rim: 0.6, specular: 0.4 });
      }

      // bounce pads (pulsing emissive)
      for (let i = 0; i < this.pads.length; i++) {
        const pad = this.pads[i];
        const pulse = 0.5 + 0.5 * Math.sin(t * 4 + pad.phase);
        const m = M.create();
        M.translate(m, m, [pad.pos[0], pad.pos[1] + Math.sin(t * 3 + pad.phase) * 0.1, pad.pos[2]]);
        r.draw(pad.mesh, m, { emissive: [0.1 * pulse, 0.8 * pulse, 0.5 * pulse], rim: 0.5 });
      }

      // dinosaurs
      for (let i = 0; i < this.dinos.length; i++) {
        const d = this.dinos[i];
        const m = M.create();
        M.translate(m, m, [d.pos[0], d.pos[1] + (d.bob || 0), d.pos[2]]);
        M.rotateY(m, m, d.facing);
        r.draw(this.dinoMesh, m, { specular: 0.1, rim: env.rim });
      }

      // cart (hover bob)
      const cm = M.create();
      M.translate(cm, cm, [this.cartPos[0], this.cartPos[1] + 0.35 + Math.sin(t * 1.6) * 0.12, this.cartPos[2]]);
      M.rotateY(cm, cm, this.cartYaw);
      r.draw(this.cartMesh, cm, { specular: 0.4, rim: 0.3 });

      // cup
      const cup = M.create();
      M.translate(cup, cup, [this.holePos[0], this.greenBaseH - 0.7, this.holePos[2]]);
      r.draw(this.cupMesh, cup, { specular: 0 });
      // pole
      const pole = M.create();
      M.translate(pole, pole, [this.holePos[0], this.greenBaseH + 2, this.holePos[2]]);
      r.draw(this.poleMesh, pole, { specular: 0.2 });
      // flag (sway), drawn double-sided
      const flag = M.create();
      M.translate(flag, flag, [this.holePos[0], this.greenBaseH + 3.55, this.holePos[2]]);
      M.rotateY(flag, flag, Math.sin(t * 2.5) * 0.35 + 0.4);
      r.draw(this.flagMesh, flag, { cull: false, emissive: [this.flagColor[0] * 0.12, this.flagColor[1] * 0.12, this.flagColor[2] * 0.12] });

      // ---- translucent pass ----
      // hazards
      for (let i = 0; i < this.hazards.length; i++) {
        const h = this.hazards[i];
        const y = h.floorY + 1.7 + Math.sin(t * 1.5 + i) * 0.05;
        const m = M.create();
        M.translate(m, m, [h.cx, y, h.cz]);
        M.rotateX(m, m, -Math.PI / 2);
        M.scale(m, m, [h.r * 2, h.r * 2, 1]);
        const isLava = h.type === 'lava';
        r.draw(this.unitQuad, m, {
          texture: this.hazardTex, uvScale: [h.r / 2.5, h.r / 2.5],
          blend: true, depthWrite: false, opacity: isLava ? 0.95 : 0.78, unlit: isLava,
          emissive: isLava ? [0.6, 0.2, 0.05] : [0, 0, 0], cull: false
        });
      }
      // geyser columns
      for (let i = 0; i < this.geysers.length; i++) {
        const ge = this.geysers[i];
        const pulse = 0.6 + 0.4 * Math.sin(t * 6 + ge.phase);
        const m = M.create();
        M.translate(m, m, [ge.pos[0], ge.pos[1] + ge.height / 2, ge.pos[2]]);
        r.draw(this.geyserMesh, m, {
          blend: true, additive: true, unlit: true, depthWrite: false, cull: false,
          opacity: 0.25 * pulse, emissive: [0.2, 0.9, 0.6]
        });
      }
    }

    // ambient particle emission (dust, geyser spray, well wisps)
    ambientParticles(particles, dt, rng) {
      const w = this.world;
      if (w.id === 'moon' || w.gimmick.type === 'gravitywells') return; // airless, no drifting motes here
      if (w.gimmick.type === 'bouncepads') {
        for (let i = 0; i < this.geysers.length; i++) {
          const ge = this.geysers[i];
          if (Math.random() < 0.6) {
            particles.emit({
              p: [ge.pos[0] + (Math.random() - 0.5) * 2, ge.pos[1] + 0.5, ge.pos[2] + (Math.random() - 0.5) * 2],
              v: [0, ge.power * 0.35 * (0.6 + Math.random() * 0.6), 0],
              life: 1.1, size: 0.7, col: [0.3, 1.0, 0.7], drag: 0.6, grav: -ge.power * 0.18
            });
          }
        }
      }
    }

    dispose() {
      const gl = this.r.gl;
      this.meshes.forEach((m) => {
        if (m.position) gl.deleteBuffer(m.position);
        if (m.normal) gl.deleteBuffer(m.normal);
        if (m.color) gl.deleteBuffer(m.color);
        if (m.uv) gl.deleteBuffer(m.uv);
        if (m.index) gl.deleteBuffer(m.index);
      });
      this.textures.forEach((t) => gl.deleteTexture(t));
      this.meshes = []; this.textures = [];
    }
  }

  G.Course = Course;
})(window.GOLF = window.GOLF || {});
