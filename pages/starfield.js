// A quiet field of stars that drift on their own, and lean gently
// toward the cursor when it moves nearby.

const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d");

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

let width = 0;
let height = 0;
let stars = [];
let pointer = { x: null, y: null };

const STAR_COUNT = 160;
const PULL_RADIUS = 160;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  ctx.setTransform(
    window.devicePixelRatio,
    0,
    0,
    window.devicePixelRatio,
    0,
    0,
  );
}

function makeStar() {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    baseX: 0,
    baseY: 0,
    radius: Math.random() * 1.4 + 0.3,
    drift: Math.random() * 0.15 + 0.02,
    angle: Math.random() * Math.PI * 2,
    twinkle: Math.random() * Math.PI * 2,
  };
}

function initStars() {
  stars = Array.from({ length: STAR_COUNT }, () => {
    const star = makeStar();
    star.baseX = star.x;
    star.baseY = star.y;
    return star;
  });
}

function step() {
  ctx.clearRect(0, 0, width, height);

  for (const star of stars) {
    star.angle += star.drift * 0.02;
    star.twinkle += 0.03;

    let x = star.baseX + Math.cos(star.angle) * 8;
    let y = star.baseY + Math.sin(star.angle) * 8;

    if (pointer.x !== null) {
      const dx = pointer.x - x;
      const dy = pointer.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PULL_RADIUS) {
        const pull = (1 - dist / PULL_RADIUS) * 14;
        x += (dx / (dist || 1)) * pull;
        y += (dy / (dist || 1)) * pull;
      }
    }

    const brightness = 0.5 + Math.sin(star.twinkle) * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, star.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(99, 224, 138, ${brightness})`;
    ctx.fill();
  }

  if (!prefersReducedMotion) {
    requestAnimationFrame(step);
  }
}

window.addEventListener("resize", () => {
  resize();
  initStars();
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
initStars();
step();

if (prefersReducedMotion) {
  // Draw a single still frame so the piece still reads as intentional,
  // just calm, for anyone who prefers reduced motion.
  step();
}
