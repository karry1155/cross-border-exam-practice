(function () {
  const canvas = document.getElementById("signalCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dots = Array.from({ length: 86 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    r: index % 5 === 0 ? 2.8 : 1.6,
    vx: (Math.random() - 0.5) * 0.0012,
    vy: (Math.random() - 0.5) * 0.0012,
  }));

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#07131f";
    ctx.fillRect(0, 0, width, height);

    const scan = (Date.now() / 38) % height;
    ctx.fillStyle = "rgba(219, 168, 82, 0.08)";
    ctx.fillRect(0, scan, width, 2);

    dots.forEach((dot) => {
      dot.x += dot.vx;
      dot.y += dot.vy;
      if (dot.x < 0 || dot.x > 1) dot.vx *= -1;
      if (dot.y < 0 || dot.y > 1) dot.vy *= -1;
    });

    for (let i = 0; i < dots.length; i += 1) {
      for (let j = i + 1; j < dots.length; j += 1) {
        const a = dots[i];
        const b = dots[j];
        const ax = a.x * width;
        const ay = a.y * height;
        const bx = b.x * width;
        const by = b.y * height;
        const distance = Math.hypot(ax - bx, ay - by);
        if (distance < 150) {
          ctx.strokeStyle = `rgba(65, 189, 169, ${0.18 - distance / 900})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
    }

    dots.forEach((dot) => {
      const x = dot.x * width;
      const y = dot.y * height;
      ctx.fillStyle = dot.r > 2 ? "#dba852" : "#41bda9";
      ctx.beginPath();
      ctx.arc(x, y, dot.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
})();
