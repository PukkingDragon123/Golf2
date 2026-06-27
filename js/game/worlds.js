/* ===========================================================================
 * worlds.js  —  The five themed courses. Each is a data object describing its
 * physics, palette, lighting, sky and signature gimmick. course.js turns this
 * data (plus a seed) into actual geometry; physics.js reads the physics block.
 *
 * Colors: env lights / palettes are 0..1 floats; sky colors are 0..255.
 * Gravity is m/s^2. airDensity is relative to Earth (1.0).
 * =========================================================================== */
(function (G) {
  'use strict';
  const V = G.V;
  const norm = (v) => V.normalize([0, 0, 0], v);

  const WORLDS = {
    earth: {
      id: 'earth', name: 'Verdant Links', emoji: '🌍',
      tagline: 'Classic turf, gentle breeze, water you do not want to find.',
      gimmickName: 'Crosswinds & Water',
      gimmickHint: 'Read the wind arrow before every swing — and keep it dry.',
      holes: 3, seedBase: 1000,
      physics: {
        gravity: 9.81, airDensity: 1.0,
        wind: { base: 1.6, gust: 2.4 },
        restitution: 0.34, friction: 0.46, rollFriction: 0.95
      },
      gimmick: { type: 'classic' },
      palette: {
        fairway: [0.30, 0.60, 0.24], rough: [0.20, 0.44, 0.18], green: [0.38, 0.74, 0.32],
        sand: [0.84, 0.76, 0.52], dirt: [0.46, 0.35, 0.22], hazardTint: [0.25, 0.55, 0.85]
      },
      decor: { kinds: ['tree', 'tree', 'bush', 'rock'], density: 0.9 },
      hazard: 'water',
      terrain: { amp: 2.2, freq: 0.05, octaves: 4, ridged: 0 },
      env: {
        lightDir: norm([0.45, 0.82, 0.35]), lightColor: [1.0, 0.97, 0.88],
        ambient: [0.42, 0.47, 0.52], fogColor: [0.74, 0.85, 0.93], fogDensity: 0.0040,
        clearColor: [0.74, 0.85, 0.93], specular: 0.25, rim: 0.15
      },
      sky: {
        seed: 11, zenith: [62, 120, 205], horizon: [188, 214, 236], nadir: [120, 150, 120],
        sun: [1.1, 0.7, [255, 245, 215], 60], clouds: true
      },
      ambient: { intensity: 0.05, tone: 600 }
    },

    moon: {
      id: 'moon', name: 'Lunar Links', emoji: '🌙',
      tagline: 'One-sixth gravity and no air. Your drives go forever — and so do mistakes.',
      gimmickName: 'Low Gravity & Craters',
      gimmickHint: 'Tiny taps fly miles in 1/6 g. Beware the crater bowls.',
      holes: 3, seedBase: 2000,
      physics: {
        gravity: 1.62, airDensity: 0.02,
        wind: { base: 0, gust: 0 },
        restitution: 0.24, friction: 0.55, rollFriction: 0.62
      },
      gimmick: { type: 'lowgrav', craters: 5 },
      palette: {
        fairway: [0.56, 0.57, 0.60], rough: [0.40, 0.40, 0.43], green: [0.52, 0.64, 0.62],
        sand: [0.66, 0.66, 0.68], dirt: [0.34, 0.34, 0.37], hazardTint: [0.2, 0.2, 0.25]
      },
      decor: { kinds: ['rock', 'rock', 'crystal'], density: 0.5 },
      hazard: 'none',
      terrain: { amp: 1.7, freq: 0.055, octaves: 4, ridged: 0.2 },
      env: {
        lightDir: norm([0.4, 0.7, 0.55]), lightColor: [1.0, 1.0, 0.98],
        ambient: [0.14, 0.16, 0.22], fogColor: [0.02, 0.02, 0.05], fogDensity: 0.0010,
        clearColor: [0.02, 0.02, 0.05], specular: 0.1, rim: 0.35
      },
      sky: {
        seed: 22, zenith: [2, 2, 8], horizon: [10, 10, 26], nadir: [6, 6, 12],
        sun: [1.4, 0.9, [255, 255, 255], 30], stars: 720,
        planet: { az: 4.2, el: 0.7, r: 70, colorA: [90, 150, 235], colorB: [30, 70, 150] }
      },
      ambient: { intensity: 0.0, tone: 200 }
    },

    dino: {
      id: 'dino', name: 'Jurassic Fairway', emoji: '🦕',
      tagline: 'Thick prehistoric air drags every shot down. Mind the lava — and the locals.',
      gimmickName: 'Dense Air, Lava & Roaming Dinos',
      gimmickHint: 'Heavy air kills carry — swing big. Dinosaurs nudge a ball that strays.',
      holes: 3, seedBase: 3000,
      physics: {
        gravity: 9.81, airDensity: 1.7,
        wind: { base: 1.0, gust: 3.0 },
        restitution: 0.30, friction: 0.50, rollFriction: 1.15
      },
      gimmick: { type: 'denseair', dinos: 3, lava: true },
      palette: {
        fairway: [0.26, 0.50, 0.20], rough: [0.16, 0.34, 0.14], green: [0.34, 0.62, 0.26],
        sand: [0.5, 0.42, 0.26], dirt: [0.40, 0.30, 0.18], hazardTint: [0.9, 0.35, 0.1]
      },
      decor: { kinds: ['palm', 'fern', 'mushroom', 'rock', 'tree'], density: 1.3 },
      hazard: 'lava',
      terrain: { amp: 3.0, freq: 0.045, octaves: 5, ridged: 0.15 },
      env: {
        lightDir: norm([0.5, 0.7, 0.25]), lightColor: [1.0, 0.9, 0.72],
        ambient: [0.40, 0.42, 0.34], fogColor: [0.56, 0.60, 0.46], fogDensity: 0.0072,
        clearColor: [0.56, 0.60, 0.46], specular: 0.2, rim: 0.18
      },
      sky: {
        seed: 33, zenith: [110, 138, 150], horizon: [205, 182, 138], nadir: [80, 70, 50],
        sun: [1.0, 0.55, [255, 220, 170], 70], clouds: true
      },
      ambient: { intensity: 0.07, tone: 420 }
    },

    solar: {
      id: 'solar', name: 'Orbital Open', emoji: '🪐',
      tagline: 'Golf among the planets. Gravity wells bend your ball; the void keeps what falls.',
      gimmickName: 'Gravity Wells & The Void',
      gimmickHint: 'Curving past a planet? Let its pull do the work. Off the edge = lost ball.',
      holes: 3, seedBase: 4000,
      physics: {
        gravity: 3.4, airDensity: 0.0,
        wind: { base: 0, gust: 0 },
        restitution: 0.46, friction: 0.40, rollFriction: 0.78
      },
      gimmick: { type: 'gravitywells', wells: 3, void: true },
      palette: {
        fairway: [0.20, 0.58, 0.54], rough: [0.14, 0.40, 0.40], green: [0.32, 0.82, 0.72],
        sand: [0.5, 0.5, 0.6], dirt: [0.22, 0.26, 0.34], hazardTint: [0.4, 0.5, 0.9]
      },
      decor: { kinds: ['crystal', 'pylon', 'rock'], density: 0.6 },
      hazard: 'void',
      terrain: { amp: 1.4, freq: 0.06, octaves: 4, ridged: 0.0, platform: true },
      env: {
        lightDir: norm([0.35, 0.65, 0.6]), lightColor: [1.0, 1.0, 1.0],
        ambient: [0.18, 0.18, 0.27], fogColor: [0.02, 0.02, 0.07], fogDensity: 0.0016,
        clearColor: [0.02, 0.02, 0.07], specular: 0.35, rim: 0.4
      },
      sky: {
        seed: 44, zenith: [2, 2, 14], horizon: [10, 6, 26], nadir: [4, 2, 14],
        sun: [1.2, 0.8, [255, 250, 230], 40], stars: 820,
        nebula: [[120, 60, 200], [40, 120, 210], [210, 80, 170]],
        planet: { az: 3.4, el: 0.5, r: 56, colorA: [220, 150, 90], colorB: [120, 70, 40] }
      },
      ambient: { intensity: 0.0, tone: 200 }
    },

    alien: {
      id: 'alien', name: 'Xeno Country Club', emoji: '👽',
      tagline: 'Springy bio-turf, launch-pad fungi and updraft geysers under twin suns.',
      gimmickName: 'Bounce Pads & Updrafts',
      gimmickHint: 'The turf is a trampoline. Ride the geysers; trust the mushrooms.',
      holes: 3, seedBase: 5000,
      physics: {
        gravity: 6.0, airDensity: 0.7,
        wind: { base: 1.0, gust: 2.0 },
        restitution: 0.70, friction: 0.35, rollFriction: 0.82
      },
      gimmick: { type: 'bouncepads', pads: 5, geysers: 3 },
      palette: {
        fairway: [0.50, 0.26, 0.60], rough: [0.34, 0.18, 0.46], green: [0.40, 0.85, 0.72],
        sand: [0.6, 0.5, 0.7], dirt: [0.30, 0.18, 0.36], hazardTint: [0.4, 0.9, 0.4]
      },
      decor: { kinds: ['mushroom', 'crystal', 'alienplant', 'crystal'], density: 1.1 },
      hazard: 'acid',
      terrain: { amp: 3.2, freq: 0.06, octaves: 4, ridged: 0.35 },
      env: {
        lightDir: norm([0.45, 0.7, 0.4]), lightColor: [0.92, 0.82, 1.0],
        ambient: [0.30, 0.27, 0.42], fogColor: [0.40, 0.24, 0.50], fogDensity: 0.0056,
        clearColor: [0.40, 0.24, 0.50], specular: 0.4, rim: 0.5
      },
      sky: {
        seed: 55, zenith: [56, 18, 92], horizon: [188, 92, 156], nadir: [60, 24, 70],
        sun: [1.0, 0.6, [255, 200, 160], 52], sun2: [3.6, 0.45, [150, 200, 255], 36],
        stars: 220, nebula: [[160, 60, 200], [60, 180, 200]]
      },
      ambient: { intensity: 0.06, tone: 520 }
    }
  };

  const ORDER = ['earth', 'moon', 'dino', 'solar', 'alien'];

  G.WORLDS = WORLDS;
  G.WORLD_ORDER = ORDER;
  G.nextWorld = function (id) {
    const i = ORDER.indexOf(id);
    return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
  };
})(window.GOLF = window.GOLF || {});
