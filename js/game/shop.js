/* ===========================================================================
 * shop.js  —  Renders the gear shop from gear.CATALOG and handles purchases,
 * folding new levels into the live player stats.
 * =========================================================================== */
(function (G) {
  'use strict';

  const shop = {
    render(game) {
      const wrap = document.getElementById('shop-items');
      const coinsEl = document.getElementById('shop-coins');
      if (!wrap) return;
      if (coinsEl) coinsEl.textContent = '🪙 ' + G.save.coins;
      wrap.innerHTML = '';
      G.gear.CATALOG.forEach((u) => {
        const lvl = G.save.upgradeLevel(u.id);
        const maxed = lvl >= u.max;
        const cost = maxed ? 0 : u.cost(lvl);
        const afford = G.save.coins >= cost;

        const card = document.createElement('div');
        card.className = 'shop-card';

        const pips = [];
        for (let i = 0; i < u.max; i++) pips.push('<span class="pip ' + (i < lvl ? 'on' : '') + '"></span>');

        card.innerHTML =
          '<div class="shop-ico">' + u.icon + '</div>' +
          '<div class="shop-body">' +
          '<div class="shop-name">' + u.name + ' <span class="shop-lvl">Lv ' + lvl + '/' + u.max + '</span></div>' +
          '<div class="shop-blurb">' + u.blurb + '</div>' +
          '<div class="shop-pips">' + pips.join('') + '</div>' +
          '<div class="shop-detail">' + (maxed ? 'Now: ' + u.detail(lvl) : 'Next: ' + u.detail(lvl + 1)) + '</div>' +
          '</div>' +
          '<button class="shop-buy ' + (maxed ? 'maxed' : afford ? '' : 'poor') + '">' +
          (maxed ? 'MAX' : '🪙 ' + cost) + '</button>';

        const btn = card.querySelector('.shop-buy');
        btn.addEventListener('click', () => {
          if (maxed) { G.audio.deny(); return; }
          if (G.save.coins < cost) { G.audio.deny(); shop._flash(coinsEl); return; }
          G.save.spend(cost);
          G.save.setUpgrade(u.id, lvl + 1);
          G.audio.buy();
          game.refreshStats();
          shop.render(game);
        });
        wrap.appendChild(card);
      });
    },

    _flash(el) {
      if (!el) return;
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    }
  };

  G.shop = shop;
})(window.GOLF = window.GOLF || {});
