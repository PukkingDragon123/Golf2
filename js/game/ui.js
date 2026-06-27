/* ===========================================================================
 * ui.js  —  Screen flow: title, world select, shop, hole/world results,
 * how-to-play, and pause. Builds dynamic content and wires buttons to the game.
 * =========================================================================== */
(function (G) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const SCREENS = ['title', 'worlds', 'shop', 'holeresult', 'worldresult', 'howto', 'pause'];

  const ACCENTS = [[230, 70, 90], [255, 170, 40], [60, 200, 120], [80, 140, 255], [200, 90, 230], [240, 240, 240]];

  const ui = {
    init(game) {
      this.game = game;
      const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { G.audio.click(); fn(); }); };

      click('btn-play', () => this.showWorlds());
      click('btn-shop', () => this.showShop('title'));
      click('btn-howto', () => this.show('howto'));
      click('btn-worlds-back', () => this.show('title'));
      click('btn-shop-back', () => this.show(this._shopFrom || 'title'));
      click('btn-howto-back', () => this.show('title'));
      click('btn-hr-next', () => { this.show(null); this.game.nextHole(); });
      click('btn-wr-continue', () => this.showWorlds());
      click('btn-wr-shop', () => this.showShop('worldresult'));
      click('btn-pause', () => this.showPause());
      click('btn-resume', () => this.resume());
      click('btn-pause-worlds', () => { this.resume(); this.showWorlds(); });
      click('btn-pause-shop', () => this.showShop('pause'));

      const mute = $('btn-mute');
      if (mute) {
        const sync = () => mute.textContent = G.save.settings.muted ? '🔇' : '🔊';
        sync();
        mute.addEventListener('click', () => {
          const m = !G.save.settings.muted;
          G.save.setSetting('muted', m); G.audio.setMuted(m); sync();
        });
      }

      // accent swatches
      const sw = $('accent-swatches');
      if (sw) {
        ACCENTS.forEach((c) => {
          const b = document.createElement('button');
          b.className = 'swatch';
          b.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
          b.addEventListener('click', () => {
            G.audio.click();
            G.save.setBallAccent(c);
            this.game.refreshStats();
          });
          sw.appendChild(b);
        });
      }

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          if (this.game.state === 'playing') this.showPause();
          else if (this.current === 'pause') this.resume();
        }
      });

      this.show('title');
    },

    show(name) {
      this.current = name;
      SCREENS.forEach((s) => { const el = $('screen-' + s); if (el) el.classList.toggle('hidden', s !== name); });
      const ov = $('overlay');
      if (ov) ov.classList.toggle('hidden', !name);
      // any overlay halts gameplay input; pure play (name === null) re-enables it
      this.game.paused = (name === 'pause');
      this.game.input.enabled = !name;
      this._refreshCoins();
    },

    _refreshCoins() {
      ['title-coins', 'worlds-coins'].forEach((id) => { const el = $(id); if (el) el.textContent = '🪙 ' + G.save.coins; });
    },

    showWorlds() {
      this.game.menuMode = true; this.game.state = 'title';
      const grid = $('worlds-grid');
      if (grid) {
        grid.innerHTML = '';
        G.WORLD_ORDER.forEach((id, idx) => {
          const w = G.WORLDS[id];
          const unlocked = G.save.isUnlocked(id);
          const best = G.save.bestScore(id);
          const stars = G.save.stars(id);
          const card = document.createElement('div');
          card.className = 'world-card' + (unlocked ? '' : ' locked');
          const starStr = '★★★☆☆☆'.slice(3 - stars, 6 - stars);
          const prev = idx > 0 ? G.WORLDS[G.WORLD_ORDER[idx - 1]].name : '';
          card.innerHTML =
            '<div class="world-emoji">' + w.emoji + '</div>' +
            '<div class="world-name">' + w.name + '</div>' +
            '<div class="world-tag">' + w.tagline + '</div>' +
            '<div class="world-gimmick">✦ ' + w.gimmickName + '</div>' +
            '<div class="world-stat">' + (unlocked ? (best != null ? 'Best ' + best + ' · ' + starStr : starStr) : '🔒 Clear ' + prev) + '</div>' +
            '<button class="world-play"' + (unlocked ? '' : ' disabled') + '>' + (unlocked ? '▶ Play' : 'Locked') + '</button>';
          const btn = card.querySelector('.world-play');
          if (unlocked) btn.addEventListener('click', () => { G.audio.click(); this.show(null); this.game.startWorld(id); });
          grid.appendChild(card);
        });
      }
      this.show('worlds');
    },

    showShop(from) {
      this._shopFrom = from || 'title';
      G.shop.render(this.game);
      this.show('shop');
    },

    showPause() { if (this.game.state === 'playing') this.show('pause'); },
    resume() { this.show(null); this.game.paused = false; this.game.input.enabled = true; },

    showHoleResult(d) {
      this._set('hr-label', d.label);
      this._set('hr-detail', 'You took ' + d.strokes + ' on a par ' + d.par + '.');
      this._set('hr-coins', '🪙 +' + d.coins);
      const btn = $('btn-hr-next');
      if (btn) btn.textContent = d.last ? 'Finish Course →' : 'Next Hole →';
      this.show('holeresult');
    },

    showWorldResult(d) {
      this._set('wr-title', d.world.emoji + ' ' + d.world.name + ' Complete!');
      const starStr = '★★★☆☆☆'.slice(3 - d.stars, 6 - d.stars);
      this._set('wr-stars', starStr);
      this._set('wr-score', 'Total ' + d.total + ' · Par ' + d.par + ' (' + (d.total - d.par >= 0 ? '+' : '') + (d.total - d.par) + ')');
      this._set('wr-scores', 'Holes: ' + d.scores.join(' · '));
      this._set('wr-coins', '🪙 +' + d.coinsEarned + ' earned this round');
      this._set('wr-unlock', d.unlocked ? '🔓 Unlocked ' + d.unlocked.emoji + ' ' + d.unlocked.name + '!' : '');
      this.show('worldresult');
    },

    _set(id, t) { const el = $(id); if (el) el.textContent = t; },

    onEvent(type, data) {
      if (type === 'holeresult') this.showHoleResult(data);
      else if (type === 'worldresult') this.showWorldResult(data);
    }
  };

  G.ui = ui;
})(window.GOLF = window.GOLF || {});
