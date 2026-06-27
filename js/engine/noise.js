/* ===========================================================================
 * noise.js  —  Seeded RNG + deterministic value noise / fBm.
 *
 * Every course is generated from an integer seed so a given hole always looks
 * and plays identically. No Math.random() anywhere in world generation.
 * =========================================================================== */
(function (G) {
  'use strict';

  // mulberry32 — tiny, fast, good-enough deterministic PRNG.
  function makeRNG(seed) {
    let a = (seed >>> 0) || 1;
    const rng = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.range = (lo, hi) => lo + (hi - lo) * rng();
    rng.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * rng());
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    // Signed unit value, handy for jitter.
    rng.signed = () => rng() * 2 - 1;
    return rng;
  }

  // Deterministic 2D hash -> [0,1)
  function hash2(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10); // quintic

  // Smooth value noise on an integer lattice. Returns [0,1].
  function valueNoise2(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = fade(x - x0), fy = fade(y - y0);
    const v00 = hash2(x0, y0, seed);
    const v10 = hash2(x0 + 1, y0, seed);
    const v01 = hash2(x0, y0 + 1, seed);
    const v11 = hash2(x0 + 1, y0 + 1, seed);
    const a = v00 + (v10 - v00) * fx;
    const b = v01 + (v11 - v01) * fx;
    return a + (b - a) * fy;
  }

  // Fractal Brownian motion: layered value noise. Returns roughly [0,1].
  function fbm2(x, y, seed, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amp = 0.5, freq = 1.0, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * valueNoise2(x * freq, y * freq, seed + o * 1013);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  // Ridged variant — sharp crests, good for mountains / alien spires.
  function ridged2(x, y, seed, octaves = 4) {
    let amp = 0.5, freq = 1.0, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(valueNoise2(x * freq, y * freq, seed + o * 7919) * 2 - 1);
      sum += amp * n * n;
      norm += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return sum / norm;
  }

  G.makeRNG = makeRNG;
  G.noise = { hash2, valueNoise2, fbm2, ridged2 };
})(window.GOLF = window.GOLF || {});
