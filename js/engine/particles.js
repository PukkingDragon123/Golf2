/* ===========================================================================
 * particles.js  —  CPU particle pool rendered as camera-facing additive quads
 * in a single dynamic draw. Used for dust, sparkles, jet flame, splashes,
 * gravity-well wisps, hole confetti, etc.
 * =========================================================================== */
(function (G) {
  'use strict';
  const V = G.V;

  function softSprite() {
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return cv;
  }

  class Particles {
    constructor(renderer, max = 600) {
      this.r = renderer;
      this.gl = renderer.gl;
      this.max = max;
      this.pool = [];
      for (let i = 0; i < max; i++) {
        this.pool.push({ p: [0, 0, 0], v: [0, 0, 0], a: [0, 0, 0], life: 0, maxLife: 1, size: 1, col: [1, 1, 1], drag: 0, grav: 0, alive: false });
      }
      this.tex = renderer.createTexture(softSprite(), { mipmap: true, repeat: false });

      const gl = this.gl;
      this.cpuPos = new Float32Array(max * 4 * 3);
      this.cpuCol = new Float32Array(max * 4 * 3);
      const uv = new Float32Array(max * 4 * 2);
      const idx = new Uint16Array(max * 6);
      const nrm = new Float32Array(max * 4 * 3);
      for (let i = 0; i < max; i++) {
        const u = i * 8;
        uv[u] = 0; uv[u + 1] = 0; uv[u + 2] = 1; uv[u + 3] = 0;
        uv[u + 4] = 1; uv[u + 5] = 1; uv[u + 6] = 0; uv[u + 7] = 1;
        const b = i * 4, k = i * 6;
        idx[k] = b; idx[k + 1] = b + 1; idx[k + 2] = b + 2;
        idx[k + 3] = b; idx[k + 4] = b + 2; idx[k + 5] = b + 3;
        for (let q = 0; q < 4; q++) nrm[(b + q) * 3 + 2] = 1;
      }
      const mk = (data, t, usage) => { const buf = gl.createBuffer(); gl.bindBuffer(t, buf); gl.bufferData(t, data, usage); return buf; };
      this.mesh = {
        position: mk(this.cpuPos, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW),
        color: mk(this.cpuCol, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW),
        uv: mk(uv, gl.ARRAY_BUFFER, gl.STATIC_DRAW),
        normal: mk(nrm, gl.ARRAY_BUFFER, gl.STATIC_DRAW),
        index: mk(idx, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW),
        indexType: gl.UNSIGNED_SHORT,
        count: 0
      };
      this._model = G.M.create();
    }

    _free() {
      for (let i = 0; i < this.max; i++) if (!this.pool[i].alive) return this.pool[i];
      return null;
    }

    emit(o) {
      const p = this._free();
      if (!p) return;
      p.alive = true;
      p.p[0] = o.p[0]; p.p[1] = o.p[1]; p.p[2] = o.p[2];
      p.v[0] = o.v ? o.v[0] : 0; p.v[1] = o.v ? o.v[1] : 0; p.v[2] = o.v ? o.v[2] : 0;
      p.a[0] = 0; p.a[1] = o.grav != null ? o.grav : 0; p.a[2] = 0;
      p.life = p.maxLife = o.life || 1;
      p.size = o.size || 0.4;
      p.col[0] = o.col ? o.col[0] : 1; p.col[1] = o.col ? o.col[1] : 1; p.col[2] = o.col ? o.col[2] : 1;
      p.drag = o.drag != null ? o.drag : 1.2;
      p.grav = o.grav != null ? o.grav : 0;
      p.grow = o.grow || 0;
    }

    burst(pos, count, o) {
      o = o || {};
      const rng = o.rng || Math.random;
      for (let i = 0; i < count; i++) {
        const spd = (o.speed || 2) * (0.4 + rng() * 0.8);
        const theta = rng() * Math.PI * 2;
        const phi = (o.cone != null ? o.cone : Math.PI) * rng();
        const dir = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
        if (o.up) { const t = dir[1]; dir[1] = Math.abs(t) + 0.2; }
        this.emit({
          p: pos,
          v: [dir[0] * spd + (o.vx || 0), dir[1] * spd + (o.vy || 0), dir[2] * spd + (o.vz || 0)],
          life: (o.life || 0.8) * (0.6 + rng() * 0.8),
          size: (o.size || 0.4) * (0.6 + rng() * 0.8),
          col: o.col || [1, 1, 1],
          drag: o.drag != null ? o.drag : 1.5,
          grav: o.grav != null ? o.grav : -4,
          grow: o.grow || 0
        });
      }
    }

    update(dt) {
      for (let i = 0; i < this.max; i++) {
        const p = this.pool[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; continue; }
        p.v[1] += p.grav * dt;
        const d = Math.max(0, 1 - p.drag * dt);
        p.v[0] *= d; p.v[1] *= d; p.v[2] *= d;
        p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt;
        if (p.grow) p.size += p.grow * dt;
      }
    }

    draw(camera) {
      const v = camera.view;
      const right = [v[0], v[4], v[8]];
      const up = [v[1], v[5], v[9]];
      let n = 0;
      const pos = this.cpuPos, col = this.cpuCol;
      for (let i = 0; i < this.max; i++) {
        const p = this.pool[i];
        if (!p.alive) continue;
        const f = Math.min(1, p.life / p.maxLife);
        const s = p.size * 0.5;
        const rx = right[0] * s, ry = right[1] * s, rz = right[2] * s;
        const ux = up[0] * s, uy = up[1] * s, uz = up[2] * s;
        const cx = p.p[0], cy = p.p[1], cz = p.p[2];
        const o = n * 12;
        // four corners: -r-u, +r-u, +r+u, -r+u
        pos[o] = cx - rx - ux; pos[o + 1] = cy - ry - uy; pos[o + 2] = cz - rz - uz;
        pos[o + 3] = cx + rx - ux; pos[o + 4] = cy + ry - uy; pos[o + 5] = cz + rz - uz;
        pos[o + 6] = cx + rx + ux; pos[o + 7] = cy + ry + uy; pos[o + 8] = cz + rz + uz;
        pos[o + 9] = cx - rx + ux; pos[o + 10] = cy - ry + uy; pos[o + 11] = cz - rz + uz;
        const cr = p.col[0] * f, cg = p.col[1] * f, cb = p.col[2] * f;
        for (let q = 0; q < 4; q++) {
          const co = o + q * 3;
          col[co] = cr; col[co + 1] = cg; col[co + 2] = cb;
        }
        n++;
      }
      if (n === 0) { this.mesh.count = 0; return; }
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.position);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.cpuPos.subarray(0, n * 12));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.color);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.cpuCol.subarray(0, n * 12));
      this.mesh.count = n * 6;
      G.M.identity(this._model);
      this.r.draw(this.mesh, this._model, {
        texture: this.tex, unlit: true, blend: true, additive: true,
        depthWrite: false, cull: false
      });
    }

    clear() { for (let i = 0; i < this.max; i++) this.pool[i].alive = false; }
  }

  G.Particles = Particles;
})(window.GOLF = window.GOLF || {});
