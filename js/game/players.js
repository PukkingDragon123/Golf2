/* ===========================================================================
 * players.js  —  Party players: colours, hats, names, and their custom golfer
 * meshes. Up to 4 local players take turns on one device.
 * =========================================================================== */
(function (G) {
  'use strict';

  const COLORS = [
    [232, 72, 92], [86, 150, 255], [70, 200, 120], [255, 178, 46],
    [200, 96, 232], [240, 240, 245], [255, 120, 186], [120, 96, 255]
  ];
  const HATS = ['cap', 'beanie', 'tophat', 'crown', 'antenna', 'none'];
  const HAT_LABEL = { cap: '🧢 Cap', beanie: '🎿 Beanie', tophat: '🎩 Top Hat', crown: '👑 Crown', antenna: '🛸 Antenna', none: '🚫 None' };
  const DEFAULT_NAMES = ['Comet', 'Nova', 'Rocket', 'Zorp'];

  function defaults(n) {
    const list = [];
    for (let i = 0; i < n; i++) list.push({
      name: DEFAULT_NAMES[i] || ('P' + (i + 1)),
      colorIdx: i % COLORS.length,
      hatIdx: i % HATS.length,
      score: 0, result: null, _m: null
    });
    return list;
  }

  function color01(p) { const c = COLORS[p.colorIdx]; return [c[0] / 255, c[1] / 255, c[2] / 255]; }
  function colorCss(p) { const c = COLORS[p.colorIdx]; return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function hatId(p) { return HATS[p.hatIdx]; }

  // (Re)build a player's golfer meshes; frees previous ones.
  function buildMeshes(renderer, p) {
    freeMeshes(renderer, p);
    const g = G.decor.golfer(color01(p), hatId(p));
    p._m = {
      lower: renderer.createMesh(g.lower), torso: renderer.createMesh(g.torso),
      arms: renderer.createMesh(g.arms), club: renderer.createMesh(g.club),
      hipY: g.hipY, shoulderLocal: g.shoulderLocal, hand: g.hand
    };
    return p._m;
  }
  function freeMeshes(renderer, p) {
    if (!p._m) return;
    const gl = renderer.gl;
    ['lower', 'torso', 'arms', 'club'].forEach((k) => {
      const m = p._m[k];
      if (m) ['position', 'normal', 'color', 'uv', 'index'].forEach((b) => { if (m[b]) gl.deleteBuffer(m[b]); });
    });
    p._m = null;
  }

  G.players = { COLORS, HATS, HAT_LABEL, defaults, color01, colorCss, hatId, buildMeshes, freeMeshes };
})(window.GOLF = window.GOLF || {});
