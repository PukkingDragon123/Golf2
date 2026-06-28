/* ===========================================================================
 * shop.js  —  Drives the Xeno Gear Emporium UI: category tabs, item cards, and
 * purchases. Selecting an item updates the 3D pedestal preview in ShopScene.
 * =========================================================================== */
(function (G) {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function descriptor(u) {
    switch (u.id) {
      case 'driver': return { type: 'club', club: 'driver', color: [0.85, 0.3, 0.35] };
      case 'spin': return { type: 'club', club: 'wedge', color: [0.4, 0.6, 0.95] };
      case 'putter': return { type: 'club', club: 'putter', color: [0.4, 0.85, 0.55] };
      case 'precision': return { type: 'gizmo', color: [0.5, 0.9, 1.0] };
      case 'aero': return { type: 'ball', accent: G.save.ballAccent };
      case 'grip': return { type: 'ball', accent: G.save.ballAccent };
      case 'antigrav': return { type: 'cart', color: G.save.ballAccent.map((c) => c / 255) };
      case 'magnet': return { type: 'gizmo', color: [0.85, 0.5, 1.0] };
      case 'jet': return { type: 'cart', color: G.save.ballAccent.map((c) => c / 255) };
      default: return { type: 'gizmo', color: [0.6, 0.9, 1.0] };
    }
  }

  const shop = {
    cat: 'Clubs',

    render(game) {
      this.game = game;
      const coins = $('shop-coins'); if (coins) coins.textContent = '🪙 ' + G.save.coins;
      this._tabs();
      this._category(this.cat, true);
    },

    _tabs() {
      const wrap = $('shop-tabs'); if (!wrap) return;
      wrap.innerHTML = '';
      G.gear.CATEGORIES.forEach((cat) => {
        const b = document.createElement('button');
        b.className = 'shop-tab' + (cat === this.cat ? ' on' : '');
        b.textContent = cat;
        b.addEventListener('click', () => { G.audio.click(); this._category(cat, true); });
        wrap.appendChild(b);
      });
    },

    _category(cat, selectFirst) {
      this.cat = cat;
      document.querySelectorAll('.shop-tab').forEach((t) => t.classList.toggle('on', t.textContent === cat));
      const wrap = $('shop-items'); if (!wrap) return;
      wrap.innerHTML = '';
      const items = G.gear.CATALOG.filter((u) => u.cat === cat);
      items.forEach((u, idx) => {
        const card = this._card(u);
        wrap.appendChild(card);
        if (selectFirst && idx === 0) this._select(u, card);
      });
    },

    _card(u) {
      const lvl = G.save.upgradeLevel(u.id);
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : u.cost(lvl);
      const afford = G.save.coins >= cost;
      const pips = [];
      for (let i = 0; i < u.max; i++) pips.push('<span class="pip ' + (i < lvl ? 'on' : '') + '"></span>');
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<div class="shop-ico">' + u.icon + '</div>' +
        '<div class="shop-body">' +
        '<div class="shop-name">' + u.name + ' <span class="shop-lvl">Lv ' + lvl + '/' + u.max + '</span></div>' +
        '<div class="shop-blurb">' + u.blurb + '</div>' +
        '<div class="shop-pips">' + pips.join('') + '</div>' +
        '<div class="shop-detail">' + (maxed ? 'Now: ' + u.detail(lvl) : 'Next: ' + u.detail(lvl + 1)) + '</div>' +
        '</div>' +
        '<button class="shop-buy ' + (maxed ? 'maxed' : afford ? '' : 'poor') + '">' + (maxed ? 'MAX' : '🪙 ' + cost) + '</button>';
      card.addEventListener('click', (e) => { if (!e.target.classList.contains('shop-buy')) this._select(u, card); });
      const btn = card.querySelector('.shop-buy');
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._buy(u); });
      card._upgrade = u;
      return card;
    },

    _select(u, card) {
      document.querySelectorAll('.shop-card').forEach((c) => c.classList.remove('sel'));
      if (card) card.classList.add('sel');
      this.game.setShopPreview(descriptor(u));
    },

    _buy(u) {
      const lvl = G.save.upgradeLevel(u.id);
      if (lvl >= u.max) { G.audio.deny(); return; }
      const cost = u.cost(lvl);
      if (G.save.coins < cost) { G.audio.deny(); const c = $('shop-coins'); if (c) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } return; }
      G.save.spend(cost);
      G.save.setUpgrade(u.id, lvl + 1);
      G.audio.buy();
      this.game.refreshStats();
      this._category(this.cat, false);
      const coins = $('shop-coins'); if (coins) coins.textContent = '🪙 ' + G.save.coins;
      // keep the bought item previewed
      this.game.setShopPreview(descriptor(u));
    }
  };

  G.shop = shop;
})(window.GOLF = window.GOLF || {});
