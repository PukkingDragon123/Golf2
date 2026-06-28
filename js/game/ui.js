/* ===========================================================================
 * ui.js  —  Party screen flow: title, player setup (names/colours/hats), round
 * intro, round results, the winner podium, how-to and pause.
 * =========================================================================== */
(function (G) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const SCREENS = ['title', 'setup', 'roundintro', 'roundresult', 'podium', 'howto', 'pause'];

  const ui = {
    init(game) {
      this.game = game;
      this.setupPlayers = null;
      const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { G.audio.click(); fn(); }); };

      click('btn-play', () => this.showSetup());
      click('btn-howto', () => this.show('howto'));
      click('btn-howto-back', () => this.show('title'));
      click('btn-setup-back', () => this.show('title'));
      click('btn-add-player', () => this.changeCount(1));
      click('btn-rm-player', () => this.changeCount(-1));
      click('btn-start-party', () => this.startParty());
      click('btn-ri-go', () => { this.show(null); this.game.startRoundTurns(); });
      click('btn-rr-next', () => { this.show(null); this.game.nextRound(); });
      click('btn-podium-again', () => this.showSetup());
      click('btn-podium-menu', () => { this.game.endParty(); this.show('title'); });
      click('btn-pause', () => this.showPause());
      click('btn-resume', () => this.resume());
      click('btn-quit', () => { this.game.endParty(); this.show('title'); });

      const mute = $('btn-mute');
      if (mute) { const sync = () => mute.textContent = G.save.settings.muted ? '🔇' : '🔊'; sync(); mute.addEventListener('click', () => { const m = !G.save.settings.muted; G.save.setSetting('muted', m); G.audio.setMuted(m); sync(); }); }

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') { if (this.game.state === 'play') this.showPause(); else if (this.current === 'pause') this.resume(); }
      });

      this.show('title');
    },

    show(name) {
      this.current = name;
      SCREENS.forEach((s) => { const el = $('screen-' + s); if (el) el.classList.toggle('hidden', s !== name); });
      const ov = $('overlay'); if (ov) ov.classList.toggle('hidden', !name);
      this.game.paused = (name === 'pause');
      this.game.input.enabled = !name;
      if (name === 'title') { this.game.menuMode = true; this.game.state = 'title'; }
      const coins = $('title-tag'); if (coins) { /* no-op */ }
    },

    /* ----------------------------- setup --------------------------------- */
    showSetup() {
      if (!this.setupPlayers) this.setupPlayers = G.players.defaults(2);
      this.renderSetup();
      this.show('setup');
    },
    changeCount(d) {
      G.audio.click();
      const n = Math.max(1, Math.min(4, this.setupPlayers.length + d));
      if (n === this.setupPlayers.length) return;
      if (n > this.setupPlayers.length) {
        const extra = G.players.defaults(n);
        while (this.setupPlayers.length < n) this.setupPlayers.push(extra[this.setupPlayers.length]);
      } else this.setupPlayers.length = n;
      this.renderSetup();
    },
    renderSetup() {
      const wrap = $('setup-players'); if (!wrap) return;
      $('setup-count').textContent = this.setupPlayers.length + ' player' + (this.setupPlayers.length > 1 ? 's' : '');
      wrap.innerHTML = '';
      this.setupPlayers.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'pcard';
        card.style.borderColor = G.players.colorCss(p);
        card.innerHTML =
          '<div class="pavatar" style="background:' + G.players.colorCss(p) + '">🏌️</div>' +
          '<input class="pname" maxlength="10" value="' + p.name.replace(/"/g, '') + '" />' +
          '<div class="prow"><button class="pbtn pcolor">🎨 Colour</button><button class="pbtn phat">' + G.players.HAT_LABEL[G.players.hatId(p)] + '</button></div>';
        const nameEl = card.querySelector('.pname');
        nameEl.addEventListener('input', () => { p.name = nameEl.value || ('P' + (idx + 1)); });
        card.querySelector('.pcolor').addEventListener('click', () => {
          G.audio.click(); p.colorIdx = (p.colorIdx + 1) % G.players.COLORS.length;
          card.style.borderColor = G.players.colorCss(p); card.querySelector('.pavatar').style.background = G.players.colorCss(p);
        });
        const hatEl = card.querySelector('.phat');
        hatEl.addEventListener('click', () => { G.audio.click(); p.hatIdx = (p.hatIdx + 1) % G.players.HATS.length; hatEl.textContent = G.players.HAT_LABEL[G.players.hatId(p)]; });
        wrap.appendChild(card);
      });
    },
    startParty() {
      // commit names from inputs
      const inputs = document.querySelectorAll('#setup-players .pname');
      inputs.forEach((el, i) => { if (this.setupPlayers[i]) this.setupPlayers[i].name = el.value || ('P' + (i + 1)); });
      this.show(null);
      this.game.startParty(this.setupPlayers);
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
      const list = $('rr-list'); if (list) {
        list.innerHTML = '';
        d.ranking.forEach((row, i) => {
          const medal = ['🥇', '🥈', '🥉', '4️⃣'][i] || '';
          const el = document.createElement('div');
          el.className = 'rr-row';
          el.innerHTML = '<span class="rr-rank">' + medal + '</span>' +
            '<span class="rr-name" style="color:' + row.color + '">' + row.name + '</span>' +
            '<span class="rr-val">' + row.value + '</span>' +
            '<span class="rr-pts">+' + row.points + '</span>' +
            '<span class="rr-tot">' + row.total + '</span>';
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
      const list = $('podium-list'); if (list) {
        list.innerHTML = '';
        d.standings.forEach((row, i) => {
          const medal = ['🥇', '🥈', '🥉', '4️⃣'][i] || '';
          const el = document.createElement('div'); el.className = 'rr-row';
          el.innerHTML = '<span class="rr-rank">' + medal + '</span><span class="rr-name" style="color:' + row.color + '">' + row.name + '</span><span class="rr-tot big">' + row.score + ' pts</span>';
          list.appendChild(el);
        });
      }
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
