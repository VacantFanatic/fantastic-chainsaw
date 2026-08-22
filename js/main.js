// Draws a quiet strip of analog "static" across the top of the page,
// and wires up the phosphor-mode toggle (paper -> CRT terminal look).

function initStaticStrip() {
  const canvas = document.getElementById("static-strip");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
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

  function draw() {
    const imageData = ctx.createImageData(width, height);
    const isPhosphor = document.body.classList.contains("phosphor");
    const tint = isPhosphor ? [99, 224, 138] : [33, 40, 59];

    for (let i = 0; i < imageData.data.length; i += 4) {
      const shade = Math.random();
      imageData.data[i] = tint[0] * shade;
      imageData.data[i + 1] = tint[1] * shade;
      imageData.data[i + 2] = tint[2] * shade;
      imageData.data[i + 3] = 255 * shade * 0.5;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  resize();
  draw();

  if (!prefersReducedMotion) {
    setInterval(draw, 120);
  }

  window.addEventListener("resize", () => {
    resize();
    draw();
  });
}

function initPhosphorToggle() {
  const toggle = document.getElementById("phosphor-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("phosphor");
  });
}

initStaticStrip();
initPhosphorToggle();
