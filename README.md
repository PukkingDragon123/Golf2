# 🛸 Extraterrestrial Golf Party

A goofy, couch **party golf game** across the cosmos — built from scratch with a
custom WebGL engine. **Zero dependencies, no build step, runs offline.** Grab
1–4 friends, customise your little golfers, and fling balls through a gauntlet of
minigames on wild alien maps.

![players](https://img.shields.io/badge/players-1--4-45e0c0) ![deps](https://img.shields.io/badge/dependencies-0-7aa8ff) ![engine](https://img.shields.io/badge/engine-custom%20WebGL-ffd35b)

## ▶ Play it

It's a single static page with no dependencies:

- **Easiest:** open `index.html` in a modern browser. Everything — geometry,
  textures and sound — is generated in code, so it works offline.
- **Or serve it** (recommended): `python3 -m http.server 8000` then open
  `http://localhost:8000`.

Pass the device around between turns — it's local hot-seat multiplayer.

## 🎮 How to play

- **Drag back** from the ball like a slingshot — the further you pull, the more power.
- **Aim** by the angle of your pull; the glowing arc previews the shot.
- **Release** to fling. Your golfer winds up and whacks it — with a dash of chaos
  for laughs. Works with mouse or finger.

That's the whole control scheme. Simple, goofy, chaotic.

## 🎉 The party

Pick **1–4 players**, each with a name, colour and a goofy hat (🧢 cap, 🎿 beanie,
🎩 top hat, 👑 crown, 🛸 antenna, or none). Then play **5 rounds** of minigames —
each on a randomly chosen map. Place high each round to earn points; most points
after 5 rounds takes the 👑.

**Minigames**

| Game | Goal |
|---|---|
| 💥 **Long Bomb** | One mega-swing — furthest landing wins. |
| 🎯 **Pin Seeker** | One shot — closest to the flag wins. |
| 🏁 **Hole Rush** | Sink it in the fewest swings. |

**Maps** (each with its own physics twist)

- 🌳 **Emerald Estate** — gentle wind & water hazards.
- 🌙 **Moon Mayhem** — 1/6 gravity & no air; drives fly forever.
- 🦖 **Jurassic Jam** — thick air, lava & roaming dinosaurs.
- 🪐 **Cosmic Carnival** — gravity-well planets bend your ball; the void keeps strays.
- 👽 **Alien Antics** — springy turf, launch-pad fungi & updraft geysers.

## 🧪 How it's built

Everything is hand-rolled and self-contained — no Three.js, no CDN, no asset files.

```
index.html, css/style.css   # page + UI
js/engine/                  # custom WebGL1 renderer, procedural mesh/terrain,
                            # Canvas2D textures, particles, WebAudio SFX, math
js/game/
  worlds.js                 # the 5 maps: physics, palette, lighting, sky, gimmick
  physics.js                # ball flight: gravity, drag, Magnus, bounce, roll, cup
  course.js                 # procedural hole generation + gimmick objects
  decor.js                  # low-poly props, the googly-eyed cart & the golfer rig
  players.js                # party players, colours, hats, per-player models
  game.js                   # drag-fling control, hot-seat turns, minigames, party
  input.js, hud.js, ui.js, main.js
```

Highlights: a custom WebGL renderer (lighting, fog, particles, sky), deterministic
procedural courses from a seed, an articulated golfer with an eased physics-style
swing, true ball-roll orientation, and all sound synthesized with WebAudio.

## Browser support

Any browser with WebGL1 + WebAudio (every current desktop and mobile browser). If
WebGL isn't available you'll get a friendly fallback message.
