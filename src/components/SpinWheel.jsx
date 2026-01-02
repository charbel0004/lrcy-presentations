import { useEffect, useRef } from "react";

export default function SpinWheel({ labels = [], rotationRad = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- Size / Retina ---
    const size = 360;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const center = size / 2;
    const radius = size / 2;

    const items = labels.length || 1;
    const sliceAngle = (2 * Math.PI) / items;

    ctx.clearRect(0, 0, size, size);

    // --- Color palette (pleasant, repeating) ---
    const palette = [
      "#2563eb", // blue
      "#16a34a", // green
      "#f59e0b", // amber
      "#7c3aed", // violet
      "#ef4444", // red
      "#06b6d4", // cyan
      "#f97316", // orange
      "#22c55e", // emerald
      "#e11d48", // rose
      "#a855f7", // purple
      "#0ea5e9", // sky
      "#84cc16", // lime
    ];

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    // basic wrap by words into 1–2 lines
    const wrapLines = (text, maxLen = 18) => {
      const words = String(text || "").trim().split(/\s+/).filter(Boolean);
      if (!words.length) return [""];
      const lines = [];
      let line = "";

      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (next.length <= maxLen) {
          line = next;
        } else {
          if (line) lines.push(line);
          line = w;
          if (lines.length === 1) break; // keep max 2 lines
        }
      }
      if (line && lines.length < 2) lines.push(line);

      // if still too long, hard-trim last line
      if (lines.length === 2 && lines[1].length > maxLen) {
        lines[1] = lines[1].slice(0, maxLen - 1) + "…";
      }
      if (lines.length === 1 && lines[0].length > maxLen * 2) {
        lines[0] = lines[0].slice(0, maxLen * 2 - 1) + "…";
      }
      return lines;
    };

    // --- Draw wheel ---
    ctx.save();
    ctx.translate(center, center);

    // Wheel rotates, arrow stays DOWN (6 o'clock)
    ctx.rotate(Math.PI / 2 + rotationRad);

    for (let i = 0; i < items; i++) {
      const start = i * sliceAngle;
      const end = start + sliceAngle;
      const mid = start + sliceAngle / 2;

      // Slice
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();

      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();

      // Slice separator line (subtle)
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Text (vertical)
      ctx.save();

      ctx.rotate(mid);
      ctx.translate(radius * 0.67, 0);
      ctx.rotate(-Math.PI / 2); // vertical/upright

      const raw = String(labels[i] || "");
      const lines = wrapLines(raw, 18);

      // font scales with number of items
      const base = 14 - Math.floor(items / 10);
      const fontSize = clamp(base, 10, 14);

      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

      // light shadow for readability
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;

      if (lines.length === 1) {
        ctx.fillText(lines[0], 0, 0);
      } else {
        const gap = fontSize + 2;
        ctx.fillText(lines[0], 0, -gap / 2);
        ctx.fillText(lines[1], 0, gap / 2);
      }

      ctx.restore();
    }

    ctx.restore();

    // --- Outer ring / inner ring / hub (for polish) ---
    // Outer ring
    ctx.beginPath();
    ctx.arc(center, center, radius - 1, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.12, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(10,10,10,0.70)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [labels, rotationRad]);

  return <canvas ref={canvasRef} className="rounded-full" />;
}
