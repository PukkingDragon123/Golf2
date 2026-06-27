/* ===========================================================================
 * camera.js  —  Perspective camera + smooth follow/orbit helpers.
 * =========================================================================== */
(function (G) {
  'use strict';
  const M = G.M, V = G.V, math = G.math;

  class Camera {
    constructor() {
      this.position = [0, 5, 10];
      this.target = [0, 0, 0];
      this.up = [0, 1, 0];
      this.fov = 60 * math.DEG;
      this.near = 0.1;
      this.far = 1400;
      this.projection = M.create();
      this.view = M.create();
      // orbit state around target
      this.yaw = 0;        // radians, around Y
      this.pitch = 0.42;   // radians, above horizon
      this.distance = 14;
    }

    updateProjection(aspect) {
      M.perspective(this.projection, this.fov, aspect, this.near, this.far);
    }

    updateView() {
      M.lookAt(this.view, this.position, this.target, this.up);
    }

    // Place the eye on a sphere around `target` using yaw/pitch/distance.
    orbitTo(target, yaw, pitch, distance) {
      this.target[0] = target[0]; this.target[1] = target[1]; this.target[2] = target[2];
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      this.position[0] = target[0] + Math.cos(yaw) * cp * distance;
      this.position[1] = target[1] + sp * distance;
      this.position[2] = target[2] + Math.sin(yaw) * cp * distance;
      this.updateView();
    }

    // Exponential smoothing toward a desired eye/target (frame-rate aware).
    follow(desiredPos, desiredTarget, dt, stiffness) {
      const k = 1 - Math.exp(-(stiffness || 6) * dt);
      V.lerp(this.position, this.position, desiredPos, k);
      V.lerp(this.target, this.target, desiredTarget, k);
      this.updateView();
    }

    // Screen-projection of a world point -> {x,y,visible} in CSS pixels.
    project(world, cssW, cssH) {
      const clip = [0, 0, 0, 0];
      const x = world[0], y = world[1], z = world[2];
      const v = this.view, p = this.projection;
      const vx = v[0] * x + v[4] * y + v[8] * z + v[12];
      const vy = v[1] * x + v[5] * y + v[9] * z + v[13];
      const vz = v[2] * x + v[6] * y + v[10] * z + v[14];
      const vw = v[3] * x + v[7] * y + v[11] * z + v[15];
      clip[0] = p[0] * vx + p[4] * vy + p[8] * vz + p[12] * vw;
      clip[1] = p[1] * vx + p[5] * vy + p[9] * vz + p[13] * vw;
      clip[3] = p[3] * vx + p[7] * vy + p[11] * vz + p[15] * vw;
      const w = clip[3];
      if (w <= 0.0001) return { x: 0, y: 0, visible: false };
      return {
        x: (clip[0] / w * 0.5 + 0.5) * cssW,
        y: (1 - (clip[1] / w * 0.5 + 0.5)) * cssH,
        visible: true
      };
    }
  }

  G.Camera = Camera;
})(window.GOLF = window.GOLF || {});
