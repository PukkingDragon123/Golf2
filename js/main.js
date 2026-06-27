/* ===========================================================================
 * main.js  —  Bootstrap. Creates the renderer + game, wires UI/HUD, kicks off
 * the showcase background and the render loop.
 * =========================================================================== */
(function (G) {
  'use strict';

  function boot() {
    const canvas = document.getElementById('gl');
    let renderer;
    try {
      renderer = new G.Renderer(canvas);
    } catch (e) {
      console.error(e);
      const fb = document.getElementById('fallback');
      if (fb) fb.classList.remove('hidden');
      return;
    }

    const game = new G.Game(renderer, canvas);
    G.game = game;
    game.onStateChange = (type, data) => { try { G.ui.onEvent(type, data); } catch (e) { console.error(e); } };
    game.onFrame = () => { try { G.hud.update(game); } catch (e) { /* keep rendering */ } };

    G.hud.init(game);
    G.ui.init(game);
    game.startShowcase();
    game.start();

    // browsers require a user gesture before audio can start
    const resume = () => { G.audio.ensure(); window.removeEventListener('pointerdown', resume); window.removeEventListener('keydown', resume); };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    window.addEventListener('resize', () => renderer.resize());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.GOLF = window.GOLF || {});
