/* ===========================================================================
 * ui.js  —  Party flow: title, lobby (room code + host + rounds + customisation),
 * achievements, round intro/results, podium, how-to and pause. Bouncy screens.
 * =========================================================================== */
(function (G) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const SCREENS = ['title', 'lobby', 'ach', 'roundintro', 'roundresult', 'podium', 'howto', 'pause'];
  const ROUND_OPTS = [3, 5, 7];

  function genRoom() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 3; i++) s += a[Math.floor(Math.random() * a.length)]; return s + (100 + Math.floor(Math.random() * 900)); }

  const ui = {
    init(game) {
      this.game = game;
      this.players = null;
      this.rounds = 5;
      this.roomCode = genRoom();
      const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { G.audio.click(); fn(); }); };

      click('btn-play', () => this.showLobby());
      click('btn-howto', () => this.show('howto'));
      click('btn-ach', () => this.showAch());
      click('btn-howto-back', () => this.show('title'));
      click('btn-ach-back', () => this.show('title'));
      click('btn-lobby-back', () => { this.game.exitStudio(); this.show('title'); });
      click('btn-add-player', () => this.changeCount(1));
      click('btn-rm-player', () => this.changeCount(-1));
      click('btn-newroom', () => { this.roomCode = genRoom(); this.renderStudio(); });
      click('btn-start-party', () => this.startParty());

      // live name editing for the active studio potato
      const nameEl = $('studio-name');
      if (nameEl) nameEl.addEventListener('input', () => { const p = this._active(); if (!p) return; p.name = nameEl.value || ('P' + (this.activeStudio + 1)); const np = $('studio-nameplate'), nn = np && np.querySelector('.np-name'); if (nn) nn.textContent = p.name; });

      // Ball Dash tap-pads (separate DOM elements → real multi-touch)
      const pads = $('race-pads');
      if (pads) Array.prototype.forEach.call(pads.querySelectorAll('.race-pad'), (pad) => {
        const idx = parseInt(pad.getAttribute('data-idx'), 10);
        const tap = (e) => { e.preventDefault(); this.game.raceTap(idx); pad.classList.add('hit'); };
        const off = () => pad.classList.remove('hit');
        pad.addEventListener('pointerdown', tap);
        pad.addEventListener('pointerup', off);
        pad.addEventListener('pointercancel', off);
        pad.addEventListener('pointerleave', off);
      });
      click('btn-ri-go', () => { this.show(null); this.game.startRoundTurns(); });
      click('btn-rr-next', () => { this.show(null); this.game.nextRound(); });
      click('btn-podium-again', () => this.showLobby());
      click('btn-podium-menu', () => { this.game.endParty(); this.show('title'); });
      click('btn-pause', () => this.showPause());
      click('btn-resume', () => this.resume());
      click('btn-quit', () => { this.game.endParty(); this.show('title'); });

      const mute = $('btn-mute');
      if (mute) { const sync = () => mute.textContent = G.save.settings.muted ? '🔇' : '🔊'; sync(); mute.addEventListener('click', () => { const m = !G.save.settings.muted; G.save.setSetting('muted', m); G.audio.setMuted(m); sync(); }); }

      window.addEventListener('keydown', (e) => { if (e.code === 'Escape') { if (this.game.state === 'play') this.showPause(); else if (this.current === 'pause') this.resume(); } });

      this.show('title');
    },

    show(name) {
      this.current = name;
      SCREENS.forEach((s) => { const el = $('screen-' + s); if (el) el.classList.toggle('hidden', s !== name); });
      const ov = $('overlay'); if (ov) { ov.classList.toggle('hidden', !name); ov.classList.toggle('clear', name === 'lobby'); }
      this.game.paused = (name === 'pause');
      this.game.input.enabled = !name;
      if (name === 'title') { this.game.menuMode = true; this.game.state = 'title'; }
      // re-trigger the bouncy entrance animation
      const cur = name && $('screen-' + name);
      if (cur) { cur.style.animation = 'none'; void cur.offsetWidth; cur.style.animation = ''; }
    },

    /* --------------------- lobby: live character studio ------------------ */
    showLobby() {
      if (!this.players) this.players = G.players.defaults(2);
      this.activeStudio = Math.min(this.activeStudio || 0, this.players.length - 1);
      this.game.enterStudio(this.players, this.activeStudio);
      this.renderStudio();
      this.show('lobby');
    },
    _active() { return this.players ? this.players[this.activeStudio] : null; },
    changeCount(d) {
      G.audio.click();
      const n = Math.max(1, Math.min(4, this.players.length + d));
      if (n === this.players.length) return;
      if (n > this.players.length) { const ex = G.players.defaults(4); while (this.players.length < n) this.players.push(ex[this.players.length]); }
      else { for (let i = n; i < this.players.length; i++) G.players.freeMeshes(this.game.r, this.players[i]); this.players.length = n; }
      this.activeStudio = Math.min(this.activeStudio, n - 1);
      this.game.enterStudio(this.players, this.activeStudio);   // build any new meshes + clamp
      this.renderStudio();
    },
    renderStudio() {
      const P = G.players, p = this._active(); if (!p) return;
      this._set('room-code', 'ROOM ' + this.roomCode);
      this._set('lobby-count', this.players.length + ' player' + (this.players.length > 1 ? 's' : ''));
      const np = $('studio-nameplate');
      if (np) { np.innerHTML = (this.activeStudio === 0 ? '<span class="np-host">👑</span> ' : '') + '<span class="np-name"></span>'; np.querySelector('.np-name').textContent = p.name || ''; np.style.color = P.colorCss(p); }
      const nameEl = $('studio-name'); if (nameEl && document.activeElement !== nameEl) nameEl.value = p.name || '';
      if (nameEl) nameEl.style.borderColor = P.colorCss(p);
      // player tabs
      const tabs = $('player-tabs');
      if (tabs) {
        tabs.innerHTML = '';
        this.players.forEach((pl, i) => {
          const b = document.createElement('button');
          b.className = 'ptab' + (i === this.activeStudio ? ' on' : '');
          b.style.background = P.colorCss(pl);
          b.innerHTML = (i === 0 ? '👑 ' : '') + '<span>' + (pl.name || ('P' + (i + 1))) + '</span>';
          b.addEventListener('click', () => { G.audio.click(); this.activeStudio = i; this.game.setStudioPlayer(i); this.renderStudio(); });
          tabs.appendChild(b);
        });
      }
      // colour swatches (all 10, locked greyed)
      const cg = $('pick-colors');
      if (cg) {
        cg.innerHTML = '';
        P.COLORS.forEach((c, idx) => {
          const unlocked = G.save.hasSkin('colors', idx);
          const s = document.createElement('button');
          s.className = 'swatch2' + (idx === p.colorIdx ? ' on' : '') + (unlocked ? '' : ' locked');
          s.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
          if (!unlocked) s.textContent = '🔒';
          if (unlocked) s.addEventListener('click', () => { if (p.colorIdx === idx) return; p.colorIdx = idx; this.game.studioReact('body'); this.renderStudio(); });
          cg.appendChild(s);
        });
      }
      this._chips('pick-hats', P.HATS, P.HAT_LABEL, 'hats', p.hat, (id) => { p.hat = id; this.game.studioReact('body'); this.renderStudio(); });
      this._chips('pick-balls', P.BALLS, P.BALL_LABEL, 'balls', p.ball, (id) => { p.ball = id; this.game.studioReact('ball'); this.renderStudio(); });
      const rw = $('rounds-row');
      if (rw) { rw.innerHTML = ''; ROUND_OPTS.forEach((n) => { const b = document.createElement('button'); b.className = 'round-opt' + (n === this.rounds ? ' on' : ''); b.textContent = n; b.addEventListener('click', () => { G.audio.click(); this.rounds = n; this.renderStudio(); }); rw.appendChild(b); }); }
    },
    _chips(hostId, list, labels, bucket, cur, onpick) {
      const host = $(hostId); if (!host) return;
      host.innerHTML = '';
      list.forEach((id) => {
        const unlocked = G.save.hasSkin(bucket, id);
        const b = document.createElement('button');
        b.className = 'chip2' + (id === cur ? ' on' : '') + (unlocked ? '' : ' locked');
        b.textContent = (unlocked ? '' : '🔒 ') + labels[id];
        if (unlocked) b.addEventListener('click', () => { if (id === cur) return; G.audio.click(); onpick(id); });
        host.appendChild(b);
      });
    },
    startParty() {
      this.game.roundsTotal = this.rounds;
      this.show(null);
      this.game.startParty(this.players);
    },

    /* -------------------------- achievements ----------------------------- */
    showAch() {
      const list = $('ach-list');
      if (list) {
        list.innerHTML = '';
        G.achievements.progress().forEach((a) => {
          const el = document.createElement('div');
          el.className = 'ach-row' + (a.earned ? ' earned' : '');
          el.innerHTML = '<span class="ach-ico">' + (a.earned ? a.icon : '🔒') + '</span>' +
            '<div class="ach-body"><div class="ach-name">' + a.name + '</div><div class="ach-desc">' + a.desc + '</div></div>' +
            '<span class="ach-rew">' + a.rewards.join('<br>') + '</span>';
          list.appendChild(el);
        });
      }
      this.show('ach');
    },

    /* --------------------------- round screens --------------------------- */
    showRoundIntro(d) {
      this._set('ri-round', 'Round ' + d.round + ' / ' + d.total);
      this._set('ri-game', d.game.emoji + ' ' + d.game.name);
      this._set('ri-blurb', d.game.blurb);
      this._set('ri-map', 'on ' + d.map.emoji + ' ' + d.map.name);
      this._set('ri-gimmick', '✦ ' + d.map.gimmickName);
      this.show('roundintro');
    },
    showRoundResult(d) {
      this._set('rr-title', d.game.emoji + ' ' + d.game.name + ' — Results');
      const list = $('rr-list');
      if (list) {
        list.innerHTML = '';
        d.ranking.forEach((row, i) => {
          const medal = ['🥇', '🥈', '🥉', '4️⃣'][i] || '';
          const el = document.createElement('div'); el.className = 'rr-row pop-in'; el.style.animationDelay = (i * 0.07) + 's';
          el.innerHTML = '<span class="rr-rank">' + medal + '</span><span class="rr-name" style="color:' + row.color + '">' + row.name + '</span><span class="rr-val">' + row.value + '</span><span class="rr-pts">+' + row.points + '</span><span class="rr-tot">' + row.total + '</span>';
          list.appendChild(el);
        });
      }
      const btn = $('btn-rr-next'); if (btn) btn.textContent = (d.round >= d.total) ? 'Final Results →' : 'Next Round →';
      this.show('roundresult');
    },
    showPodium(d) {
      const w = d.standings[0];
      this._set('podium-winner', '👑 ' + (w ? w.name : '') + ' wins!');
      const wel = $('podium-winner'); if (wel && w) wel.style.color = w.color;
      const list = $('podium-list');
      if (list) {
        list.innerHTML = '';
        d.standings.forEach((row, i) => {
          const medal = ['🥇', '🥈', '🥉', '4️⃣'][i] || '';
          const el = document.createElement('div'); el.className = 'rr-row pop-in'; el.style.animationDelay = (i * 0.1) + 's';
          el.innerHTML = '<span class="rr-rank">' + medal + '</span><span class="rr-name" style="color:' + row.color + '">' + row.name + '</span><span class="rr-tot big">' + row.score + ' pts</span>';
          list.appendChild(el);
        });
      }
      const un = $('podium-unlocks');
      if (un) un.innerHTML = (d.unlocked && d.unlocked.length) ? ('🏆 Unlocked: ' + d.unlocked.map((u) => u.icon + ' ' + u.name).join(' · ')) : '';
      this.show('podium');
    },

    showPause() { if (this.game.state === 'play') this.show('pause'); },
    resume() { this.show(null); this.game.paused = false; this.game.input.enabled = true; this.game._camSnap = true; },

    _set(id, t) { const el = $(id); if (el) el.textContent = t; },
    onEvent(type, data) {
      if (type === 'roundintro') this.showRoundIntro(data);
      else if (type === 'roundresult') this.showRoundResult(data);
      else if (type === 'podium') this.showPodium(data);
    }
  };

  G.ui = ui;
})(window.GOLF = window.GOLF || {});
