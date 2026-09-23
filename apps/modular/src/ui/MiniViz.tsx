import { useEffect, useRef } from 'react';
import type { ModuleType } from '../modules/types';
import type { ModularEngine } from '../audio/ModularEngine';

interface Props {
  nodeId: string;
  type: ModuleType;
  engine: ModularEngine;
  params: Record<string, number | string>;
  width?: number;
  height?: number;
}

/** Cheap per-node canvas peek: waveform / ADSR / meters / clock / seq. */
export function MiniViz({
  nodeId,
  type,
  engine,
  params,
  width = 120,
  height = 40,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    let raf = 0;
    const buf = new Float32Array(128);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.fillStyle = 'rgba(7, 10, 13, 0.85)';
      ctx2d.fillRect(0, 0, w, h);

      if (type === 'env') {
        drawAdsr(
          ctx2d,
          w,
          h,
          params,
          engine.getEnvLevel(nodeId),
          engine.getEnvStage(nodeId),
          engine.getEnvProgress(nodeId),
        );
      } else if (type === 'clock') {
        drawPulse(ctx2d, w, h, engine.getPulse(nodeId));
      } else if (type === 'seq') {
        const steps = Number(params.steps ?? 8) === 16 ? 16 : 8;
        drawSteps(ctx2d, w, h, steps, engine.getStep(nodeId));
      } else if (type === 'quant') {
        drawSteps(ctx2d, w, h, 8, Math.round(Number(params.root ?? 0) % 8));
      } else if (type === 'sh') {
        drawHold(ctx2d, w, h, engine.getHold(nodeId));
      } else if (type === 'turing') {
        drawBits(
          ctx2d,
          w,
          h,
          engine.getBits(nodeId),
          engine.getStep(nodeId),
        );
      } else if (type === 'euclid') {
        const pat = engine.getPattern(nodeId);
        const n = pat.length || 1;
        const active = (engine.getStep(nodeId) - 1 + n) % n;
        drawEuclid(ctx2d, w, h, pat, active);
      } else {
        const an = engine.getAnalyser(nodeId);
        if (an) {
          an.getFloatTimeDomainData(buf);
          if (
            type === 'vca' ||
            type === 'out' ||
            type === 'chorus' ||
            type === 'delay' ||
            type === 'reverb' ||
            type === 'mixer' ||
            type === 'dist'
          ) {
            drawMeter(ctx2d, w, h, buf);
          } else {
            drawWave(ctx2d, w, h, buf);
          }
        } else {
          ctx2d.strokeStyle = 'rgba(94, 234, 212, 0.2)';
          ctx2d.beginPath();
          ctx2d.moveTo(0, h / 2);
          ctx2d.lineTo(w, h / 2);
          ctx2d.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [nodeId, type, engine, params, width, height]);

  return (
    <canvas
      ref={ref}
      className="mini-viz"
      width={width}
      height={height}
      style={{ width, height }}
    />
  );
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  buf: Float32Array,
) {
  ctx.strokeStyle = '#5eead4';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const mid = h / 2;
  for (let i = 0; i < buf.length; i++) {
    const x = (i / (buf.length - 1)) * w;
    const y = mid - buf[i]! * mid * 0.9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawMeter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  buf: Float32Array,
) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    peak = Math.max(peak, Math.abs(buf[i]!));
  }
  const bar = Math.min(1, peak * 2) * (w - 4);
  ctx.fillStyle = 'rgba(94, 234, 212, 0.15)';
  ctx.fillRect(2, 8, w - 4, h - 16);
  ctx.fillStyle = peak > 0.85 ? '#f472b6' : '#5eead4';
  ctx.fillRect(2, 8, bar, h - 16);
}

function drawPulse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  on: boolean,
) {
  ctx.fillStyle = on ? '#f472b6' : 'rgba(244, 114, 182, 0.2)';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, on ? 10 : 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawHold(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hold: number,
) {
  const y = h / 2 - clampViz(hold, -1, 1) * (h / 2 - 4);
  ctx.strokeStyle = '#e8b86d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, y);
  ctx.lineTo(w - 4, y);
  ctx.stroke();
}

function clampViz(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function drawSteps(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  steps: number,
  active: number,
) {
  const pad = 4;
  const gap = 2;
  const bw = (w - pad * 2 - gap * (steps - 1)) / steps;
  for (let i = 0; i < steps; i++) {
    const x = pad + i * (bw + gap);
    ctx.fillStyle =
      i === active % steps ? '#e8b86d' : 'rgba(94, 234, 212, 0.2)';
    ctx.fillRect(x, 10, bw, h - 20);
  }
}

function drawBits(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bits: number[],
  head: number,
) {
  const n = Math.max(1, bits.length);
  const pad = 3;
  const gap = 1;
  const bw = (w - pad * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = pad + i * (bw + gap);
    const on = bits[i] === 1;
    ctx.fillStyle = on ? '#a78bfa' : 'rgba(167, 139, 250, 0.15)';
    ctx.fillRect(x, 8, bw, h - 16);
    if (i === head % n) {
      ctx.strokeStyle = '#e8b86d';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, 8.5, bw - 1, h - 17);
    }
  }
}

function drawEuclid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pattern: boolean[],
  active: number,
) {
  const n = Math.max(1, pattern.length);
  const pad = 3;
  const gap = 1;
  const bw = (w - pad * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = pad + i * (bw + gap);
    const hit = pattern[i];
    const isActive = i === active % n;
    if (hit) {
      ctx.fillStyle = isActive ? '#e8b86d' : '#5eead4';
    } else {
      ctx.fillStyle = isActive
        ? 'rgba(232, 184, 109, 0.35)'
        : 'rgba(94, 234, 212, 0.12)';
    }
    ctx.fillRect(x, hit ? 6 : 14, bw, hit ? h - 12 : h - 28);
  }
}

function drawAdsr(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: Record<string, number | string>,
  level: number,
  stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release',
  progress: number,
) {
  const a = Math.max(0.001, Number(params.attack ?? 0.01));
  const d = Math.max(0.001, Number(params.decay ?? 0.2));
  const s = Math.min(1, Math.max(0, Number(params.sustain ?? 0.65)));
  const r = Math.max(0.001, Number(params.release ?? 0.35));
  const sustainHold = 0.35;
  const total = a + d + sustainHold + r;
  const pad = 3;
  const y0 = h - pad;
  const y1 = pad;
  const xAt = (t: number) => pad + (t / total) * (w - pad * 2);
  const yAt = (v: number) => y0 - v * (y0 - y1);
  const p = Math.min(1, Math.max(0, progress));

  // Dim ADSR shape
  ctx.strokeStyle = 'rgba(232, 184, 109, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(0));
  ctx.lineTo(xAt(a), yAt(1));
  ctx.lineTo(xAt(a + d), yAt(s));
  ctx.lineTo(xAt(a + d + sustainHold), yAt(s));
  ctx.lineTo(xAt(total), yAt(0));
  ctx.stroke();

  const active = stage !== 'idle';
  const lv = Math.min(1, Math.max(0, level));

  if (active || lv > 0.01) {
    const fillH = lv * (y0 - y1);
    ctx.fillStyle = active
      ? 'rgba(232, 184, 109, 0.22)'
      : 'rgba(232, 184, 109, 0.1)';
    ctx.fillRect(pad, y0 - fillH, w - pad * 2, fillH);
  }

  if (!active) return;

  let x0 = 0;
  let y0s = 0;
  let x1 = 0;
  let y1s = 0;
  let playT = 0;
  let playV = lv;

  if (stage === 'attack') {
    x0 = 0;
    y0s = 0;
    x1 = a;
    y1s = 1;
    playT = a * p;
    playV = p;
  } else if (stage === 'decay') {
    x0 = a;
    y0s = 1;
    x1 = a + d;
    y1s = s;
    playT = a + d * p;
    playV = 1 + (s - 1) * p;
  } else if (stage === 'sustain') {
    x0 = a + d;
    y0s = s;
    x1 = a + d + sustainHold;
    y1s = s;
    playT = a + d + sustainHold * 0.5;
    playV = s;
  } else {
    x0 = a + d + sustainHold;
    y0s = s;
    x1 = total;
    y1s = 0;
    playT = a + d + sustainHold + r * p;
    playV = s * (1 - p);
  }

  ctx.strokeStyle = '#e8b86d';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(xAt(x0), yAt(y0s));
  ctx.lineTo(xAt(x1), yAt(y1s));
  ctx.stroke();

  ctx.fillStyle = '#e8b86d';
  ctx.beginPath();
  ctx.arc(xAt(playT), yAt(playV), 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(w - pad - 2, yAt(lv), 2, y0 - yAt(lv));
}
