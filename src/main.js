import Phaser from "phaser";
import "./style.css";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const STORAGE_PREFIX = "starlight-village:";

const CHARACTER_PALETTES = {
  sun: {
    name: "보리",
    fur: 0xf7c969,
    furDark: 0xdea345,
    accent: 0xef6c56,
    cheeks: 0xef9479
  },
  mint: {
    name: "모모",
    fur: 0x77cfac,
    furDark: 0x4ca583,
    accent: 0x4f8ed0,
    cheeks: 0xf09b91
  },
  berry: {
    name: "두두",
    fur: 0xe995a9,
    furDark: 0xc86883,
    accent: 0x806bc0,
    cheeks: 0xf5ac9f
  }
};

const ui = {
  select: document.querySelector("#character-select"),
  cards: [...document.querySelectorAll(".character-card")],
  gameScreen: document.querySelector("#game-screen"),
  gameRoot: document.querySelector("#game-root"),
  homeButton: document.querySelector("#home-button"),
  soundButton: document.querySelector("#sound-button"),
  joystickZone: document.querySelector("#joystick-zone"),
  joystickStick: document.querySelector("#joystick-stick"),
  actionButton: document.querySelector("#action-button"),
  actionIcon: document.querySelector("#action-icon"),
  actionLabel: document.querySelector("#action-label"),
  objectiveStart: document.querySelector("#objective-start"),
  objectiveEnd: document.querySelector("#objective-end"),
  objectiveText: document.querySelector("#objective-text"),
  toast: document.querySelector("#scene-toast")
};

const controls = {
  x: 0,
  y: 0,
  actionQueued: false,
  activePointer: null,
  lastInputAt: performance.now()
};

let game = null;
let selectedCharacter = localStorage.getItem(`${STORAGE_PREFIX}character`) || "sun";
let soundMuted = localStorage.getItem(`${STORAGE_PREFIX}muted`) === "true";
let audioContext = null;
let toastTimer = null;
let actionUiState = "";

function ensureAudio() {
  if (soundMuted) return;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTone(frequency, duration = 0.1, type = "sine", volume = 0.025, delay = 0, endFrequency = null) {
  if (soundMuted) return;
  ensureAudio();
  if (!audioContext) return;

  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSelectSound() {
  playTone(440, 0.1, "triangle", 0.035);
  playTone(660, 0.16, "triangle", 0.03, 0.09);
}

function playDoorSound() {
  playTone(523, 0.15, "triangle", 0.035);
  playTone(659, 0.15, "triangle", 0.033, 0.11);
  playTone(784, 0.22, "triangle", 0.03, 0.22);
}

function playStepSound(stepIndex) {
  playTone(stepIndex % 2 ? 122 : 138, 0.055, "sine", 0.012, 0, 94);
}

function setObjective(start, end, text) {
  ui.objectiveStart.textContent = start;
  ui.objectiveEnd.textContent = end;
  ui.objectiveText.textContent = text;
}

function setActionUi(icon, label, ready = false) {
  const nextState = `${icon}|${label}|${ready}`;
  if (nextState === actionUiState) return;
  actionUiState = nextState;
  ui.actionIcon.textContent = icon;
  ui.actionLabel.textContent = label;
  ui.actionButton.classList.toggle("is-ready", ready);
  ui.actionButton.setAttribute("aria-label", label);
}

function showToast(message, duration = 1250) {
  window.clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => ui.toast.classList.remove("is-visible"), duration);
}

function resetControls() {
  controls.x = 0;
  controls.y = 0;
  controls.actionQueued = false;
  controls.activePointer = null;
  ui.joystickStick.style.transform = "translate(0px, 0px)";
}

function setupJoystick() {
  const maxDistance = 42;

  function updateFromPointer(event) {
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
    controls.lastInputAt = performance.now();
    ui.joystickStick.style.transform = `translate(${x}px, ${y}px)`;
    ui.joystickZone.classList.remove("is-idle");
  }

  ui.joystickZone.addEventListener("pointerdown", (event) => {
    if (controls.activePointer !== null) return;
    controls.activePointer = event.pointerId;
    ui.joystickZone.setPointerCapture(event.pointerId);
    updateFromPointer(event);
    ensureAudio();
  });

  ui.joystickZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== controls.activePointer) return;
    event.preventDefault();
    updateFromPointer(event);
  });

  function releaseJoystick(event) {
    if (event.pointerId !== controls.activePointer) return;
    resetControls();
  }

  ui.joystickZone.addEventListener("pointerup", releaseJoystick);
  ui.joystickZone.addEventListener("pointercancel", releaseJoystick);

  window.setInterval(() => {
    const shouldTeach = controls.activePointer === null && performance.now() - controls.lastInputAt > 5500;
    ui.joystickZone.classList.toggle("is-idle", shouldTeach);
  }, 900);
}

function launchGame(characterKey) {
  selectedCharacter = characterKey;
  localStorage.setItem(`${STORAGE_PREFIX}character`, characterKey);
  playSelectSound();
  ui.select.classList.add("is-hidden");
  ui.gameScreen.classList.remove("is-hidden");
  resetControls();

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-root",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#79d3cd",
    transparent: false,
    render: {
      antialias: true,
      roundPixels: true,
      powerPreference: "high-performance"
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    scene: [TownScene, PizzaShopScene]
  });
}

function returnToSelection() {
  if (game) {
    game.destroy(true);
    game = null;
  }
  resetControls();
  ui.gameRoot.replaceChildren();
  ui.gameScreen.classList.add("is-hidden");
  ui.select.classList.remove("is-hidden");
  setActionUi("✦", "행동", false);
}

function createHeroTextures(scene, characterKey) {
  const palette = CHARACTER_PALETTES[characterKey];
  const outline = 0x365355;
  const directions = ["down", "up", "side"];

  for (const direction of directions) {
    for (let frame = 0; frame < 4; frame += 1) {
      const key = `hero-${characterKey}-${direction}-${frame}`;
      if (scene.textures.exists(key)) continue;

      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      const stride = [0, 5, 0, -5][frame];
      const bounce = [0, -2, 0, -1][frame];

      graphics.fillStyle(0x355d5b, 0.2);
      graphics.fillEllipse(48, 103, 57 - Math.abs(stride), 13);

      if (direction === "side") {
        graphics.fillStyle(palette.furDark, 1);
        graphics.lineStyle(4, outline, 1);
        graphics.fillEllipse(23, 69, 35, 25);
        graphics.strokeEllipse(23, 69, 35, 25);
      }

      graphics.fillStyle(palette.furDark, 1);
      graphics.lineStyle(4, outline, 1);
      graphics.fillRoundedRect(27 - stride, 82, 24, 22, 10);
      graphics.strokeRoundedRect(27 - stride, 82, 24, 22, 10);
      graphics.fillRoundedRect(49 + stride, 82, 24, 22, 10);
      graphics.strokeRoundedRect(49 + stride, 82, 24, 22, 10);

      graphics.fillStyle(palette.fur, 1);
      graphics.fillRoundedRect(22, 48 + bounce, 52, 47, 21);
      graphics.strokeRoundedRect(22, 48 + bounce, 52, 47, 21);

      graphics.fillStyle(palette.accent, 1);
      graphics.fillRoundedRect(20, 55 + bounce, 56, 15, 7);
      graphics.strokeRoundedRect(20, 55 + bounce, 56, 15, 7);
      graphics.fillTriangle(65, 65 + bounce, 83, 73 + bounce, 68, 78 + bounce);
      graphics.strokeTriangle(65, 65 + bounce, 83, 73 + bounce, 68, 78 + bounce);

      graphics.fillStyle(palette.furDark, 1);
      if (direction === "side") {
        graphics.fillTriangle(27, 24 + bounce, 34, 2 + bounce, 46, 26 + bounce);
        graphics.strokeTriangle(27, 24 + bounce, 34, 2 + bounce, 46, 26 + bounce);
        graphics.fillTriangle(53, 24 + bounce, 70, 5 + bounce, 69, 31 + bounce);
        graphics.strokeTriangle(53, 24 + bounce, 70, 5 + bounce, 69, 31 + bounce);
      } else {
        graphics.fillTriangle(20, 29 + bounce, 29, 4 + bounce, 42, 28 + bounce);
        graphics.strokeTriangle(20, 29 + bounce, 29, 4 + bounce, 42, 28 + bounce);
        graphics.fillTriangle(55, 28 + bounce, 69, 4 + bounce, 77, 32 + bounce);
        graphics.strokeTriangle(55, 28 + bounce, 69, 4 + bounce, 77, 32 + bounce);
      }

      graphics.fillStyle(palette.fur, 1);
      graphics.fillEllipse(48, 37 + bounce, 65, 58);
      graphics.strokeEllipse(48, 37 + bounce, 65, 58);

      if (direction === "down") {
        graphics.fillStyle(outline, 1);
        graphics.fillEllipse(36, 38 + bounce, 7, 11);
        graphics.fillEllipse(60, 38 + bounce, 7, 11);
        graphics.fillTriangle(45, 48 + bounce, 51, 48 + bounce, 48, 53 + bounce);
        graphics.lineStyle(3, outline, 1);
        graphics.beginPath();
        graphics.arc(48, 53 + bounce, 9, 0.24, Math.PI - 0.24, false);
        graphics.strokePath();
        graphics.fillStyle(palette.cheeks, 0.8);
        graphics.fillEllipse(26, 49 + bounce, 10, 6);
        graphics.fillEllipse(70, 49 + bounce, 10, 6);
      } else if (direction === "side") {
        graphics.fillStyle(outline, 1);
        graphics.fillEllipse(63, 38 + bounce, 7, 11);
        graphics.fillTriangle(70, 47 + bounce, 78, 50 + bounce, 70, 53 + bounce);
        graphics.fillStyle(palette.cheeks, 0.8);
        graphics.fillEllipse(63, 51 + bounce, 10, 6);
      } else {
        graphics.fillStyle(palette.furDark, 0.8);
        graphics.fillEllipse(48, 29 + bounce, 26, 12);
      }

      graphics.generateTexture(key, 96, 112);
      graphics.destroy();
    }
  }
}

function addPhysicsBarrier(scene, x, y, width, height) {
  const barrier = scene.add.rectangle(x, y, width, height, 0x000000, 0);
  scene.physics.add.existing(barrier, true);
  scene.physics.add.collider(scene.player, barrier);
  return barrier;
}

function addTree(scene, x, y, scale = 1, tint = 0x5db16a) {
  const shadow = scene.add.ellipse(x, y + 40 * scale, 116 * scale, 33 * scale, 0x2f6251, 0.18).setDepth(y - 1);
  const trunk = scene.add.rectangle(x, y + 7 * scale, 31 * scale, 76 * scale, 0x9a653e).setStrokeStyle(5 * scale, 0x4c5a50).setDepth(y);
  const crownBack = scene.add.circle(x - 35 * scale, y - 45 * scale, 47 * scale, tint).setStrokeStyle(6 * scale, 0x3e6256).setDepth(y + 1);
  const crownRight = scene.add.circle(x + 35 * scale, y - 44 * scale, 45 * scale, tint).setStrokeStyle(6 * scale, 0x3e6256).setDepth(y + 1);
  const crown = scene.add.circle(x, y - 75 * scale, 59 * scale, Phaser.Display.Color.IntegerToColor(tint).brighten(8).color).setStrokeStyle(6 * scale, 0x3e6256).setDepth(y + 2);
  const dot1 = scene.add.circle(x - 24 * scale, y - 76 * scale, 8 * scale, 0xa9df76).setDepth(y + 3);
  const dot2 = scene.add.circle(x + 20 * scale, y - 48 * scale, 7 * scale, 0xa9df76).setDepth(y + 3);
  addPhysicsBarrier(scene, x, y + 24 * scale, 72 * scale, 46 * scale);
  return [shadow, trunk, crownBack, crownRight, crown, dot1, dot2];
}

function addFlower(scene, x, y, color) {
  const stem = scene.add.rectangle(x, y, 4, 21, 0x44885d).setDepth(y);
  const petals = [
    scene.add.circle(x - 6, y - 9, 7, color),
    scene.add.circle(x + 6, y - 9, 7, color),
    scene.add.circle(x, y - 15, 7, color),
    scene.add.circle(x, y - 5, 7, color),
    scene.add.circle(x, y - 10, 5, 0xffda5e)
  ];
  petals.forEach((petal) => petal.setDepth(y + 1));
  return [stem, ...petals];
}

function addTownGround(scene) {
  const ground = scene.add.graphics().setDepth(0);
  ground.fillStyle(0x86cb73, 1);
  ground.fillRect(0, 0, 2200, 1350);

  ground.fillStyle(0x78bd68, 1);
  for (let x = 60; x < 2200; x += 135) {
    for (let y = 80; y < 1350; y += 120) {
      const offset = ((x + y) / 15) % 3;
      ground.fillCircle(x + offset * 9, y + offset * 4, 4);
      ground.fillCircle(x + 14 + offset * 8, y - 5, 3);
    }
  }

  ground.fillStyle(0xe6c987, 1);
  ground.fillRoundedRect(130, 694, 1880, 190, 95);
  ground.fillRoundedRect(1120, 390, 250, 760, 115);
  ground.fillCircle(880, 790, 300);
  ground.fillStyle(0xf1dda4, 1);
  ground.fillRoundedRect(155, 728, 1800, 48, 24);
  ground.fillRoundedRect(1203, 415, 54, 680, 27);
  ground.lineStyle(8, 0xcaa964, 0.5);
  ground.strokeCircle(880, 790, 290);
}

function addPizzaShop(scene) {
  const x = 1280;
  const baseY = 590;
  const building = scene.add.container(x, baseY).setDepth(baseY - 15);
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x315957, 0.2);
  graphics.fillEllipse(-255, 122, 510, 70);

  graphics.fillStyle(0xfff0cb, 1);
  graphics.lineStyle(8, 0x405a59, 1);
  graphics.fillRoundedRect(-230, -200, 460, 310, 28);
  graphics.strokeRoundedRect(-230, -200, 460, 310, 28);

  graphics.fillStyle(0xe96555, 1);
  graphics.beginPath();
  graphics.moveTo(-265, -182);
  graphics.lineTo(0, -360);
  graphics.lineTo(265, -182);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
  graphics.fillStyle(0xffaa62, 1);
  graphics.fillTriangle(-213, -186, 0, -326, 213, -186);

  graphics.fillStyle(0x73bdd0, 1);
  graphics.fillRoundedRect(-180, -115, 115, 96, 16);
  graphics.strokeRoundedRect(-180, -115, 115, 96, 16);
  graphics.lineStyle(5, 0xffffff, 0.8);
  graphics.lineBetween(-122, -112, -122, -22);
  graphics.lineBetween(-176, -67, -68, -67);

  graphics.fillStyle(0x73bdd0, 1);
  graphics.lineStyle(8, 0x405a59, 1);
  graphics.fillRoundedRect(65, -115, 115, 96, 16);
  graphics.strokeRoundedRect(65, -115, 115, 96, 16);
  graphics.lineStyle(5, 0xffffff, 0.8);
  graphics.lineBetween(122, -112, 122, -22);
  graphics.lineBetween(69, -67, 176, -67);

  graphics.fillStyle(0x55a58a, 1);
  graphics.lineStyle(8, 0x405a59, 1);
  graphics.fillRoundedRect(-58, -28, 116, 139, 18);
  graphics.strokeRoundedRect(-58, -28, 116, 139, 18);
  graphics.fillStyle(0x9ddac1, 1);
  graphics.fillRoundedRect(-38, -9, 76, 70, 12);
  graphics.fillStyle(0xffd75f, 1);
  graphics.fillCircle(34, 79, 7);

  graphics.fillStyle(0xffd76b, 1);
  graphics.lineStyle(8, 0x405a59, 1);
  graphics.fillCircle(0, -205, 62);
  graphics.strokeCircle(0, -205, 62);
  graphics.fillStyle(0xef7058, 1);
  graphics.fillCircle(0, -205, 43);
  graphics.fillStyle(0xffe69b, 1);
  graphics.fillCircle(0, -205, 34);
  graphics.fillStyle(0xd6534c, 1);
  graphics.fillCircle(-13, -216, 7);
  graphics.fillCircle(15, -195, 7);
  graphics.fillCircle(12, -222, 6);

  building.add(graphics);
  scene.shopDoor = { x, y: baseY + 120 };
  scene.shopDoorGlow = scene.add.ellipse(x, baseY + 112, 150, 54, 0xffe16f, 0.25).setDepth(baseY + 100);
  scene.shopBeacon = scene.add.text(x, baseY - 76, "▼", {
    fontFamily: "Arial Rounded MT Bold, sans-serif",
    fontSize: "54px",
    color: "#ff715f",
    stroke: "#fff8dc",
    strokeThickness: 8
  }).setOrigin(0.5).setDepth(baseY + 500);
  scene.tweens.add({ targets: [scene.shopBeacon], y: baseY - 56, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  scene.tweens.add({ targets: scene.shopDoorGlow, scaleX: 1.16, scaleY: 1.16, alpha: 0.43, duration: 740, yoyo: true, repeat: -1 });

  addPhysicsBarrier(scene, x, baseY - 40, 500, 360);
}

function addOtherTownDetails(scene) {
  const fountainBase = scene.add.ellipse(840, 795, 290, 190, 0x6d7771).setStrokeStyle(8, 0x405a59).setDepth(777);
  const fountainWater = scene.add.ellipse(840, 775, 240, 138, 0x64c8dc).setStrokeStyle(8, 0x405a59).setDepth(778);
  const fountainCenter = scene.add.circle(840, 738, 42, 0xffdf8d).setStrokeStyle(7, 0x405a59).setDepth(779);
  const fountainStar = scene.add.text(840, 720, "★", { fontSize: "54px", color: "#fff7c7", stroke: "#e3a84d", strokeThickness: 6 }).setOrigin(0.5).setDepth(780);
  scene.tweens.add({ targets: fountainStar, scale: 1.08, duration: 850, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  addPhysicsBarrier(scene, 840, 785, 246, 145);

  const notice = scene.add.container(390, 690).setDepth(690);
  notice.add(scene.add.rectangle(0, 22, 24, 112, 0x8f633e).setStrokeStyle(5, 0x405a59));
  notice.add(scene.add.rectangle(0, -35, 175, 108, 0xffe8a8).setStrokeStyle(7, 0x405a59));
  notice.add(scene.add.text(0, -35, "🍕  →", { fontSize: "40px" }).setOrigin(0.5));
  addPhysicsBarrier(scene, 390, 705, 150, 70);

  const pond = scene.add.ellipse(1830, 1030, 390, 230, 0x59bdd2).setStrokeStyle(18, 0x72ae69).setDepth(1000);
  scene.add.ellipse(1770, 990, 77, 31, 0x70b96c).setDepth(1002);
  scene.add.circle(1783, 981, 11, 0xffd765).setDepth(1003);
  scene.add.ellipse(1905, 1065, 58, 25, 0x70b96c).setDepth(1002);
  addPhysicsBarrier(scene, 1830, 1030, 360, 190);

  scene.add.rectangle(480, 1090, 270, 46, 0xb9784a).setStrokeStyle(7, 0x405a59).setDepth(1090);
  scene.add.rectangle(390, 1130, 25, 90, 0x875b3c).setDepth(1089);
  scene.add.rectangle(570, 1130, 25, 90, 0x875b3c).setDepth(1089);
  addPhysicsBarrier(scene, 480, 1100, 300, 78);

  addTree(scene, 160, 360, 1.08, 0x55a968);
  addTree(scene, 430, 300, 0.86, 0x67b770);
  addTree(scene, 1880, 330, 1.05, 0x5eaf6c);
  addTree(scene, 2050, 665, 0.8, 0x69b770);
  addTree(scene, 210, 1180, 0.9, 0x58ad68);
  addTree(scene, 1460, 1160, 0.92, 0x5eb36b);

  const flowerColors = [0xff8e91, 0xffd466, 0x9b83d8, 0xffa85f];
  [[620, 440], [690, 460], [1540, 790], [1610, 820], [1010, 1100], [1070, 1125], [1880, 760], [350, 920]].forEach(([x, y], index) => {
    addFlower(scene, x, y, flowerColors[index % flowerColors.length]);
  });

  void fountainBase;
  void fountainWater;
  void fountainCenter;
  void pond;
}

function createPlayer(scene, x, y) {
  createHeroTextures(scene, selectedCharacter);
  scene.player = scene.physics.add.sprite(x, y, `hero-${selectedCharacter}-down-0`);
  scene.player.setDepth(y);
  scene.player.setCollideWorldBounds(true);
  scene.player.body.setSize(52, 42);
  scene.player.body.setOffset(22, 63);
  scene.player.direction = "down";
  scene.player.nextStepAt = 0;
  scene.player.stepIndex = 0;
  scene.player.setScale(1.04);
  return scene.player;
}

function readKeyboard(scene) {
  const left = scene.keys.left.isDown || scene.keys.a.isDown;
  const right = scene.keys.right.isDown || scene.keys.d.isDown;
  const up = scene.keys.up.isDown || scene.keys.w.isDown;
  const down = scene.keys.down.isDown || scene.keys.s.isDown;
  return {
    x: Number(right) - Number(left),
    y: Number(down) - Number(up)
  };
}

function updatePlayer(scene, time) {
  const keyboard = readKeyboard(scene);
  let x = controls.x + keyboard.x;
  let y = controls.y + keyboard.y;
  const length = Math.hypot(x, y);
  const moving = length > 0.12;

  if (moving) {
    x /= Math.max(1, length);
    y /= Math.max(1, length);
    const speed = 260;
    scene.player.setVelocity(x * speed, y * speed);

    let direction;
    if (Math.abs(x) > Math.abs(y)) {
      direction = "side";
      scene.player.setFlipX(x < 0);
    } else {
      direction = y < 0 ? "up" : "down";
      scene.player.setFlipX(false);
    }
    scene.player.direction = direction;
    const frame = Math.floor(time / 115) % 4;
    scene.player.setTexture(`hero-${selectedCharacter}-${direction}-${frame}`);

    if (time > scene.player.nextStepAt) {
      scene.player.nextStepAt = time + 280;
      scene.player.stepIndex += 1;
      playStepSound(scene.player.stepIndex);
    }
  } else {
    scene.player.setVelocity(0, 0);
    scene.player.setTexture(`hero-${selectedCharacter}-${scene.player.direction}-0`);
  }

  scene.player.setDepth(scene.player.y + 4);
  return moving;
}

function addSparkle(scene, x, y, delay = 0) {
  const sparkle = scene.add.text(x, y, "✦", {
    fontSize: "24px",
    color: "#fff4a8",
    stroke: "#dfa75a",
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(y + 200);
  sparkle.setScale(0.45);
  scene.tweens.add({
    targets: sparkle,
    scale: 1.05,
    angle: 35,
    alpha: 0.45,
    duration: 780,
    delay,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });
  return sparkle;
}

class TownScene extends Phaser.Scene {
  constructor() {
    super("TownScene");
  }

  create() {
    this.physics.world.setBounds(0, 0, 2200, 1350);
    addTownGround(this);
    createPlayer(this, 720, 930);
    addOtherTownDetails(this);
    addPizzaShop(this);

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      action: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    this.cameras.main.setBounds(0, 0, 2200, 1350);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setDeadzone(150, 100);
    this.cameras.main.fadeIn(350, 255, 250, 226);

    setObjective("🐾", "🍕", "피자가게로 가요");
    setActionUi("✦", "행동", false);
    controls.lastInputAt = performance.now();
    this.nearDoor = false;
    this.transitioning = false;
    showToast("별빛마을에 어서 와요!", 1100);
  }

  enterPizzaShop() {
    if (this.transitioning) return;
    this.transitioning = true;
    playDoorSound();
    localStorage.setItem(`${STORAGE_PREFIX}visited-pizza`, "true");
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(340, 255, 245, 213);
    this.time.delayedCall(350, () => this.scene.start("PizzaShopScene"));
  }

  hop() {
    if (this.player.getData("hopping")) return;
    this.player.setData("hopping", true);
    playTone(360, 0.08, "triangle", 0.018, 0, 520);
    this.tweens.add({
      targets: this.player,
      scaleX: 1.13,
      scaleY: 0.94,
      duration: 100,
      yoyo: true,
      onComplete: () => this.player.setData("hopping", false)
    });
  }

  update(time) {
    if (this.transitioning) return;
    updatePlayer(this, time);
    this.nearDoor = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.shopDoor.x, this.shopDoor.y) < 150;
    setActionUi(this.nearDoor ? "🍕" : "✦", this.nearDoor ? "들어가기" : "행동", this.nearDoor);
    this.shopDoorGlow.setAlpha(this.nearDoor ? 0.5 : 0.25);

    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) controls.actionQueued = true;
    if (controls.actionQueued) {
      controls.actionQueued = false;
      this.nearDoor ? this.enterPizzaShop() : this.hop();
    }
  }
}

function drawShopInterior(scene) {
  const graphics = scene.add.graphics().setDepth(0);
  graphics.fillStyle(0xfff2d7, 1);
  graphics.fillRect(0, 0, 1600, 900);

  graphics.fillStyle(0xf3d58e, 1);
  graphics.fillRect(0, 470, 1600, 430);
  graphics.lineStyle(4, 0xd3ad68, 0.42);
  for (let x = -200; x < 1800; x += 130) graphics.lineBetween(x, 470, x + 270, 900);
  for (let y = 540; y < 900; y += 92) graphics.lineBetween(0, y, 1600, y);

  graphics.fillStyle(0x73bdd0, 1);
  graphics.lineStyle(8, 0x405a59, 1);
  graphics.fillRoundedRect(130, 85, 260, 210, 24);
  graphics.strokeRoundedRect(130, 85, 260, 210, 24);
  graphics.lineStyle(6, 0xffffff, 0.8);
  graphics.lineBetween(260, 90, 260, 290);
  graphics.lineBetween(135, 190, 385, 190);

  graphics.fillStyle(0x73bdd0, 1);
  graphics.lineStyle(8, 0x405a59, 1);
  graphics.fillRoundedRect(1210, 85, 260, 210, 24);
  graphics.strokeRoundedRect(1210, 85, 260, 210, 24);
  graphics.lineStyle(6, 0xffffff, 0.8);
  graphics.lineBetween(1340, 90, 1340, 290);
  graphics.lineBetween(1215, 190, 1465, 190);

  const counter = scene.add.rectangle(810, 390, 730, 150, 0x8fcf9f).setStrokeStyle(9, 0x405a59).setDepth(410);
  const counterTop = scene.add.rectangle(810, 314, 775, 42, 0xffd886).setStrokeStyle(8, 0x405a59).setDepth(413);
  const counterPanel = scene.add.rectangle(810, 390, 290, 86, 0xfff0c7).setStrokeStyle(6, 0x405a59).setDepth(415);
  const counterText = scene.add.text(810, 390, "★  PIZZA  ★", {
    fontFamily: "Arial Rounded MT Bold, sans-serif",
    fontSize: "30px",
    color: "#e46155"
  }).setOrigin(0.5).setDepth(416);

  const oven = scene.add.rectangle(1335, 410, 255, 280, 0xef765d).setStrokeStyle(9, 0x405a59).setDepth(420);
  scene.add.rectangle(1335, 400, 155, 115, 0x4e5d5d).setStrokeStyle(8, 0x405a59).setDepth(422);
  scene.add.ellipse(1335, 420, 108, 55, 0xffc962, 0.75).setDepth(423);
  scene.add.circle(1282, 318, 10, 0xffe56e).setStrokeStyle(4, 0x405a59).setDepth(423);
  scene.add.circle(1320, 318, 10, 0x7bd59a).setStrokeStyle(4, 0x405a59).setDepth(423);

  const shelf = scene.add.rectangle(800, 95, 440, 105, 0xe8915d).setStrokeStyle(8, 0x405a59).setDepth(95);
  [680, 760, 840, 920].forEach((x, index) => {
    scene.add.circle(x, 95, 31, 0xffe298).setStrokeStyle(5, 0x405a59).setDepth(97);
    scene.add.circle(x - 8, 90, 6, index % 2 ? 0x78b85f : 0xe76154).setDepth(98);
    scene.add.circle(x + 10, 104, 6, 0xe76154).setDepth(98);
  });

  scene.exitDoor = { x: 800, y: 848 };
  scene.add.rectangle(800, 845, 190, 105, 0x58a78b).setStrokeStyle(9, 0x405a59).setDepth(820);
  scene.add.rectangle(800, 835, 132, 62, 0x9de1c6).setDepth(822);
  scene.exitGlow = scene.add.ellipse(800, 837, 235, 74, 0xffe179, 0.2).setDepth(818);
  scene.tweens.add({ targets: scene.exitGlow, scaleX: 1.13, scaleY: 1.13, alpha: 0.38, duration: 760, yoyo: true, repeat: -1 });

  const chef = scene.add.container(800, 263).setDepth(430);
  chef.add(scene.add.circle(0, 0, 50, 0xc99868).setStrokeStyle(7, 0x405a59));
  chef.add(scene.add.circle(-18, -4, 5, 0x364f51));
  chef.add(scene.add.circle(18, -4, 5, 0x364f51));
  chef.add(scene.add.arc(0, 12, 17, 15, 165, false, 0, 0).setStrokeStyle(4, 0x364f51));
  chef.add(scene.add.ellipse(0, -50, 105, 50, 0xffffff).setStrokeStyle(7, 0x405a59));
  chef.add(scene.add.circle(-35, -68, 27, 0xffffff).setStrokeStyle(6, 0x405a59));
  chef.add(scene.add.circle(0, -75, 32, 0xffffff).setStrokeStyle(6, 0x405a59));
  chef.add(scene.add.circle(35, -68, 27, 0xffffff).setStrokeStyle(6, 0x405a59));
  chef.add(scene.add.rectangle(0, 68, 100, 78, 0xffffff).setStrokeStyle(7, 0x405a59));
  chef.add(scene.add.text(0, 66, "🍕", { fontSize: "40px" }).setOrigin(0.5));
  scene.tweens.add({ targets: chef, y: 257, duration: 820, yoyo: true, repeat: -1, ease: "Sine.InOut" });

  scene.add.ellipse(350, 650, 270, 120, 0xffd58a).setStrokeStyle(8, 0x405a59).setDepth(645);
  scene.add.rectangle(350, 705, 25, 115, 0x9b6844).setDepth(640);
  scene.add.ellipse(1250, 680, 270, 120, 0xffd58a).setStrokeStyle(8, 0x405a59).setDepth(675);
  scene.add.rectangle(1250, 735, 25, 115, 0x9b6844).setDepth(670);

  addSparkle(scene, 1085, 500, 0);
  addSparkle(scene, 1140, 450, 280);
  addSparkle(scene, 1220, 505, 560);

  void counter;
  void counterTop;
  void counterPanel;
  void counterText;
  void oven;
  void shelf;
}

class PizzaShopScene extends Phaser.Scene {
  constructor() {
    super("PizzaShopScene");
  }

  create() {
    this.physics.world.setBounds(0, 0, 1600, 900);
    drawShopInterior(this);
    createPlayer(this, 800, 720);

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      action: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    addPhysicsBarrier(this, 810, 345, 760, 185);
    addPhysicsBarrier(this, 1335, 410, 280, 300);
    addPhysicsBarrier(this, 350, 650, 280, 125);
    addPhysicsBarrier(this, 1250, 680, 280, 125);

    this.cameras.main.setBounds(0, 0, 1600, 900);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.fadeIn(350, 255, 244, 218);
    setObjective("🍕", "👀", "피자가게를 둘러봐요");
    setActionUi("✦", "행동", false);
    this.transitioning = false;
    showToast("피자가게!", 950);
  }

  leaveShop() {
    if (this.transitioning) return;
    this.transitioning = true;
    playDoorSound();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(320, 255, 244, 218);
    this.time.delayedCall(330, () => this.scene.start("TownScene"));
  }

  hop() {
    if (this.player.getData("hopping")) return;
    this.player.setData("hopping", true);
    playTone(360, 0.08, "triangle", 0.018, 0, 520);
    this.tweens.add({
      targets: this.player,
      scaleX: 1.13,
      scaleY: 0.94,
      duration: 100,
      yoyo: true,
      onComplete: () => this.player.setData("hopping", false)
    });
  }

  update(time) {
    if (this.transitioning) return;
    updatePlayer(this, time);
    const nearExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitDoor.x, this.exitDoor.y) < 135;
    setActionUi(nearExit ? "↩" : "✦", nearExit ? "나가기" : "행동", nearExit);
    this.exitGlow.setAlpha(nearExit ? 0.5 : 0.2);

    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) controls.actionQueued = true;
    if (controls.actionQueued) {
      controls.actionQueued = false;
      nearExit ? this.leaveShop() : this.hop();
    }
  }
}

ui.cards.forEach((card) => {
  if (card.dataset.character === selectedCharacter) card.classList.add("is-selected");
  card.addEventListener("click", () => launchGame(card.dataset.character));
});

ui.actionButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  controls.actionQueued = true;
  controls.lastInputAt = performance.now();
  ensureAudio();
});

ui.soundButton.setAttribute("aria-pressed", String(soundMuted));
ui.soundButton.setAttribute("aria-label", soundMuted ? "소리 켜기" : "소리 끄기");
ui.soundButton.addEventListener("click", () => {
  soundMuted = !soundMuted;
  localStorage.setItem(`${STORAGE_PREFIX}muted`, String(soundMuted));
  ui.soundButton.setAttribute("aria-pressed", String(soundMuted));
  ui.soundButton.setAttribute("aria-label", soundMuted ? "소리 켜기" : "소리 끄기");
  if (!soundMuted) playSelectSound();
});

ui.homeButton.addEventListener("click", returnToSelection);
setupJoystick();

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("gesturestart", (event) => event.preventDefault());

if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
