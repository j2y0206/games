(() => {
  "use strict";

  const garage = document.querySelector("#garage");
  const car = document.querySelector("#car");
  const carSvg = document.querySelector("#carSvg");
  const soundButton = document.querySelector("#soundButton");
  const bubbleLayer = document.querySelector("#bubbleLayer");
  const tools = [...document.querySelectorAll(".tool")];
  const mudSpots = [...document.querySelectorAll(".mud")].map((element) => ({
    element,
    x: Number(element.dataset.x),
    y: Number(element.dataset.y),
    clean: 0
  }));

  const carColors = [
    ["#36a8c8", "#278cab"],
    ["#ee7555", "#d85844"],
    ["#78bd5f", "#589c48"],
    ["#a887d7", "#8167b0"]
  ];

  let active = null;
  let audioContext = null;
  let muted = false;
  let bubbleTimer = 0;
  let lastMoveTime = performance.now();
  let completed = false;
  let round = 0;

  function ensureAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  }

  function tone(frequency, duration, type = "sine", volume = 0.05, delay = 0) {
    if (muted) return;
    ensureAudio();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
    gain.gain.setValueAtTime(0, audioContext.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + delay + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(audioContext.currentTime + delay);
    oscillator.stop(audioContext.currentTime + delay + duration + 0.03);
  }

  function playPickup(toolName) {
    tone(toolName === "hose" ? 330 : 440, 0.12, "sine", 0.035);
  }

  function playSuccess() {
    tone(523, 0.18, "triangle", 0.055, 0);
    tone(659, 0.18, "triangle", 0.055, 0.14);
    tone(784, 0.35, "triangle", 0.06, 0.28);
  }

  function makeBubble(x, y) {
    const bubble = document.createElement("i");
    bubble.className = "bubble";
    bubble.style.left = `${x + (Math.random() - 0.5) * 56}px`;
    bubble.style.top = `${y + (Math.random() - 0.5) * 38}px`;
    bubble.style.setProperty("--size", `${18 + Math.random() * 24}px`);
    bubbleLayer.appendChild(bubble);
    bubble.addEventListener("animationend", () => bubble.remove(), { once: true });
  }

  function cleanAt(clientX, clientY, toolName, elapsed) {
    if (completed) return;
    const rect = carSvg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 900;
    const y = ((clientY - rect.top) / rect.height) * 470;
    const radius = toolName === "hose" ? 125 : 90;
    const strength = toolName === "hose" ? 0.00072 : 0.00115;
    let touched = false;

    mudSpots.forEach((spot) => {
      const distance = Math.hypot(x - spot.x, y - spot.y);
      if (distance < radius && spot.clean < 1) {
        spot.clean = Math.min(1, spot.clean + elapsed * strength * (1 - distance / radius * 0.42));
        spot.element.style.setProperty("--clean", spot.clean.toFixed(3));
        touched = true;
      }
    });

    if (touched && toolName === "sponge" && performance.now() - bubbleTimer > 70) {
      makeBubble(clientX, clientY);
      bubbleTimer = performance.now();
    }

    if (mudSpots.every((spot) => spot.clean >= 0.995)) finishRound();
  }

  function finishRound() {
    if (completed) return;
    completed = true;
    mudSpots.forEach((spot) => {
      spot.clean = 1;
      spot.element.style.setProperty("--clean", "1");
    });
    garage.classList.add("complete");
    car.setAttribute("aria-label", "깨끗해진 자동차");
    playSuccess();
    window.setTimeout(startNextCar, 3000);
  }

  function startNextCar() {
    round += 1;
    garage.classList.remove("complete");
    const [main, dark] = carColors[round % carColors.length];
    car.style.setProperty("--car-main", main);
    car.style.setProperty("--car-dark", dark);
    car.animate([
      { transform: "translate(-50%, -50%) translateX(0)", opacity: 1 },
      { transform: "translate(-50%, -50%) translateX(80vw)", opacity: 0 },
      { transform: "translate(-50%, -50%) translateX(-80vw)", opacity: 0 },
      { transform: "translate(-50%, -50%) translateX(0)", opacity: 1 }
    ], { duration: 1200, easing: "cubic-bezier(.4,0,.2,1)" });

    window.setTimeout(() => {
      mudSpots.forEach((spot, index) => {
        spot.clean = 0;
        spot.element.style.setProperty("--clean", "0");
        spot.element.style.transform = `translate(${spot.x}px, ${spot.y}px) rotate(${((round + index) % 3 - 1) * 8}deg)`;
      });
      completed = false;
      car.setAttribute("aria-label", "진흙이 묻은 자동차");
      tools.forEach((tool) => tool.classList.add("is-helping"));
    }, 570);
  }

  function beginDrag(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const tool = event.currentTarget;
    const rect = tool.getBoundingClientRect();
    active = {
      tool,
      pointerId: event.pointerId,
      name: tool.dataset.tool,
      homeX: rect.left - Number.parseFloat(getComputedStyle(tool).getPropertyValue("--drag-x") || 0),
      homeY: rect.top - Number.parseFloat(getComputedStyle(tool).getPropertyValue("--drag-y") || 0),
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    tool.setPointerCapture(event.pointerId);
    tool.classList.add("dragging");
    tools.forEach((item) => item.classList.remove("is-helping"));
    lastMoveTime = performance.now();
    playPickup(active.name);
    moveDrag(event);
  }

  function moveDrag(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    event.preventDefault();
    const nextLeft = event.clientX - active.offsetX;
    const nextTop = event.clientY - active.offsetY;
    active.tool.style.setProperty("--drag-x", `${nextLeft - active.homeX}px`);
    active.tool.style.setProperty("--drag-y", `${nextTop - active.homeY}px`);
    const now = performance.now();
    cleanAt(event.clientX, event.clientY, active.name, Math.min(60, now - lastMoveTime));
    lastMoveTime = now;
  }

  function endDrag(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    const tool = active.tool;
    tool.classList.remove("dragging");
    tool.style.setProperty("--drag-x", "0px");
    tool.style.setProperty("--drag-y", "0px");
    if (!completed) window.setTimeout(() => tools.forEach((item) => item.classList.add("is-helping")), 1800);
    active = null;
  }

  tools.forEach((tool) => {
    tool.addEventListener("pointerdown", beginDrag);
    tool.addEventListener("pointermove", moveDrag);
    tool.addEventListener("pointerup", endDrag);
    tool.addEventListener("pointercancel", endDrag);
  });

  soundButton.addEventListener("click", () => {
    muted = !muted;
    soundButton.setAttribute("aria-pressed", String(muted));
    if (!muted) {
      ensureAudio();
      tone(440, 0.12, "sine", 0.04);
    }
  });

  document.addEventListener("contextmenu", (event) => event.preventDefault());
})();
