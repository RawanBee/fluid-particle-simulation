const CONTROL_CONFIG = [
  {
    key: "particleCount",
    label: "particles",
    min: 200,
    max: 4200,
    step: 50,
    type: "int",
    hint: "How many beads are simulated. Higher looks richer but costs more CPU. Changing this respawns the fluid.",
  },
  {
    key: "radius",
    label: "orbeez size",
    min: 6.0,
    max: 10.4,
    step: 0.1,
    type: "float",
    hint: "Radius of each particle in sim space. Bigger beads pack looser and collide sooner; smaller feel finer.",
  },
  {
    key: "gravity",
    label: "gravity",
    min: 0,
    max: 1800,
    step: 10,
    type: "float",
    hint: "Strength of gravity along world-up (the tank rotation still applies). 0 floats the pile.",
  },
  {
    key: "interactionRadius",
    label: "smoothing",
    min: 10,
    max: 26,
    step: 1,
    type: "float",
    hint: "Neighbor radius for density and pressure. Larger = smoother, softer clumps and more work per particle.",
  },
  {
    key: "restDensity",
    label: "density",
    min: 4,
    max: 24,
    step: 1,
    type: "float",
    hint: "Target crowding for the main pressure term. Below it, particles spread; above it, they get pushed apart.",
  },
  {
    key: "pressureStiffness",
    label: "pressure",
    min: 0.05,
    max: 0.5,
    step: 0.01,
    type: "float",
    hint: "How hard particles resist compressing past rest density. Higher = stiffer, more incompressible blob.",
  },
  {
    key: "nearPressureStiffness",
    label: "cohesion",
    min: 0.02,
    max: 0.5,
    step: 0.01,
    type: "float",
    hint: "Short-range “near density” pressure plus extra separation term—surface-tension-like clumping and skin.",
  },
  {
    key: "viscosity",
    label: "viscosity",
    min: 0,
    max: 0.5,
    step: 0.005,
    type: "float",
    hint: "Shear and bulk damping between neighbors. Higher = thicker, syrup-like motion; lower = slipperier.",
  },
  {
    key: "velocityDamping",
    label: "damping",
    min: 0,
    max: 0.25,
    step: 0.005,
    type: "float",
    hint: "Global velocity decay each frame. Calms slosh and jitter without changing neighbor physics.",
  },
  {
    key: "vorticityConfinement",
    label: "vorticity",
    min: 0,
    max: 180,
    step: 5,
    type: "int",
    hint: "Adds small-scale swirl so motion stays lively. 0 disables. Higher = more artificial curl.",
  },
  {
    key: "solverIterations",
    label: "solver passes",
    min: 1,
    max: 6,
    step: 1,
    type: "int",
    hint: "How many density/pressure solve passes per frame. More reduces overlap but costs more CPU.",
  },
  {
    key: "bounce",
    label: "wall elasticity",
    min: 0,
    max: 1.0,
    step: 0.01,
    type: "float",
    hint: "Wall restitution: 0 absorbs impacts, values toward 1 make the tank feel bouncier.",
  },
  {
    key: "mouseForce",
    label: "stir force",
    min: 800,
    max: 12500,
    step: 100,
    type: "float",
    hint: "Push strength when the sim is stirring (hand gesture / SIG stir). Stronger = more violent local swirl.",
  },
];

function formatValue(type, value) {
  if (type === "int") {
    return String(Math.round(value));
  }
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

export function mountControls(rootEl, initialParams, onChange) {
  rootEl.innerHTML = "";
  const controlRefs = new Map();
  const chips = document.createElement("div");
  chips.className = "control-presets";

  const quickActions = [
    {
      label: "Cinematic",
      patch: {
        particleCount: 1400,
        radius: 6.2,
        gravity: 820,
        interactionRadius: 22,
        restDensity: 9.2,
        pressureStiffness: 0.14,
        nearPressureStiffness: 0.22,
        viscosity: 0.055,
        velocityDamping: 0.018,
        vorticityConfinement: 135,
        bounce: 0.03,
        mouseForce: 12000,
        fillFraction: 0.5,
      },
    },
    {
      label: "Playful",
      patch: {
        interactionRadius: 18,
        restDensity: 7.6,
        pressureStiffness: 0.19,
        nearPressureStiffness: 0.036,
        viscosity: 0.02,
        bounce: 0.088,
        velocityDamping: 0.059,
        vorticityConfinement: 90,
        mouseForce: 9500,
      },
    },
    {
      label: "Water",
      patch: {
        viscosity: 0.07,
        nearPressureStiffness: 0.56,
        pressureStiffness: 0.24,
        bounce: 0.04,
        velocityDamping: 0.02,
        vorticityConfinement: 0,
        interactionRadius: 16,
        restDensity: 8.6,
      },
    },
    { label: "Gel", patch: { viscosity: 0.22, nearPressureStiffness: 0.92, pressureStiffness: 0.33, bounce: 0.08, velocityDamping: 0.04, vorticityConfinement: 0 } },
    { label: "Bouncy", patch: { bounce: 0.98, viscosity: 0.02, nearPressureStiffness: 0.48, pressureStiffness: 0.2, velocityDamping: 0.015, vorticityConfinement: 35 } },
  ];

  quickActions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      Object.entries(action.patch).forEach(([key, value]) => {
        const ref = controlRefs.get(key);
        if (!ref) {
          onChange(key, value);
          return;
        }
        const clamped = Math.max(ref.control.min, Math.min(ref.control.max, value));
        ref.input.value = String(clamped);
        ref.valueLabel.textContent = formatValue(ref.control.type, clamped);
        onChange(key, clamped);
      });
    });
    chips.append(button);
  });

  const drawer = document.createElement("details");
  drawer.id = "hudTune";
  drawer.className = "controls-drawer hud-tune";
  drawer.setAttribute("aria-label", "Physics parameters");

  const summary = document.createElement("summary");
  summary.className = "controls-drawer__summary";
  summary.textContent = "Physics parameters";
  drawer.append(summary);

  const content = document.createElement("div");
  content.className = "controls-content controls-content--grid";

  CONTROL_CONFIG.forEach((control) => {
    const wrapper = document.createElement("div");
    wrapper.className = "control-group";

    const row = document.createElement("div");
    row.className = "control-row";

    const label = document.createElement("label");
    label.setAttribute("for", control.key);
    label.textContent = control.label;

    const hintWrap = document.createElement("span");
    hintWrap.className = "control-hint-wrap";

    const hintBtn = document.createElement("button");
    hintBtn.type = "button";
    

    const valueLabel = document.createElement("span");
    valueLabel.className = "control-value";
    valueLabel.textContent = formatValue(control.type, initialParams[control.key]);

    row.append(label, hintWrap, valueLabel);

    hintBtn.className = "control-hint";
    hintBtn.setAttribute("aria-label", `${control.label}: help`);
    const tipId = `control-hint-${control.key}`;
    hintBtn.setAttribute("aria-describedby", tipId);

    const hintIcon = document.createElement("span");
    hintIcon.className = "control-hint__icon";
    hintIcon.setAttribute("aria-hidden", "true");
    hintIcon.textContent = "i";

    const hintTooltip = document.createElement("span");
    hintTooltip.className = "control-hint__tooltip";
    hintTooltip.id = tipId;
    hintTooltip.setAttribute("role", "tooltip");
    hintTooltip.textContent = control.hint;

    hintBtn.append(hintIcon);
    hintWrap.append(hintBtn, hintTooltip);
    
    const input = document.createElement("input");
    input.type = "range";
    input.id = control.key;
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    input.value = String(initialParams[control.key]);

    input.addEventListener("input", () => {
      const raw = Number(input.value);
      const value = control.type === "int" ? Math.round(raw) : raw;
      valueLabel.textContent = formatValue(control.type, value);
      onChange(control.key, value);
    });

    controlRefs.set(control.key, {
      control,
      input,
      valueLabel,
    });

    wrapper.append(row, input);
    content.append(wrapper);
  });

  drawer.append(content);
  rootEl.append(chips, drawer);
}
