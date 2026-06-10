"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BoundingBox = { x: number; y: number; width: number; height: number; };

type Props = { imageUrl: string | null; boundingBoxes?: BoundingBox[]; className?: string; };

export default function MedicalViewport({ imageUrl, boundingBoxes = [], className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<"idle" | "pan" | "zoom">("idle");
  const imgRef = useRef<HTMLImageElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const activeButtonRef = useRef<number | null>(null);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastTouchDistRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: cw, height: ch } = canvas;
    ctx.clearRect(0, 0, cw, ch);
    const scale = scaleRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;
    const fitScale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const drawW = img.naturalWidth * fitScale * scale;
    const drawH = img.naturalHeight * fitScale * scale;
    const drawX = (cw - drawW) / 2 + ox;
    const drawY = (ch - drawH) / 2 + oy;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    if (boundingBoxes.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(255,59,48,0.6)";
      ctx.shadowBlur = 6;
      for (let i = 0; i < boundingBoxes.length; i++) {
        const box = boundingBoxes[i];
        const bx = drawX + box.x * fitScale * scale;
        const by = drawY + box.y * fitScale * scale;
        const bw = box.width * fitScale * scale;
        const bh = box.height * fitScale * scale;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ff3b30";
        ctx.font = "bold 10px sans-serif";
        ctx.fillRect(bx, by - 16, 52, 16);
        ctx.fillStyle = "#fff";
        ctx.fillText("Finding " + (i + 1), bx + 3, by - 4);
        ctx.shadowBlur = 6;
        ctx.strokeStyle = "#ff3b30";
      }
      ctx.restore();
    }
  }, [boundingBoxes]);

  const fitImage = useCallback(() => {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    });
    ro.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    if (!imageUrl) {
      imgRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const img = new Image();
    img.onload = () => { imgRef.current = img; setError(null); fitImage(); setLoading(false); };
    img.onerror = () => { setError("Could not load image."); setLoading(false); };
    queueMicrotask(() => setLoading(true));
    img.src = imageUrl;
  }, [fitImage, imageUrl]);

  useEffect(() => { draw(); }, [draw]);

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 && e.button !== 2) return;
    activeButtonRef.current = e.button;
    setInteractionMode(e.button === 2 ? "zoom" : "pan");
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (activeButtonRef.current === null) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    if (activeButtonRef.current === 0) {
      offsetRef.current.x += dx;
      offsetRef.current.y += dy;
    } else if (activeButtonRef.current === 2) {
      const zoomFactor = 1 + dy * -0.01;
      scaleRef.current = Math.max(0.2, Math.min(10, scaleRef.current * zoomFactor));
    }
    draw();
  }

  function onMouseUp() { activeButtonRef.current = null; setInteractionMode("idle"); }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      activeButtonRef.current = 0;
      setInteractionMode("pan");
      lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastTouchDistRef.current !== null) {
        scaleRef.current = Math.max(0.2, Math.min(10, scaleRef.current * (dist / lastTouchDistRef.current)));
        draw();
      }
      lastTouchDistRef.current = dist;
    } else if (e.touches.length === 1) {
      offsetRef.current.x += e.touches[0].clientX - lastPosRef.current.x;
      offsetRef.current.y += e.touches[0].clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      draw();
    }
  }

  function onTouchEnd() { activeButtonRef.current = null; lastTouchDistRef.current = null; setInteractionMode("idle"); }

  const cursorClass = interactionMode === "pan" ? "cursor-grabbing" : interactionMode === "zoom" ? "cursor-ns-resize" : "cursor-grab";

  return (
    <div
      ref={containerRef}
      className={className ?? "relative h-80 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800"}
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className={`h-full w-full ${cursorClass}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      />
      {!imageUrl && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
          <svg className="h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <span className="text-[12px] opacity-30">Preview will appear here</span>
        </div>
      )}
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg className="h-6 w-6 animate-spin opacity-40" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] text-red-400">{error}</div>
      )}
      {imageUrl && !error && !loading && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-lg bg-black/50 px-2 py-1 text-[10px] text-white/70">
          Left-drag: pan · Right-drag: zoom
        </div>
      )}
      {boundingBoxes.length > 0 && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-red-500/80 px-2 py-1 text-[10px] font-semibold text-white">
          {boundingBoxes.length} region{boundingBoxes.length > 1 ? "s" : ""} flagged
        </div>
      )}
    </div>
  );
}
