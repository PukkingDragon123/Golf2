/* ===========================================================================
 * mesh.js  —  Procedural geometry. Everything in the game is generated here;
 * no external model files. Returns plain geometry objects:
 *   { position, normal, color, uv, index }  (typed arrays)
 * which renderer.createMesh() uploads to the GPU.
 * =========================================================================== */
(function (G) {
  'use strict';
  const V = G.V;

  /* ----- A growable builder that merges many primitives into one mesh ----- */
  class Builder {
    constructor() {
      this.pos = []; this.nrm = []; this.col = []; this.uv = []; this.idx = [];
    }
    _vert(p, n, c, u, v) {
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.col.push(c[0], c[1], c[2]);
      this.uv.push(u, v);
      return this.pos.length / 3 - 1;
    }
    addGeometry(geo, ox = 0, oy = 0, oz = 0) {
      const base = this.pos.length / 3;
      const p = geo.position, n = geo.normal, c = geo.color, u = geo.uv;
      for (let i = 0; i < p.length; i += 3) {
        this.pos.push(p[i] + ox, p[i + 1] + oy, p[i + 2] + oz);
        this.nrm.push(n[i], n[i + 1], n[i + 2]);
      }
      for (let i = 0; i < c.length; i++) this.col.push(c[i]);
      for (let i = 0; i < u.length; i++) this.uv.push(u[i]);
      const idx = geo.index;
      for (let i = 0; i < idx.length; i++) this.idx.push(idx[i] + base);
    }
    // Instance a geometry with yaw rotation (Y), uniform scale and translation.
    // tint optionally multiplies the source colors (per-instance variation).
    addGeometryT(geo, tx, ty, tz, scale, yaw, tint) {
      const base = this.pos.length / 3;
      const ca = Math.cos(yaw || 0), sa = Math.sin(yaw || 0);
      const s = scale == null ? 1 : scale;
      const p = geo.position, n = geo.normal, c = geo.color, u = geo.uv;
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i] * s, y = p[i + 1] * s, z = p[i + 2] * s;
        this.pos.push(x * ca + z * sa + tx, y + ty, -x * sa + z * ca + tz);
        const nx = n[i], ny = n[i + 1], nz = n[i + 2];
        this.nrm.push(nx * ca + nz * sa, ny, -nx * sa + nz * ca);
      }
      if (tint) {
        for (let i = 0; i < c.length; i += 3) {
          this.col.push(c[i] * tint[0], c[i + 1] * tint[1], c[i + 2] * tint[2]);
        }
      } else {
        for (let i = 0; i < c.length; i++) this.col.push(c[i]);
      }
      for (let i = 0; i < u.length; i++) this.uv.push(u[i]);
      const idx = geo.index;
      for (let i = 0; i < idx.length; i++) this.idx.push(idx[i] + base);
    }
    get vertexCount() { return this.pos.length / 3; }
    result() {
      const n = this.pos.length / 3;
      const idx = n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx);
      return {
        position: new Float32Array(this.pos),
        normal: new Float32Array(this.nrm),
        color: new Float32Array(this.col),
        uv: new Float32Array(this.uv),
        index: idx
      };
    }
  }

  /* --------------------------------- box --------------------------------- */
  function boxGeo(sx, sy, sz, color) {
    const c = color || [1, 1, 1];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const pos = [], nrm = [], col = [], uv = [], idx = [];
    const faces = [
      { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
      { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
      { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
      { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
      { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] }
    ];
    const uvc = [[0, 0], [1, 0], [1, 1], [0, 1]];
    faces.forEach((f) => {
      const b = pos.length / 3;
      for (let i = 0; i < 4; i++) {
        pos.push(f.v[i][0], f.v[i][1], f.v[i][2]);
        nrm.push(f.n[0], f.n[1], f.n[2]);
        col.push(c[0], c[1], c[2]);
        uv.push(uvc[i][0], uvc[i][1]);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    return geom(pos, nrm, col, uv, idx);
  }

  /* ------------------------------- sphere -------------------------------- */
  function sphereGeo(radius, segU, segV, color) {
    const c = color || [1, 1, 1];
    const pos = [], nrm = [], col = [], uv = [], idx = [];
    for (let y = 0; y <= segV; y++) {
      const v = y / segV;
      const phi = v * Math.PI;          // 0..PI
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (let x = 0; x <= segU; x++) {
        const u = x / segU;
        const theta = u * Math.PI * 2;
        const st = Math.sin(theta), ct = Math.cos(theta);
        const nx = sp * ct, ny = cp, nz = sp * st;
        pos.push(nx * radius, ny * radius, nz * radius);
        nrm.push(nx, ny, nz);
        col.push(c[0], c[1], c[2]);
        uv.push(u, 1 - v);
      }
    }
    const row = segU + 1;
    for (let y = 0; y < segV; y++) {
      for (let x = 0; x < segU; x++) {
        const a = y * row + x, b = a + row;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return geom(pos, nrm, col, uv, idx);
  }

  /* ------------------------------ ellipsoid ------------------------------ */
  // A unit sphere scaled per-axis into a clean ovoid, with an optional taper
  // that narrows the bottom (taper<1) for a potato/pear silhouette. Normals are
  // inverse-scaled + renormalized so lighting stays correct.
  function ellipsoidGeo(rx, ry, rz, segU, segV, color, taper) {
    const g = sphereGeo(1, segU, segV, color);
    const p = g.position, n = g.normal;
    const t = (taper == null) ? 1 : taper;
    for (let i = 0; i < p.length; i += 3) {
      const uy = p[i + 1];                       // unit-sphere y in [-1,1]
      const tw = t + (1 - t) * ((uy + 1) * 0.5); // 1 at top, taper at bottom
      p[i] = p[i] * rx * tw; p[i + 1] = uy * ry; p[i + 2] = p[i + 2] * rz * tw;
      let nx = n[i] / (rx * tw), ny = n[i + 1] / ry, nz = n[i + 2] / (rz * tw);
      const l = Math.hypot(nx, ny, nz) || 1;
      n[i] = nx / l; n[i + 1] = ny / l; n[i + 2] = nz / l;
    }
    return g;
  }

  /* ------------------------------ cylinder ------------------------------- */
  // Along Y axis, centered at origin. rTop/rBottom allow cones & tapers.
  function cylinderGeo(rTop, rBottom, height, seg, color, caps) {
    const c = color || [1, 1, 1];
    const pos = [], nrm = [], col = [], uv = [], idx = [];
    const hy = height / 2;
    for (let y = 0; y <= 1; y++) {
      const r = y === 0 ? rBottom : rTop;
      const py = y === 0 ? -hy : hy;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        pos.push(ca * r, py, sa * r);
        // side normal (ignoring slope for simplicity, good enough visually)
        const nl = Math.hypot(ca, sa) || 1;
        nrm.push(ca / nl, 0.0, sa / nl);
        col.push(c[0], c[1], c[2]);
        uv.push(i / seg, y);
      }
    }
    const row = seg + 1;
    for (let i = 0; i < seg; i++) {
      const a = i, b = i + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    if (caps !== false) {
      // top & bottom fans
      const addCap = (py, r, ny) => {
        const center = pos.length / 3;
        pos.push(0, py, 0); nrm.push(0, ny, 0); col.push(c[0], c[1], c[2]); uv.push(0.5, 0.5);
        const start = pos.length / 3;
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * Math.PI * 2;
          pos.push(Math.cos(a) * r, py, Math.sin(a) * r);
          nrm.push(0, ny, 0); col.push(c[0], c[1], c[2]);
          uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
        }
        for (let i = 0; i < seg; i++) {
          if (ny > 0) idx.push(center, start + i, start + i + 1);
          else idx.push(center, start + i + 1, start + i);
        }
      };
      addCap(hy, rTop, 1);
      addCap(-hy, rBottom, -1);
    }
    return geom(pos, nrm, col, uv, idx);
  }

  /* -------------------------------- quad --------------------------------- */
  // Centered at origin, facing +Z, size w x h, uv 0..1.
  function quadGeo(w, h, color) {
    const c = color || [1, 1, 1];
    const hw = w / 2, hh = h / 2;
    const pos = [-hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0];
    const nrm = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    const col = [c[0], c[1], c[2], c[0], c[1], c[2], c[0], c[1], c[2], c[0], c[1], c[2]];
    const uv = [0, 0, 1, 0, 1, 1, 0, 1];
    const idx = [0, 1, 2, 0, 2, 3];
    return geom(pos, nrm, col, uv, idx);
  }

  /* ------------------------------ terrain -------------------------------- */
  // size: world units (square from -size/2..size/2 in X and Z)
  // res:  cells per side; vertices = (res+1)^2
  // heightFn(x,z) -> y ;  colorFn(x,z,y,nrm) -> [r,g,b]
  function buildTerrain(opts) {
    const size = opts.size, res = opts.res;
    const hf = opts.heightFn, cf = opts.colorFn;
    const uvTile = opts.uvTile || 1;
    const n = res + 1;
    const half = size / 2;
    const step = size / res;
    const pos = new Float32Array(n * n * 3);
    const nrm = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    const eps = step * 0.5;
    let pi = 0, ni = 0, ci = 0, ui = 0;
    for (let j = 0; j < n; j++) {
      const z = -half + j * step;
      for (let i = 0; i < n; i++) {
        const x = -half + i * step;
        const y = hf(x, z);
        // analytic normal via central differences
        const hl = hf(x - eps, z), hr = hf(x + eps, z);
        const hd = hf(x, z - eps), hu = hf(x, z + eps);
        let nx = hl - hr, ny = 2 * eps, nz = hd - hu;
        const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
        nx *= inv; ny *= inv; nz *= inv;
        pos[pi++] = x; pos[pi++] = y; pos[pi++] = z;
        nrm[ni++] = nx; nrm[ni++] = ny; nrm[ni++] = nz;
        const c = cf(x, z, y, nx, ny, nz);
        col[ci++] = c[0]; col[ci++] = c[1]; col[ci++] = c[2];
        uv[ui++] = (x + half) / size * uvTile;
        uv[ui++] = (z + half) / size * uvTile;
      }
    }
    const idx = new Uint32Array(res * res * 6); // may exceed 65535 verts
    let k = 0;
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const a = j * n + i, b = a + n;
        idx[k++] = a; idx[k++] = b; idx[k++] = a + 1;
        idx[k++] = a + 1; idx[k++] = b; idx[k++] = b + 1;
      }
    }
    return { position: pos, normal: nrm, color: col, uv: uv, index: idx, _uint32: true };
  }

  function geom(pos, nrm, col, uv, idx) {
    return {
      position: new Float32Array(pos),
      normal: new Float32Array(nrm),
      color: new Float32Array(col),
      uv: new Float32Array(uv),
      index: new Uint16Array(idx)
    };
  }

  G.mesh = { Builder, boxGeo, sphereGeo, ellipsoidGeo, cylinderGeo, quadGeo, buildTerrain, geom };
})(window.GOLF = window.GOLF || {});
