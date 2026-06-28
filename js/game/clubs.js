/* ===========================================================================
 * clubs.js  —  The three clubs you swap between (Driver / Wedge / Putter).
 * Each has its own loft, max-power fraction, backspin, accuracy difficulty and
 * roll. Shop upgrades fold in via computeClub().
 * =========================================================================== */
(function (G) {
  'use strict';
  const DEG = Math.PI / 180;

  const CLUBS = [
    {
      id: 'driver', name: 'Driver', icon: '🟥', short: 'DRV',
      loft: 13, power: 1.0, back: 0.18, deflect: 9.0, roll: 1.1,
      desc: 'Maximum distance off the tee. Hard to keep dead straight.'
    },
    {
      id: 'wedge', name: 'Wedge', icon: '🟦', short: 'WDG',
      loft: 44, power: 0.62, back: 0.9, deflect: 5.0, roll: 0.5,
      desc: 'High, soft approach shot that bites and stops on the green.'
    },
    {
      id: 'putter', name: 'Putter', icon: '🟩', short: 'PUT',
      loft: 5, power: 0.34, back: 0.0, deflect: 2.4, roll: 1.5,
      desc: 'Keeps it on the deck — roll it true across the green.'
    }
  ];
  const byId = {};
  CLUBS.forEach((c) => { byId[c.id] = c; });

  // Fold player gear into a club's effective stats.
  function computeClub(id, stats) {
    const c = byId[id] || CLUBS[0];
    stats = stats || {};
    const powerMul = stats.powerMul || 1;
    const spinMul = stats.spinMul || 1;
    const ease = stats.accuracyEase != null ? stats.accuracyEase : 1; // <1 = tighter
    const putterCtrl = stats.putterCtrl || 0;
    let deflect = c.deflect * ease;
    if (c.id === 'putter') deflect *= (1 - Math.min(0.7, putterCtrl));
    return {
      id: c.id, name: c.name, icon: c.icon, short: c.short, desc: c.desc,
      loftRad: c.loft * DEG,
      power: c.power * powerMul,
      back: c.back * (c.id === 'wedge' ? spinMul : 1),
      deflect: deflect * DEG,
      roll: c.roll
    };
  }

  G.CLUBS = CLUBS;
  G.clubById = byId;
  G.computeClub = computeClub;
})(window.GOLF = window.GOLF || {});
