// A quiet field of stars that drift on their own, and lean gently
// toward the cursor when it moves nearby.
//
// The distortion values are live: the panel in the corner writes into
// `params`, and the draw loop reads it every frame. DEFAULTS is the
// resting state that the reset button returns to.

const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d");

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const DEFAULTS = {
  count: 160,
  pullRadius: 160,
  pullStrength: 14,
  drift: 8,
  twinkle: 0.03,
};

const params = { ...DEFAULTS };

// How each value is written out beside its slider.
const FORMAT = {
  count: (v) => String(Math.round(v)),
  pullRadius: (v) => `${Math.round(v)}px`,
  pullStrength: (v) => `${Math.round(v)}px`,
  drift: (v) => `${Math.round(v)}px`,
  twinkle: (v) => v.toFixed(3),
};

// Read the star color off the shared token rather than hardcoding it,
// so the palette stays defined in one place.
const STAR_COLOR =
  getComputedStyle(document.documentElement)
    .getPropertyValue("--phosphor-fg")
    .trim() || "#63e08a";

let width = 0;
let height = 0;
let stars = [];
let pointer = { x: null, y: null };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeStar() {
  return {
    baseX: Math.random() * width,
    baseY: Math.random() * height,
    radius: Math.random() * 1.4 + 0.3,
    drift: Math.random() * 0.15 + 0.02,
    angle: Math.random() * Math.PI * 2,
    twinkle: Math.random() * Math.PI * 2,
  };
}

// Grow or trim the field in place. Dragging the count slider should add
// and remove stars, not reshuffle the ones already on screen.
function setCount(n) {
  const target = Math.max(0, Math.round(n));
  while (stars.length < target) stars.push(makeStar());
  if (stars.length > target) stars.length = target;
}

function frame() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = STAR_COLOR;

  for (const star of stars) {
    star.angle += star.drift * 0.02;
    star.twinkle += params.twinkle;

    let x = star.baseX + Math.cos(star.angle) * params.drift;
    let y = star.baseY + Math.sin(star.angle) * params.drift;

    if (pointer.x !== null && params.pullRadius > 0) {
      const dx = pointer.x - x;
      const dy = pointer.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < params.pullRadius) {
        const pull = (1 - dist / params.pullRadius) * params.pullStrength;
        x += (dx / (dist || 1)) * pull;
        y += (dy / (dist || 1)) * pull;
      }
    }

    ctx.globalAlpha = 0.5 + Math.sin(star.twinkle) * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function loop() {
  frame();
  requestAnimationFrame(loop);
}

// With reduced motion there's no animation loop running, so any change
// to the field has to repaint its one still frame by hand.
function repaintIfStill() {
  if (prefersReducedMotion) frame();
}

function readout(key) {
  return document.querySelector(`[data-readout="${key}"]`);
}

// Push `params` out to every slider and its printed value.
function syncControls() {
  for (const input of document.querySelectorAll("[data-param]")) {
    const key = input.dataset.param;
    input.value = String(params[key]);
    const out = readout(key);
    if (out) out.textContent = FORMAT[key](params[key]);
  }
}

function initControls() {
  for (const input of document.querySelectorAll("[data-param]")) {
    input.addEventListener("input", () => {
      const key = input.dataset.param;
      params[key] = parseFloat(input.value);

      const out = readout(key);
      if (out) out.textContent = FORMAT[key](params[key]);
      if (key === "count") setCount(params.count);

      repaintIfStill();
    });
  }

  const reset = document.getElementById("controls-reset");
  if (reset) {
    reset.addEventListener("click", () => {
      Object.assign(params, DEFAULTS);
      setCount(params.count);
      syncControls();
      repaintIfStill();
    });
  }
}

window.addEventListener("resize", () => {
  resize();
  stars = [];
  setCount(params.count);
  repaintIfStill();
});

window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});

window.addEventListener("pointerleave", () => {
  pointer.x = null;
  pointer.y = null;
});

resize();
setCount(params.count);
initControls();
syncControls();

if (prefersReducedMotion) {
  // Draw a single still frame so the piece still reads as intentional,
  // just calm, for anyone who prefers reduced motion. The sliders keep
  // working — each change repaints this frame.
  frame();
} else {
  loop();
}
