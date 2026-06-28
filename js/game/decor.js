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

  // The extraterrestrial golf cart — a cute rounded hover-buggy. Googly eyes are
  // drawn separately (see EYES) so their pupils can wobble. Faces +Z (front).
  function cart(accent) {
    const b = B();
    const body = accent || [0.9, 0.8, 0.25];
    const dark = mul(body, 0.45);
    const metal = [0.74, 0.77, 0.82];
    const glass = [0.45, 0.78, 0.92];
    // hover skirt (rounded, wide)
    b.addGeometry(mesh.cylinderGeo(1.55, 1.35, 0.55, 18, dark), 0, 0.5, 0);
    b.addGeometry(mesh.cylinderGeo(1.5, 1.5, 0.16, 18, mul(metal, 0.6)), 0, 0.84, 0);
    // main rounded body
    b.addGeometry(mesh.cylinderGeo(1.45, 1.5, 0.8, 18, body), 0, 1.3, 0);
    b.addGeometry(mesh.sphereGeo(1.45, 16, 10, mul(body, 1.06)), 0, 1.7, 0);
    // sleek nose
    b.addGeometry(mesh.cylinderGeo(0.5, 1.0, 0.9, 14, mul(body, 1.1)), 0, 1.35, 1.15);
    // face plate (where the eyes sit)
    b.addGeometry(mesh.cylinderGeo(0.95, 0.95, 0.2, 16, [0.96, 0.96, 0.98]), 0, 2.0, 1.18);
    // cabin bubble
    b.addGeometry(mesh.sphereGeo(0.95, 14, 9, glass), 0, 2.35, -0.15);
    // little smile under the eyes
    b.addGeometry(mesh.boxGeo(0.7, 0.12, 0.1, dark), 0, 1.62, 2.0);
    // side fins
    b.addGeometry(mesh.boxGeo(0.15, 0.5, 1.1, mul(body, 0.8)), -1.5, 1.6, -0.6);
    b.addGeometry(mesh.boxGeo(0.15, 0.5, 1.1, mul(body, 0.8)), 1.5, 1.6, -0.6);
    // hover pods at the corners (emissive rings drawn separately under the cart)
    [[-1.2, 1.0], [1.2, 1.0], [-1.2, -1.1], [1.2, -1.1]].forEach((p) => {
      b.addGeometry(mesh.cylinderGeo(0.42, 0.5, 0.35, 10, mul(metal, 0.55)), p[0], 0.42, p[1]);
    });
    // antenna
    b.addGeometry(mesh.cylinderGeo(0.035, 0.035, 1.3, 5, metal), 0.7, 3.0, -0.9);
    b.addGeometry(mesh.sphereGeo(0.15, 8, 6, [0.4, 1, 0.6]), 0.7, 3.7, -0.9);
    // golf bag + clubs at the back
    b.addGeometry(mesh.cylinderGeo(0.26, 0.3, 1.3, 8, [0.75, 0.16, 0.22]), -0.7, 2.1, -1.35);
    [-0.12, 0, 0.12].forEach((dx, i) => {
      b.addGeometry(mesh.cylinderGeo(0.02, 0.02, 1.0, 4, metal), -0.7 + dx, 3.0 + i * 0.04, -1.35);
      b.addGeometry(mesh.sphereGeo(0.09, 5, 4, [0.85, 0.85, 0.9]), -0.7 + dx, 3.5 + i * 0.04, -1.35);
    });
    return b.result();
  }
  // Googly-eye mounts on the cart's face plate (local space, +Z front).
  cart.EYES = [{ x: -0.42, y: 2.05, z: 1.32, r: 0.34 }, { x: 0.42, y: 2.05, z: 1.32, r: 0.34 }];

  /* ------------------------------- golfer -------------------------------- */
  // Detailed articulated golfer for a hierarchical, eased swing. Faces +Z.
  // Returns 4 parts each authored around its own joint pivot, plus the joint
  // offsets the rig composes with:
  //   lower  (feet at y=0 .. hips)         drawn at the golfer base
  //   torso  (hip joint at origin, +Y up)  drawn at base + (0,hipY,0)
  //   arms   (shoulder pivot at origin)    drawn at torso + (0,shoulderLocal,0)
  //   club   (grip pivot at origin)        drawn at arms + hand
  function golfer(accent) {
    const shirt = accent && accent[0] != null ? accent : [0.85, 0.3, 0.35];
    const skin = [0.86, 0.66, 0.52];
    const pants = [0.24, 0.27, 0.36];
    const cap = mul(shirt, 0.92);
    const shoe = [0.11, 0.11, 0.13];
    const glove = [0.92, 0.92, 0.95];
    const belt = [0.14, 0.14, 0.17];
    const hipY = 0.92, shoulderLocal = 0.62;

    // ---- lower body (static): shoes, calves, knees, thighs, hips ----
    const lower = new mesh.Builder();
    [-0.17, 0.17].forEach((x) => {
      lower.addGeometry(mesh.boxGeo(0.3, 0.13, 0.52, shoe), x, 0.07, 0.12);
      lower.addGeometry(mesh.cylinderGeo(0.12, 0.14, 0.4, 9, pants), x, 0.36, 0);   // calf
      lower.addGeometry(mesh.sphereGeo(0.14, 9, 7, pants), x, 0.58, 0);             // knee
      lower.addGeometry(mesh.cylinderGeo(0.15, 0.17, 0.34, 9, pants), x, 0.78, 0);  // thigh
    });
    lower.addGeometry(mesh.cylinderGeo(0.3, 0.32, 0.26, 12, pants), 0, 0.92, 0);    // hips
    lower.addGeometry(mesh.cylinderGeo(0.31, 0.31, 0.08, 14, belt), 0, 0.86, 0);    // belt

    // ---- torso (pivot at hip joint, extends up to head) ----
    const torso = new mesh.Builder();
    torso.addGeometry(mesh.cylinderGeo(0.29, 0.31, 0.34, 12, shirt), 0, 0.18, 0);   // waist
    torso.addGeometry(mesh.cylinderGeo(0.33, 0.29, 0.4, 12, shirt), 0, 0.52, 0);    // chest
    torso.addGeometry(mesh.sphereGeo(0.33, 12, 9, shirt), 0, 0.5, 0);
    torso.addGeometry(mesh.boxGeo(0.66, 0.2, 0.26, mul(shirt, 1.04)), 0, 0.66, 0);  // shoulder yoke
    torso.addGeometry(mesh.cylinderGeo(0.14, 0.16, 0.1, 10, mul(shirt, 0.8)), 0, 0.78, 0); // collar
    torso.addGeometry(mesh.cylinderGeo(0.095, 0.1, 0.16, 8, skin), 0, 0.88, 0);     // neck
    torso.addGeometry(mesh.sphereGeo(0.25, 14, 11, skin), 0, 1.12, 0);              // head
    torso.addGeometry(mesh.boxGeo(0.075, 0.07, 0.09, mul(skin, 0.96)), 0, 1.1, 0.24); // nose
    torso.addGeometry(mesh.sphereGeo(0.27, 14, 8, cap), 0, 1.2, -0.01);             // cap dome
    torso.addGeometry(mesh.boxGeo(0.4, 0.05, 0.28, cap), 0, 1.15, 0.25);            // visor

    // ---- arms + hands (pivot at the shoulders/sternum, hanging down) ----
    const arms = new mesh.Builder();
    [-0.3, 0.3].forEach((x) => {
      arms.addGeometry(mesh.cylinderGeo(0.085, 0.1, 0.36, 8, shirt), x, -0.16, 0.03);  // upper arm
      arms.addGeometry(mesh.sphereGeo(0.095, 8, 6, skin), x, -0.34, 0.06);             // elbow
    });
    [-0.16, 0.16].forEach((x) => {
      arms.addGeometry(mesh.cylinderGeo(0.075, 0.085, 0.42, 8, skin), x, -0.52, 0.14); // forearm
    });
    arms.addGeometry(mesh.sphereGeo(0.11, 9, 7, glove), 0, -0.7, 0.22);                 // gloved hands
    const hand = [0, -0.7, 0.22];

    // ---- club (pivot at the grip, shaft down) ----
    const club = new mesh.Builder();
    club.addGeometry(mesh.cylinderGeo(0.045, 0.052, 0.22, 7, [0.14, 0.14, 0.17]), 0, -0.1, 0); // grip
    club.addGeometry(mesh.cylinderGeo(0.025, 0.032, 0.95, 7, [0.86, 0.87, 0.92]), 0, -0.62, 0.015); // shaft
    club.addGeometry(mesh.boxGeo(0.2, 0.13, 0.1, [0.28, 0.28, 0.32]), 0, -1.12, 0.05);  // head

    return {
      lower: lower.result(), torso: torso.result(), arms: arms.result(), club: club.result(),
      hipY, shoulderLocal, hand
    };
  }

  /* --------------------------- alien shopkeeper -------------------------- */
  // A friendly three-eyed alien clerk. Faces +Z. Bob/sway handled by ShopScene.
  function alienShopkeeper() {
    const b = B();
    const skin = [0.45, 0.85, 0.6];
    const robe = [0.45, 0.25, 0.6];
    const glow = [0.6, 1.0, 0.8];
    // robe / base
    b.addGeometry(mesh.cylinderGeo(0.55, 1.05, 1.7, 14, robe), 0, 0.85, 0);
    b.addGeometry(mesh.cylinderGeo(0.6, 0.6, 0.2, 14, mul(robe, 1.3)), 0, 1.7, 0);
    // body + head
    b.addGeometry(mesh.sphereGeo(0.78, 14, 10, skin), 0, 2.0, 0);
    b.addGeometry(mesh.sphereGeo(0.95, 16, 12, skin), 0, 3.0, 0);
    // three big eyes (white) + pupils, looking forward (+Z)
    [[-0.42, 3.05], [0.0, 3.25], [0.42, 3.05]].forEach((e) => {
      b.addGeometry(mesh.sphereGeo(0.27, 10, 8, [0.98, 0.98, 1.0]), e[0], e[1], 0.72);
      b.addGeometry(mesh.sphereGeo(0.13, 8, 6, [0.05, 0.05, 0.08]), e[0], e[1], 0.93);
    });
    // smile
    b.addGeometry(mesh.boxGeo(0.5, 0.08, 0.08, mul(skin, 0.5)), 0, 2.55, 0.9);
    // antennae with glowing bulbs
    b.addGeometry(mesh.cylinderGeo(0.04, 0.04, 0.7, 5, skin), -0.3, 3.9, 0);
    b.addGeometry(mesh.cylinderGeo(0.04, 0.04, 0.7, 5, skin), 0.3, 3.9, 0);
    b.addGeometry(mesh.sphereGeo(0.14, 8, 6, glow), -0.3, 4.3, 0);
    b.addGeometry(mesh.sphereGeo(0.14, 8, 6, glow), 0.3, 4.3, 0);
    // tentacle arms
    b.addGeometry(mesh.cylinderGeo(0.16, 0.1, 1.2, 8, skin), -0.85, 1.9, 0.2);
    b.addGeometry(mesh.cylinderGeo(0.16, 0.1, 1.2, 8, skin), 0.85, 1.9, 0.2);
    return b.result();
  }

  /* ------------------------- shop preview models ------------------------- */
  // A club standing head-down, for the pedestal preview. type: driver|wedge|putter
  function clubModel(type, accent) {
    const b = B();
    const shaft = [0.82, 0.84, 0.9];
    const grip = [0.15, 0.15, 0.18];
    const head = accent || [0.85, 0.3, 0.35];
    b.addGeometry(mesh.cylinderGeo(0.045, 0.05, 3.0, 8, shaft), 0, 1.7, 0);
    b.addGeometry(mesh.cylinderGeo(0.07, 0.08, 0.8, 8, grip), 0, 3.0, 0);
    if (type === 'driver') {
      b.addGeometry(mesh.sphereGeo(0.42, 12, 9, head), 0.1, 0.25, 0.12);
    } else if (type === 'wedge') {
      b.addGeometry(mesh.boxGeo(0.5, 0.5, 0.16, head), 0.18, 0.22, 0);
    } else { // putter
      b.addGeometry(mesh.boxGeo(0.7, 0.22, 0.28, head), 0.18, 0.16, 0.05);
    }
    return b.result();
  }

  // A glowing abstract upgrade gizmo (core + ring), drawn emissive.
  function gizmo(color) {
    const b = B();
    const c = color || [0.5, 0.9, 1.0];
    b.addGeometry(mesh.sphereGeo(0.55, 14, 10, c), 0, 0, 0);
    b.addGeometry(mesh.cylinderGeo(1.1, 1.1, 0.08, 24, mul(c, 1.2), false), 0, 0, 0);
    b.addGeometry(mesh.cylinderGeo(0.9, 0.9, 0.1, 24, mul(c, 0.8), false), 0, 0, 0);
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

  G.decor = { make, KINDS: Object.keys(KINDS), bouncePad, planet, cart, dino, tree, rock, golfer, alienShopkeeper, clubModel, gizmo };
})(window.GOLF = window.GOLF || {});
