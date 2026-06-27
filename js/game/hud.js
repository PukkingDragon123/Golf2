/* ===========================================================================
 * hud.js  —  In-game heads-up display: hole/par/strokes/coins, the power meter,
 * wind & gravity gauge, club & spin readout, jet charges, a live top-down
 * minimap, the toast line, and on-screen touch controls.
 * =========================================================================== */
(function (G) {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function clubName(loftDeg) {
    if (loftDeg < 16) return 'Driver';
    if (loftDeg < 22) return '3-Wood';
    if (loftDeg < 28) return '5-Iron';
    if (loftDeg < 34) return '7-Iron';
    if (loftDeg < 42) return '9-Iron';
    if (loftDeg < 50) return 'Wedge';
    return 'Lob Wedge';
  }

  const hud = {
    init(game) {
      this.game = game;
      this.mini = $('minimap');
      this.miniCtx = this.mini ? this.mini.getContext('2d') : null;
      // touch controls
      const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      const tc = $('touch-controls');
      if (tc && touch) tc.classList.remove('hidden');
      const bind = (id, name) => { const el = $(id); if (el) game.input.bindButton(el, name); };
      bind('btn-aimL', 'aimL'); bind('btn-aimR', 'aimR');
      bind('btn-loftU', 'loftU'); bind('btn-loftD', 'loftD');
      bind('btn-back', 'backspin'); bind('btn-top', 'topspin');
      bind('btn-curveL', 'curveL'); bind('btn-curveR', 'curveR');
      bind('btn-swing', 'swing');
      const jet = $('btn-jet');
      if (jet) jet.addEventListener('pointerdown', (e) => { e.preventDefault(); game.input.triggerEdge('jet'); });
    },

    update(game) {
      const playing = game.state === 'playing';
      const hudEl = $('hud');
      if (hudEl) hudEl.classList.toggle('hidden', !playing && game.state !== 'holeresult');
      if (!game.course) return;

      // top bar
      this._txt('hud-world', game.world.emoji + ' ' + game.world.name);
      this._txt('hud-hole', 'Hole ' + (game.holeIndex + 1) + '/' + game.world.holes);
      this._txt('hud-par', 'Par ' + game.course.par);
      this._txt('hud-strokes', 'Strokes ' + (game.strokes || 0));
      this._txt('hud-coins', '🪙 ' + G.save.coins);
      this._txt('hud-dist', this._dist(game) + ' m');

      // power meter
      const fill = $('power-fill');
      if (fill) fill.style.height = (game.power * 100).toFixed(0) + '%';
      const pm = $('power-meter');
      if (pm) pm.classList.toggle('charging', game.phase === 'charge');

      // club & spin
      this._txt('hud-club', clubName(game.loft / G.math.DEG) + ' · ' + (game.loft / G.math.DEG).toFixed(0) + '°');
      const sb = game.spinB, ss = game.spinS;
      const spinTxt = (Math.abs(sb) < 0.05 && Math.abs(ss) < 0.05) ? 'Spin: none'
        : 'Spin: ' + (sb > 0.05 ? 'Back ' + (sb * 100 | 0) + '%' : sb < -0.05 ? 'Top ' + (-sb * 100 | 0) + '%' : '') +
        (Math.abs(ss) > 0.05 ? (Math.abs(sb) > 0.05 ? ' · ' : '') + (ss > 0 ? 'Curve R ' : 'Curve L ') + (Math.abs(ss) * 100 | 0) + '%' : '');
      this._txt('hud-spin', spinTxt);

      // jet charges
      const jetEl = $('hud-jet');
      if (jetEl) {
        if (game.stats.jetCharges > 0 && playing) {
          jetEl.classList.remove('hidden');
          jetEl.textContent = '💥 Jet x' + (game.phase === 'watch' ? game.jetRemaining : game.stats.jetCharges) + '  (SPACE in flight)';
        } else jetEl.classList.add('hidden');
      }

      // gravity + wind
      const g = game.world.physics.gravity;
      this._txt('hud-grav', '⬇ ' + (g / 9.81).toFixed(2) + ' G');
      const arrow = $('wind-arrow');
      const w = game.world.physics.wind;
      const airless = (w.base === 0 && w.gust === 0);
      if (arrow) arrow.style.opacity = airless ? '0' : '1';
      if (!airless && arrow) arrow.style.transform = 'rotate(' + (game.windInfo.dir + Math.PI / 2) + 'rad)';
      this._txt('wind-speed', airless ? 'No air' : game.windInfo.speed.toFixed(1) + ' m/s');

      // gimmick label
      this._txt('hud-gimmick', '✦ ' + game.world.gimmickName);

      // toast
      const toastEl = $('toast');
      if (toastEl) {
        if (game.toast) { toastEl.textContent = game.toast.msg; toastEl.classList.add('show'); }
        else toastEl.classList.remove('show');
      }

      this._minimap(game);
    },

    _dist(game) {
      const b = game.ball.pos, h = game.course.holePos;
      return Math.round(Math.hypot(h[0] - b[0], h[2] - b[2]));
    },

    _txt(id, t) { const el = $(id); if (el && el.textContent !== t) el.textContent = t; },

    _minimap(game) {
      const ctx = this.miniCtx; if (!ctx) return;
      const c = game.course, w = this.mini.width, h = this.mini.height;
      const half = c.half;
      const map = (x, z) => [(x / (half * 2) + 0.5) * w, (z / (half * 2) + 0.5) * h];
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(10,16,14,0.55)';
      ctx.fillRect(0, 0, w, h);
      // fairway path
      ctx.strokeStyle = 'rgba(120,210,120,0.8)';
      ctx.lineWidth = Math.max(3, w * 0.05);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < c.path.length; i++) {
        const p = map(c.path[i][0], c.path[i][1]);
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
      // hazards
      c.hazards.forEach((hz) => {
        const p = map(hz.cx, hz.cz);
        ctx.fillStyle = hz.type === 'lava' ? 'rgba(255,90,40,0.8)' : hz.type === 'acid' ? 'rgba(90,230,90,0.8)' : 'rgba(80,150,255,0.8)';
        ctx.beginPath(); ctx.arc(p[0], p[1], hz.r / (half * 2) * w, 0, 7); ctx.fill();
      });
      // tee
      let p = map(c.teePos[0], c.teePos[2]);
      ctx.fillStyle = '#fff'; ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4);
      // hole
      p = map(c.holePos[0], c.holePos[2]);
      ctx.fillStyle = '#ff4455'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill();
      // ball
      p = map(game.ball.pos[0], game.ball.pos[2]);
      ctx.fillStyle = '#ffff66'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill();
      // aim direction
      if (game.phase !== 'watch') {
        const a = game.aimDir();
        ctx.strokeStyle = 'rgba(255,255,120,0.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + a[0] * 14, p[1] + a[2] * 14); ctx.stroke();
      }
    }
  };

  G.hud = hud;
})(window.GOLF = window.GOLF || {});
