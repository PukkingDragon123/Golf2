/* ===========================================================================
 * gear.js  —  Upgradeable gear for your extraterrestrial golf cart.
 * Each upgrade meaningfully changes physics or grants an ability. computeStats()
 * folds the player's purchased levels into a single stats object the physics
 * and shot systems read every shot.
 * =========================================================================== */
(function (G) {
  'use strict';

  // cost of buying the NEXT level (level = current owned level)
  const curve = (base, mult) => (level) => Math.round(base * Math.pow(mult, level));

  const CATALOG = [
    {
      id: 'driver', name: 'Quantum Driver', icon: '🚀',
      blurb: 'Warp-charged clubface. Adds raw launch power to every swing.',
      max: 5, cost: curve(80, 1.7),
      detail: (l) => `+${(l * 9)}% shot power`
    },
    {
      id: 'aero', name: 'Aero-Shell Ball', icon: '🛸',
      blurb: 'Frictionless dimples slice through thick atmospheres. Huge on dense worlds.',
      max: 5, cost: curve(70, 1.7),
      detail: (l) => `-${(l * 12)}% air drag`
    },
    {
      id: 'spin', name: 'Gyro Spin Core', icon: '🌀',
      blurb: 'Lets you load far more back/side spin — curve shots and bite the green.',
      max: 5, cost: curve(70, 1.65),
      detail: (l) => `+${(l * 22)}% spin authority`
    },
    {
      id: 'precision', name: 'Pulsar Sight', icon: '🎯',
      blurb: 'Slows the power meter and steadies your aim line for pinpoint shots.',
      max: 4, cost: curve(90, 1.7),
      detail: (l) => `${(l * 18)}% calmer meter & aim`
    },
    {
      id: 'grip', name: 'Mag-Grip Treads', icon: '🧲',
      blurb: 'Smart rolling resistance — the ball settles faster and runs away less downhill.',
      max: 4, cost: curve(80, 1.65),
      detail: (l) => `+${(l * 20)}% roll control`
    },
    {
      id: 'antigrav', name: 'Anti-Grav Stabilizers', icon: '🌌',
      blurb: 'Dampens gravity wells and crosswind drift on the wilder worlds.',
      max: 3, cost: curve(120, 1.8),
      detail: (l) => `-${(l * 28)}% well & wind pull`
    },
    {
      id: 'magnet', name: 'Hole Magnet', icon: '🕳️',
      blurb: 'A cheeky tractor field that nudges a close ball toward the cup.',
      max: 3, cost: curve(150, 1.9),
      detail: (l) => `homing within ${(l * 1.1).toFixed(1)}m of the cup`
    },
    {
      id: 'jet', name: 'Pulse Jet Booster', icon: '💥',
      blurb: 'Mid-flight thruster. Tap SPACE in the air to boost the ball onward.',
      max: 3, cost: curve(160, 1.9),
      detail: (l) => `${l} air-boost${l === 1 ? '' : 's'} per shot`
    }
  ];

  const byId = {};
  CATALOG.forEach((u) => { byId[u.id] = u; });

  // Fold owned levels into the stats the engine reads.
  function computeStats(levels) {
    levels = levels || {};
    const L = (id) => levels[id] || 0;
    return {
      powerMul: 1 + 0.09 * L('driver'),
      dragMul: Math.max(0.25, 1 - 0.12 * L('aero')),
      spinMul: 1 + 0.22 * L('spin'),
      meterCalm: 1 - 0.18 * L('precision'),   // <1 = slower/steadier meter
      aimCalm: 1 - 0.18 * L('precision'),
      rollControl: 0.20 * L('grip'),          // extra rolling friction & downhill damping
      antiGrav: 0.28 * L('antigrav'),         // fraction of well/wind cancelled
      magnetRange: 1.1 * L('magnet'),         // metres
      magnetStrength: L('magnet') > 0 ? (0.6 + 0.25 * L('magnet')) : 0,
      jetCharges: L('jet')
    };
  }

  function statsFromSave() {
    const levels = {};
    CATALOG.forEach((u) => { levels[u.id] = G.save.upgradeLevel(u.id); });
    return computeStats(levels);
  }

  G.gear = { CATALOG, byId, computeStats, statsFromSave };
})(window.GOLF = window.GOLF || {});
