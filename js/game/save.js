/* ===========================================================================
 * save.js  —  Persistent profile in localStorage with an in-memory fallback
 * (file:// origins sometimes block storage; the game still runs, just won't
 * remember between reloads).
 * =========================================================================== */
(function (G) {
  'use strict';
  const KEY = 'extraterrestrial_golf_save_v1';

  const DEFAULT = {
    version: 1,
    coins: 0,
    upgrades: {},            // { upgradeId: level }
    unlocked: ['earth'],     // unlocked world ids
    best: {},                // { worldId: totalStrokes }
    stars: {},               // { worldId: starCount 0..3 }
    ballAccent: [230, 70, 90],
    settings: { muted: false, volume: 0.7 },
    seenIntro: false
  };

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  class Save {
    constructor() {
      this.mem = deepClone(DEFAULT);
      this.canStore = false;
      try {
        const probe = '__golf_probe__';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        this.canStore = true;
      } catch (e) { this.canStore = false; }
      this.load();
    }
    load() {
      if (!this.canStore) return;
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) {
          const data = JSON.parse(raw) || {};
          // per-key, type-checked merge so a corrupt/legacy field can't crash later
          const m = deepClone(DEFAULT);
          if (typeof data.coins === 'number' && isFinite(data.coins)) m.coins = data.coins;
          if (Array.isArray(data.unlocked)) m.unlocked = data.unlocked.filter((x) => typeof x === 'string');
          if (m.unlocked.indexOf('earth') < 0) m.unlocked.push('earth');
          if (data.upgrades && typeof data.upgrades === 'object') Object.assign(m.upgrades, data.upgrades);
          if (data.best && typeof data.best === 'object') Object.assign(m.best, data.best);
          if (data.stars && typeof data.stars === 'object') Object.assign(m.stars, data.stars);
          if (Array.isArray(data.ballAccent) && data.ballAccent.length === 3) m.ballAccent = data.ballAccent.slice();
          if (data.settings && typeof data.settings === 'object') Object.assign(m.settings, data.settings);
          if (typeof data.seenIntro === 'boolean') m.seenIntro = data.seenIntro;
          this.mem = m;
        }
      } catch (e) { /* corrupt save -> defaults */ }
    }
    persist() {
      if (!this.canStore) return;
      try { window.localStorage.setItem(KEY, JSON.stringify(this.mem)); } catch (e) { }
    }

    get coins() { return this.mem.coins; }
    addCoins(n) { this.mem.coins += n; this.persist(); }
    spend(n) { if (this.mem.coins >= n) { this.mem.coins -= n; this.persist(); return true; } return false; }

    upgradeLevel(id) { return this.mem.upgrades[id] || 0; }
    setUpgrade(id, lvl) { this.mem.upgrades[id] = lvl; this.persist(); }

    isUnlocked(id) { return this.mem.unlocked.indexOf(id) >= 0; }
    unlock(id) { if (!this.isUnlocked(id)) { this.mem.unlocked.push(id); this.persist(); } }

    bestScore(worldId) { return this.mem.best[worldId]; }
    recordWorld(worldId, total, par, stars) {
      const prev = this.mem.best[worldId];
      if (prev == null || total < prev) this.mem.best[worldId] = total;
      const ps = this.mem.stars[worldId] || 0;
      if (stars > ps) this.mem.stars[worldId] = stars;
      this.persist();
    }
    stars(worldId) { return this.mem.stars[worldId] || 0; }

    get settings() { return this.mem.settings; }
    setSetting(k, v) { this.mem.settings[k] = v; this.persist(); }

    setBallAccent(c) { this.mem.ballAccent = c; this.persist(); }
    get ballAccent() { return this.mem.ballAccent; }

    reset() { this.mem = deepClone(DEFAULT); this.persist(); }
  }

  G.save = new Save();
})(window.GOLF = window.GOLF || {});
