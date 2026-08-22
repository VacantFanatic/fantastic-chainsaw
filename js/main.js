// Draws a quiet strip of analog "static" across the top of the page,
// and wires up the phosphor-mode toggle (paper -> CRT terminal look).

function initStaticStrip() {
  const canvas = document.getElementById("static-strip");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // The noise is generated at CSS-pixel size in an offscreen buffer and
  // then scaled up to the device-pixel canvas. Two reasons: putImageData
  // ignores the transform matrix, so writing CSS-sized ImageData straight
  // to a HiDPI canvas only fills the top-left corner of it; and drawing
  // through drawImage keeps the grain the same apparent size on every
  // display instead of going fine and smooth on retina screens.
  const buffer = document.createElement("canvas");
  const bufferCtx = buffer.getContext("2d");

  let width = 0;
  let height = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = Math.max(1, Math.round(canvas.clientWidth));
    height = Math.max(1, Math.round(canvas.clientHeight));

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    buffer.width = width;
    buffer.height = height;

    // Resizing a canvas resets its context, so both of these have to be
    // reapplied here rather than set once at startup.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function draw() {
    const imageData = bufferCtx.createImageData(width, height);
    const data = imageData.data;
    const isPhosphor = document.body.classList.contains("phosphor");
    const tint = isPhosphor ? [99, 224, 138] : [33, 40, 59];

    for (let i = 0; i < data.length; i += 4) {
      const shade = Math.random();
      data[i] = tint[0] * shade;
      data[i + 1] = tint[1] * shade;
      data[i + 2] = tint[2] * shade;
      data[i + 3] = 255 * shade * 0.5;
    }

    bufferCtx.putImageData(imageData, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(buffer, 0, 0, width, height);
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
