// Lightweight, dependency-free canvas confetti. Tasteful + brief.
const COLORS = ["#5ef2c0", "#7cc7ff", "#ffb454", "#ffffff", "#a78bfa"];

export function burst({ count = 120, power = 1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H;
  const resize = () => {
    W = canvas.width = innerWidth * dpr;
    H = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
  };
  resize();
  addEventListener("resize", resize);

  const cx = W / 2;
  const parts = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI - Math.PI / 2;
    const v = (6 + Math.random() * 9) * power * dpr;
    return {
      x: cx + (Math.random() - 0.5) * 120 * dpr,
      y: H * 0.28,
      vx: Math.sin(a) * v + (Math.random() - 0.5) * 4,
      vy: -Math.abs(Math.cos(a) * v) - Math.random() * 6,
      g: 0.22 * dpr,
      size: (5 + Math.random() * 7) * dpr,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 1,
    };
  });

  let frame = 0;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (frame > 60) p.life -= 0.018;
      if (p.life > 0 && p.y < H + 40) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    if (alive && frame < 200) requestAnimationFrame(tick);
    else {
      removeEventListener("resize", resize);
      canvas.remove();
    }
  };
  requestAnimationFrame(tick);
}
