/* ===========================================================================
 * hud.js  —  In-game HUD: top status bar, left club rail (Driver/Wedge/Putter
 * with max-distance), the drag power slider + accuracy skill-check meter,
 * right-side minimap & gravity/wind gauges, gimmick label and toast.
 * =========================================================================== */
(function (G) {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const hud = {
    init(game) {
      this.game = game;
      this.mini = $('minimap');
      this.miniCtx = this.mini ? this.mini.getContext('2d') : null;

      // club rail
      this.clubBtns = Array.prototype.slice.call(document.querySelectorAll('.club-btn'));
      this.clubBtns.forEach((b) => {
        b.addEventListener('click', () => game.selectClub(b.getAttribute('data-club')));
      });

      // power slider — drag up to set power, release to confirm
      const slider = $('power-slider');
      if (slider) {
        const setFromY = (clientY) => {
          const r = slider.getBoundingClientRect();
          game.setPower((r.bottom - clientY) / r.height);
        };
        slider.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (game.phase === 'aim') game.beginPower('pointer');
          if (game.phase === 'power') setFromY(e.clientY);
          try { slider.setPointerCapture(e.pointerId); } catch (err) { }
          this._dragging = true; this._moved = false;
        });
        slider.addEventListener('pointermove', (e) => { if (this._dragging && game.phase === 'power') { this._moved = true; setFromY(e.clientY); } });
        // commit on release; a pure low tap (no drag) cancels instead of firing a weak shot
        const up = () => {
          if (!this._dragging) return;
          this._dragging = false;
          if (!this._moved && game.power < 0.12) game.cancelPower();
          else game.confirmPower();
        };
        slider.addEventListener('pointerup', up);
        slider.addEventListener('pointercancel', up);
      }

      // accuracy bar — tap to stop
      const acc = $('acc-bar');
      if (acc) acc.addEventListener('pointerdown', (e) => { e.preventDefault(); game.lockAccuracy(); });
    },

    update(game) {
      const playing = game.state === 'playing';
      const hudEl = $('hud');
      if (hudEl) hudEl.classList.toggle('hidden', !(playing || game.state === 'holeresult'));
      if (!game.course || game.state === 'shop') return;

      this._txt('hud-world', game.world.emoji + ' ' + game.world.name);
      this._txt('hud-hole', 'Hole ' + (game.holeIndex + 1) + '/' + game.world.holes);
      this._txt('hud-par', 'Par ' + game.course.par);
      this._txt('hud-strokes', 'Strokes ' + (game.strokes || 0));
      this._txt('hud-coins', '🪙 ' + G.save.coins);
      this._txt('hud-dist', this._dist(game) + ' m');

      // club rail
      const eff = game.clubEff();
      this.clubBtns.forEach((b) => b.classList.toggle('on', b.getAttribute('data-club') === game.club));
      this._txt('club-maxdist', 'max ' + game.maxDist + ' m');

      // skill widgets
      const inSwing = game.phase === 'power' || game.phase === 'aim';
      this._show('power-wrap', inSwing);
      this._show('acc-wrap', game.phase === 'accuracy');
      const fill = $('power-fill');
      if (fill) fill.style.height = (game.power * 100).toFixed(0) + '%';
      const ro = $('power-readout');
      if (ro) ro.textContent = game.phase === 'power' ? ('≈ ' + game.projectedDist() + ' m') : (eff.name);
      const slider = $('power-slider');
      if (slider) slider.classList.toggle('charging', game.phase === 'power');
      if (game.phase === 'accuracy') {
        const marker = $('acc-marker');
        if (marker) marker.style.left = ((game.accPos + 1) / 2 * 100).toFixed(1) + '%';
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

      this._txt('hud-gimmick', '✦ ' + game.world.gimmickName);

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
    _show(id, v) { const el = $(id); if (el) el.classList.toggle('hidden', !v); },

    _minimap(game) {
      const ctx = this.miniCtx; if (!ctx) return;
      const c = game.course, w = this.mini.width, h = this.mini.height, half = c.half;
      const map = (x, z) => [(x / (half * 2) + 0.5) * w, (z / (half * 2) + 0.5) * h];
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(10,16,14,0.55)'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,210,120,0.8)'; ctx.lineWidth = Math.max(3, w * 0.05); ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < c.path.length; i++) { const p = map(c.path[i][0], c.path[i][1]); if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
      ctx.stroke();
      c.hazards.forEach((hz) => {
        const p = map(hz.cx, hz.cz);
        ctx.fillStyle = hz.type === 'lava' ? 'rgba(255,90,40,0.8)' : hz.type === 'acid' ? 'rgba(90,230,90,0.8)' : 'rgba(80,150,255,0.8)';
        ctx.beginPath(); ctx.arc(p[0], p[1], hz.r / (half * 2) * w, 0, 7); ctx.fill();
      });
      let p = map(c.teePos[0], c.teePos[2]); ctx.fillStyle = '#fff'; ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4);
      p = map(c.holePos[0], c.holePos[2]); ctx.fillStyle = '#ff4455'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill();
      p = map(game.ball.pos[0], game.ball.pos[2]); ctx.fillStyle = '#ffff66'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill();
      if (game.phase !== 'watch') {
        const a = game.aimDir();
        ctx.strokeStyle = 'rgba(255,255,120,0.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + a[0] * 14, p[1] + a[2] * 14); ctx.stroke();
      }
    }
  };

  G.hud = hud;
})(window.GOLF = window.GOLF || {});
