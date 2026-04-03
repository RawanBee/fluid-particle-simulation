# Fluid particle simulation (HYDRO)

A **browser-only**, real-time **2D canvas** demo that reads like a soft-body fluid: thousands of particles in a transformable 3D-style glass box, with **mouse/trackpad** control and optional **webcam hand tracking** (MediaPipe). No build step, no framework—just ES modules, Canvas 2D, and a small physics core.

**[Live demo →](https://rawanbee.github.io/fluid-particle-simulation/)**

## Capabilities

| Topic | Notes |
|-------|--------|
| **Graphics** | Canvas 2D game loop, device-pixel-ratio sizing, compositing video + particles |
| **Simulation** | Time-stepped particle dynamics, density/pressure model, spatial hashing for neighbor queries |
| **Interaction** | Pointer events, multi-mode drag (rotate / pan / depth), gesture heuristics over landmarks |
| **Vision** | Dynamic `import()` of MediaPipe Tasks Vision, WASM backend, async model + camera lifecycle |
| **UI** | Responsive HUD, `prefers-reduced-motion`, safe areas, progressive disclosure on small screens |
| **Structure** | `sim/` (physics), `ui/` (controls), `main.js` (integration + loop) |

## Technical overview

- **`ParticleSim`** (`src/sim/particles.js`) drives positions each frame using a **position-based style** fluid flavor: smooth density kernels, pressure from deviation from rest density, viscosity, gravity, and wall collision inside a **rotated 3D box** projected to screen space.
- **Neighbor work** uses a **spatial hash** (`buildSpatialHash` / `forEachNeighborPair`) so pairwise work scales far better than naive \(O(n^2)\) over the particle count slider range.
- **`main.js`** owns the **`requestAnimationFrame` loop**, resize/DPR handling, pointer routing, and optional **HandLandmarker** pose → cube transform + stir detection. The webcam stream is drawn under the sim when vision mode is on.

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Modern evergreen browsers (Chrome recommended for MediaPipe + camera) |
| Language | JavaScript **ES modules** |
| Rendering | **HTML5 Canvas 2D** + `<video>` underlay for camera |
| Styling | **CSS3** (custom properties, `clamp`, `dvh`, safe-area insets, media queries) |
| Hand tracking | **[@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision)** via **jsDelivr CDN** (dynamic import + WASM) |

There is **no** `package.json`: zero install, clone and serve.

## Project layout

```text
fluid-particle-simulation/
├── index.html          # markup: viewport, HUD, intro overlay, controls mount point
├── style.css           # HUD / intro / responsive layout
├── README.md
└── src/
    ├── main.js         # RAF loop, input, resize, MediaPipe integration, intro persistence
    ├── sim/
    │   └── particles.js    # ParticleSim: physics, container, spatial hash, drawing
    └── ui/
        └── controls.js     # Sliders + Water / Gel / Bouncy presets (injected into #controls)
```

## Running locally

ES modules require **HTTP** (not `file://`).

**Python:**

```bash
cd fluid-particle-simulation
python3 -m http.server 5173
```

Open [http://localhost:5173](http://localhost:5173).

**Or** use VS Code **Live Server** (or any static file server) pointed at the repo root.

## Controls

**Mouse / trackpad**

| Input | Effect |
|--------|--------|
| Drag on canvas | Rotate the container |
| **Shift** + drag | Pan the container |
| **Ctrl** / **Cmd** + drag | Depth / twist |
| Wheel | Zoom |
| **Alt** + drag | Stir particles |

**Vision (optional)**

- **Vision track** — requests camera, loads the hand landmarker model, maps hand pose to cube motion and optional stir.
- Permission is only needed when you enable tracking.

**HUD**

- **Hold** — pause simulation; **Run** resumes.
- **Reset** — respawn particles at current count.
- **Tune** — presets + parameter drawer (on narrow viewports this starts collapsed).
- **Welcome** — replay the onboarding overlay (also clears the stored dismiss flag).

## Performance notes

- **`particleCount`** is the main cost driver; spatial hashing keeps neighbor passes practical, but GPU/CPU still matter.
- Canvas size follows **`window.innerWidth/Height × min(devicePixelRatio, 2)`** to balance sharpness and fill rate.
- Hand tracking adds **inference per video frame**; expect lower FPS on low-end phones.

## Browser and privacy

- **Camera**: used only if the user enables vision tracking; tracks are stopped on disable / `beforeunload`.
- **Intro dismiss** uses **`localStorage`** key `hydro-intro-v1` (no analytics in this repo).

## Possible extensions

- WebGPU / WebGL for particle fill; worker thread for physics step
- Spatial structure tuned for SIMD or typed-array SoA layout
- Touch-specific gestures; PWA manifest for installable demo

---

## License

[MIT](LICENSE). Copyright (c) 2026 **Rawan Bazadough**. The license asks that the **HYDRO** project name and [demo link](https://rawanbee.github.io/fluid-particle-simulation/) stay with the copyright notice when you redistribute or ship derivatives—see `LICENSE` for the exact wording.
