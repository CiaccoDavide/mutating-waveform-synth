import { useEffect, useRef } from 'react';

interface FormulaPlotProps {
  samples: Float32Array;
  width?: number;
  height?: number;
}

export function FormulaPlot({ samples, width = 640, height = 220 }: FormulaPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

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

    if (samples.length < 2) return;

    // Glow path
    ctx.beginPath();
    for (let i = 0; i < samples.length; i += 1) {
      const x = (i / (samples.length - 1)) * width;
      const y = height / 2 - samples[i] * (height * 0.42);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Crisp path
    ctx.beginPath();
    for (let i = 0; i < samples.length; i += 1) {
      const x = (i / (samples.length - 1)) * width;
      const y = height / 2 - samples[i] * (height * 0.42);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [samples, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block', maxWidth: '100%' }}
      aria-label="Waveshape plot"
    />
  );
}
