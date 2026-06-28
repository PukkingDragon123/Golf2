/* ===========================================================================
 * input.js  —  Unified input: keyboard (physical key codes), mouse / touch
 * drag on the canvas, on-screen virtual buttons, and basic gamepad support.
 * The game polls a simple state each frame.
 * =========================================================================== */
(function (G) {
  'use strict';

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();       // held physical codes
      this.pressed = new Set();    // edges this frame
      this.virtual = {};           // name -> bool (touch buttons / gamepad)
      this.dragX = 0; this.dragY = 0;
      this.pointerTap = false;   // a canvas pointerdown happened this frame
      this._dragId = null; this._lastX = 0; this._lastY = 0;
      this.enabled = true;
      this._bind();
    }

    _bind() {
      window.addEventListener('keydown', (e) => {
        if (!this.enabled) return;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
      window.addEventListener('blur', () => { this.keys.clear(); });

      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        this.pointerTap = true;
        if (this._dragId === null) {
          this._dragId = e.pointerId;
          this._lastX = e.clientX; this._lastY = e.clientY;
          try { c.setPointerCapture(e.pointerId); } catch (err) { }
        }
      });
      c.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this._dragId) return;
        this.dragX += e.clientX - this._lastX;
        this.dragY += e.clientY - this._lastY;
        this._lastX = e.clientX; this._lastY = e.clientY;
      });
      const end = (e) => { if (e.pointerId === this._dragId) this._dragId = null; };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // bind a DOM element as a hold-button setting virtual[name] true while pressed
    bindButton(el, name) {
      if (!el) return;
      const on = (e) => { e.preventDefault(); this.virtual[name] = true; };
      const off = (e) => { e.preventDefault(); this.virtual[name] = false; };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
    }

    isDown(code) { return this.keys.has(code) || !!this.virtual[code]; }
    // axis from two codes (and optional alt codes)
    axis(neg, pos, neg2, pos2) {
      let v = 0;
      if (this.isDown(pos) || (pos2 && this.isDown(pos2))) v += 1;
      if (this.isDown(neg) || (neg2 && this.isDown(neg2))) v -= 1;
      return v;
    }
    edge(code) {
      if (this.pressed.has(code)) { return true; }
      if (this.virtual['_edge_' + code]) { this.virtual['_edge_' + code] = false; return true; }
      return false;
    }
    triggerEdge(name) { this.virtual['_edge_' + name] = true; }

    // returns {aim, loft, spinB, spinS} axes and {swing, jet, camera, preview}
    poll() {
      const gp = this._gamepad();
      let aim = this.axis('KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight') + (this.virtual.aimL ? -1 : 0) + (this.virtual.aimR ? 1 : 0);
      let loft = this.axis('KeyS', 'KeyW', 'ArrowDown', 'ArrowUp') + (this.virtual.loftD ? -1 : 0) + (this.virtual.loftU ? 1 : 0);
      let spinB = this.axis('KeyE', 'KeyQ') + (this.virtual.backspin ? 1 : 0) + (this.virtual.topspin ? -1 : 0);
      let spinS = this.axis('KeyZ', 'KeyX') + (this.virtual.curveL ? -1 : 0) + (this.virtual.curveR ? 1 : 0);
      if (gp) {
        if (Math.abs(gp.axes[0]) > 0.15) aim += gp.axes[0];
        if (Math.abs(gp.axes[1]) > 0.15) loft += -gp.axes[1];
      }
      const swing = this.isDown('Space') || !!this.virtual.swing || (gp && gp.buttons[0] && gp.buttons[0].pressed);
      return {
        aim: Math.max(-1, Math.min(1, aim)),
        loft: Math.max(-1, Math.min(1, loft)),
        spinB: Math.max(-1, Math.min(1, spinB)),
        spinS: Math.max(-1, Math.min(1, spinS)),
        swing,
        dragX: this.dragX, dragY: this.dragY
      };
    }

    _gamepad() {
      if (!navigator.getGamepads) return null;
      const pads = navigator.getGamepads();
      for (let i = 0; i < pads.length; i++) if (pads[i]) return pads[i];
      return null;
    }

    endFrame() {
      this.dragX = 0; this.dragY = 0; this.pointerTap = false; this.pressed.clear();
      // discard any virtual edge (e.g. a touch jet tap) not consumed this frame,
      // so it can't carry into the next shot
      for (const k in this.virtual) if (k.indexOf('_edge_') === 0) this.virtual[k] = false;
    }
  }

  G.Input = Input;
})(window.GOLF = window.GOLF || {});
