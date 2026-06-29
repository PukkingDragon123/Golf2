/* ===========================================================================
 * achievements.js  —  Lifetime achievements that unlock cosmetics (hats, ball
 * skins, colours). Profile-wide (shared device). game.js calls note()/evaluate.
 * =========================================================================== */
(function (G) {
  'use strict';

  // reward types map to save unlock buckets: 'hats' | 'balls' | 'colors'
  const ACHIEVEMENTS = [
    { id: 'firstparty', name: 'First Fling', icon: '🎉', desc: 'Finish your first party.', cond: (s) => s.stat('parties') >= 1, rewards: [{ type: 'hats', id: 'tophat' }] },
    { id: 'partyanimal', name: 'Party Animal', icon: '🥳', desc: 'Finish 3 parties.', cond: (s) => s.stat('parties') >= 3, rewards: [{ type: 'hats', id: 'party' }] },
    { id: 'champion', name: 'Champion', icon: '🏆', desc: 'Win a party.', cond: (s) => s.stat('wins') >= 1, rewards: [{ type: 'colors', id: 8 }, { type: 'hats', id: 'halo' }] },
    { id: 'sweep', name: 'Clean Sweep', icon: '🧹', desc: 'Win 3 rounds in one party.', cond: (s) => s.stat('bestRoundWins') >= 3, rewards: [{ type: 'hats', id: 'wizard' }] },
    { id: 'longball', name: 'Big Bertha', icon: '💪', desc: 'Fling a ball 130m or more.', cond: (s) => s.stat('longest') >= 130, rewards: [{ type: 'balls', id: 'galaxy' }] },
    { id: 'ace', name: 'Hole in One!', icon: '🕳️', desc: 'Sink a Hole Rush in one swing.', cond: (s) => s.stat('ace') >= 1, rewards: [{ type: 'balls', id: 'eyeball' }] },
    { id: 'bull', name: 'Bullseye!', icon: '🎯', desc: 'Nail the centre in Bullseye.', cond: (s) => s.stat('bull') >= 1, rewards: [{ type: 'hats', id: 'crown' }, { type: 'balls', id: 'gold' }] },
    { id: 'sharp', name: 'Sharpshooter', icon: '🔭', desc: 'Pin Seeker within 1m of the cup.', cond: (s) => s.stat('pin1') >= 1, rewards: [{ type: 'balls', id: 'beach' }] },
    { id: 'starmuncher', name: 'Star Muncher', icon: '⭐', desc: 'Collect 5 stars in one Star Smash.', cond: (s) => s.stat('bestStars') >= 5, rewards: [{ type: 'hats', id: 'antenna' }] },
    { id: 'globetrotter', name: 'Globetrotter', icon: '🌍', desc: 'Play on all 5 maps.', cond: (s) => s.setStatSize('mapsPlayed') >= 5, rewards: [{ type: 'balls', id: 'eight' }, { type: 'colors', id: 9 }] }
  ];
  const byId = {}; ACHIEVEMENTS.forEach((a) => byId[a.id] = a);

  function labelFor(r) {
    if (r.type === 'hats') return G.players.HAT_LABEL[r.id] || r.id;
    if (r.type === 'balls') return G.players.BALL_LABEL[r.id] || r.id;
    if (r.type === 'colors') return 'a new colour';
    return r.id;
  }

  // Check all achievements; unlock rewards for any newly earned. Returns the
  // list of newly unlocked achievements (with reward labels) for notification.
  function evaluate() {
    const s = G.save, fresh = [];
    ACHIEVEMENTS.forEach((a) => {
      if (s.isAch(a.id)) return;
      if (a.cond(s)) {
        s.setAch(a.id);
        a.rewards.forEach((r) => s.unlockSkin(r.type, r.id));
        fresh.push({ id: a.id, name: a.name, icon: a.icon, rewards: a.rewards.map(labelFor) });
      }
    });
    return fresh;
  }

  function progress() {
    return ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, icon: a.icon, desc: a.desc, earned: G.save.isAch(a.id), rewards: a.rewards.map(labelFor) }));
  }

  G.achievements = { ACHIEVEMENTS, evaluate, progress };
})(window.GOLF = window.GOLF || {});
