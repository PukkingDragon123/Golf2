/* ===========================================================================
 * textures.js  —  Procedurally drawn textures (Canvas2D). No image files, so
 * the game stays self-contained and free of file:// cross-origin tainting.
 * All canvases are power-of-two so REPEAT + mipmaps work in WebGL1.
 * Returns <canvas> elements ready for renderer.createTexture().
 * =========================================================================== */
(function (G) {
  'use strict';

  function cv(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }
  const hex = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

  // Subtle near-white grayscale speckle that MULTIPLIES over terrain vertex
  // colors to add surface grain without recoloring. `rough` = contrast.
  function groundDetail(seed, rough) {
    const s = 256, c = cv(s), ctx = c.getContext('2d');
    const img = ctx.createImageData(s, s);
    const d = img.data;
    const rng = G.makeRNG(seed || 7);
    const nz = (x, y) => G.noise.fbm2(x * 0.06, y * 0.06, seed || 7, 4);
    rough = rough != null ? rough : 0.18;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = nz(x, y);
        const grain = (rng() - 0.5) * 0.10;
        let v = 1 - rough * 0.5 + (n - 0.5) * rough + grain;
        v = Math.max(0.55, Math.min(1.15, v));
        const g = Math.min(255, v * 255);
        const i = (y * s + x) * 4;
        d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Golf ball: bright white, dimple grid, a colored equator stripe + dot.
  function ball(accent) {
    const s = 256, c = cv(s), ctx = c.getContext('2d');
    ctx.fillStyle = '#f6f7f3';
    ctx.fillRect(0, 0, s, s);
    // dimples
    ctx.fillStyle = 'rgba(150,160,150,0.30)';
    const step = 18;
    for (let y = 0; y < s; y += step) {
      for (let x = 0; x < s; x += step) {
        const ox = (Math.floor(y / step) % 2) * step / 2;
        ctx.beginPath();
        ctx.arc(x + ox, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // accent stripe near the seam (u≈0.5)
    const a = accent || [230, 70, 90];
    ctx.fillStyle = hex(a[0], a[1], a[2]);
    ctx.fillRect(s * 0.47, 0, s * 0.06, s);
    ctx.beginPath();
    ctx.arc(s * 0.25, s * 0.5, 14, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  // Tiling translucent water surface (used as a moving plane, low alpha).
  function water(tint) {
    const s = 256, c = cv(s), ctx = c.getContext('2d');
    const t = tint || [40, 120, 180];
    ctx.fillStyle = hex(t[0], t[1], t[2]);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const x = (G.noise.hash2(i, 1, 5)) * s;
      const y = (G.noise.hash2(i, 2, 5)) * s;
      const a = 0.05 + G.noise.hash2(i, 3, 5) * 0.12;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + G.noise.hash2(i, 4, 5) * 18, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }

  // Tiling lava with glowing cracks (drawn emissive in the world).
  function lava() {
    const s = 256, c = cv(s), ctx = c.getContext('2d');
    const img = ctx.createImageData(s, s);
    const d = img.data;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = G.noise.fbm2(x * 0.04, y * 0.04, 99, 5);
        const cell = Math.abs(G.noise.valueNoise2(x * 0.03, y * 0.03, 12) - n);
        const heat = Math.pow(1 - Math.min(1, cell * 3.2), 2);
        const i = (y * s + x) * 4;
        d[i] = 60 + heat * 195;
        d[i + 1] = 18 + heat * 120;
        d[i + 2] = 10 + heat * 20;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Equirectangular sky. style: {zenith, horizon, nadir, sun:[az,el,color,size],
  //   sun2, stars, nebula:[colors], clouds:bool}
  function sky(style) {
    const w = 1024, h = 512;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const Z = style.zenith, Hc = style.horizon, Nd = style.nadir || style.horizon;

    // vertical gradient: top=zenith, middle=horizon, bottom=nadir
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hex(Z[0], Z[1], Z[2]));
    grad.addColorStop(0.5, hex(Hc[0], Hc[1], Hc[2]));
    grad.addColorStop(0.62, hex(Hc[0], Hc[1], Hc[2]));
    grad.addColorStop(1, hex(Nd[0], Nd[1], Nd[2]));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const rng = G.makeRNG(style.seed || 42);

    if (style.nebula) {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 26; i++) {
        const col = style.nebula[i % style.nebula.length];
        const x = rng() * w, y = rng() * h * 0.7;
        const r = 60 + rng() * 200;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.22)`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    if (style.stars) {
      for (let i = 0; i < (style.stars | 0); i++) {
        const x = rng() * w, y = rng() * h * 0.78;
        const b = 0.35 + rng() * 0.65;
        const sz = rng() < 0.94 ? 1 : 2;
        ctx.fillStyle = `rgba(255,255,255,${b})`;
        ctx.fillRect(x, y, sz, sz);
      }
    }

    if (style.clouds) {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 30; i++) {
        const x = rng() * w, y = h * (0.42 + rng() * 0.16);
        const r = 40 + rng() * 110;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.10 + rng() * 0.14;
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    const drawSun = (sun) => {
      if (!sun) return;
      const az = sun[0], el = sun[1], col = sun[2], size = sun[3] || 60;
      const x = ((az / (Math.PI * 2)) % 1 + 1) % 1 * w;
      const y = (0.5 - el / (Math.PI / 2) * 0.5) * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 3.2);
      g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},1)`);
      g.addColorStop(0.16, `rgba(${col[0]},${col[1]},${col[2]},0.95)`);
      g.addColorStop(0.4, `rgba(${col[0]},${col[1]},${col[2]},0.25)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - size * 3.2, y - size * 3.2, size * 6.4, size * 6.4);
      ctx.fillStyle = `rgba(255,255,255,0.95)`;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
      ctx.fill();
    };
    drawSun(style.sun);
    drawSun(style.sun2);

    // A faint big planet/earth in the sky if requested
    if (style.planet) {
      const p = style.planet; // {az,el,r,colorA,colorB}
      const x = ((p.az / (Math.PI * 2)) % 1 + 1) % 1 * w;
      const y = (0.5 - p.el / (Math.PI / 2) * 0.5) * h;
      const g = ctx.createRadialGradient(x - p.r * 0.3, y - p.r * 0.3, p.r * 0.2, x, y, p.r);
      g.addColorStop(0, hex(p.colorA[0], p.colorA[1], p.colorA[2]));
      g.addColorStop(1, hex(p.colorB[0], p.colorB[1], p.colorB[2]));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
      // simple cloud swirls
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(x + (rng() - 0.5) * p.r, y + (rng() - 0.5) * p.r, p.r * 0.5, p.r * 0.12, rng(), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    return c;
  }

  G.textures = { groundDetail, ball, water, lava, sky };
})(window.GOLF = window.GOLF || {});
