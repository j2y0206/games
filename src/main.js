import * as THREE from "three";
import "./style.css";

const STORAGE_PREFIX = "pizza-village-25d:";
const START_POSITION = new THREE.Vector3(-1.8, 0, 6.2);
const DOOR_POSITION = new THREE.Vector3(5.5, 0, -3.15);
const PLAYER_RADIUS = 0.42;
const VIEW_HEIGHT = 12.5;

const ui = {
  gameRoot: document.querySelector("#game-root"),
  startScreen: document.querySelector("#start-screen"),
  startButton: document.querySelector("#start-button"),
  homeButton: document.querySelector("#home-button"),
  soundButton: document.querySelector("#sound-button"),
  joystickZone: document.querySelector("#joystick-zone"),
  joystickStick: document.querySelector("#joystick-stick"),
  actionButton: document.querySelector("#action-button"),
  actionLabel: document.querySelector("#action-label"),
  objectiveText: document.querySelector("#objective-text"),
  toast: document.querySelector("#scene-toast")
};

const controls = {
  x: 0,
  y: 0,
  activePointer: null,
  actionQueued: false,
  keys: new Set()
};

let started = false;
let muted = localStorage.getItem(`${STORAGE_PREFIX}muted`) === "true";
let audioContext = null;
let toastTimer = null;
let doorOpen = false;
let doorTargetRotation = 0;
let nearDoor = false;
let lastTime = performance.now();
let walkClock = 0;
let actionUiState = "";
let objectiveUiState = "";

const LOW_POWER_DEVICE =
  window.matchMedia("(pointer: coarse)").matches ||
  navigator.maxTouchPoints > 1 ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4);

function ensureAudio() {
  if (muted) return;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTone(frequency, duration = 0.1, delay = 0, volume = 0.025) {
  if (muted) return;
  ensureAudio();
  if (!audioContext) return;
  const startAt = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
}

function playStartSound() {
  playTone(392, 0.12, 0, 0.03);
  playTone(523, 0.14, 0.1, 0.028);
  playTone(659, 0.18, 0.2, 0.026);
}

function playDoorSound() {
  playTone(330, 0.11, 0, 0.025);
  playTone(494, 0.15, 0.1, 0.022);
}

function showToast(message, duration = 1500) {
  window.clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => ui.toast.classList.remove("is-visible"), duration);
}

function setAction(label, ready) {
  const nextState = `${label}|${ready}`;
  if (actionUiState === nextState) return;
  actionUiState = nextState;
  ui.actionLabel.textContent = label;
  ui.actionButton.setAttribute("aria-label", label);
  ui.actionButton.classList.toggle("is-ready", ready);
}

function setObjectiveText(text) {
  if (objectiveUiState === text) return;
  objectiveUiState = text;
  ui.objectiveText.textContent = text;
}

function setupJoystick() {
  const maxDistance = 38;

  function updatePointer(event) {
    const rect = ui.joystickZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    controls.x = x / maxDistance;
    controls.y = y / maxDistance;
    ui.joystickStick.style.transform = `translate(${x}px, ${y}px)`;
  }

  function release(event) {
    if (event.pointerId !== controls.activePointer) return;
    controls.activePointer = null;
    controls.x = 0;
    controls.y = 0;
    ui.joystickStick.style.transform = "translate(0, 0)";
  }

  ui.joystickZone.addEventListener("pointerdown", (event) => {
    if (!started || controls.activePointer !== null) return;
    controls.activePointer = event.pointerId;
    ui.joystickZone.setPointerCapture(event.pointerId);
    updatePointer(event);
    ensureAudio();
  });
  ui.joystickZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== controls.activePointer) return;
    event.preventDefault();
    updatePointer(event);
  });
  ui.joystickZone.addEventListener("pointerup", release);
  ui.joystickZone.addEventListener("pointercancel", release);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcbe7df);
scene.fog = new THREE.Fog(0xcbe7df, 22, 38);

const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 80);
const cameraFocus = new THREE.Vector3(0.7, 0.8, 1.2);
const cameraOffset = new THREE.Vector3(11.5, 13.5, 16.5);

const renderer = new THREE.WebGLRenderer({ antialias: !LOW_POWER_DEVICE, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !LOW_POWER_DEVICE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = !LOW_POWER_DEVICE;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_POWER_DEVICE ? 1 : 1.35));
ui.gameRoot.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xfff8df, 0x668868, 2.35);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d2, 3.2);
sun.position.set(-10, 18, 12);
sun.castShadow = !LOW_POWER_DEVICE;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 45;
sun.shadow.bias = -0.0006;
scene.add(sun);

const COLORS = {
  grass: 0x78ad5e,
  grassDark: 0x4f8149,
  path: 0xe6c98d,
  pathEdge: 0xcba96c,
  cream: 0xffe8b5,
  wall: 0xf5dca4,
  wallShade: 0xd5b983,
  red: 0xc94d3c,
  terracotta: 0xc85b3d,
  wood: 0x895535,
  woodDark: 0x5b382a,
  teal: 0x3f7f78,
  leaf: 0x4f8e52,
  leafLight: 0x78aa58,
  water: 0x57aebb,
  ink: 0x3b3a32
};

const plainMaterialCache = new Map();

function toon(color, options = {}) {
  if (Object.keys(options).length > 0) return new THREE.MeshToonMaterial({ color, ...options });
  if (!plainMaterialCache.has(color)) plainMaterialCache.set(color, new THREE.MeshToonMaterial({ color }));
  return plainMaterialCache.get(color);
}

function shadowed(mesh, receive = true) {
  mesh.castShadow = !LOW_POWER_DEVICE;
  mesh.receiveShadow = !LOW_POWER_DEVICE && receive;
  return mesh;
}

function addBox(group, size, position, material, rotation = null) {
  const mesh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(...size), material));
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

const world = new THREE.Group();
scene.add(world);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), toon(COLORS.grass));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.09;
ground.receiveShadow = !LOW_POWER_DEVICE;
world.add(ground);

const blobShadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x284b3d,
  transparent: true,
  opacity: LOW_POWER_DEVICE ? 0.16 : 0.08,
  depthWrite: false
});

function addBlobShadow(x, z, width, depth, rotation = -0.45) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), blobShadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.rotation.z = rotation;
  shadow.scale.set(width, depth, 1);
  shadow.position.set(x, 0.012, z);
  shadow.renderOrder = 1;
  world.add(shadow);
  return shadow;
}

function addGroundDisc(x, z, radius, color, y = -0.035) {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), toon(color));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, y, z);
  disc.receiveShadow = !LOW_POWER_DEVICE;
  world.add(disc);
  return disc;
}

function addPathStrip(x, z, width, depth, rotation = 0) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, depth), toon(COLORS.path));
  strip.position.set(x, -0.025, z);
  strip.rotation.y = rotation;
  strip.receiveShadow = !LOW_POWER_DEVICE;
  world.add(strip);
  return strip;
}

addGroundDisc(0.7, 1.6, 5.2, COLORS.pathEdge, -0.06);
addGroundDisc(0.7, 1.6, 4.95, COLORS.path, -0.02);
addPathStrip(-1.1, 6.0, 4.2, 8.2, -0.05);
addPathStrip(3.5, -1.2, 4.1, 8.3, -0.67);
addGroundDisc(5.2, -3.0, 2.25, COLORS.path, -0.015);

const colliders = [];

function addTree(x, z, scale = 1, leafColor = COLORS.leaf) {
  addBlobShadow(x + 0.62 * scale, z + 0.52 * scale, 2.6 * scale, 1.15 * scale);
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.34 * scale, 2.2 * scale, 7), toon(COLORS.wood)));
  trunk.position.y = 1.05 * scale;
  group.add(trunk);

  const crownMat = toon(leafColor);
  const crownLight = toon(COLORS.leafLight);
  [
    [-0.42, 2.35, 0.86, crownMat],
    [0.4, 2.45, 0.8, crownMat],
    [0, 3.0, 0.95, crownLight]
  ].forEach(([cx, cy, radius, material]) => {
    const crown = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(radius * scale, 1), material));
    crown.position.set(cx * scale, cy * scale, 0);
    crown.rotation.y = cx;
    group.add(crown);
  });
  world.add(group);
  colliders.push({ type: "circle", x, z, radius: 0.55 * scale });
  return group;
}

function addRock(x, z, scale = 1) {
  addBlobShadow(x + 0.25 * scale, z + 0.2 * scale, 1.15 * scale, 0.48 * scale);
  const rock = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 * scale, 0), toon(0xa8a28b)));
  rock.scale.set(1.25, 0.7, 1);
  rock.position.set(x, 0.35 * scale, z);
  rock.rotation.set(0.1, x * 0.3, -0.08);
  world.add(rock);
  colliders.push({ type: "circle", x, z, radius: 0.48 * scale });
}

function addFence(x, z, length, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  const postMat = toon(COLORS.wood);
  const railMat = toon(0xa86e3f);
  const posts = Math.max(2, Math.round(length / 1.4));
  for (let index = 0; index < posts; index += 1) {
    const px = -length / 2 + (index / (posts - 1)) * length;
    addBox(group, [0.18, 1.05, 0.18], [px, 0.52, 0], postMat);
  }
  addBox(group, [length, 0.15, 0.14], [0, 0.78, 0], railMat);
  addBox(group, [length, 0.13, 0.14], [0, 0.38, 0], railMat);
  world.add(group);
  return group;
}

function addFlowerPatch(x, z, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  for (let index = 0; index < 5; index += 1) {
    const angle = index * 2.4;
    const radius = 0.18 + (index % 2) * 0.1;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 5), toon(0x3e7444));
    stem.position.set(Math.cos(angle) * radius, 0.14, Math.sin(angle) * radius);
    group.add(stem);
    const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.095, 0), toon(index === 2 ? 0xffd65c : color));
    flower.position.set(stem.position.x, 0.32, stem.position.z);
    group.add(flower);
  }
  world.add(group);
}

function createPond() {
  addGroundDisc(-7.3, 3.6, 2.65, 0x477a58, -0.045);
  const pond = addGroundDisc(-7.3, 3.6, 2.35, COLORS.water, -0.02);
  pond.material = new THREE.MeshToonMaterial({ color: COLORS.water, transparent: true, opacity: 0.92 });
  const lily = addGroundDisc(-6.7, 3.1, 0.34, 0x79a956, 0.005);
  lily.scale.y = 0.68;
  [-9.25, -5.25].forEach((x) => addRock(x, 3.75, 0.85));
  colliders.push({ type: "circle", x: -7.3, z: 3.6, radius: 2.2 });
}

function createPizzaShop() {
  addBlobShadow(7.4, -3.9, 7.4, 3.1, -0.3);
  const shop = new THREE.Group();
  shop.position.set(5.5, 0, -5.25);
  world.add(shop);

  const wallMat = toon(COLORS.wall);
  const shadeMat = toon(COLORS.wallShade);
  addBox(shop, [6.2, 3.5, 4.4], [0, 1.75, 0], wallMat);
  addBox(shop, [6.3, 0.28, 4.5], [0, 0.15, 0], shadeMat);

  const roofMat = toon(COLORS.terracotta);
  addBox(shop, [3.65, 0.34, 5.2], [-1.45, 3.92, 0], roofMat, [0, 0, -0.46]);
  addBox(shop, [3.65, 0.34, 5.2], [1.45, 3.92, 0], roofMat, [0, 0, 0.46]);
  for (let index = -2; index <= 2; index += 1) {
    addBox(shop, [0.12, 0.08, 5.23], [index * 0.72, 4.35 - Math.abs(index) * 0.33, 0], toon(0xe48153));
  }

  const chimney = addBox(shop, [0.7, 2.0, 0.7], [1.9, 4.6, -0.65], shadeMat);
  chimney.castShadow = !LOW_POWER_DEVICE;
  addBox(shop, [0.9, 0.24, 0.9], [1.9, 5.55, -0.65], roofMat);

  const frontZ = 2.23;
  const windowMat = new THREE.MeshToonMaterial({ color: 0x8fd0cc, emissive: 0x254e46, emissiveIntensity: 0.25 });
  [-2.0, 2.0].forEach((x) => {
    addBox(shop, [1.15, 1.18, 0.12], [x, 1.72, frontZ], toon(COLORS.woodDark));
    addBox(shop, [0.91, 0.93, 0.14], [x, 1.72, frontZ + 0.03], windowMat);
    addBox(shop, [0.08, 0.98, 0.17], [x, 1.72, frontZ + 0.08], toon(0xffe7b0));
    addBox(shop, [0.96, 0.08, 0.17], [x, 1.72, frontZ + 0.08], toon(0xffe7b0));
  });

  const awning = new THREE.Group();
  awning.position.set(0, 2.75, frontZ + 0.33);
  shop.add(awning);
  for (let index = 0; index < 9; index += 1) {
    const color = index % 2 === 0 ? COLORS.red : COLORS.cream;
    const stripe = addBox(awning, [0.48, 0.24, 0.82], [(index - 4) * 0.47, 0, 0], toon(color), [-0.16, 0, 0]);
    stripe.castShadow = !LOW_POWER_DEVICE;
  }

  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.65, 24), toon(COLORS.cream));
  sign.position.set(0, 3.47, frontZ + 0.04);
  shop.add(sign);
  const sauce = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), toon(0xe59b45));
  sauce.position.set(0, 3.47, frontZ + 0.07);
  shop.add(sauce);
  [[-0.15, 0.12], [0.18, 0.11], [0.07, -0.17]].forEach(([x, y]) => {
    const topping = new THREE.Mesh(new THREE.CircleGeometry(0.075, 12), toon(COLORS.red));
    topping.position.set(x, 3.47 + y, frontZ + 0.1);
    shop.add(topping);
  });

  const pivot = new THREE.Group();
  pivot.position.set(-0.67, 0.05, frontZ + 0.07);
  shop.add(pivot);
  const door = addBox(pivot, [1.34, 2.35, 0.16], [0.67, 1.18, 0], toon(COLORS.teal));
  addBox(pivot, [0.82, 0.76, 0.05], [0.67, 1.55, 0.11], windowMat);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), toon(0xffcf5a));
  knob.position.set(1.12, 1.02, 0.15);
  pivot.add(knob);

  const light = new THREE.PointLight(0xffbd63, 1.4, 5.5);
  light.position.set(0, 1.45, frontZ + 0.55);
  shop.add(light);

  colliders.push({ type: "box", x: 5.5, z: -5.25, width: 6.7, depth: 4.25 });
  return { group: shop, doorPivot: pivot, doorMesh: door, light };
}

createPond();
addFence(-8.1, -1.0, 5.2, 0.02);
addFence(9.1, 2.8, 5.0, Math.PI / 2);
addFence(-2.0, -8.0, 5.0, 0);

[
  [-10.2, -4.5, 1.15],
  [-7.2, -5.8, 0.95],
  [-1.7, -6.7, 1.1],
  [10.2, -5.9, 1.05],
  [10.5, 5.7, 1.1],
  [5.0, 7.6, 0.9],
  [-10.7, 7.0, 1.0]
].forEach(([x, z, scale], index) => addTree(x, z, scale, index % 2 ? 0x56894c : COLORS.leaf));

[
  [-4.2, -2.4, 0xffd15c],
  [8.8, -1.3, 0xf17861],
  [2.7, 7.7, 0xf4eee0],
  [-3.3, 5.9, 0xf17861]
].forEach(([x, z, color]) => addFlowerPatch(x, z, color));

addRock(-4.7, -5.6, 0.8);
addRock(9.4, 7.2, 0.65);

const shop = createPizzaShop();

function createDoorMarker() {
  const group = new THREE.Group();
  group.position.copy(DOOR_POSITION);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.76, 36),
    new THREE.MeshBasicMaterial({ color: 0xffc851, transparent: true, opacity: 0.68, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  world.add(group);
  return group;
}

const doorMarker = createDoorMarker();

function pixelTexture(direction, step) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 40;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;

  if (direction === "left") {
    context.translate(32, 0);
    context.scale(-1, 1);
    direction = "right";
  }

  const colors = {
    outline: "#49372f",
    fur: "#c9884c",
    light: "#e8b068",
    dark: "#785039",
    muzzle: "#dca66c",
    red: "#c94c3e",
    redLight: "#e46a4f",
    teal: "#276d6c",
    tealLight: "#3f8e85",
    eye: "#302b29",
    shine: "#fff5d6"
  };
  const rect = (x, y, width, height, color) => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };
  const legShift = step ? 1 : 0;

  if (direction === "up") {
    rect(9, 28 + legShift, 6, 8, colors.outline);
    rect(18, 27 + (1 - legShift), 6, 9, colors.outline);
    rect(10, 19, 14, 14, colors.outline);
    rect(11, 19, 12, 13, colors.fur);
    rect(6, 7, 20, 16, colors.outline);
    rect(8, 7, 16, 15, colors.fur);
    rect(6, 5, 6, 6, colors.outline);
    rect(20, 5, 6, 6, colors.outline);
    rect(7, 6, 4, 4, colors.dark);
    rect(21, 6, 4, 4, colors.dark);
    rect(8, 18, 16, 4, colors.red);
    rect(6, 19, 5, 5, colors.redLight);
    rect(12, 22, 3, 9, colors.teal);
    rect(15, 27, 8, 6, colors.teal);
    rect(16, 28, 6, 4, colors.tealLight);
  } else if (direction === "right") {
    rect(10, 29 + legShift, 6, 8, colors.outline);
    rect(20, 28 + (1 - legShift), 6, 8, colors.outline);
    rect(8, 18, 17, 15, colors.outline);
    rect(10, 18, 14, 14, colors.fur);
    rect(8, 7, 18, 16, colors.outline);
    rect(9, 7, 17, 15, colors.fur);
    rect(7, 5, 7, 6, colors.outline);
    rect(8, 6, 5, 4, colors.dark);
    rect(23, 12, 7, 8, colors.outline);
    rect(23, 13, 6, 6, colors.muzzle);
    rect(20, 10, 3, 4, colors.eye);
    rect(21, 10, 1, 1, colors.shine);
    rect(27, 15, 2, 2, colors.eye);
    rect(8, 18, 18, 4, colors.red);
    rect(8, 20, 5, 4, colors.redLight);
    rect(19, 23, 3, 8, colors.teal);
    rect(21, 27, 6, 6, colors.tealLight);
  } else {
    rect(8, 29 + legShift, 7, 8, colors.outline);
    rect(18, 28 + (1 - legShift), 7, 9, colors.outline);
    rect(7, 18, 18, 15, colors.outline);
    rect(9, 18, 14, 14, colors.fur);
    rect(6, 7, 20, 16, colors.outline);
    rect(8, 7, 16, 15, colors.fur);
    rect(5, 5, 7, 7, colors.outline);
    rect(20, 5, 7, 7, colors.outline);
    rect(7, 6, 4, 4, colors.dark);
    rect(21, 6, 4, 4, colors.dark);
    rect(9, 12, 4, 5, colors.eye);
    rect(20, 12, 4, 5, colors.eye);
    rect(10, 12, 1, 1, colors.shine);
    rect(21, 12, 1, 1, colors.shine);
    rect(11, 16, 11, 6, colors.muzzle);
    rect(15, 17, 3, 3, colors.eye);
    rect(7, 18, 18, 4, colors.red);
    rect(20, 23, 3, 7, colors.teal);
    rect(20, 27, 7, 6, colors.tealLight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

const heroTextures = new Map();
["down", "up", "left", "right"].forEach((direction) => {
  [0, 1].forEach((step) => heroTextures.set(`${direction}-${step}`, pixelTexture(direction, step)));
});

const hero = new THREE.Group();
hero.position.copy(START_POSITION);
world.add(hero);

const heroShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 24),
  new THREE.MeshBasicMaterial({ color: 0x22372f, transparent: true, opacity: 0.25, depthWrite: false })
);
heroShadow.rotation.x = -Math.PI / 2;
heroShadow.scale.z = 0.55;
heroShadow.position.y = 0.02;
hero.add(heroShadow);

const heroMaterial = new THREE.SpriteMaterial({
  map: heroTextures.get("up-0"),
  transparent: true,
  alphaTest: 0.12,
  depthTest: true,
  depthWrite: false
});
const heroSprite = new THREE.Sprite(heroMaterial);
heroSprite.center.set(0.5, 0.03);
heroSprite.scale.set(1.85, 2.35, 1);
heroSprite.position.y = 0.02;
hero.add(heroSprite);

function canOccupy(x, z) {
  if (x < -13 || x > 13 || z < -9.3 || z > 9.3) return false;
  return colliders.every((collider) => {
    if (collider.type === "circle") {
      return Math.hypot(x - collider.x, z - collider.z) > PLAYER_RADIUS + collider.radius;
    }
    const halfWidth = collider.width / 2 + PLAYER_RADIUS;
    const halfDepth = collider.depth / 2 + PLAYER_RADIUS;
    return !(Math.abs(x - collider.x) < halfWidth && Math.abs(z - collider.z) < halfDepth);
  });
}

const projectedForward = new THREE.Vector3();
const projectedRight = new THREE.Vector3();
const moveVector = new THREE.Vector3();

function readInput() {
  let x = controls.x;
  let y = controls.y;
  if (controls.keys.has("ArrowLeft") || controls.keys.has("KeyA")) x -= 1;
  if (controls.keys.has("ArrowRight") || controls.keys.has("KeyD")) x += 1;
  if (controls.keys.has("ArrowUp") || controls.keys.has("KeyW")) y -= 1;
  if (controls.keys.has("ArrowDown") || controls.keys.has("KeyS")) y += 1;
  return { x, y };
}

function updateHero(delta, elapsed) {
  const input = readInput();
  const inputLength = Math.hypot(input.x, input.y);
  const moving = started && inputLength > 0.12;

  if (moving) {
    camera.getWorldDirection(projectedForward);
    projectedForward.y = 0;
    projectedForward.normalize();
    projectedRight.crossVectors(projectedForward, camera.up).normalize();
    moveVector.copy(projectedRight).multiplyScalar(input.x);
    moveVector.addScaledVector(projectedForward, -input.y);
    moveVector.normalize();

    const speed = 4.25;
    const nextX = hero.position.x + moveVector.x * speed * delta;
    const nextZ = hero.position.z + moveVector.z * speed * delta;
    if (canOccupy(nextX, hero.position.z)) hero.position.x = nextX;
    if (canOccupy(hero.position.x, nextZ)) hero.position.z = nextZ;

    const screenX = input.x / inputLength;
    const screenY = input.y / inputLength;
    let direction;
    if (Math.abs(screenX) > Math.abs(screenY) * 0.72) direction = screenX > 0 ? "right" : "left";
    else direction = screenY > 0 ? "down" : "up";
    const step = Math.floor(elapsed * 7) % 2;
    heroMaterial.map = heroTextures.get(`${direction}-${step}`);
    walkClock += delta;
    heroSprite.position.y = 0.02 + Math.abs(Math.sin(walkClock * 14)) * 0.07;
    heroSprite.material.rotation = Math.sin(walkClock * 7) * 0.025;
  } else {
    walkClock = 0;
    heroSprite.position.y += (0.02 - heroSprite.position.y) * Math.min(1, delta * 10);
    heroSprite.material.rotation *= Math.max(0, 1 - delta * 10);
  }

  nearDoor = hero.position.distanceTo(DOOR_POSITION) < 2.55;
  setAction(nearDoor ? (doorOpen ? "문 닫기" : "문 열기") : "인사하기", nearDoor);
  setObjectiveText(doorOpen ? "따뜻한 피자 향기가 나요" : nearDoor ? "오른쪽 버튼으로 문을 열어요" : "피자가게 문까지 걸어가요");
}

function doAction() {
  if (!started) return;
  if (nearDoor) {
    doorOpen = !doorOpen;
    doorTargetRotation = doorOpen ? -1.25 : 0;
    playDoorSound();
    showToast(doorOpen ? "피자 향기가 솔솔!" : "문을 살며시 닫았어요");
    return;
  }

  playTone(520, 0.1, 0, 0.022);
  playTone(660, 0.12, 0.08, 0.02);
  heroSprite.scale.set(2.0, 2.18, 1);
  showToast("안녕! 나는 보리야");
}

function updateWorld(delta, elapsed) {
  shop.doorPivot.rotation.y += (doorTargetRotation - shop.doorPivot.rotation.y) * Math.min(1, delta * 6);
  shop.light.intensity += ((doorOpen ? 2.8 : 1.35) - shop.light.intensity) * Math.min(1, delta * 4);
  doorMarker.visible = !doorOpen;
  if (doorMarker.visible) {
    const pulse = 1 + Math.sin(elapsed * 3.2) * 0.11;
    doorMarker.scale.setScalar(pulse);
  }
  heroSprite.scale.x += (1.85 - heroSprite.scale.x) * Math.min(1, delta * 8);
  heroSprite.scale.y += (2.35 - heroSprite.scale.y) * Math.min(1, delta * 8);
}

const desiredCameraFocus = new THREE.Vector3();

function updateCamera(delta) {
  desiredCameraFocus.set(hero.position.x * 0.72 + 0.7, 0.8, hero.position.z * 0.62 - 0.45);
  cameraFocus.lerp(desiredCameraFocus, Math.min(1, delta * 3.2));
  camera.position.copy(cameraFocus).add(cameraOffset);
  camera.lookAt(cameraFocus);
}

function resize() {
  const width = ui.gameRoot.clientWidth || window.innerWidth;
  const height = ui.gameRoot.clientHeight || window.innerHeight;
  const aspect = width / Math.max(1, height);
  camera.left = (-VIEW_HEIGHT * aspect) / 2;
  camera.right = (VIEW_HEIGHT * aspect) / 2;
  camera.top = VIEW_HEIGHT / 2;
  camera.bottom = -VIEW_HEIGHT / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function resetGame() {
  hero.position.copy(START_POSITION);
  doorOpen = false;
  doorTargetRotation = 0;
  controls.x = 0;
  controls.y = 0;
  controls.actionQueued = false;
  controls.activePointer = null;
  ui.joystickStick.style.transform = "translate(0, 0)";
  cameraFocus.set(0.7, 0.8, 1.2);
  setAction("인사하기", false);
  setObjectiveText("피자가게 문까지 걸어가요");
}

function startGame() {
  started = true;
  ui.startScreen.classList.add("is-hidden");
  playStartSound();
  showToast("보리와 함께 출발!");
}

function returnHome() {
  started = false;
  resetGame();
  ui.startScreen.classList.remove("is-hidden");
}

function animate(now) {
  const delta = Math.min(0.04, Math.max(0.001, (now - lastTime) / 1000));
  const elapsed = now / 1000;
  lastTime = now;
  updateHero(delta, elapsed);
  if (controls.actionQueued) {
    controls.actionQueued = false;
    doAction();
  }
  updateWorld(delta, elapsed);
  updateCamera(delta);
  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

ui.startButton.addEventListener("click", startGame);
ui.homeButton.addEventListener("click", returnHome);
ui.actionButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  controls.actionQueued = true;
  ensureAudio();
});
ui.soundButton.setAttribute("aria-pressed", String(muted));
ui.soundButton.setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
ui.soundButton.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem(`${STORAGE_PREFIX}muted`, String(muted));
  ui.soundButton.setAttribute("aria-pressed", String(muted));
  ui.soundButton.setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
  if (!muted) playTone(523, 0.12);
});

window.addEventListener("keydown", (event) => {
  controls.keys.add(event.code);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  if (event.code === "Space" && !event.repeat) controls.actionQueued = true;
});
window.addEventListener("keyup", (event) => controls.keys.delete(event.code));
window.addEventListener("resize", resize);
document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("gesturestart", (event) => event.preventDefault());

setupJoystick();
resize();
resetGame();
window.requestAnimationFrame(animate);

if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
