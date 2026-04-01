const CONTROL_CONFIG = [
  { key: "particleCount", label: "particles", min: 200, max: 4200, step: 50, type: "int" },
  { key: "radius", label: "orbeez size", min: 8.4, max: 10.4, step: 0.1, type: "float" },
  { key: "gravity", label: "gravity", min: 0, max: 1800, step: 10, type: "float" },
  { key: "interactionRadius", label: "smoothing", min: 10, max: 24, step: 1, type: "float" },
  { key: "restDensity", label: "density", min: 4, max: 24, step: 1, type: "float" },
  { key: "pressureStiffness", label: "pressure", min: 0.05, max: 0.5, step: 0.01, type: "float" },
  { key: "nearPressureStiffness", label: "cohesion", min: 0.1, max: 0.5, step: 0.01, type: "float" },
  { key: "viscosity", label: "viscosity", min: 0, max: 0.5, step: 0.01, type: "float" },
  { key: "bounce", label: "wall bounce", min: 0.85, max: 1.0, step: 0.01, type: "float" },
  { key: "mouseForce", label: "stir force", min: 800, max: 10000, step: 100, type: "float" },
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
  chips.className = "hud-bottom";
  chips.style.position = "static";
  chips.style.left = "auto";
  chips.style.right = "auto";
  chips.style.bottom = "auto";
  chips.style.paddingBottom = "8px";

  const quickActions = [
    { label: "Water", patch: { viscosity: 0.03, nearPressureStiffness: 0.56, pressureStiffness: 0.24, bounce: 0.96 } },
    { label: "Gel", patch: { viscosity: 0.18, nearPressureStiffness: 0.92, pressureStiffness: 0.33, bounce: 0.9 } },
    { label: "Bouncy", patch: { bounce: 0.998, viscosity: 0.02, nearPressureStiffness: 0.48, pressureStiffness: 0.2 } },
  ];

  quickActions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
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
  drawer.className = "controls-drawer";

  const summary = document.createElement("summary");
  summary.textContent = "Tuning";
  drawer.append(summary);

  const content = document.createElement("div");
  content.className = "controls-content";

  CONTROL_CONFIG.forEach((control) => {
    const wrapper = document.createElement("div");
    wrapper.className = "control-group";

    const row = document.createElement("div");
    row.className = "control-row";

    const label = document.createElement("label");
    label.setAttribute("for", control.key);
    label.textContent = control.label;

    const valueLabel = document.createElement("span");
    valueLabel.textContent = formatValue(control.type, initialParams[control.key]);

    row.append(label, valueLabel);

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
