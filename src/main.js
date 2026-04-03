import { ParticleSim } from "./sim/particles.js";
import { mountControls } from "./ui/controls.js";

const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");
const controlsRoot = document.getElementById("controls");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const fpsLabel = document.getElementById("fpsLabel");
const particleCountLabel = document.getElementById("particleCountLabel");
const handToggleBtn = document.getElementById("handToggleBtn");
const handStatusLabel = document.getElementById("handStatusLabel");
const handVideo = document.getElementById("handVideo");
const modeChip = document.getElementById("modeChip");
const gestureChip = document.getElementById("gestureChip");
const introOverlay = document.getElementById("introOverlay");
const introDismiss = document.getElementById("introDismiss");
const introReplay = document.getElementById("introReplay");

const INTRO_STORAGE_KEY = "hydro-intro-v1";

const sim = new ParticleSim(canvas.width, canvas.height);
const POSITION_ALPHA_SLOW = 0.08;
const POSITION_ALPHA_MED = 0.14;
const POSITION_ALPHA_FAST = 0.22;
const ROTATION_ALPHA_SLOW = 0.06;
const ROTATION_ALPHA_MED = 0.08;
const ROTATION_ALPHA_FAST = 0.14;
const SCALE_ALPHA_SLOW = 0.04;
const SCALE_ALPHA_MED = 0.06;
const SCALE_ALPHA_FAST = 0.1;
const TELEKINESIS_POS_BLEND = 0.6;
const TELEKINESIS_ROT_BLEND = 0.72;
const TELEKINESIS_SCALE_BLEND = 0.5;

const OPENNESS_ENTER = 0.12;
const OPENNESS_STIR = 0.125;
const CENTER_DEAD_ZONE = 0.03;
const ROLL_DEAD_ZONE = 0.05;
const PITCH_DEAD_ZONE = 0.05;
const YAW_DEAD_ZONE = 0.03;
const HAND_LOST_FREEZE_MS = 120;
const HAND_LOST_RELAX_MS = 350;
const MOVE_GAIN_X = 1.15;
const MOVE_GAIN_Y = 1.15;
const ROT_GAIN_X = 1.35;
const ROT_GAIN_Y = 1.35;
const ROT_GAIN_Z = 1.15;
const ZOOM_MIN = 0.78;
const ZOOM_MAX = 1.28;
const ANCHOR_REACQUIRE_MS = 300;
const ROTATION_DIRECTION_FLIP = -1;

let isPaused = false;
let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = 0;
let isStirMode = false;
let handTrackingEnabled = false;
let handStream = null;
let handLandmarker = null;
let lastVideoTime = -1;
let lastHandSeenMs = 0;
let lostSinceMs = 0;
let handMode = "idle";
let mouseDragMode = "rotate";
let reacquireStartMs = 0;
let reacquireDurationMs = 220;
let reacquireFromPose = null;
let handAnchor = null;
let lastTrackedHandMs = 0;
let filteredPose = {
  x: canvas.width * 0.55,
  y: canvas.height * 0.58,
  rx: -0.52,
  ry: 0.52,
  rz: 0,
  scale: 1,
};
let lastStablePose = { ...filteredPose };
let prevPoseForSpeed = { x: filteredPose.x, y: filteredPose.y };
const smoothedLandmarks = {};

particleCountLabel.textContent = String(sim.particles.length);
setModeChip("MOUSE");
setGestureChip("—");

mountControls(controlsRoot, sim.params, (key, value) => {
  sim.setParam(key, value);

  if (key === "particleCount") {
    sim.reset(value);
    particleCountLabel.textContent = String(sim.particles.length);
  }
});

function resizeScene() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(window.innerWidth * dpr);
  const height = Math.floor(window.innerHeight * dpr);
  canvas.width = width;
  canvas.height = height;
  sim.resize(width, height);
  filteredPose.x = width * 0.55;
  filteredPose.y = height * 0.58;
  prevPoseForSpeed.x = filteredPose.x;
  prevPoseForSpeed.y = filteredPose.y;
}

resizeScene();
window.addEventListener("resize", resizeScene);

const hudTune = document.getElementById("hudTune");
const hudTuneWideMq = window.matchMedia("(min-width: 641px)");

function syncHudTuneOpen() {
  if (!hudTune) {
    return;
  }
  hudTune.open = hudTuneWideMq.matches;
}

syncHudTuneOpen();
hudTuneWideMq.addEventListener("change", syncHudTuneOpen);

function bindIntroOverlay() {
  if (!introOverlay || !introDismiss) {
    return;
  }

  if (localStorage.getItem(INTRO_STORAGE_KEY)) {
    introOverlay.classList.add("intro--gone");
    introOverlay.setAttribute("aria-hidden", "true");
    introOverlay.classList.remove("intro--checking");
  } else {
    requestAnimationFrame(() => {
      introOverlay.classList.remove("intro--checking");
      introDismiss.focus();
    });
  }

  function dismissIntro() {
    localStorage.setItem(INTRO_STORAGE_KEY, "1");
    introOverlay.classList.add("intro--leaving");
    introOverlay.setAttribute("aria-hidden", "true");
    introOverlay.addEventListener(
      "transitionend",
      () => {
        introOverlay.classList.add("intro--gone");
        introOverlay.classList.remove("intro--leaving");
      },
      { once: true },
    );
  }

  introDismiss.addEventListener("click", dismissIntro);

  introOverlay.addEventListener("click", (event) => {
    if (event.target === introOverlay) {
      dismissIntro();
    }
  });

  if (introReplay) {
    introReplay.addEventListener("click", () => {
      localStorage.removeItem(INTRO_STORAGE_KEY);
      introOverlay.classList.remove("intro--gone", "intro--leaving");
      introOverlay.setAttribute("aria-hidden", "false");
      introDismiss.focus();
    });
  }

  introOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !introOverlay.classList.contains("intro--gone")) {
      introDismiss.click();
    }
  });
}

bindIntroOverlay();

pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "Run" : "Hold";
});

resetBtn.addEventListener("click", () => {
  sim.reset(sim.params.particleCount);
  particleCountLabel.textContent = String(sim.particles.length);
});

function setHandStatus(text) {
  handStatusLabel.textContent = text;
}

function setModeChip(text) {
  modeChip.textContent = text;
}

function setGestureChip(text) {
  gestureChip.textContent = text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyDeadZone(value, zone) {
  if (Math.abs(value) <= zone) {
    return 0;
  }
  return value > 0 ? value - zone : value + zone;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothLandmark(landmarks, index, alpha) {
  const source = landmarks[index];
  const prev = smoothedLandmarks[index];
  if (!prev) {
    const seeded = { x: source.x, y: source.y, z: source.z };
    smoothedLandmarks[index] = seeded;
    return seeded;
  }
  prev.x += (source.x - prev.x) * alpha;
  prev.y += (source.y - prev.y) * alpha;
  prev.z += (source.z - prev.z) * alpha;
  return prev;
}

async function setupHandTrackerModel() {
  if (handLandmarker) {
    return true;
  }

  setHandStatus("Vision: loading model…");
  try {
    const visionTasks = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
    const filesetResolver = await visionTasks.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    );
    handLandmarker = await visionTasks.HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minTrackingConfidence: 0.55,
    });
    return true;
  } catch (error) {
    setHandStatus("Vision: model error");
    // eslint-disable-next-line no-console
    console.error(error);
    return false;
  }
}

async function startHandTracking() {
  const modelReady = await setupHandTrackerModel();
  if (!modelReady) {
    return;
  }

  setHandStatus("Vision: requesting camera…");
  try {
    handStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
      audio: false,
    });
    handVideo.srcObject = handStream;
    await handVideo.play();
    handTrackingEnabled = true;
    lostSinceMs = 0;
    reacquireFromPose = null;
    handAnchor = null;
    lastTrackedHandMs = 0;
    lastStablePose = { ...filteredPose };
    handToggleBtn.textContent = "End track";
    setHandStatus("Vision: active");
  } catch (error) {
    setHandStatus("Vision: permission denied");
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

function stopHandTracking() {
  handTrackingEnabled = false;
  handMode = "idle";
  lostSinceMs = 0;
  reacquireFromPose = null;
  handAnchor = null;
  lastTrackedHandMs = 0;
  setModeChip("MOUSE");
  setGestureChip("—");
  handToggleBtn.textContent = "Vision track";
  setHandStatus("Vision: off");
  if (handStream) {
    handStream.getTracks().forEach((track) => track.stop());
    handStream = null;
  }
  handVideo.srcObject = null;
  sim.setPointer(0, 0, false);
  sim.relaxHandPose(1 / 60, false);
}

function applyHandPoseFromLandmarks(landmarks, handednessLabel, now, dt) {
  const lmAlpha = 0.28;
  const wrist = smoothLandmark(landmarks, 0, lmAlpha);
  const thumbTip = smoothLandmark(landmarks, 4, lmAlpha);
  const indexMcp = smoothLandmark(landmarks, 5, lmAlpha);
  const indexTip = smoothLandmark(landmarks, 8, lmAlpha);
  const middleMcp = smoothLandmark(landmarks, 9, lmAlpha);
  const middleTip = smoothLandmark(landmarks, 12, lmAlpha);
  const ringTip = smoothLandmark(landmarks, 16, lmAlpha);
  const pinkyMcp = smoothLandmark(landmarks, 17, lmAlpha);
  const pinkyTip = smoothLandmark(landmarks, 20, lmAlpha);

  const palmX = (wrist.x + indexMcp.x + middleMcp.x + pinkyMcp.x) * 0.25;
  const palmY = (wrist.y + indexMcp.y + middleMcp.y + pinkyMcp.y) * 0.25;
  let screenX = (1 - palmX) * canvas.width;
  let screenY = palmY * canvas.height;

  // Handedness from the model is in camera space; the scene is mirrored.
  // Flipping sign here aligns perceived rotation with on-screen motion.
  const handSign = handednessLabel === "Left" ? 1 : -1;
  let roll = Math.atan2(indexMcp.y - pinkyMcp.y, indexMcp.x - pinkyMcp.x);
  let pitch = Math.atan2(middleMcp.y - wrist.y, Math.abs(middleMcp.x - wrist.x) + 1e-5);
  let yaw = (indexMcp.z - pinkyMcp.z) * 2.6;
  roll = applyDeadZone(roll, ROLL_DEAD_ZONE) * handSign;
  pitch = applyDeadZone(pitch, PITCH_DEAD_ZONE);
  yaw = applyDeadZone(yaw, YAW_DEAD_ZONE) * handSign;

  const pinch = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
  const palmSpan = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
  const handHeight = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
  const avgZ = (wrist.z + indexMcp.z + middleMcp.z + pinkyMcp.z) * 0.25;
  const depthMetric = (palmSpan * 0.6 + handHeight * 0.4) * 0.8 + (1 / Math.max(0.08, Math.abs(avgZ))) * 0.2;
  const openness =
    (Math.hypot(indexTip.x - palmX, indexTip.y - palmY) +
      Math.hypot(middleTip.x - palmX, middleTip.y - palmY) +
      Math.hypot(ringTip.x - palmX, ringTip.y - palmY) +
      Math.hypot(pinkyTip.x - palmX, pinkyTip.y - palmY)) *
    0.25;

  let centeredX = screenX / canvas.width - 0.5;
  let centeredY = screenY / canvas.height - 0.5;
  centeredX = applyDeadZone(centeredX, CENTER_DEAD_ZONE);
  centeredY = applyDeadZone(centeredY, CENTER_DEAD_ZONE);

  let measuredPose = {
    centerX: clamp(screenX, canvas.width * 0.18, canvas.width * 0.82),
    centerY: clamp(screenY, canvas.height * 0.15, canvas.height * 0.86),
    rotX: clamp((centeredY * 1.35 + pitch * 0.85) * ROTATION_DIRECTION_FLIP, -1.15, 1.15),
    rotY: clamp((centeredX * 1.1 + yaw * 0.7) * ROTATION_DIRECTION_FLIP, -1.3, 1.3),
    rotZ: clamp((-roll * 0.75) * ROTATION_DIRECTION_FLIP, -1.1, 1.1),
    size: depthMetric,
  };

  if (!handAnchor || now - lastTrackedHandMs > ANCHOR_REACQUIRE_MS) {
    handAnchor = { ...measuredPose };
  }
  lastTrackedHandMs = now;

  const dx = measuredPose.centerX - handAnchor.centerX;
  const dy = measuredPose.centerY - handAnchor.centerY;
  const dRotX = measuredPose.rotX - handAnchor.rotX;
  const dRotY = measuredPose.rotY - handAnchor.rotY;
  const dRotZ = measuredPose.rotZ - handAnchor.rotZ;
  const sizeRatio = measuredPose.size / Math.max(handAnchor.size, 1e-4);

  let desiredCx = sim.defaultCx + dx * MOVE_GAIN_X;
  let desiredCy = sim.defaultCy + dy * MOVE_GAIN_Y;
  let desiredRotX = sim.defaultRotationX + dRotX * ROT_GAIN_X;
  let desiredRotY = sim.defaultRotationY + dRotY * ROT_GAIN_Y;
  let desiredRotZ = sim.defaultRotationZ + dRotZ * ROT_GAIN_Z;
  let desiredScale = clamp(sizeRatio, ZOOM_MIN, ZOOM_MAX);
  desiredScale = 1 + (desiredScale - 1) * 0.85;

  // Blend anchor-relative control with direct hand pose for a stronger
  // "telekinetic" feel while keeping anchor stability.
  desiredCx = lerp(desiredCx, measuredPose.centerX, TELEKINESIS_POS_BLEND);
  desiredCy = lerp(desiredCy, measuredPose.centerY, TELEKINESIS_POS_BLEND);
  desiredRotX = lerp(desiredRotX, measuredPose.rotX, TELEKINESIS_ROT_BLEND);
  desiredRotY = lerp(desiredRotY, measuredPose.rotY, TELEKINESIS_ROT_BLEND);
  desiredRotZ = lerp(desiredRotZ, measuredPose.rotZ, TELEKINESIS_ROT_BLEND);
  desiredScale = lerp(desiredScale, clamp(measuredPose.size / Math.max(handAnchor.size, 1e-4), ZOOM_MIN, ZOOM_MAX), TELEKINESIS_SCALE_BLEND);

  if (reacquireFromPose && now - reacquireStartMs < reacquireDurationMs) {
    const t = clamp((now - reacquireStartMs) / reacquireDurationMs, 0, 1);
    const eased = t * t * (3 - 2 * t);
    desiredCx = reacquireFromPose.x + (desiredCx - reacquireFromPose.x) * eased;
    desiredCy = reacquireFromPose.y + (desiredCy - reacquireFromPose.y) * eased;
    desiredRotX = reacquireFromPose.rx + (desiredRotX - reacquireFromPose.rx) * eased;
    desiredRotY = reacquireFromPose.ry + (desiredRotY - reacquireFromPose.ry) * eased;
    desiredRotZ = reacquireFromPose.rz + (desiredRotZ - reacquireFromPose.rz) * eased;
    desiredScale = reacquireFromPose.scale + (desiredScale - reacquireFromPose.scale) * eased;
  } else {
    reacquireFromPose = null;
  }

  desiredCx = clamp(desiredCx, canvas.width * 0.18, canvas.width * 0.82);
  desiredCy = clamp(desiredCy, canvas.height * 0.15, canvas.height * 0.86);
  desiredRotX = clamp(desiredRotX, -1.15, 1.15);
  desiredRotY = clamp(desiredRotY, -1.3, 1.3);
  desiredRotZ = clamp(desiredRotZ, -1.1, 1.1);

  const motion = Math.hypot(desiredCx - filteredPose.x, desiredCy - filteredPose.y);
  let posAlpha = POSITION_ALPHA_SLOW;
  let rotAlpha = ROTATION_ALPHA_SLOW;
  let scaleAlpha = SCALE_ALPHA_SLOW;
  if (motion > canvas.width * 0.015) {
    posAlpha = POSITION_ALPHA_MED + 0.04;
    rotAlpha = ROTATION_ALPHA_MED + 0.03;
    scaleAlpha = SCALE_ALPHA_MED + 0.02;
  }
  if (motion > canvas.width * 0.035) {
    posAlpha = POSITION_ALPHA_FAST + 0.05;
    rotAlpha = ROTATION_ALPHA_FAST + 0.04;
    scaleAlpha = SCALE_ALPHA_FAST + 0.03;
  }

  filteredPose.x += (desiredCx - filteredPose.x) * posAlpha;
  filteredPose.y += (desiredCy - filteredPose.y) * posAlpha;
  filteredPose.rx += (desiredRotX - filteredPose.rx) * rotAlpha;
  filteredPose.ry += (desiredRotY - filteredPose.ry) * rotAlpha;
  filteredPose.rz += (desiredRotZ - filteredPose.rz) * rotAlpha;
  filteredPose.scale += (desiredScale - filteredPose.scale) * scaleAlpha;

  const handSpeed = Math.hypot(filteredPose.x - prevPoseForSpeed.x, filteredPose.y - prevPoseForSpeed.y) / Math.max(dt, 1e-4);
  prevPoseForSpeed.x = filteredPose.x;
  prevPoseForSpeed.y = filteredPose.y;

  const shouldStir = openness > OPENNESS_STIR && pinch > OPENNESS_ENTER && handSpeed > canvas.width * 0.26;
  setGestureChip(shouldStir ? "STIR" : "HOLD");
  setModeChip("HAND");

  sim.applyHandPose(filteredPose.x, filteredPose.y, filteredPose.rx, filteredPose.ry, filteredPose.rz, filteredPose.scale);
  handMode = shouldStir ? "stir" : "hold";
  sim.setPointer(shouldStir ? filteredPose.x : 0, shouldStir ? filteredPose.y : 0, shouldStir);
  lastStablePose = { ...filteredPose };
}

function updateHandTracking(now, dt) {
  if (!handTrackingEnabled) {
    return;
  }

  if (!handLandmarker || handVideo.readyState < 2) {
    sim.setPointer(0, 0, false);
    sim.relaxHandPose(dt, true);
    return;
  }

  if (handVideo.currentTime === lastVideoTime) {
    if (now - lastHandSeenMs > 350) {
      sim.setPointer(0, 0, false);
      handMode = "idle";
      setGestureChip("—");
      sim.relaxHandPose(dt, true);
      setHandStatus("Vision: show hand");
    }
    return;
  }
  lastVideoTime = handVideo.currentTime;

  const results = handLandmarker.detectForVideo(handVideo, now);
  if (results.landmarks && results.landmarks.length > 0) {
    const lostDuration = lostSinceMs > 0 ? now - lostSinceMs : 0;
    if (lostDuration > HAND_LOST_FREEZE_MS) {
      reacquireFromPose = { ...lastStablePose };
      reacquireStartMs = now;
    }
    lostSinceMs = 0;
    const handednessLabel = results.handedness?.[0]?.[0]?.categoryName ?? "Right";
    applyHandPoseFromLandmarks(results.landmarks[0], handednessLabel, now, dt);
    lastHandSeenMs = now;
    setHandStatus("Vision: locked");
  } else {
    if (lostSinceMs === 0) {
      lostSinceMs = now;
    }
    const lostDuration = now - lostSinceMs;
    sim.setPointer(0, 0, false);
    if (lostDuration <= HAND_LOST_FREEZE_MS) {
      setHandStatus("Vision: acquiring…");
      return;
    }
    handMode = "idle";
    setGestureChip("—");
    if (lostDuration <= HAND_LOST_RELAX_MS) {
      sim.relaxHandPose(dt * 0.45, true);
      setHandStatus("Vision: hold steady");
      return;
    }
    handAnchor = null;
    lastTrackedHandMs = 0;
    sim.relaxHandPose(dt, true);
    setHandStatus("Vision: show hand");
  }
}

handToggleBtn.addEventListener("click", async () => {
  if (handTrackingEnabled) {
    stopHandTracking();
    return;
  }
  await startHandTracking();
  setModeChip("HAND");
});

window.addEventListener("beforeunload", () => {
  stopHandTracking();
});

function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * sx;
  const y = (event.clientY - rect.top) * sy;
  return { x, y };
}

canvas.addEventListener("pointerdown", (event) => {
  if (handTrackingEnabled) {
    return;
  }
  setGestureChip("PTR");
  const pointer = updatePointerFromEvent(event);
  isStirMode = event.altKey;

  if (isStirMode) {
    sim.setPointer(pointer.x, pointer.y, true);
    return;
  }

  if (event.shiftKey) {
    mouseDragMode = "pan";
  } else if (event.ctrlKey || event.metaKey) {
    mouseDragMode = "depth";
  } else {
    mouseDragMode = "rotate";
  }

  if (sim.containsPointInContainer(pointer.x, pointer.y)) {
    sim.startCubeDrag(pointer.x, pointer.y);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (handTrackingEnabled) {
    return;
  }
  const pointer = updatePointerFromEvent(event);
  if (sim.isDraggingCube && event.buttons !== 0) {
    sim.dragCube(pointer.x, pointer.y, mouseDragMode);
    return;
  }

  if (isStirMode) {
    sim.setPointer(pointer.x, pointer.y, event.buttons === 1);
  }
});

canvas.addEventListener("pointerup", () => {
  sim.endCubeDrag();
  sim.setPointer(0, 0, false);
  isStirMode = false;
  mouseDragMode = "rotate";
});

canvas.addEventListener("pointerleave", () => {
  sim.endCubeDrag();
  sim.setPointer(0, 0, false);
  isStirMode = false;
  mouseDragMode = "rotate";
});

canvas.addEventListener("wheel", (event) => {
  if (handTrackingEnabled) {
    return;
  }
  event.preventDefault();
  const delta = -Math.sign(event.deltaY) * 8;
  sim.adjustCubeScale(delta);
}, { passive: false });

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

function frame(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 1 / 30);

  updateHandTracking(now, dt);

  if (handTrackingEnabled && handVideo.readyState >= 2) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(handVideo, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.fillStyle = "#020508";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (!isPaused) {
    sim.update(dt);
  }
  sim.draw(ctx);

  frameCount += 1;
  fpsTimer += dt;
  if (fpsTimer >= 0.25) {
    const fps = frameCount / fpsTimer;
    fpsLabel.textContent = fps.toFixed(0);
    frameCount = 0;
    fpsTimer = 0;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
