/* ===========================================================================
 * shopscene.js  —  A little rendered 3D "Xeno Gear Emporium": a neon room with
 * a three-eyed alien shopkeeper behind a counter and a glowing pedestal that
 * shows a rotating 3D preview of whatever item you're looking at.
 * =========================================================================== */
(function (G) {
  'use strict';
  const M = G.M, V = G.V, mesh = G.mesh;

  function gridTexture() {
    const s = 256, c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0716'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(90,220,200,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i <= s; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,90,200,0.25)';
    for (let i = 0; i < s; i += 32) for (let j = 0; j < s; j += 32) if ((i + j) % 64 === 0) ctx.fillRect(i, j, 32, 32);
    return c;
  }

  class ShopScene {
    constructor(renderer) {
      this.r = renderer;
      this.time = 0;
      this.meshes = [];
      this.preview = null;
      this.previewSpin = 0;
      this.env = {
        lightDir: V.normalize([0, 0, 0], [0.3, 0.9, 0.5]),
        lightColor: [1.0, 0.95, 1.0], ambient: [0.34, 0.30, 0.44],
        fogColor: [0.10, 0.06, 0.18], fogDensity: 0.028,
        clearColor: [0.06, 0.04, 0.12], specular: 0.4, rim: 0.5
      };
      this._build();
      this.setPreview({ type: 'gizmo', color: [0.5, 0.9, 1.0] });
    }

    _track(m) { this.meshes.push(m); return m; }

    _build() {
      const r = this.r;
      this.gridTex = r.createTexture(gridTexture());
      this.floor = this._track(r.createMesh(mesh.quadGeo(40, 40, [1, 1, 1])));
      this.wall = this._track(r.createMesh(mesh.boxGeo(40, 18, 1, [0.12, 0.08, 0.22])));
      this.counter = this._track(r.createMesh(mesh.boxGeo(7, 1.6, 1.6, [0.30, 0.20, 0.42])));
      this.counterTop = this._track(r.createMesh(mesh.boxGeo(7.4, 0.2, 2.0, [0.5, 0.9, 0.85])));
      this.keeper = this._track(r.createMesh(G.decor.alienShopkeeper()));
      this.pedestal = this._track(r.createMesh(mesh.cylinderGeo(1.2, 1.5, 1.2, 20, [0.2, 0.14, 0.34])));
      this.pedDisc = this._track(r.createMesh(mesh.cylinderGeo(1.25, 1.25, 0.12, 24, [0.5, 1.0, 0.9], false)));
      this.shelf = this._track(r.createMesh(mesh.boxGeo(5, 0.25, 1.2, [0.4, 0.3, 0.55])));
      this.orb = this._track(r.createMesh(mesh.sphereGeo(0.22, 8, 6, [0.6, 1.0, 0.9])));
      this.shelfItem = this._track(r.createMesh(mesh.sphereGeo(0.5, 10, 7, [0.7, 0.6, 0.95])));
      this.sign = this._track(r.createMesh(mesh.boxGeo(7, 1.0, 0.3, [0.9, 0.4, 0.8])));
    }

    setPreview(desc) {
      const r = this.r;
      if (this.preview) {
        const gl = r.gl, m = this.preview.mesh;
        ['position', 'normal', 'color', 'uv', 'index'].forEach((k) => { if (m[k]) gl.deleteBuffer(m[k]); });
      }
      desc = desc || { type: 'gizmo', color: [0.5, 0.9, 1.0] };
      let geo, scale = 1, y = 2.7, emissive = false;
      if (desc.type === 'club') {
        geo = G.decor.clubModel(desc.club, desc.color);
        scale = 0.85; y = 1.7;
      } else if (desc.type === 'ball') {
        geo = mesh.sphereGeo(0.85, 20, 14, [1, 1, 1]);
        const acc = desc.accent || [230, 70, 90];
        const key = acc.join(',');
        if (this._ballTexKey !== key) {
          if (this._ballTex) r.gl.deleteTexture(this._ballTex);
          this._ballTex = r.createTexture(G.textures.ball(acc));
          this._ballTexKey = key;
        }
        y = 2.9;
      } else if (desc.type === 'cart') {
        geo = G.decor.cart(desc.color || [0.9, 0.8, 0.25]);
        scale = 0.5; y = 1.4;
      } else {
        geo = G.decor.gizmo(desc.color || [0.5, 0.9, 1.0]);
        emissive = true; y = 2.9;
      }
      this.preview = { mesh: r.createMesh(geo), scale, y, type: desc.type, color: desc.color, emissive, accent: desc.accent };
    }

    update(dt) { this.time += dt; this.previewSpin += dt * 0.8; }

    placeCamera(camera, time) {
      const a = Math.sin(time * 0.18) * 0.22;
      V.set(camera.position, Math.sin(a) * 9, 3.6, 9.5);
      V.set(camera.target, 0, 2.4, 0.5);
      camera.updateView();
    }

    draw(camera, time) {
      const r = this.r, t = this.time;
      r.beginFrame(camera, this.env);
      const I = M.create();

      // floor
      const fm = M.create();
      M.translate(fm, fm, [0, 0, 0]);
      M.rotateX(fm, fm, -Math.PI / 2);
      M.scale(fm, fm, [1, 1, 1]);
      r.draw(this.floor, fm, { texture: this.gridTex, uvScale: [8, 8], unlit: true, emissive: [0.05, 0.04, 0.08] });

      // back wall + sign + shelves
      const wm = M.create(); M.translate(wm, wm, [0, 8, -6]); r.draw(this.wall, wm, { specular: 0.1, rim: 0.2 });
      const sg = M.create(); M.translate(sg, sg, [0, 6.0, -5.4]);
      r.draw(this.sign, sg, { unlit: true, emissive: [0.7, 0.25, 0.6] });
      for (let i = 0; i < 2; i++) {
        const sh = M.create(); M.translate(sh, sh, [(i === 0 ? -7 : 7), 4.5 - i * 0, -5.2]);
        r.draw(this.shelf, sh, { specular: 0.2 });
        for (let j = -1; j <= 1; j++) {
          const it = M.create();
          M.translate(it, it, [(i === 0 ? -7 : 7) + j * 1.6, 5.2, -5.0]);
          const pulse = 0.4 + 0.4 * Math.sin(t * 2 + i + j);
          r.draw(this.shelfItem, it, { emissive: [0.3 * pulse, 0.5 * pulse, 0.8 * pulse], rim: 0.5 });
        }
      }

      // counter
      const cm = M.create(); M.translate(cm, cm, [0, 0.8, -2.2]); r.draw(this.counter, cm, { specular: 0.2 });
      const ct = M.create(); M.translate(ct, ct, [0, 1.7, -2.2]); r.draw(this.counterTop, ct, { unlit: true, emissive: [0.3, 0.7, 0.65] });

      // shopkeeper (bob + sway)
      const km = M.create();
      M.translate(km, km, [0, 0.05 + Math.sin(t * 1.4) * 0.08, -3.4]);
      M.rotateY(km, km, Math.sin(t * 0.5) * 0.12);
      r.draw(this.keeper, km, { specular: 0.2, rim: 0.6 });

      // pedestal + glowing disc
      const pm = M.create(); M.translate(pm, pm, [0, 0.6, 0.8]); r.draw(this.pedestal, pm, { specular: 0.3, rim: 0.4 });
      const pd = M.create(); M.translate(pd, pd, [0, 1.25 + Math.sin(t * 2) * 0.03, 0.8]);
      r.draw(this.pedDisc, pd, { unlit: true, blend: true, additive: true, depthWrite: false, emissive: [0.25, 0.9, 0.7], cull: false });

      // floating spores
      for (let i = 0; i < 8; i++) {
        const ox = Math.sin(t * 0.6 + i * 1.3) * 5;
        const oy = 2 + ((t * 0.5 + i) % 5);
        const oz = Math.cos(t * 0.4 + i) * 3 - 1;
        const om = M.create(); M.translate(om, om, [ox, oy, oz]);
        r.draw(this.orb, om, { unlit: true, blend: true, additive: true, depthWrite: false, emissive: [0.2, 0.7, 0.6] });
      }

      // the previewed item, rotating above the pedestal
      if (this.preview) {
        const p = this.preview;
        const m = M.create();
        M.translate(m, m, [0, p.y + 1.4 + Math.sin(t * 1.5) * 0.12, 0.8]);
        M.rotateY(m, m, this.previewSpin);
        M.scale(m, m, [p.scale, p.scale, p.scale]);
        const opt = { specular: 0.5, rim: 0.6 };
        if (p.type === 'ball') opt.texture = this._ballTex;
        if (p.emissive) { opt.unlit = true; opt.emissive = [p.color[0] * 0.7, p.color[1] * 0.7, p.color[2] * 0.7]; }
        r.draw(this.preview.mesh, m, opt);
      }
    }
  }

  G.ShopScene = ShopScene;
})(window.GOLF = window.GOLF || {});
