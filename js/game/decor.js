/* ===========================================================================
 * decor.js  —  Low-poly props built from primitives. Each returns a geometry
 * (origin at the base, +Y up) ready to be instanced into a scenery mesh or
 * drawn on its own. Colours are tinted per-world by the caller.
 * =========================================================================== */
(function (G) {
  'use strict';
  const mesh = G.mesh;
  const B = () => new mesh.Builder();

  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  /* --------------------------- vegetation --------------------------------- */
  function tree(pal) {
    const b = B();
    const bark = [0.34, 0.24, 0.15];
    const leaf = pal.green ? mul(pal.green, 0.85) : [0.2, 0.5, 0.2];
    b.addGeometry(mesh.cylinderGeo(0.22, 0.36, 2.4, 7, bark), 0, 1.2, 0);
    b.addGeometry(mesh.sphereGeo(1.5, 8, 6, leaf), 0, 3.0, 0);
    b.addGeometry(mesh.sphereGeo(1.15, 8, 6, mul(leaf, 1.12)), 0.5, 3.9, 0.3);
    b.addGeometry(mesh.sphereGeo(1.0, 8, 6, mul(leaf, 0.9)), -0.5, 3.7, -0.2);
    return b.result();
  }
  function bush(pal) {
    const b = B();
    const leaf = pal.green ? mul(pal.green, 0.8) : [0.2, 0.45, 0.2];
    b.addGeometry(mesh.sphereGeo(0.8, 7, 5, leaf), 0, 0.6, 0);
    b.addGeometry(mesh.sphereGeo(0.6, 7, 5, mul(leaf, 1.1)), 0.55, 0.5, 0.2);
    b.addGeometry(mesh.sphereGeo(0.55, 7, 5, mul(leaf, 0.9)), -0.45, 0.45, -0.3);
    return b.result();
  }
  function palm(pal) {
    const b = B();
    const bark = [0.42, 0.32, 0.18];
    const leaf = [0.18, 0.46, 0.18];
    for (let i = 0; i < 5; i++) b.addGeometry(mesh.cylinderGeo(0.18, 0.26, 0.9, 6, bark), 0, 0.45 + i * 0.85, 0);
    const frond = mesh.boxGeo(0.35, 0.12, 3.2, leaf);
    for (let i = 0; i < 7; i++) {
      const yaw = (i / 7) * Math.PI * 2;
      b.addGeometryT(frond, Math.cos(yaw) * 1.4, 4.6, Math.sin(yaw) * 1.4, 1, yaw, [1, 1, 1]);
    }
    b.addGeometry(mesh.sphereGeo(0.3, 6, 5, [0.5, 0.4, 0.2]), 0, 4.4, 0);
    return b.result();
  }
  function fern(pal) {
    const b = B();
    const leaf = pal.green ? mul(pal.green, 0.7) : [0.16, 0.4, 0.16];
    const blade = mesh.boxGeo(0.18, 1.4, 0.55, leaf);
    for (let i = 0; i < 6; i++) {
      const yaw = (i / 6) * Math.PI * 2 + 0.3;
      b.addGeometryT(blade, Math.cos(yaw) * 0.3, 0.7, Math.sin(yaw) * 0.3, 1, yaw, [1, 1, 1]);
    }
    return b.result();
  }
  function rock(pal) {
    const b = B();
    const base = pal.dirt ? pal.dirt : [0.45, 0.45, 0.47];
    b.addGeometry(mesh.sphereGeo(1.0, 6, 4, mul(base, 1.0)), 0, 0.5, 0);
    b.addGeometry(mesh.sphereGeo(0.7, 5, 4, mul(base, 0.85)), 0.8, 0.35, 0.4);
    b.addGeometry(mesh.sphereGeo(0.55, 5, 4, mul(base, 1.1)), -0.6, 0.3, -0.5);
    return b.result();
  }
  function mushroom(pal) {
    const b = B();
    const cap = pal.green ? [0.85, 0.3, 0.4] : [0.85, 0.3, 0.4];
    b.addGeometry(mesh.cylinderGeo(0.3, 0.4, 1.2, 7, [0.92, 0.9, 0.82]), 0, 0.6, 0);
    b.addGeometry(mesh.sphereGeo(1.0, 9, 5, cap), 0, 1.3, 0);
    return b.result();
  }
  function crystal(pal) {
    const b = B();
    const c = pal.green ? mul(pal.green, 1.1) : [0.5, 0.8, 1.0];
    for (let i = 0; i < 3; i++) {
      const yaw = i * 2.1;
      const h = 1.4 + i * 0.6;
      const g = mesh.cylinderGeo(0.0, 0.32, h, 6, c, false);
      b.addGeometryT(g, Math.cos(yaw) * 0.35, h / 2, Math.sin(yaw) * 0.35, 1, yaw, [1, 1, 1]);
    }
    return b.result();
  }
  function pylon(pal) {
    const b = B();
    const c = [0.6, 0.85, 1.0];
    b.addGeometry(mesh.boxGeo(0.6, 4.0, 0.6, mul(c, 0.4)), 0, 2.0, 0);
    b.addGeometry(mesh.boxGeo(0.3, 4.2, 0.3, c), 0, 2.1, 0);
    b.addGeometry(mesh.sphereGeo(0.4, 8, 6, [1, 1, 1]), 0, 4.4, 0);
    return b.result();
  }
  function alienplant(pal) {
    const b = B();
    const stem = pal.fairway ? mul(pal.fairway, 1.1) : [0.5, 0.3, 0.6];
    const pod = [0.4, 0.95, 0.8];
    b.addGeometry(mesh.cylinderGeo(0.15, 0.3, 2.0, 6, stem), 0, 1.0, 0);
    b.addGeometry(mesh.sphereGeo(0.6, 9, 6, pod), 0, 2.2, 0);
    b.addGeometry(mesh.sphereGeo(0.32, 7, 5, pod), 0.5, 1.5, 0.2);
    b.addGeometry(mesh.sphereGeo(0.28, 7, 5, pod), -0.4, 1.2, -0.3);
    return b.result();
  }

  const KINDS = { tree, bush, palm, fern, rock, mushroom, crystal, pylon, alienplant };
  function make(kind, pal) { return (KINDS[kind] || rock)(pal); }

  /* ----------------------------- functional props ------------------------- */
  // Glowing bounce-pad mushroom (drawn with emissive at draw time).
  function bouncePad() {
    const b = B();
    b.addGeometry(mesh.cylinderGeo(0.7, 0.9, 0.8, 10, [0.85, 0.85, 0.95]), 0, 0.4, 0);
    b.addGeometry(mesh.sphereGeo(1.7, 12, 7, [0.3, 1.0, 0.7]), 0, 1.1, 0);
    return b.result();
  }
  // A floating planet (sphere + optional ring), drawn with rim light + emissive.
  function planet(r, colorA, colorB, ring) {
    const b = B();
    b.addGeometry(mesh.sphereGeo(r, 20, 14, colorA), 0, 0, 0);
    // a few darker patches via overlaid translucent? keep simple — second tint band
    b.addGeometry(mesh.sphereGeo(r * 0.7, 16, 10, colorB), r * 0.2, r * 0.25, r * 0.1);
    if (ring) {
      const rg = mesh.cylinderGeo(r * 2.0, r * 2.0, 0.05, 28, ring, false);
      b.addGeometry(rg, 0, 0, 0);
      const rg2 = mesh.cylinderGeo(r * 1.45, r * 1.45, 0.06, 28, mul(ring, 0.7), false);
      b.addGeometry(rg2, 0, 0, 0);
    }
    return b.result();
  }

  // The extraterrestrial golf cart — a chunky hover buggy with a club bag.
  function cart(accent) {
    const b = B();
    const body = accent || [0.85, 0.78, 0.2];
    const dark = mul(body, 0.5);
    const metal = [0.7, 0.72, 0.78];
    const glass = [0.4, 0.7, 0.85];
    // lower hull
    b.addGeometry(mesh.boxGeo(2.0, 0.5, 3.4, dark), 0, 0.7, 0);
    // main body
    b.addGeometry(mesh.boxGeo(1.9, 0.6, 3.0, body), 0, 1.1, 0);
    // nose taper
    b.addGeometry(mesh.boxGeo(1.5, 0.45, 0.8, mul(body, 1.1)), 0, 1.05, 1.9);
    // seat
    b.addGeometry(mesh.boxGeo(1.5, 0.5, 0.9, dark), 0, 1.5, -0.4);
    b.addGeometry(mesh.boxGeo(1.5, 0.8, 0.2, dark), 0, 1.8, -0.9);
    // canopy pillars + roof
    [[-0.8, 1.3], [0.8, 1.3], [-0.8, -0.6], [0.8, -0.6]].forEach((p) => {
      b.addGeometry(mesh.cylinderGeo(0.08, 0.08, 1.2, 6, metal), p[0], 2.1, p[1]);
    });
    b.addGeometry(mesh.boxGeo(2.0, 0.18, 2.4, mul(body, 0.9)), 0, 2.75, 0.2);
    // windshield
    b.addGeometry(mesh.boxGeo(1.6, 0.7, 0.08, glass), 0, 1.9, 1.45);
    // hover pods (dark; an emissive ring is drawn separately under the cart)
    [[-1.0, 1.3], [1.0, 1.3], [-1.0, -1.3], [1.0, -1.3]].forEach((p) => {
      b.addGeometry(mesh.cylinderGeo(0.45, 0.5, 0.4, 10, mul(metal, 0.6)), p[0], 0.45, p[1]);
    });
    // headlights
    b.addGeometry(mesh.sphereGeo(0.16, 6, 5, [1, 1, 0.85]), -0.55, 1.1, 2.25);
    b.addGeometry(mesh.sphereGeo(0.16, 6, 5, [1, 1, 0.85]), 0.55, 1.1, 2.25);
    // antenna
    b.addGeometry(mesh.cylinderGeo(0.03, 0.03, 1.4, 5, metal), 0.8, 3.4, -1.0);
    b.addGeometry(mesh.sphereGeo(0.14, 7, 5, [0.4, 1, 0.6]), 0.8, 4.15, -1.0);
    // golf bag + clubs at the back
    b.addGeometry(mesh.cylinderGeo(0.28, 0.3, 1.3, 8, [0.7, 0.15, 0.2]), -0.6, 2.1, -1.55);
    [-0.12, 0, 0.12].forEach((dx, i) => {
      b.addGeometry(mesh.cylinderGeo(0.02, 0.02, 1.0, 4, metal), -0.6 + dx, 3.0 + i * 0.05, -1.55);
      b.addGeometry(mesh.sphereGeo(0.09, 5, 4, [0.85, 0.85, 0.9]), -0.6 + dx, 3.5 + i * 0.05, -1.55);
    });
    return b.result();
  }

  // A long-necked dinosaur, base at the feet.
  function dino(pal) {
    const b = B();
    const skin = [0.32, 0.42, 0.26];
    const belly = [0.45, 0.5, 0.35];
    // body
    const body = mesh.sphereGeo(1.6, 12, 9, skin);
    b.addGeometryT(body, 0, 2.6, 0, 1, 0, [1, 1, 1]);
    // scale body long via extra spheres
    b.addGeometry(mesh.sphereGeo(1.3, 10, 8, belly), 0, 2.3, 0.8);
    b.addGeometry(mesh.sphereGeo(1.2, 10, 8, skin), 0, 2.6, -0.9);
    // neck
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      b.addGeometry(mesh.sphereGeo(0.6 - t * 0.18, 8, 6, skin), 0, 3.2 + i * 0.7, 1.4 + i * 0.55);
    }
    // head
    b.addGeometry(mesh.sphereGeo(0.5, 8, 6, skin), 0, 6.4, 3.6);
    b.addGeometry(mesh.boxGeo(0.4, 0.3, 0.7, mul(skin, 1.1)), 0, 6.3, 4.0);
    // tail
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      b.addGeometry(mesh.sphereGeo(0.7 - t * 0.5, 7, 5, skin), 0, 2.6 - t * 0.8, -1.6 - i * 0.7);
    }
    // legs
    [[-0.8, 0.7], [0.8, 0.7], [-0.8, -0.7], [0.8, -0.7]].forEach((p) => {
      b.addGeometry(mesh.cylinderGeo(0.35, 0.45, 2.0, 7, mul(skin, 0.9)), p[0], 1.0, p[1]);
    });
    return b.result();
  }

  G.decor = { make, KINDS: Object.keys(KINDS), bouncePad, planet, cart, dino, tree, rock };
})(window.GOLF = window.GOLF || {});
