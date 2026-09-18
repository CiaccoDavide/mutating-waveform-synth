import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { midiToFreq, NOTE_NAMES } from '../audio/HarmonyModel';
import { midiToRoot, type PlayMode, type RootPitch } from '../input/RootInput';

type PlayTab = 'piano' | 'hex';

interface MobilePlaySurfaceProps {
  playMode: PlayMode;
  playOctave: number;
  rootNote: number;
  rootOctave: number;
  onPlayOctaveChange: (octave: number) => void;
  onRootChange: (root: RootPitch) => void;
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
  onFreqNoteOn: (noteId: string, baseHz: number, velocity: number) => void;
  onFreqNoteOff: (noteId: string) => void;
}

interface HexCell {
  q: number;
  r: number;
  ratio: number;
  label: string;
  id: string;
}

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_OFFSETS = [1, 3, 6, 8, 10];

/** Approximate ratio as a short fraction string. */
function ratioLabel(ratio: number): string {
  const targets: [number, number, string][] = [
    [1, 1, '1/1'],
    [16, 15, '16/15'],
    [10, 9, '10/9'],
    [9, 8, '9/8'],
    [8, 7, '8/7'],
    [7, 6, '7/6'],
    [6, 5, '6/5'],
    [5, 4, '5/4'],
    [4, 3, '4/3'],
    [7, 5, '7/5'],
    [3, 2, '3/2'],
    [8, 5, '8/5'],
    [5, 3, '5/3'],
    [7, 4, '7/4'],
    [9, 5, '9/5'],
    [15, 8, '15/8'],
    [2, 1, '2/1'],
  ];
  let best = '·';
  let bestErr = Infinity;
  for (const [n, d, label] of targets) {
    const err = Math.abs(ratio - n / d);
    if (err < bestErr) {
      bestErr = err;
      best = label;
    }
  }
  return bestErr < 0.02 ? best : ratio.toFixed(2);
}

function buildHexLattice(radius: number): HexCell[] {
  const cells: HexCell[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.abs(q + r) > radius) continue;
      // Flat-top JI lattice: +q → fifth (3/2), +r → major third (5/4)
      let ratio = Math.pow(3 / 2, q) * Math.pow(5 / 4, r);
      while (ratio >= 2) ratio /= 2;
      while (ratio < 1) ratio *= 2;
      cells.push({
        q,
        r,
        ratio,
        label: ratioLabel(ratio),
        id: `hex:${q},${r}`,
      });
    }
  }
  return cells;
}

function hexPixel(q: number, r: number, size: number) {
  const x = size * ((3 / 2) * q);
  const y = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
  return { x, y };
}

function midiLabel(midi: number): string {
  const note = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[note]}${oct}`;
}

export function MobilePlaySurface({
  playMode,
  playOctave,
  rootNote,
  rootOctave,
  onPlayOctaveChange,
  onRootChange,
  onNoteOn,
  onNoteOff,
  onFreqNoteOn,
  onFreqNoteOff,
}: MobilePlaySurfaceProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PlayTab>('piano');
  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => new Set());
  const pointersRef = useRef(new Map<number, string>());

  const rootHz = useMemo(
    () => midiToFreq((rootOctave + 1) * 12 + rootNote),
    [rootNote, rootOctave],
  );

  const hexCells = useMemo(() => buildHexLattice(2), []);
  const hexLayout = useMemo(() => {
    const size = 28;
    const points = hexCells.map((c) => {
      const { x, y } = hexPixel(c.q, c.r, size);
      return { ...c, x, y };
    });
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const pad = size * 1.15;
    return {
      size,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
      ox: -minX + pad,
      oy: -minY + pad,
      cells: points,
    };
  }, [hexCells]);

  const pianoBase = (playOctave + 1) * 12;
  const whiteKeys = useMemo(() => {
    const keys: { midi: number; label: string }[] = [];
    for (let oct = 0; oct < 2; oct += 1) {
      for (const off of WHITE_OFFSETS) {
        const midi = pianoBase + oct * 12 + off;
        keys.push({ midi, label: midiLabel(midi) });
      }
    }
    return keys;
  }, [pianoBase]);

  const blackKeys = useMemo(() => {
    const keys: { midi: number; leftPct: number }[] = [];
    const whiteWidth = 100 / whiteKeys.length;
    for (let oct = 0; oct < 2; oct += 1) {
      for (const off of BLACK_OFFSETS) {
        const midi = pianoBase + oct * 12 + off;
        // Position between surrounding whites
        const whiteIndexBefore = WHITE_OFFSETS.findIndex((w) => w > off) - 1;
        const idxInOct =
          whiteIndexBefore >= 0
            ? whiteIndexBefore
            : WHITE_OFFSETS.length - 1;
        const globalWhite = oct * WHITE_OFFSETS.length + idxInOct;
        keys.push({
          midi,
          leftPct: (globalWhite + 0.68) * whiteWidth,
        });
      }
    }
    return keys;
  }, [pianoBase, whiteKeys.length]);

  const setActive = useCallback((id: string, on: boolean) => {
    setActiveKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const pressPiano = useCallback(
    (midi: number) => {
      const id = `midi:${midi}`;
      if (playMode === 'adsr') {
        onNoteOn(midi, 0.9);
      } else {
        onRootChange(midiToRoot(midi));
      }
      setActive(id, true);
    },
    [playMode, onNoteOn, onRootChange, setActive],
  );

  const releasePiano = useCallback(
    (midi: number) => {
      const id = `midi:${midi}`;
      if (playMode === 'adsr') onNoteOff(midi);
      setActive(id, false);
    },
    [playMode, onNoteOff, setActive],
  );

  const pressHex = useCallback(
    (cell: HexCell) => {
      const hz = rootHz * cell.ratio;
      if (playMode === 'adsr') {
        onFreqNoteOn(cell.id, hz, 0.9);
      } else {
        const midi = Math.round(69 + 12 * Math.log2(hz / 440));
        onRootChange(midiToRoot(midi));
      }
      setActive(cell.id, true);
    },
    [rootHz, playMode, onFreqNoteOn, onRootChange, setActive],
  );

  const releaseHex = useCallback(
    (cell: HexCell) => {
      onFreqNoteOff(cell.id);
      setActive(cell.id, false);
    },
    [onFreqNoteOff, setActive],
  );

  const bindPointer = useCallback(
    (
      pointerId: number,
      noteId: string,
      onPress: () => void,
      onRelease: () => void,
      target: Element,
    ) => {
      if (pointersRef.current.has(pointerId)) return;
      pointersRef.current.set(pointerId, noteId);
      onPress();
      const up: EventListener = (ev) => {
        const pe = ev as PointerEvent;
        if (pe.pointerId !== pointerId) return;
        if ('releasePointerCapture' in target) {
          try {
            (target as Element & { releasePointerCapture(id: number): void }).releasePointerCapture(
              pointerId,
            );
          } catch {
            /* ignore */
          }
        }
        pointersRef.current.delete(pointerId);
        onRelease();
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        target.removeEventListener('lostpointercapture', up);
      };
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
      target.addEventListener('lostpointercapture', up);
      if ('setPointerCapture' in target) {
        try {
          (target as Element & { setPointerCapture(id: number): void }).setPointerCapture(
            pointerId,
          );
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  // Release all on close / mode change
  useEffect(() => {
    if (!open) {
      for (const id of pointersRef.current.values()) {
        if (id.startsWith('hex:')) onFreqNoteOff(id);
        else if (id.startsWith('midi:')) {
          const midi = Number(id.slice(5));
          if (!Number.isNaN(midi)) onNoteOff(midi);
        }
      }
      pointersRef.current.clear();
      setActiveKeys(new Set());
    }
  }, [open, onFreqNoteOff, onNoteOff]);

  useEffect(() => {
    if (playMode !== 'adsr') {
      for (const id of [...activeKeys]) {
        if (id.startsWith('hex:')) onFreqNoteOff(id);
        else if (id.startsWith('midi:')) {
          const midi = Number(id.slice(5));
          if (!Number.isNaN(midi)) onNoteOff(midi);
        }
      }
      setActiveKeys(new Set());
      pointersRef.current.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mode flip
  }, [playMode]);

  return (
    <div className="mobile-play">
      <button
        type="button"
        className="mobile-play-fab"
        aria-expanded={open}
        aria-controls="mobile-play-sheet"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Close' : 'Play'}
      </button>

      {open && (
        <div
          className="mobile-play-backdrop"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <div
        id="mobile-play-sheet"
        className={`mobile-play-sheet${open ? ' is-open' : ''}`}
        role="dialog"
        aria-label="Touch play surface"
        aria-hidden={!open}
      >
        <div className="mobile-play-handle" />
        <div className="mobile-play-toolbar">
          <div className="mode-toggle mobile-play-tabs">
            <button
              type="button"
              className={`btn btn-ghost${tab === 'piano' ? ' active' : ''}`}
              onClick={() => setTab('piano')}
            >
              Piano
            </button>
            <button
              type="button"
              className={`btn btn-ghost${tab === 'hex' ? ' active' : ''}`}
              onClick={() => setTab('hex')}
            >
              Hex
            </button>
          </div>
          <div className="mobile-play-octave">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onPlayOctaveChange(Math.max(1, playOctave - 1))}
              aria-label="Octave down"
            >
              −
            </button>
            <span className="panel-hint">oct {playOctave}</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onPlayOctaveChange(Math.min(4, playOctave + 1))}
              aria-label="Octave up"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>

        <p className="panel-hint mobile-play-hint">
          {playMode === 'adsr'
            ? 'Hold keys for chords · multi-touch'
            : 'Tap to set root · Hex uses just ratios from current root'}
        </p>

        {tab === 'piano' ? (
          <div className="touch-piano" style={{ touchAction: 'none' }}>
            <div className="touch-piano-whites">
              {whiteKeys.map((k) => (
                <button
                  key={k.midi}
                  type="button"
                  className={`touch-piano-white${activeKeys.has(`midi:${k.midi}`) ? ' is-active' : ''}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    bindPointer(
                      e.pointerId,
                      `midi:${k.midi}`,
                      () => pressPiano(k.midi),
                      () => releasePiano(k.midi),
                      e.currentTarget,
                    );
                  }}
                >
                  <span>{k.label}</span>
                </button>
              ))}
            </div>
            <div className="touch-piano-blacks">
              {blackKeys.map((k) => (
                <button
                  key={k.midi}
                  type="button"
                  className={`touch-piano-black${activeKeys.has(`midi:${k.midi}`) ? ' is-active' : ''}`}
                  style={{ left: `${k.leftPct}%` }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    bindPointer(
                      e.pointerId,
                      `midi:${k.midi}`,
                      () => pressPiano(k.midi),
                      () => releasePiano(k.midi),
                      e.currentTarget,
                    );
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="touch-hex-wrap" style={{ touchAction: 'none' }}>
            <svg
              className="touch-hex-svg"
              viewBox={`0 0 ${hexLayout.width} ${hexLayout.height}`}
              role="img"
              aria-label="Just-intonation hexagonal keyboard"
            >
              {hexLayout.cells.map((c) => {
                const cx = c.x + hexLayout.ox;
                const cy = c.y + hexLayout.oy;
                const s = hexLayout.size * 0.92;
                const pts = Array.from({ length: 6 }, (_, i) => {
                  const a = (Math.PI / 180) * (60 * i);
                  return `${cx + s * Math.cos(a)},${cy + s * Math.sin(a)}`;
                }).join(' ');
                const active = activeKeys.has(c.id);
                return (
                  <g
                    key={c.id}
                    className={`touch-hex-cell${active ? ' is-active' : ''}${c.q === 0 && c.r === 0 ? ' is-root' : ''}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      bindPointer(
                        e.pointerId,
                        c.id,
                        () => pressHex(c),
                        () => releaseHex(c),
                        e.currentTarget,
                      );
                    }}
                  >
                    <polygon points={pts} />
                    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle">
                      {c.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
