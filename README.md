# HYDRO

Real-time **particle fluid** in your browser: thousands of spheres in a 3D-style glass tank, steered with your **webcam** (hand pose via MediaPipe). **Desktop:** live physics sliders on the left. No build step, no framework—ES modules, Canvas 2D, and a small simulation core.

**[Live demo →](https://rawanbee.github.io/fluid-particle-simulation/)**

---

## Contents

| Section | What you’ll find |
|--------|-------------------|
| [Quick start](#quick-start) | Run it locally in one command |
| [Using HYDRO](#using-hydro) | In-app controls, HUD, permissions |
| [Repository map](#repository-map) | Where each part of the code lives |
| [How it works](#how-it-works) | Physics, vision, performance |
| [Privacy & data](#privacy--data) | Camera, `localStorage` |
| [Requirements](#requirements) | Browsers and hosting |
| [License](#license) | MIT + attribution note |

---

## Quick start

The app loads **ES modules** over **HTTP** (opening `index.html` as a `file://` URL will not work).

```bash
cd fluid-particle-simulation
python3 -m http.server 5173
```

Open **http://localhost:5173** in your browser.

Other options: **VS Code Live Server**, `npx serve`, or any static file server with the **repo root** as the document root.

**Deploying / forking:** If you host a copy under another URL, update **`og:url`** and **`rel="canonical"`** in `index.html` so social previews and SEO point to your deployment.

---

## Using HYDRO

### First visit

1. Read the **welcome** overlay, then choose **Enter**.
2. **Allow the camera** when the browser asks—the tank is controlled from your **hand in frame** (not mouse on the canvas).
3. On **wide screens**, use the **left column** of sliders for particles, gravity, viscosity, cohesion, and other parameters.

### HUD (heads-up display)

| Area | Role |
|------|------|
| **Top** | Title, short tagline, **Help** (`<details>`) with metrics legend |
| **Metrics** | **FPS**, **N** (particle count), **MODE** (webcam), **SIG** (gesture: hold / stir) |
| **Status line** | Vision state (loading, active, show hand, errors, etc.) |
| **Left rail** | Physics sliders (hidden on small/narrow layouts to save space) |
| **Footer** | **Hold** (pause) · **Reset** (respawn) · **Welcome** (replay intro) |

### Input model

- **Scene:** webcam hand tracking only (the canvas does not use mouse or wheel for moving the tank).
- **Tuning:** range inputs in the left rail (desktop).
- **Hold / Reset / Welcome:** buttons as above.

---

## Repository map

```text
fluid-particle-simulation/
├── index.html          # Page shell, intro overlay, HUD, #controls mount
├── style.css           # Layout, HUD, intro, responsive rules
├── LICENSE
├── README.md           # This file
└── src/
    ├── main.js         # Game loop, resize, MediaPipe + camera, HUD wiring
    ├── sim/
    │   └── particles.js    # ParticleSim: physics, spatial hash, drawing
    └── ui/
        └── controls.js     # Injects physics sliders into #controls
```

**Good starting points for reading code**

1. `index.html` — structure and copy  
2. `src/main.js` — frame loop, vision lifecycle, pause/reset  
3. `src/sim/particles.js` — simulation parameters and step  
4. `src/ui/controls.js` — slider definitions (preset chip UI exists in code but is **hidden** in CSS for this build)

---

## How it works

- **Simulation** (`ParticleSim`): position-based style fluid flavor—density kernels, pressure vs rest density, viscosity, gravity, walls inside a rotated box projected to 2D.
- **Neighbors:** spatial hashing keeps work closer to \(O(n)\) than \(O(n^2)\) as you raise particle count.
- **Vision:** `@mediapipe/tasks-vision` is loaded with **`import()`** from jsDelivr (WASM). After the intro, the app **requests the camera** and runs hand landmark inference on video frames.
- **Rendering:** Canvas is sized with **`devicePixelRatio`** (capped at 2). The mirrored video can be drawn under the particle pass when tracking is active.

---

## Privacy & data

| Item | Detail |
|------|--------|
| **Camera** | Used for hand tracking while the page is open; tracks are stopped on tab close / unload. |
| **Intro** | If you dismiss the welcome overlay, a flag is stored in **`localStorage`** (`hydro-intro-v1`) so it stays dismissed. **Welcome** clears that flag. |
| **Analytics** | None in this repository. |

---

## Requirements

- **Browser:** Recent Chrome, Edge, Firefox, or Safari. **Chrome** is the most reliable target for MediaPipe + camera.
- **Camera:** Required for steering the scene (with user permission).
- **Hosting:** Static files only; no server-side API.

---

## Performance

- **`particleCount`** (slider) is the main CPU cost.
- Hand tracking adds **per-frame** model work; expect lower **FPS** on weak devices or high resolutions.

---

## License

[MIT](LICENSE). Copyright (c) 2026 **Rawan Bazadough**. The license asks that the **HYDRO** name and [demo link](https://rawanbee.github.io/fluid-particle-simulation/) stay with the copyright notice when you redistribute or ship derivatives—see `LICENSE` for the exact wording.

---

## Release checklist (maintainers)

- [ ] `og:url` and `rel="canonical"` in `index.html` match the deployment URL  
- [ ] Smoke test in **Chrome**: intro → camera permission → hand moves tank → sliders (desktop) → Hold / Reset  
- [ ] **README** demo link points at the live site you intend to ship  

---
