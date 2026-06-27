/* ===========================================================================
 * physics.js  —  Ball flight & ground interaction.
 *
 * Forces modelled:
 *   • gravity (per world)
 *   • quadratic aerodynamic drag against the wind-relative velocity
 *   • a simplified but controllable Magnus effect (back/top spin = lift/run,
 *     side spin = curve) that follows the ball's heading for natural banana shots
 *   • gravity wells (Solar), bounce pads & updraft geysers (Alien),
 *     roaming dinosaurs (Dino) as kick obstacles
 *   • slope-aware rolling with surface-dependent friction & restitution
 *   • a gentle hole magnet (gear) and realistic cup capture / lip-out
 *
 * Physics.update() advances the ball with fixed sub-steps and returns a small
 * events object so the game layer can fire sound + particles.
 * =========================================================================== */
(function (G) {
  'use strict';
  const V = G.V;

  const P = {
    sub: 1 / 240,
    dragK: 0.0072,
    magnusBack: 0.090,
    magnusSide: 0.105,
    spinDecay: 0.55,
    restSpeed: 0.55,
    restFrames: 6,
    captureSpeed: 7.0,
    rollBase: 2.4,        // base rolling deceleration (units/s^2)
    slopeGravity: 0.55    // how much slope gravity drives a rolling ball
  };

  function makeBall(radius) {
    return {
      pos: [0, 0, 0], vel: [0, 0, 0],
      spinB: 0, spinS: 0,
      heading: [0, 0, 1],
      radius: radius || 0.5,
      state: 'rest',          // 'air' | 'roll' | 'rest'
      resting: true,
      restCount: 0,
      lastSafe: [0, 0, 0],
      _padCool: 0, _dinoCool: 0,
      spinDir: 0
    };
  }

  // dir: desired horizontal-ish launch direction (unit). loft: 0..1 (adds Y).
  function launch(ball, dir, speed, loft, spinB, spinS) {
    const cl = Math.cos(loft), sl = Math.sin(loft);
    const v = [dir[0] * cl, sl, dir[2] * cl];
    V.normalize(v, v);
    ball.vel[0] = v[0] * speed; ball.vel[1] = v[1] * speed; ball.vel[2] = v[2] * speed;
    ball.heading = [dir[0], 0, dir[2]];
    V.normalize(ball.heading, ball.heading);
    ball.spinB = spinB; ball.spinS = spinS;
    ball.state = 'air';
    ball.resting = false;
    ball.restCount = 0;
    ball._padCool = 0; ball._dinoCool = 0;
  }

  function surfaceMods(type) {
    switch (type) {
      case 'green': return { roll: 0.62, rest: 0.95, fric: 0.9 };
      case 'fairway': return { roll: 1.0, rest: 1.0, fric: 1.0 };
      case 'rough': return { roll: 1.9, rest: 0.68, fric: 1.3 };
      case 'sand': return { roll: 3.2, rest: 0.30, fric: 1.8 };
      case 'tee': return { roll: 1.0, rest: 1.0, fric: 1.0 };
      default: return { roll: 1.0, rest: 1.0, fric: 1.0 };
    }
  }

  const _N = [0, 1, 0], _g = [0, 0, 0], _vrel = [0, 0, 0], _tmp = [0, 0, 0], _slope = [0, 0, 0];

  function update(ball, ctx, dt, ev) {
    ev = ev || {};
    if (ball.resting) return ev;
    let steps = Math.ceil(dt / P.sub);
    steps = Math.min(steps, 8);
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      if (!step(ball, ctx, h, ev)) break;
    }
    return ev;
  }

  function step(ball, ctx, h, ev) {
    const pos = ball.pos, vel = ball.vel;
    const rho = ctx.airDensity;
    const stats = ctx.stats;
    const windFactor = 1 - Math.min(0.9, stats.antiGrav);
    ball._padCool = Math.max(0, ball._padCool - h);
    ball._dinoCool = Math.max(0, ball._dinoCool - h);

    // ---- accelerations ----
    let ax = 0, ay = -ctx.gravity, az = 0;

    // wind-relative velocity for drag
    const wx = (ctx.wind ? ctx.wind[0] : 0) * windFactor;
    const wz = (ctx.wind ? ctx.wind[2] : 0) * windFactor;
    _vrel[0] = vel[0] - wx; _vrel[1] = vel[1]; _vrel[2] = vel[2] - wz;
    const vr = Math.hypot(_vrel[0], _vrel[1], _vrel[2]);
    if (vr > 0.0001 && rho > 0) {
      const k = P.dragK * rho * stats.dragMul * vr;
      ax -= k * _vrel[0]; ay -= k * _vrel[1]; az -= k * _vrel[2];
    }

    // Magnus (only meaningful while airborne and there is air)
    if (ball.state === 'air' && rho > 0.001) {
      const speed = Math.hypot(vel[0], vel[1], vel[2]);
      if (speed > 0.5) {
        // heading basis from current horizontal velocity
        let hx = vel[0], hz = vel[2];
        const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
        // right = up x heading
        const rxr = hz, rzr = -hx;
        const lift = P.magnusBack * ball.spinB * rho * speed;
        ay += lift;
        const curve = P.magnusSide * ball.spinS * rho * speed;
        ax += rxr * curve; az += rzr * curve;
      }
    }
    // spin bleeds off in flight
    const sd = Math.max(0, 1 - P.spinDecay * h);
    ball.spinB *= sd; ball.spinS *= sd;

    // gravity wells (Solar) — attract in 3D, softened, reduced by anti-grav
    if (ctx.wells) {
      const wf = 1 - Math.min(0.9, stats.antiGrav);
      for (let i = 0; i < ctx.wells.length; i++) {
        const w = ctx.wells[i];
        const dx = w.pos[0] - pos[0], dy = w.pos[1] - pos[1], dz = w.pos[2] - pos[2];
        let d2 = dx * dx + dy * dy + dz * dz;
        const minD = (w.radius || 6);
        if (d2 < minD * minD * 16) {
          d2 = Math.max(d2, minD * minD);
          const inv = 1 / Math.sqrt(d2);
          const a = (w.strength * wf) / d2;
          ax += dx * inv * a; ay += dy * inv * a; az += dz * inv * a;
        }
      }
    }

    // geysers (Alien) — vertical updraft column
    if (ctx.geysers) {
      for (let i = 0; i < ctx.geysers.length; i++) {
        const ge = ctx.geysers[i];
        const dx = pos[0] - ge.pos[0], dz = pos[2] - ge.pos[2];
        if (dx * dx + dz * dz < ge.radius * ge.radius && pos[1] < ge.pos[1] + ge.height) {
          ay += ge.power;
          ev.geyser = ge;
        }
      }
    }

    // integrate velocity, then position
    vel[0] += ax * h; vel[1] += ay * h; vel[2] += az * h;
    pos[0] += vel[0] * h; pos[1] += vel[1] * h; pos[2] += vel[2] * h;

    // ---- void / falling off (Solar) ----
    if (ctx.voidY != null && pos[1] < ctx.voidY) {
      ev.oob = 'void';
      ball.resting = true; ball.state = 'rest';
      vel[0] = vel[1] = vel[2] = 0;
      return false;
    }

    // ---- out of bounds (off the map) ----
    if (ctx.course.inBounds && !ctx.course.inBounds(pos[0], pos[2])) {
      ev.oob = ev.oob || 'oob';
      ball.resting = true; ball.state = 'rest';
      vel[0] = vel[1] = vel[2] = 0;
      return false;
    }

    // ---- dinosaurs (Dino) — kick obstacle ----
    if (ctx.dinos && ball._dinoCool <= 0) {
      for (let i = 0; i < ctx.dinos.length; i++) {
        const d = ctx.dinos[i];
        const dx = pos[0] - d.pos[0], dz = pos[2] - d.pos[2];
        const dd = dx * dx + dz * dz;
        if (dd < d.radius * d.radius && pos[1] < d.pos[1] + 4) {
          const inv = 1 / (Math.sqrt(dd) || 1);
          const speed = Math.hypot(vel[0], vel[2]) + 4;
          vel[0] = dx * inv * speed; vel[2] = dz * inv * speed;
          vel[1] = Math.max(vel[1], 3.5);
          ball._dinoCool = 0.5;
          ev.dino = [pos[0], pos[1], pos[2]];
          break;
        }
      }
    }

    // ---- ground interaction ----
    const gh = ctx.course.sampleHeight(pos[0], pos[2]);
    const rest = pos[1] - ball.radius;
    if (rest <= gh) {
      pos[1] = gh + ball.radius;
      ctx.course.sampleNormal(_N, pos[0], pos[2]);
      const surfType = ctx.course.surfaceAt ? ctx.course.surfaceAt(pos[0], pos[2]) : 'fairway';
      const sm = surfaceMods(surfType);

      // bounce pads (Alien) override the bounce with a launch
      if (ctx.pads && ball._padCool <= 0) {
        for (let i = 0; i < ctx.pads.length; i++) {
          const pad = ctx.pads[i];
          const dx = pos[0] - pad.pos[0], dz = pos[2] - pad.pos[2];
          if (dx * dx + dz * dz < pad.radius * pad.radius) {
            vel[1] = pad.power;
            ball._padCool = 0.4;
            ball.state = 'air';
            ev.pad = [pos[0], gh, pos[2]];
            return true;
          }
        }
      }

      // hazards
      const hz = ctx.course.hazardAt ? ctx.course.hazardAt(pos[0], pos[2]) : null;
      if (hz) {
        ev.hazard = hz;
        ev.hazardPos = [pos[0], gh, pos[2]];
        ball.resting = true; ball.state = 'rest';
        vel[0] = vel[1] = vel[2] = 0;
        return false;
      }

      // decompose velocity into normal/tangent
      const vn = vel[0] * _N[0] + vel[1] * _N[1] + vel[2] * _N[2];
      if (vn < 0) {
        const restitution = Math.min(0.95, ctx.restitution * sm.rest);
        const vnOut = -vn * restitution;
        // tangential component
        const tx = vel[0] - _N[0] * vn, ty = vel[1] - _N[1] * vn, tz = vel[2] - _N[2] * vn;
        const tfric = Math.max(0, 1 - ctx.friction * sm.fric * 0.5);
        vel[0] = tx * tfric + _N[0] * vnOut;
        vel[1] = ty * tfric + _N[1] * vnOut;
        vel[2] = tz * tfric + _N[2] * vnOut;
        // spin "check": backspin pulls back, topspin runs on (applied once)
        const sk = ball.spinB * 4.0;
        vel[0] -= ball.heading[0] * sk;
        vel[2] -= ball.heading[2] * sk;
        ball.spinB *= 0.4; ball.spinS *= 0.6;
        const impact = -vn;
        if (impact > 1.2) { ev.bounce = Math.min(1, impact / 22); ev.bouncePos = [pos[0], gh, pos[2]]; }
        ball.state = (vnOut > 1.2) ? 'air' : 'roll';
      } else {
        ball.state = 'roll';
      }

      // ---- rolling on the surface ----
      if (ball.state === 'roll') {
        // remove into-surface velocity
        const vn2 = vel[0] * _N[0] + vel[1] * _N[1] + vel[2] * _N[2];
        if (vn2 < 0) { vel[0] -= _N[0] * vn2; vel[1] -= _N[1] * vn2; vel[2] -= _N[2] * vn2; }
        // slope gravity (component of gravity along the surface tangent)
        _g[0] = 0; _g[1] = -ctx.gravity; _g[2] = 0;
        const gdotn = _g[0] * _N[0] + _g[1] * _N[1] + _g[2] * _N[2];
        _slope[0] = _g[0] - _N[0] * gdotn;
        _slope[1] = _g[1] - _N[1] * gdotn;
        _slope[2] = _g[2] - _N[2] * gdotn;
        const slopeDamp = P.slopeGravity * (1 - Math.min(0.6, stats.rollControl));
        vel[0] += _slope[0] * slopeDamp * h;
        vel[1] += _slope[1] * slopeDamp * h;
        vel[2] += _slope[2] * slopeDamp * h;
        // rolling friction
        const sp = Math.hypot(vel[0], vel[1], vel[2]);
        if (sp > 0.0001) {
          const decel = P.rollBase * sm.roll * (1 + ctx.rollFriction * 0.4) * (1 + stats.rollControl);
          const ns = Math.max(0, sp - decel * h);
          const f = ns / sp;
          vel[0] *= f; vel[1] *= f; vel[2] *= f;
        }
        pos[1] = gh + ball.radius;

        // hole magnet (gear) — gentle pull when slow & close
        if (stats.magnetStrength > 0 && ctx.holePos) {
          const dx = ctx.holePos[0] - pos[0], dz = ctx.holePos[2] - pos[2];
          const dh = Math.hypot(dx, dz);
          if (dh < stats.magnetRange && dh > 0.05 && sp < 9) {
            const pull = stats.magnetStrength * (1 - dh / stats.magnetRange) * 9;
            vel[0] += (dx / dh) * pull * h;
            vel[2] += (dz / dh) * pull * h;
          }
        }
      }
    }

    // ---- hole capture ----
    if (ctx.holePos && ctx.holeRadius) {
      const dx = pos[0] - ctx.holePos[0], dz = pos[2] - ctx.holePos[2];
      const dh = Math.hypot(dx, dz);
      const speed = Math.hypot(vel[0], vel[1], vel[2]);
      if (dh < ctx.holeRadius && pos[1] - ball.radius < ctx.holePos[1] + 0.4) {
        if (speed < P.captureSpeed) {
          ev.sank = true;
          ball.resting = true; ball.state = 'rest';
          pos[0] = ctx.holePos[0]; pos[2] = ctx.holePos[2];
          pos[1] = ctx.holePos[1] - ball.radius;
          vel[0] = vel[1] = vel[2] = 0;
          return false;
        } else if (dh < ctx.holeRadius * 0.7) {
          // lip-out: deflect and rob some speed
          vel[0] *= 0.55; vel[2] *= 0.55;
          ev.lipout = true;
        }
      }
    }

    // ---- rest detection ----
    if (ball.state === 'roll') {
      const sp = Math.hypot(vel[0], vel[1], vel[2]);
      // shallow slope check so a ball can't "rest" on a steep face
      const flat = _N[1] > 0.985;
      if (sp < P.restSpeed && (flat || sp < 0.12)) {
        ball.restCount++;
        if (ball.restCount >= P.restFrames) {
          ball.resting = true; ball.state = 'rest';
          vel[0] = vel[1] = vel[2] = 0;
          ev.stopped = true;
          return false;
        }
      } else {
        ball.restCount = 0;
      }
    }
    return true;
  }

  G.Physics = { makeBall, launch, update, P };
})(window.GOLF = window.GOLF || {});
