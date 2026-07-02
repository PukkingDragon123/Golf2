/* ===========================================================================
 * hud.js  —  In-game party HUD: round/minigame banner, whose turn it is, live
 * standings, the drag power gauge, minimap and gravity/wind, plus the toast.
 * =========================================================================== */
(function (G) {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const hud = {
    init(game) {
      this.game = game;
      this.mini = $('minimap');
      this.miniCtx = this.mini ? this.mini.getContext('2d') : null;
    },

    update(game) {
      const playing = game.state === 'play';
      const race = playing && game.mode === 'race';
      const hudEl = $('hud'); if (hudEl) hudEl.classList.toggle('hidden', !playing || race);
      const raceEl = $('race-ui'); if (raceEl) raceEl.classList.toggle('hidden', !race);
      if (race) { this._race(game); return; }
      if (!playing || !game.course) return;
      const mg = game.miniGame(), p = game.activePlayer();

      this._txt('hud-round', 'Round ' + (game.roundIdx + 1) + '/' + game.partyRounds.length + ' · ' + mg.emoji + ' ' + mg.name);
      const pn = $('hud-player');
      if (pn && p) { pn.textContent = '🏌️ ' + p.name; pn.style.color = G.players.colorCss(p); }
      const sEl = $('hud-strokes');
      if (sEl) {
        if (game.mode === 'holerush') { sEl.classList.remove('hidden'); sEl.textContent = 'Swings ' + game.strokes; }
        else if (game.mode === 'starsmash') { sEl.classList.remove('hidden'); sEl.textContent = '⭐ ' + (game._starCount || 0); }
        else if (game.mode === 'twoshot') { sEl.classList.remove('hidden'); sEl.textContent = 'Shot ' + Math.min(2, (game._shotsThisTurn || 0) + 1) + '/2'; }
        else sEl.classList.add('hidden');
      }

      // standings
      const st = $('standings');
      if (st) {
        st.innerHTML = '';
        game.players.forEach((pl, i) => {
          const row = document.createElement('div');
          row.className = 'st-row' + (i === game.activeIdx ? ' active' : '');
          row.innerHTML = '<span class="st-dot" style="background:' + G.players.colorCss(pl) + '"></span>' +
            '<span class="st-name">' + pl.name + '</span><span class="st-score">' + pl.score + '</span>';
          st.appendChild(row);
        });
      }

      // power gauge (during drag) + projected distance
      const pw = $('power-bar');
      if (pw) {
        const show = game.phase === 'drag';
        pw.classList.toggle('hidden', !show);
        if (show) { $('power-fill').style.width = (game.power * 100).toFixed(0) + '%'; $('power-label').textContent = 'POWER ' + (game.power * 100 | 0) + '%  ·  ≈ ' + game._projDist + ' m'; }
      }
      const hint = $('drag-hint');
      if (hint) hint.classList.toggle('hidden', game.phase !== 'aim');

      // gauges
      const b = game.ball.pos, h = game.course.holePos;
      this._txt('hud-dist', Math.round(Math.hypot(h[0] - b[0], h[2] - b[2])) + ' m to pin');
      this._txt('hud-grav', '⬇ ' + (game.world.physics.gravity / 9.81).toFixed(2) + ' G');
      const arrow = $('wind-arrow'), w = game.world.physics.wind, airless = (w.base === 0 && w.gust === 0);
      if (arrow) { arrow.style.opacity = airless ? '0' : '1'; if (!airless) arrow.style.transform = 'rotate(' + (game.windInfo.dir + Math.PI / 2) + 'rad)'; }
      this._txt('wind-speed', airless ? 'No air' : game.windInfo.speed.toFixed(1) + ' m/s');
      this._txt('hud-gimmick', '✦ ' + game.world.gimmickName);

      const toastEl = $('toast');
      if (toastEl) { if (game.toast) { toastEl.textContent = game.toast.msg; toastEl.classList.add('show'); } else toastEl.classList.remove('show'); }

      this._minimap(game);
    },

    _txt(id, t) { const el = $(id); if (el && el.textContent !== t) el.textContent = t; },

    _race(game) {
      const cd = $('race-count');
      if (cd) {
        let show = false, txt = '';
        if (game.raceState === 'countdown') { const n = Math.min(3, Math.ceil(game._raceCountdown)); if (n >= 1) { txt = String(n); show = true; } else { txt = 'GO!'; show = true; } }
        else if (game.raceState === 'run' && game._raceT < 0.7) { txt = 'GO!'; show = true; }
        cd.classList.toggle('hidden', !show);
        if (show && cd.textContent !== txt) { cd.textContent = txt; cd.style.animation = 'none'; void cd.offsetWidth; cd.style.animation = ''; }
      }
      const bars = $('race-bars');
      if (bars) {
        if (bars._n !== game.players.length) {
          bars.innerHTML = ''; bars._n = game.players.length;
          game.players.forEach(() => { const row = document.createElement('div'); row.className = 'race-bar'; row.innerHTML = '<span class="rb-name"></span><div class="rb-track"><div class="rb-fill"></div></div><span class="rb-pos"></span>'; bars.appendChild(row); });
        }
        const ranks = game.racers ? game.racers.slice().sort((a, b) => b.pos - a.pos) : [];
        game.players.forEach((p, i) => {
          const row = bars.children[i], rc = game.racers ? game.racers[i] : null;
          const frac = rc ? Math.min(1, rc.pos / 20) : 0;
          const nm = row.querySelector('.rb-name'); nm.textContent = p.name; nm.style.color = G.players.colorCss(p);
          const f = row.querySelector('.rb-fill'); f.style.width = (frac * 100).toFixed(0) + '%'; f.style.background = G.players.colorCss(p);
          const pos = row.querySelector('.rb-pos'); pos.textContent = rc && rc.finishT != null ? '✓' : (rc ? ('#' + (ranks.indexOf(rc) + 1)) : '');
        });
      }
      const pads = $('race-pads');
      if (pads) {
        for (let i = 0; i < 4; i++) {
          const pad = pads.children[i]; if (!pad) continue;
          const on = i < game.players.length;
          pad.classList.toggle('hidden', !on);
          if (on) { pad.style.background = G.players.colorCss(game.players[i]); const lbl = pad.querySelector('.pad-name'); if (lbl && lbl.textContent !== game.players[i].name) lbl.textContent = game.players[i].name; }
        }
      }
      const toastEl = $('toast'); if (toastEl) { if (game.toast) { toastEl.textContent = game.toast.msg; toastEl.classList.add('show'); } else toastEl.classList.remove('show'); }
    },

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
      c.hazards.forEach((hz) => { const p = map(hz.cx, hz.cz); ctx.fillStyle = hz.type === 'lava' ? 'rgba(255,90,40,0.8)' : hz.type === 'acid' ? 'rgba(90,230,90,0.8)' : 'rgba(80,150,255,0.8)'; ctx.beginPath(); ctx.arc(p[0], p[1], hz.r / (half * 2) * w, 0, 7); ctx.fill(); });
      let p = map(c.teePos[0], c.teePos[2]); ctx.fillStyle = '#fff'; ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4);
      p = map(c.holePos[0], c.holePos[2]); ctx.fillStyle = '#ff4455'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill();
      p = map(game.ball.pos[0], game.ball.pos[2]); ctx.fillStyle = '#ffff66'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill();
      if (game.phase === 'aim' || game.phase === 'drag') { const a = game.aimDir(); ctx.strokeStyle = 'rgba(255,255,120,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + a[0] * 16, p[1] + a[2] * 16); ctx.stroke(); }
    }
  };

  G.hud = hud;
})(window.GOLF = window.GOLF || {});
