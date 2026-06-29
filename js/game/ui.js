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
      click('btn-lobby-back', () => this.show('title'));
      click('btn-add-player', () => this.changeCount(1));
      click('btn-rm-player', () => this.changeCount(-1));
      click('btn-newroom', () => { this.roomCode = genRoom(); this.renderLobby(); });
      click('btn-start-party', () => this.startParty());
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
      const ov = $('overlay'); if (ov) ov.classList.toggle('hidden', !name);
      this.game.paused = (name === 'pause');
      this.game.input.enabled = !name;
      if (name === 'title') { this.game.menuMode = true; this.game.state = 'title'; }
      // re-trigger the bouncy entrance animation
      const cur = name && $('screen-' + name);
      if (cur) { cur.style.animation = 'none'; void cur.offsetWidth; cur.style.animation = ''; }
    },

    /* ----------------------------- lobby --------------------------------- */
    showLobby() {
      if (!this.players) this.players = G.players.defaults(2);
      this.renderLobby();
      this.show('lobby');
    },
    changeCount(d) {
      G.audio.click();
      this.commitNames();
      const n = Math.max(1, Math.min(4, this.players.length + d));
      if (n === this.players.length) return;
      if (n > this.players.length) { const ex = G.players.defaults(n); while (this.players.length < n) this.players.push(ex[this.players.length]); }
      else this.players.length = n;
      this.renderLobby();
    },
    commitNames() {
      document.querySelectorAll('#lobby-players .pname').forEach((el, i) => { if (this.players[i]) this.players[i].name = el.value || ('P' + (i + 1)); });
    },
    renderLobby() {
      this._set('room-code', 'ROOM ' + this.roomCode);
      this._set('lobby-count', this.players.length + ' player' + (this.players.length > 1 ? 's' : ''));
      const rw = $('rounds-row');
      if (rw) { rw.innerHTML = ''; ROUND_OPTS.forEach((n) => { const b = document.createElement('button'); b.className = 'round-opt' + (n === this.rounds ? ' on' : ''); b.textContent = n + ' rounds'; b.addEventListener('click', () => { G.audio.click(); this.rounds = n; this.renderLobby(); }); rw.appendChild(b); }); }
      const wrap = $('lobby-players'); if (!wrap) return;
      wrap.innerHTML = '';
      this.players.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'pcard pop-in';
        card.style.animationDelay = (idx * 0.05) + 's';
        card.style.borderColor = G.players.colorCss(p);
        card.innerHTML =
          (idx === 0 ? '<div class="host-badge">👑 Host</div>' : '') +
          '<div class="pavatar" style="background:' + G.players.colorCss(p) + '">🥔</div>' +
          '<input class="pname" maxlength="10" value="' + (p.name || '').replace(/"/g, '') + '" />' +
          '<div class="prow"><button class="pbtn pcolor">🎨</button><button class="pbtn phat">' + G.players.HAT_LABEL[G.players.hatId(p)] + '</button></div>' +
          '<div class="prow"><button class="pbtn pball wide2">' + G.players.BALL_LABEL[p.ball] + '</button></div>';
        const nameEl = card.querySelector('.pname');
        nameEl.addEventListener('input', () => { p.name = nameEl.value || ('P' + (idx + 1)); });
        card.querySelector('.pcolor').addEventListener('click', () => { G.audio.click(); this.commitNames(); G.players.cycleColor(p); this.renderLobby(); });
        card.querySelector('.phat').addEventListener('click', () => { G.audio.click(); this.commitNames(); G.players.cycleHat(p); this.renderLobby(); });
        card.querySelector('.pball').addEventListener('click', () => { G.audio.click(); this.commitNames(); G.players.cycleBall(p); this.renderLobby(); });
        wrap.appendChild(card);
      });
    },
    startParty() {
      this.commitNames();
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
