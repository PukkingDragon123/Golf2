/* ===========================================================================
 * save.js  —  Persistent profile in localStorage with an in-memory fallback.
 * Stores settings, cosmetic unlocks, achievement progress and lifetime stats.
 * =========================================================================== */
(function (G) {
  'use strict';
  const KEY = 'extraterrestrial_golf_save_v2';

  const DEFAULT = {
    version: 2,
    settings: { muted: false, volume: 0.7 },
    unlocks: { hats: ['cap', 'beanie', 'none'], colors: [0, 1, 2, 3, 4, 5, 6, 7], balls: ['classic', 'stripe'] },
    ach: {},      // { achievementId: true }
    stats: {}     // { statKey: number }   (arrays for set-like stats)
  };

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  class Save {
    constructor() {
      this.mem = deepClone(DEFAULT);
      this.canStore = false;
      try { window.localStorage.setItem('__golf_probe__', '1'); window.localStorage.removeItem('__golf_probe__'); this.canStore = true; }
      catch (e) { this.canStore = false; }
      this.load();
    }
    load() {
      if (!this.canStore) return;
      try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return;
        const data = JSON.parse(raw) || {};
        const m = deepClone(DEFAULT);
        if (data.settings && typeof data.settings === 'object') Object.assign(m.settings, data.settings);
        if (data.unlocks && typeof data.unlocks === 'object') {
          ['hats', 'colors', 'balls'].forEach((k) => {
            if (Array.isArray(data.unlocks[k])) data.unlocks[k].forEach((v) => { if (m.unlocks[k].indexOf(v) < 0) m.unlocks[k].push(v); });
          });
        }
        if (data.ach && typeof data.ach === 'object') m.ach = data.ach;
        if (data.stats && typeof data.stats === 'object') m.stats = data.stats;
        this.mem = m;
      } catch (e) { /* corrupt -> defaults */ }
    }
    persist() { if (this.canStore) { try { window.localStorage.setItem(KEY, JSON.stringify(this.mem)); } catch (e) { } } }

    get settings() { return this.mem.settings; }
    setSetting(k, v) { this.mem.settings[k] = v; this.persist(); }

    /* ----- cosmetic unlocks ----- */
    hasSkin(type, id) { return (this.mem.unlocks[type] || []).indexOf(id) >= 0; }
    unlockSkin(type, id) {
      const arr = this.mem.unlocks[type] || (this.mem.unlocks[type] = []);
      if (arr.indexOf(id) < 0) { arr.push(id); this.persist(); return true; }
      return false;
    }
    unlocks(type) { return (this.mem.unlocks[type] || []).slice(); }

    /* ----- achievements ----- */
    isAch(id) { return !!this.mem.ach[id]; }
    setAch(id) { if (!this.mem.ach[id]) { this.mem.ach[id] = true; this.persist(); return true; } return false; }

    /* ----- stats ----- */
    stat(k) { return this.mem.stats[k] || 0; }
    addStat(k, n) { this.mem.stats[k] = (this.mem.stats[k] || 0) + (n == null ? 1 : n); this.persist(); return this.mem.stats[k]; }
    maxStat(k, v) { if (v > (this.mem.stats[k] || 0)) { this.mem.stats[k] = v; this.persist(); } return this.mem.stats[k] || 0; }
    setInStat(k, item) { // set-like: store array of unique items, return its size
      let a = this.mem.stats[k]; if (!Array.isArray(a)) a = this.mem.stats[k] = [];
      if (a.indexOf(item) < 0) { a.push(item); this.persist(); }
      return a.length;
    }
    setStatSize(k) { const a = this.mem.stats[k]; return Array.isArray(a) ? a.length : 0; }

    reset() { this.mem = deepClone(DEFAULT); this.persist(); }
  }

  G.save = new Save();
})(window.GOLF = window.GOLF || {});
