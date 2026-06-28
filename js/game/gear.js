/* ===========================================================================
 * gear.js  —  Upgradeable gear, grouped into shop categories. Each upgrade
 * changes physics or a club's behaviour. computeStats() folds owned levels into
 * one stats object the shot/physics systems read.
 * =========================================================================== */
(function (G) {
  'use strict';

  const curve = (base, mult) => (level) => Math.round(base * Math.pow(mult, level));

  const CATALOG = [
    // ---- Clubs ----
    {
      id: 'driver', cat: 'Clubs', name: 'Plasma Driver', icon: '🚀',
      blurb: 'Warp-charged clubface — adds raw launch distance to every club.',
      max: 5, cost: curve(80, 1.7), detail: (l) => `+${(l * 7)}% distance`
    },
    {
      id: 'spin', cat: 'Clubs', name: 'Gyro Wedge Core', icon: '🌀',
      blurb: 'Loads the wedge with heavy backspin so approaches bite and stop.',
      max: 5, cost: curve(70, 1.65), detail: (l) => `+${(l * 22)}% wedge bite`
    },
    {
      id: 'precision', cat: 'Clubs', name: 'Pulsar Sight', icon: '🎯',
      blurb: 'Slows the accuracy meter and tightens every club\'s shot dispersion.',
      max: 4, cost: curve(90, 1.7), detail: (l) => `${(l * 16)}% easier accuracy`
    },
    {
      id: 'putter', cat: 'Clubs', name: 'Tractor Putter', icon: '🎱',
      blurb: 'Self-levelling head — putts track dead straight across any green.',
      max: 4, cost: curve(85, 1.65), detail: (l) => `${(l * 22)}% truer putts`
    },
    // ---- Ball ----
    {
      id: 'aero', cat: 'Ball', name: 'Aero-Shell Ball', icon: '🛸',
      blurb: 'Frictionless dimples slice thick atmospheres. Huge on dense worlds.',
      max: 5, cost: curve(70, 1.7), detail: (l) => `-${(l * 12)}% air drag`
    },
    {
      id: 'grip', cat: 'Ball', name: 'Mag-Grip Cover', icon: '🧲',
      blurb: 'Smart rolling resistance — the ball settles faster, runs away less.',
      max: 4, cost: curve(80, 1.65), detail: (l) => `+${(l * 20)}% roll control`
    },
    // ---- Cart ----
    {
      id: 'antigrav', cat: 'Cart', name: 'Anti-Grav Stabilizers', icon: '🌌',
      blurb: 'Dampens gravity wells and crosswind drift on the wilder worlds.',
      max: 3, cost: curve(120, 1.8), detail: (l) => `-${(l * 28)}% well & wind pull`
    },
    {
      id: 'magnet', cat: 'Cart', name: 'Hole Magnet', icon: '🕳️',
      blurb: 'A cheeky tractor field that nudges a close ball toward the cup.',
      max: 3, cost: curve(150, 1.9), detail: (l) => `homing within ${(1.6 + l).toFixed(1)}m`
    },
    {
      id: 'jet', cat: 'Cart', name: 'Pulse Jet Booster', icon: '💥',
      blurb: 'Mid-flight thruster — tap the action button in the air to boost on.',
      max: 3, cost: curve(160, 1.9), detail: (l) => `${l} air-boost${l === 1 ? '' : 's'} / shot`
    }
  ];

  const CATEGORIES = ['Clubs', 'Ball', 'Cart'];
  const byId = {};
  CATALOG.forEach((u) => { byId[u.id] = u; });

  function computeStats(levels) {
    levels = levels || {};
    const L = (id) => levels[id] || 0;
    return {
      powerMul: 1 + 0.07 * L('driver'),
      dragMul: Math.max(0.25, 1 - 0.12 * L('aero')),
      spinMul: 1 + 0.22 * L('spin'),
      meterCalm: 1 - 0.16 * L('precision'),       // <1 = slower meters
      accuracyEase: 1 - 0.16 * L('precision'),    // <1 = tighter dispersion
      putterCtrl: 0.22 * L('putter'),
      rollControl: 0.20 * L('grip'),
      antiGrav: 0.28 * L('antigrav'),
      magnetRange: L('magnet') > 0 ? 1.6 + L('magnet') : 0,
      magnetStrength: L('magnet') > 0 ? (0.6 + 0.25 * L('magnet')) : 0,
      jetCharges: L('jet')
    };
  }

  function statsFromSave() {
    const levels = {};
    CATALOG.forEach((u) => { levels[u.id] = G.save.upgradeLevel(u.id); });
    return computeStats(levels);
  }

  G.gear = { CATALOG, CATEGORIES, byId, computeStats, statsFromSave };
})(window.GOLF = window.GOLF || {});
