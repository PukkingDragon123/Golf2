# 🛸 Extraterrestrial Golf Cart

A **3D golf game across the cosmos**, built from scratch with a custom WebGL
engine — **zero dependencies, no build step, fully offline.** Play classic-feeling
golf with real ball physics, then take your upgradeable golf cart to five wildly
different worlds, each with its own physics twist.

![worlds](https://img.shields.io/badge/worlds-5-45e0c0) ![deps](https://img.shields.io/badge/dependencies-0-7aa8ff) ![engine](https://img.shields.io/badge/engine-custom%20WebGL-ffd35b)

## ▶ Play it

It's a single static page with no dependencies:

- **Easiest:** just open `index.html` in a modern browser (Chrome, Edge, Firefox,
  Safari). Everything — geometry, textures and sound — is generated in code, so it
  works straight off the disk and offline.
- **Or serve it** (recommended, avoids any local-file quirks):
  ```bash
  cd Golf2
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

Progress (coins, upgrades, unlocked worlds, best scores) is saved in your browser.

## 🎮 Controls

| Action | Keyboard / Mouse | Touch |
|---|---|---|
| Aim & look | Drag the view, or **A**/**D** (← →) | ◀ ▶ buttons / drag |
| Loft (club) | **W**/**S** (↑ ↓) | loft +/− |
| Back / top spin | **Q** / **E** | back / top |
| Curve left / right | **Z** / **X** | ◖ / ◗ |
| Swing | **hold SPACE**, release at the power you want | hold **SWING** |
| Jet boost (in flight) | tap **SPACE** | 💥 |
| Pause | **Esc** / ☰ | ☰ |

The glowing **arc previews your shot**. Watch the wind and gravity gauges — they
change everything from world to world.

## 🌌 The five worlds, and their twists

| World | Twist |
|---|---|
| 🌍 **Verdant Links** | Your warm-up: gentle crosswinds and water hazards. |
| 🌙 **Lunar Links** | **1/6 gravity and no air** — drives fly forever and fly flat. Mind the crater bowls. |
| 🦕 **Jurassic Fairway** | **Thick prehistoric air** drags every shot down — swing big. Lava pools, and **roaming dinosaurs** that kick a stray ball. |
| 🪐 **Orbital Open** | Golf on **floating platforms in space**. **Gravity-well planets** bend your ball; hit it off the edge and the **void** keeps it. |
| 👽 **Xeno Country Club** | **Springy bio-turf**, **launch-pad mushrooms** and **updraft geysers** under twin suns. |

Clear a world to unlock the next.

## 🛠 Upgrade your cart's gear

Earn 🪙 by scoring well and spend it in the Gear Shop on upgrades that genuinely
change how the ball behaves:

- **Quantum Driver** — more launch power
- **Aero-Shell Ball** — less air drag (a lifesaver in thick atmospheres)
- **Gyro Spin Core** — more back/side-spin authority
- **Pulsar Sight** — calmer power meter & steadier aim
- **Mag-Grip Treads** — the ball settles faster, runs away less downhill
- **Anti-Grav Stabilizers** — tames gravity wells and crosswind
- **Hole Magnet** — a cheeky tractor field that nudges a close ball toward the cup
- **Pulse Jet Booster** — tap SPACE mid-flight for an air boost

## 🧪 How it's built

Everything is hand-rolled and self-contained — no Three.js, no CDN, no assets.

```
index.html            # page + UI structure (loads classic scripts, runs from file://)
css/style.css         # neon/space UI
js/engine/            # the renderer
  gl-math.js          #   mat4 / vec3 math
  noise.js            #   seeded RNG + value noise / fBm (deterministic courses)
  renderer.js         #   WebGL1 forward renderer: lighting, fog, fx, sky pass
  mesh.js             #   procedural geometry + heightmap terrain builder
  textures.js         #   procedural Canvas2D textures (sky, ground, ball, water, lava)
  camera.js, particles.js, audio.js
js/game/
  worlds.js           # the 5 worlds: physics, palette, lighting, sky, gimmick
  physics.js          # ball flight: gravity, drag, Magnus, bounce, roll, hole capture
  course.js           # procedural hole generation + all gimmick objects + samplers
  decor.js            # low-poly props: trees, rocks, alien flora, dino, the cart
  gear.js, save.js    # upgrades + persistence
  input.js, hud.js, shop.js, ui.js, game.js, main.js
```

Highlights:

- **Custom WebGL1 renderer** with directional + ambient light, Blinn-Phong specular,
  rim light, exponential fog, alpha-tested cutouts, an unlit sky pass and additive
  particles.
- **Deterministic procedural courses** — every hole is generated from a seed
  (terrain, fairway/green/tee/bunkers, hazards, scattered scenery), so a hole always
  looks and plays the same.
- **Data-driven gimmicks** the physics engine interprets: low gravity, dense air,
  gravity wells, floating-platform void, bounce pads, updraft geysers, roaming dinos.
- **All assets generated at runtime** — textures via Canvas2D, geometry from
  primitives, and every sound synthesized with the WebAudio API. Nothing is loaded
  from disk or the network.

## Browser support

Any browser with WebGL1 and the WebAudio API (essentially every current desktop and
mobile browser). If WebGL isn't available you'll get a friendly fallback message.
