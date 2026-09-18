import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import {
  createLfoSampler,
  type MutatorState,
} from '../audio/LfoModel';
import { VOICE_COUNT } from '../audio/HarmonyModel';
import type { MidiStatus } from '../input/RootInput';

interface MonitorStripProps {
  engine: AudioEngine;
  active: boolean;
  mutators: MutatorState;
  midiStatus: MidiStatus;
  midiActive: boolean;
  keyboardActive: boolean;
}

function midiLabel(status: MidiStatus): string {
  switch (status) {
    case 'ready':
      return 'on';
    case 'denied':
      return 'deny';
    case 'unsupported':
      return 'n/a';
    default:
      return 'off';
  }
}

const TEAL = { r: 94, g: 234, b: 212 };
const AMBER = { r: 232, g: 184, b: 109 };
const DEEP = '#0a1016';
const GRAPH_H = 36;

function rgba(c: { r: number; g: number; b: number }, a: number) {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

export function MonitorStrip({
  engine,
  active,
  mutators,
  midiStatus,
  midiActive,
  keyboardActive,
}: MonitorStripProps) {
  const scopeRef = useRef<HTMLCanvasElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const spectroRef = useRef<HTMLCanvasElement>(null);
  const lfoRef = useRef<HTMLCanvasElement>(null);
  const oscDotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rmsReadoutRef = useRef<HTMLSpanElement>(null);
  const mutatorsRef = useRef(mutators);
  mutatorsRef.current = mutators;
  const samplerRef = useRef(createLfoSampler(mutators));
  const lfoHistory = useRef<number[][]>([
    new Array(80).fill(0),
    new Array(80).fill(0),
    new Array(80).fill(0),
  ]);

  useEffect(() => {
    samplerRef.current = createLfoSampler(mutators);
  }, [mutators]);

  useEffect(() => {
    const scope = scopeRef.current;
    const spectrum = spectrumRef.current;
    const spectro = spectroRef.current;
    const lfo = lfoRef.current;
    if (!scope || !spectrum || !spectro || !lfo) return;

    const sCtx = scope.getContext('2d');
    const spCtx = spectrum.getContext('2d');
    const sgCtx = spectro.getContext('2d', { alpha: false });
    const lCtx = lfo.getContext('2d');
    if (!sCtx || !spCtx || !sgCtx || !lCtx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const h = GRAPH_H;

    const sizeHiDpi = (canvas: HTMLCanvasElement, cssW: number) => {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${h}px`;
      const c = canvas.getContext('2d');
      c?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    sizeHiDpi(scope, 112);
    sizeHiDpi(spectrum, 100);
    sizeHiDpi(lfo, 118);

    const sgW = 128;
    spectro.width = sgW;
    spectro.height = h;
    spectro.style.width = `${sgW}px`;
    spectro.style.height = `${h}px`;
    sgCtx.setTransform(1, 0, 0, 1, 0, 0);
    sgCtx.fillStyle = DEEP;
    sgCtx.fillRect(0, 0, sgW, h);

    let raf = 0;
    let running = true;
    const start = performance.now();

    const drawScope = (
      timeDomain: Uint8Array | null,
      rms: number,
      peak: number,
    ) => {
      const w = 112;
      sCtx.clearRect(0, 0, w, h);
      sCtx.fillStyle = DEEP;
      sCtx.fillRect(0, 0, w, h);

      sCtx.strokeStyle = rgba(TEAL, 0.15);
      sCtx.beginPath();
      sCtx.moveTo(0, h / 2);
      sCtx.lineTo(w, h / 2);
      sCtx.stroke();

      if (timeDomain && timeDomain.length > 0) {
        const step = Math.max(1, Math.floor(timeDomain.length / w));
        sCtx.beginPath();
        sCtx.strokeStyle = rgba(TEAL, 0.9);
        sCtx.lineWidth = 1.2;
        for (let x = 0; x < w; x += 1) {
          const sample = timeDomain[x * step] ?? 128;
          const y = (sample / 255) * h;
          if (x === 0) sCtx.moveTo(x, y);
          else sCtx.lineTo(x, y);
        }
        sCtx.stroke();
      }

      const peakY = h / 2 - peak * h * 0.45;
      sCtx.fillStyle = rgba(AMBER, 0.9);
      sCtx.fillRect(w - 2, peakY - 1, 2, 2);
      sCtx.fillRect(w - 2, h / 2 + peak * h * 0.45 - 1, 2, 2);

      if (rmsReadoutRef.current) {
        const db = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
        rmsReadoutRef.current.textContent = `${db.toFixed(0)} dB`;
      }
    };

    const drawSpectrum = (freq: Uint8Array | null) => {
      const w = 100;
      spCtx.clearRect(0, 0, w, h);
      spCtx.fillStyle = DEEP;
      spCtx.fillRect(0, 0, w, h);

      const bars = 24;
      const gap = 1;
      const barW = (w - gap * (bars - 1)) / bars;
      const bins = freq ? Math.min(96, freq.length) : 0;

      for (let i = 0; i < bars; i += 1) {
        let v = 0;
        if (freq && bins > 0) {
          const start = Math.floor((i / bars) * bins);
          const end = Math.floor(((i + 1) / bars) * bins);
          let sum = 0;
          for (let b = start; b < end; b += 1) sum += freq[b]!;
          v = sum / Math.max(1, end - start) / 255;
        }
        const bh = Math.max(1, v * (h - 2));
        const x = i * (barW + gap);
        const mix = i / bars;
        spCtx.fillStyle = `rgba(${Math.floor(TEAL.r + (AMBER.r - TEAL.r) * mix)},${Math.floor(TEAL.g + (AMBER.g - TEAL.g) * mix)},${Math.floor(TEAL.b + (AMBER.b - TEAL.b) * mix)},${0.35 + v * 0.65})`;
        spCtx.fillRect(x, h - bh, barW, bh);
      }
    };

    const drawSpectro = (freq: Uint8Array | null) => {
      sgCtx.drawImage(spectro, -1, 0);
      if (freq && freq.length > 0) {
        for (let y = 0; y < h; y += 1) {
          const bin = Math.floor((1 - y / h) * Math.min(120, freq.length - 1));
          const v = freq[bin]! / 255;
          const r = Math.floor(8 + v * 50 + v * v * 40);
          const g = Math.floor(14 + v * 210);
          const b = Math.floor(22 + v * 170);
          sgCtx.fillStyle = `rgb(${r},${g},${b})`;
          sgCtx.fillRect(sgW - 1, y, 1, 1);
        }
      } else {
        sgCtx.fillStyle = DEEP;
        sgCtx.fillRect(sgW - 1, 0, 1, h);
      }
    };

    const drawLfo = (levels: number[]) => {
      const w = 118;
      lCtx.clearRect(0, 0, w, h);
      lCtx.fillStyle = DEEP;
      lCtx.fillRect(0, 0, w, h);

      const laneH = h / 3;
      for (let i = 0; i < 3; i += 1) {
        const mid = laneH * i + laneH / 2;
        lCtx.strokeStyle = rgba(TEAL, 0.12);
        lCtx.beginPath();
        lCtx.moveTo(0, mid);
        lCtx.lineTo(w, mid);
        lCtx.stroke();
      }

      const colors = [
        rgba(TEAL, 0.95),
        rgba(AMBER, 0.9),
        'rgba(160, 200, 220, 0.9)',
      ];

      for (let i = 0; i < 3; i += 1) {
        const hist = lfoHistory.current[i]!;
        hist.shift();
        const depth = mutatorsRef.current.lfos[i]?.depth ?? 1;
        const enabled =
          mutatorsRef.current.enabled && mutatorsRef.current.lfos[i]?.enabled;
        const norm = enabled && depth > 0.001 ? (levels[i] ?? 0) / depth : 0;
        hist.push(norm);

        const mid = laneH * i + laneH / 2;
        const amp = laneH * 0.4;
        lCtx.beginPath();
        lCtx.strokeStyle = enabled ? colors[i]! : rgba(TEAL, 0.25);
        lCtx.lineWidth = 1.1;
        for (let x = 0; x < hist.length; x += 1) {
          const y = mid - hist[x]! * amp;
          const px = (x / (hist.length - 1)) * w;
          if (x === 0) lCtx.moveTo(px, y);
          else lCtx.lineTo(px, y);
        }
        lCtx.stroke();

        const tip = hist[hist.length - 1] ?? 0;
        lCtx.beginPath();
        lCtx.arc(w - 2, mid - tip * amp, 1.75, 0, Math.PI * 2);
        lCtx.fillStyle = enabled ? colors[i]! : rgba(TEAL, 0.2);
        lCtx.fill();
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      const snap = active ? engine.getSnapshot() : null;

      drawScope(snap?.timeDomain ?? null, snap?.rms ?? 0, snap?.peak ?? 0);
      drawSpectrum(snap?.frequencyData ?? null);
      drawSpectro(snap?.frequencyData ?? null);
      drawLfo(samplerRef.current((now - start) * 0.001));

      const voices = engine.getVoiceActivity();
      for (let i = 0; i < VOICE_COUNT; i += 1) {
        const dot = oscDotRefs.current[i];
        if (!dot) continue;
        dot.classList.toggle('is-on', Boolean(voices[i]));
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [engine, active]);

  return (
    <aside className="monitor-strip" aria-label="Signal meters">
      <div className="monitor-cell">
        <div className="monitor-cell-head">
          <span className="monitor-label">Scope</span>
          <span ref={rmsReadoutRef} className="monitor-readout">
            — dB
          </span>
        </div>
        <canvas ref={scopeRef} className="monitor-canvas" />
      </div>

      <div className="monitor-cell">
        <span className="monitor-label">Spectrum</span>
        <canvas ref={spectrumRef} className="monitor-canvas" />
      </div>

      <div className="monitor-cell">
        <span className="monitor-label">Spectro</span>
        <canvas ref={spectroRef} className="monitor-canvas" />
      </div>

      <div className="monitor-cell">
        <span className="monitor-label">LFOs</span>
        <canvas ref={lfoRef} className="monitor-canvas" />
      </div>

      <div className="monitor-cell monitor-status-cell">
        <span className="monitor-label">Osc / I/O</span>
        <div className="monitor-dots" aria-hidden>
          {Array.from({ length: VOICE_COUNT }, (_, i) => (
            <span
              key={i}
              ref={(el) => {
                oscDotRefs.current[i] = el;
              }}
              className="monitor-dot"
            />
          ))}
        </div>
        <div className="monitor-flags">
          <span
            className={`monitor-flag${midiActive ? ' is-lit' : ''}${midiStatus === 'ready' ? ' is-ready' : ''}`}
            title={`MIDI ${midiLabel(midiStatus)}`}
          >
            MIDI
          </span>
          <span
            className={`monitor-flag${keyboardActive ? ' is-lit' : ''}`}
            title="Virtual keyboard"
          >
            KEY
          </span>
        </div>
      </div>
    </aside>
  );
}
