# Fluid Particle Simulation

An interactive, browser-based fluid simulation built with vanilla JavaScript and HTML5 Canvas.

This project renders a real-time particle system inside a transformable 3D-style container ("Orbeez cube"), with both mouse controls and optional webcam-based hand tracking for gesture-driven interaction.

## Live Demo

[View the live demo](https://rawanbee.github.io/fluid-particle-simulation/)

## Highlights

- Real-time particle dynamics inspired by position-based fluid behavior
- Interactive 3D-style container with rotation, translation, depth, and scale controls
- Gesture input via camera using MediaPipe hand landmark detection
- Runtime tuning panel for simulation parameters (density, pressure, viscosity, gravity, and more)
- Quick material presets (`Water`, `Gel`, `Bouncy`) for instant behavior changes
- Responsive canvas rendering with FPS and particle count HUD indicators

## Controls

### Mouse

- **Drag**: rotate container
- **Shift + Drag**: move container
- **Ctrl/Cmd + Drag**: adjust depth + twist
- **Mouse Wheel**: zoom container
- **Alt + Drag**: stir particles

### Hand Tracking (Optional)

- Click **Hand Control via Camera** to enable webcam input
- Open-hand movement controls cube position/rotation/scale
- Fast stirring motion activates particle stirring behavior

## Tech Stack

- Vanilla JavaScript (ES Modules)
- HTML5 Canvas
- CSS3
- [MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) (loaded via CDN for hand tracking)

## Getting Started

### Prerequisites

- A modern browser (Chrome recommended for best camera/MediaPipe support)
- Python 3 (only if using the local server option below)

### Run Locally

Because this project uses ES modules, serve it through a local HTTP server (do not open `index.html` directly via `file://`).

#### Option 1: VS Code Live Server

1. Open the project in VS Code.
2. Start **Live Server**.
3. Open the provided local URL.

#### Option 2: Python HTTP server

```bash
python3 -m http.server 5173
```

Then open [http://localhost:5173](http://localhost:5173).

## Project Structure

```text
fluid-particle-simulation/
├─ index.html
├─ style.css
└─ src/
   ├─ main.js           # app bootstrap, loop, input handling, hand tracking integration
   ├─ sim/
   │  └─ particles.js   # particle simulation, physics update, container transforms
   └─ ui/
      └─ controls.js    # parameter sliders and quick presets
```

## Notes

- Camera access is only required if you enable hand control.
- Performance depends on device GPU/CPU and selected particle count.
- Best experience is on desktop/laptop browsers.
