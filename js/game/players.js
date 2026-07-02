/* ===========================================================================
 * players.js  —  Party players: colours, hats, ball-skins (some unlockable),
 * names and their custom potato meshes + ball textures.
 * =========================================================================== */
(function (G) {
  'use strict';

  const COLORS = [
    [232, 72, 92], [86, 150, 255], [70, 200, 120], [255, 178, 46],
    [200, 96, 232], [240, 240, 245], [255, 120, 186], [120, 96, 255],
    [255, 205, 70], [60, 255, 170]   // 8 gold, 9 neon (unlockable)
  ];
  const HATS = ['cap', 'beanie', 'none', 'tophat', 'crown', 'antenna', 'wizard', 'party', 'halo'];
  const HAT_LABEL = { cap: '🧢 Cap', beanie: '🎿 Beanie', none: '🚫 None', tophat: '🎩 Top Hat', crown: '👑 Crown', antenna: '🛸 Antenna', wizard: '🧙 Wizard', party: '🥳 Party', halo: '😇 Halo' };
  const BALLS = ['classic', 'stripe', 'beach', 'eyeball', 'galaxy', 'gold', 'eight'];
  const BALL_LABEL = { classic: '⚪ Classic', stripe: '🔴 Stripe', beach: '🏖️ Beach', eyeball: '👁️ Eyeball', galaxy: '🌌 Galaxy', gold: '🏆 Gold', eight: '🎱 8-Ball' };
  const DEFAULT_NAMES = ['Comet', 'Nova', 'Rocket', 'Zorp'];

  function defaults(n) {
    const list = [];
    for (let i = 0; i < n; i++) list.push({
      name: DEFAULT_NAMES[i] || ('P' + (i + 1)),
      colorIdx: i % 8, hat: ['cap', 'beanie', 'cap', 'beanie'][i] || 'cap', ball: 'classic',
      score: 0, result: null, _m: null, _ballTex: null
    });
    return list;
  }

  const color01 = (p) => { const c = COLORS[p.colorIdx]; return [c[0] / 255, c[1] / 255, c[2] / 255]; };
  const colorCss = (p) => { const c = COLORS[p.colorIdx]; return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; };
  const hatId = (p) => p.hat;

  const unlockedColors = () => COLORS.map((_, i) => i).filter((i) => G.save.hasSkin('colors', i));
  const unlockedHats = () => HATS.filter((h) => G.save.hasSkin('hats', h));
  const unlockedBalls = () => BALLS.filter((b) => G.save.hasSkin('balls', b));
  const nextIn = (list, cur) => { const i = list.indexOf(cur); return list[(i + 1) % list.length]; };

  function cycleColor(p) { const u = unlockedColors(); if (!u.length) return; p.colorIdx = nextIn(u, p.colorIdx); }
  function cycleHat(p) { const u = unlockedHats(); if (u.indexOf(p.hat) < 0) p.hat = u[0]; else p.hat = nextIn(u, p.hat); }
  function cycleBall(p) { const u = unlockedBalls(); if (u.indexOf(p.ball) < 0) p.ball = u[0]; else p.ball = nextIn(u, p.ball); }

  function buildBody(renderer, p) {
    freeBody(renderer, p);
    const g = G.decor.golfer(color01(p), hatId(p));
    p._m = {
      lower: renderer.createMesh(g.lower), torso: renderer.createMesh(g.torso),
      arms: renderer.createMesh(g.arms), club: renderer.createMesh(g.club),
      hipY: g.hipY, shoulderLocal: g.shoulderLocal, hand: g.hand
    };
    return p._m;
  }
  function buildBall(renderer, p) { freeBall(renderer, p); p._ballTex = renderer.createTexture(G.textures.ball(p.ball)); return p._ballTex; }
  function buildMeshes(renderer, p) { buildBody(renderer, p); buildBall(renderer, p); return p._m; }
  // Rebuild just what changed — avoids GPU buffer/texture thrash when cycling.
  function rebuildBody(renderer, p) { buildBody(renderer, p); }
  function rebuildBall(renderer, p) { buildBall(renderer, p); }

  function freeBody(renderer, p) {
    const gl = renderer.gl;
    if (p._m) { ['lower', 'torso', 'arms', 'club'].forEach((k) => { const m = p._m[k]; if (m) ['position', 'normal', 'color', 'uv', 'index'].forEach((b) => { if (m[b]) gl.deleteBuffer(m[b]); }); }); p._m = null; }
  }
  function freeBall(renderer, p) { const gl = renderer.gl; if (p._ballTex) { gl.deleteTexture(p._ballTex); p._ballTex = null; } }
  function freeMeshes(renderer, p) { freeBody(renderer, p); freeBall(renderer, p); }

  G.players = {
    COLORS, HATS, HAT_LABEL, BALLS, BALL_LABEL, defaults,
    color01, colorCss, hatId, cycleColor, cycleHat, cycleBall,
    unlockedColors, unlockedHats, unlockedBalls,
    buildMeshes, rebuildBody, rebuildBall, freeMeshes
  };
})(window.GOLF = window.GOLF || {});
