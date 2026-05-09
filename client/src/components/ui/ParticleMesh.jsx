import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;
const ROWS = 18;
const COLS = 28;

const ParticleMesh = ({ className = "" }) => {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    const parent = canvas.parentElement;

    if (!context || !parent) {
      return undefined;
    }

    const meshPoints = [];

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        meshPoints.push({
          col,
          row,
          seed: Math.random() * TAU,
          offset: Math.random() * 0.65,
        });
      }
    }

    const projected = new Array(meshPoints.length);
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let resizeObserver;

    const resize = () => {
      const nextWidth = parent.clientWidth;
      const nextHeight = parent.clientHeight;

      if (!nextWidth || !nextHeight) {
        return;
      }

      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.floor(nextWidth * pixelRatio);
      canvas.height = Math.floor(nextHeight * pixelRatio);
      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (time) => {
      const t = time * 0.00042;
      const centerX = width / 2 + pointerRef.current.x * 18;
      const centerY = height / 2 + pointerRef.current.y * 12;
      const radius = Math.min(width, height) * 0.24;
      const fov = Math.min(width, height) * 1.35;

      context.clearRect(0, 0, width, height);

      const radial = context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.15,
        centerX,
        centerY,
        radius * 1.65,
      );
      radial.addColorStop(0, "rgba(231,236,239,0.16)");
      radial.addColorStop(0.48, "rgba(96,150,186,0.12)");
      radial.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = radial;
      context.fillRect(0, 0, width, height);

      for (let index = 0; index < meshPoints.length; index += 1) {
        const point = meshPoints[index];
        const u = point.col / (COLS - 1);
        const v = point.row / (ROWS - 1);
        const theta = u * TAU + t * 0.7 + point.offset;
        const phi = v * Math.PI;
        const envelope =
          0.84 +
          0.16 * Math.sin(theta * 2.4 + t * 1.6 + point.seed) +
          0.08 * Math.cos(phi * 5.1 - t * 1.2 + point.seed);
        const localRadius = radius * envelope;
        const wobble = Math.sin(theta * 1.8 + t + point.seed) * 10;
        const x = localRadius * Math.sin(phi) * Math.cos(theta);
        const y =
          localRadius * Math.cos(phi) * 0.78 +
          wobble +
          Math.cos(phi * 6 + t + point.seed) * 3;
        const z =
          localRadius * Math.sin(phi) * Math.sin(theta) +
          Math.cos(theta * 2.2 + point.seed) * 10;
        const depth = fov / (fov + z + radius * 1.7);
        const px = centerX + x * depth;
        const py = centerY + y * depth;

        projected[index] = {
          x: px,
          y: py,
          depth,
          alpha: 0.22 + depth * 0.58,
        };
      }

      context.lineWidth = 0.9;

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const currentIndex = row * COLS + col;
          const current = projected[currentIndex];

          if (col < COLS - 1) {
            const right = projected[currentIndex + 1];
            const strength = (current.alpha + right.alpha) * 0.18;
            context.strokeStyle = `rgba(231,236,239,${strength})`;
            context.beginPath();
            context.moveTo(current.x, current.y);
            context.lineTo(right.x, right.y);
            context.stroke();
          }

          if (row < ROWS - 1) {
            const down = projected[currentIndex + COLS];
            const strength = (current.alpha + down.alpha) * 0.14;
            context.strokeStyle = `rgba(96,150,186,${strength})`;
            context.beginPath();
            context.moveTo(current.x, current.y);
            context.lineTo(down.x, down.y);
            context.stroke();
          }
        }
      }

      for (let index = 0; index < projected.length; index += 1) {
        const point = projected[index];
        const size = 0.7 + point.depth * 1.35;
        context.fillStyle = `rgba(231,236,239,${point.alpha})`;
        context.beginPath();
        context.arc(point.x, point.y, size, 0, TAU);
        context.fill();
      }

      frameRef.current = window.requestAnimationFrame(draw);
    };

    const handlePointerMove = (event) => {
      const bounds = parent.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      pointerRef.current = { x, y };
    };

    const handlePointerLeave = () => {
      pointerRef.current = { x: 0, y: 0 };
    };

    resize();
    frameRef.current = window.requestAnimationFrame(draw);

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(parent);
    } else {
      window.addEventListener("resize", resize);
    }

    parent.addEventListener("pointermove", handlePointerMove);
    parent.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      parent.removeEventListener("pointermove", handlePointerMove);
      parent.removeEventListener("pointerleave", handlePointerLeave);

      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", resize);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={["particle-mesh-canvas", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
};

export default ParticleMesh;
