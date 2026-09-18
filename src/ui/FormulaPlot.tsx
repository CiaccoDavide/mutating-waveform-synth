import { useEffect, useRef, useCallback } from 'react';
import {
  sampleSketch,
  wrapPhase,
  clampAmp,
  type ConnectMode,
  type WavePoint,
} from '../audio/WaveSketch';

interface FormulaPlotProps {
  samples: Float32Array;
  width?: number;
  height?: number;
  editMode?: boolean;
  points?: WavePoint[];
  connectMode?: ConnectMode;
  onPointsChange?: (points: WavePoint[]) => void;
}

const HANDLE_R = 7;
const TAU = Math.PI * 2;

function phaseToX(phase: number, width: number): number {
  return (wrapPhase(phase) / TAU) * width;
}

function ampToY(amp: number, height: number): number {
  return height / 2 - clampAmp(amp) * (height * 0.42);
}

function xyToPoint(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): WavePoint {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * width;
  const y = ((clientY - rect.top) / rect.height) * height;
  const phase = wrapPhase((x / width) * TAU);
  const amp = clampAmp((height / 2 - y) / (height * 0.42));
  return { phase, amp };
}

function hitIndex(
  pts: WavePoint[],
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): number {
  const rect = canvas.getBoundingClientRect();
  const mx = ((clientX - rect.left) / rect.width) * width;
  const my = ((clientY - rect.top) / rect.height) * height;
  const threshold = HANDLE_R + 4;
  let best = -1;
  let bestD = threshold * threshold;
  for (let i = 0; i < pts.length; i += 1) {
    const px = phaseToX(pts[i]!.phase, width);
    const py = ampToY(pts[i]!.amp, height);
    const d = (px - mx) ** 2 + (py - my) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function FormulaPlot({
  samples,
  width = 640,
  height = 220,
  editMode = false,
  points = [],
  connectMode = 'linear',
  onPointsChange,
}: FormulaPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<number | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    if (editMode) {
      ctx.fillStyle = 'rgba(94, 234, 212, 0.04)';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    }

    // Grid
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    for (let i = 1; i < 4; i += 1) {
      const x = (width / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const curve =
      editMode && points.length >= 2
        ? sampleSketch(points, connectMode, Math.max(256, Math.floor(width)))
        : samples;

    if (curve.length >= 2) {
      ctx.beginPath();
      for (let i = 0; i < curve.length; i += 1) {
        const x = (i / (curve.length - 1)) * width;
        const y = height / 2 - curve[i]! * (height * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.25)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < curve.length; i += 1) {
        const x = (i / (curve.length - 1)) * width;
        const y = height / 2 - curve[i]! * (height * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (editMode) {
      for (const p of points) {
        const x = phaseToX(p.phase, width);
        const y = ampToY(p.amp, height);
        ctx.beginPath();
        ctx.arc(x, y, HANDLE_R, 0, TAU);
        ctx.fillStyle = '#0c1218';
        ctx.fill();
        ctx.strokeStyle = '#5eead4';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, TAU);
        ctx.fillStyle = '#e8b86d';
        ctx.fill();
      }
    }
  }, [samples, width, height, editMode, points, connectMode]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (!editMode) {
      dragRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const pts = pointsRef.current;
      const hit = hitIndex(pts, e.clientX, e.clientY, canvas, width, height);

      if (e.altKey && hit >= 0) {
        if (pts.length <= 2) return;
        onPointsChange?.(pts.filter((_, i) => i !== hit));
        return;
      }

      if (hit >= 0) {
        dragRef.current = hit;
        return;
      }

      const next = xyToPoint(e.clientX, e.clientY, canvas, width, height);
      const updated = [...pts, next];
      dragRef.current = updated.length - 1;
      onPointsChange?.(updated);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragRef.current === null) return;
      const idx = dragRef.current;
      const pts = pointsRef.current;
      const next = xyToPoint(e.clientX, e.clientY, canvas, width, height);
      onPointsChange?.(
        pts.map((p, i) => (i === idx ? next : p)),
      );
    };

    const onPointerUp = () => {
      dragRef.current = null;
    };

    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      const pts = pointsRef.current;
      const hit = hitIndex(pts, e.clientX, e.clientY, canvas, width, height);
      if (hit < 0 || pts.length <= 2) return;
      onPointsChange?.(pts.filter((_, i) => i !== hit));
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('dblclick', onDblClick);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('dblclick', onDblClick);
    };
  }, [editMode, width, height, onPointsChange]);

  return (
    <canvas
      ref={canvasRef}
      className={`formula-plot${editMode ? ' is-editing' : ''}`}
      style={{ width, height, display: 'block', maxWidth: '100%' }}
      aria-label={editMode ? 'Wave sketch editor' : 'Waveshape plot'}
    />
  );
}
