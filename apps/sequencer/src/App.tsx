import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Transport } from './clock/Transport';
import { MidiOut } from './midi/MidiOut';
import { NOTE_NAMES, SCALES, type ScaleId } from './scale/scales';
import { ENGINE_META, type EngineId, type SharedParams } from './engines/types';
import {
  createLinearEngine,
  defaultLinear,
  normalizeLinear,
  type LinearState,
} from './engines/linear';
import {
  createRadarEngine,
  defaultRadar,
  normalizeRadar,
  type RadarState,
} from './engines/radar';
import {
  createArpEngine,
  defaultArp,
  type ArpState,
} from './engines/arp';
import {
  createBrownianEngine,
  defaultBrownian,
  type BrownianState,
} from './engines/brownian';
import {
  createBounceEngine,
  defaultBounce,
  type BounceState,
} from './engines/bounce';
import { createRainEngine, defaultRain, type RainState } from './engines/rain';
import {
  createStringsEngine,
  defaultStrings,
  type StringsState,
} from './engines/strings';
import { createTreeEngine, defaultTree, type TreeState } from './engines/tree';
import {
  createPulsesEngine,
  defaultPulses,
  type PulsesState,
} from './engines/pulses';
import {
  createRatchetEngine,
  defaultRatchet,
  type RatchetState,
} from './engines/ratchet';
import {
  createCyclesEngine,
  defaultCycles,
  type CyclesState,
} from './engines/cycles';
import {
  createPhraseEngine,
  defaultPhrase,
  type PhraseState,
} from './engines/phrase';
import {
  createOrbitEngine,
  defaultOrbit,
  type OrbitState,
} from './engines/orbit';
import {
  createCellularEngine,
  defaultCellular,
  type CellularState,
} from './engines/cellular';
import {
  createMarkovEngine,
  defaultMarkov,
  type MarkovState,
} from './engines/markov';
import {
  createPolyrhythmEngine,
  defaultPolyrhythm,
  type PolyrhythmState,
} from './engines/polyrhythm';
import {
  createSwarmEngine,
  defaultSwarm,
  type SwarmState,
} from './engines/swarm';
import {
  createPendulumEngine,
  defaultPendulum,
  type PendulumState,
} from './engines/pendulum';
import {
  createLissajousEngine,
  defaultLissajous,
  type LissajousState,
} from './engines/lissajous';
import {
  createRippleEngine,
  defaultRipple,
  type RippleState,
} from './engines/ripple';
import type { ScheduledNote } from './engines/types';
import { defaultFx, type SceneFx } from './viz/types';
import {
  blankPreset,
  exportPresetJson,
  FACTORY_PRESETS,
  loadUserPresets,
  parsePresetJson,
  saveUserPresets,
  type SeqPreset,
} from './presets/storage';
import { SceneRenderer } from './viz/SceneRenderer';
import { EngineParams } from './ui/EngineParams';
import { normalizeBounce } from './engines/bounce';
import { normalizeRain } from './engines/rain';
import { normalizeTree } from './engines/tree';
import { normalizePulses } from './engines/pulses';
import { normalizeRatchet } from './engines/ratchet';
import { normalizeCycles } from './engines/cycles';
import { normalizePhrase } from './engines/phrase';
import { normalizeArp } from './engines/arp';
import { normalizeBrownian } from './engines/brownian';
import { normalizeOrbit } from './engines/orbit';
import { normalizeCellular } from './engines/cellular';
import { normalizeMarkov } from './engines/markov';
import { normalizePolyrhythm } from './engines/polyrhythm';
import { normalizeSwarm } from './engines/swarm';
import { normalizePendulum } from './engines/pendulum';
import { normalizeLissajous } from './engines/lissajous';
import { normalizeRipple } from './engines/ripple';
import { normalizeStrings } from './engines/strings';

type MidiStatus = 'idle' | 'ready' | 'empty' | 'denied' | 'unsupported';

export default function App() {
  const midiRef = useRef(new MidiOut());
  const transportRef = useRef(new Transport());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);

  const [midiStatus, setMidiStatus] = useState<MidiStatus>('idle');
  const [outputs, setOutputs] = useState<{ id: string; name: string }[]>([]);
  const [outputId, setOutputId] = useState('');
  const [midiChannel, setMidiChannel] = useState(1);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(0);
  const [humanize, setHumanize] = useState(0);
  const [engineId, setEngineId] = useState<EngineId>('linear');
  const [shared, setShared] = useState<SharedParams>({
    rootNote: 0,
    octave: 3,
    scaleId: 'minor',
    gate: 0.8,
    velocity: 100,
  });
  const [linear, setLinear] = useState<LinearState>(() => defaultLinear());
  const [radar, setRadar] = useState<RadarState>(() => defaultRadar());
  const [bounce, setBounce] = useState<BounceState>(() => defaultBounce());
  const [rain, setRain] = useState<RainState>(() => defaultRain());
  const [strings, setStrings] = useState<StringsState>(() => defaultStrings());
  const [tree, setTree] = useState<TreeState>(() => defaultTree());
  const [pulses, setPulses] = useState<PulsesState>(() => defaultPulses());
  const [ratchet, setRatchet] = useState<RatchetState>(() => defaultRatchet());
  const [cycles, setCycles] = useState<CyclesState>(() => defaultCycles());
  const [phrase, setPhrase] = useState<PhraseState>(() => defaultPhrase());
  const [arp, setArp] = useState<ArpState>(() => defaultArp());
  const [brownian, setBrownian] = useState<BrownianState>(() =>
    defaultBrownian(),
  );
  const [orbit, setOrbit] = useState<OrbitState>(() => defaultOrbit());
  const [cellular, setCellular] = useState<CellularState>(() =>
    defaultCellular(),
  );
  const [markov, setMarkov] = useState<MarkovState>(() => defaultMarkov());
  const [polyrhythm, setPolyrhythm] = useState<PolyrhythmState>(() =>
    defaultPolyrhythm(),
  );
  const [swarm, setSwarm] = useState<SwarmState>(() => defaultSwarm());
  const [pendulum, setPendulum] = useState<PendulumState>(() =>
    defaultPendulum(),
  );
  const [lissajous, setLissajous] = useState<LissajousState>(() =>
    defaultLissajous(),
  );
  const [ripple, setRipple] = useState<RippleState>(() => defaultRipple());
  const [vizFx, setVizFx] = useState<SceneFx>(() => defaultFx());
  const [userPresets, setUserPresets] = useState<SeqPreset[]>(() =>
    loadUserPresets(),
  );

  const linearRef = useRef(linear);
  linearRef.current = linear;
  const radarRef = useRef(radar);
  radarRef.current = radar;
  const bounceRef = useRef(bounce);
  bounceRef.current = bounce;
  const rainRef = useRef(rain);
  rainRef.current = rain;
  const stringsRef = useRef(strings);
  stringsRef.current = strings;
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const pulsesRef = useRef(pulses);
  pulsesRef.current = pulses;
  const ratchetRef = useRef(ratchet);
  ratchetRef.current = ratchet;
  const cyclesRef = useRef(cycles);
  cyclesRef.current = cycles;
  const phraseRef = useRef(phrase);
  phraseRef.current = phrase;
  const arpRef = useRef(arp);
  arpRef.current = arp;
  const brownianRef = useRef(brownian);
  brownianRef.current = brownian;
  const orbitRef = useRef(orbit);
  orbitRef.current = orbit;
  const cellularRef = useRef(cellular);
  cellularRef.current = cellular;
  const markovRef = useRef(markov);
  markovRef.current = markov;
  const polyrhythmRef = useRef(polyrhythm);
  polyrhythmRef.current = polyrhythm;
  const swarmRef = useRef(swarm);
  swarmRef.current = swarm;
  const pendulumRef = useRef(pendulum);
  pendulumRef.current = pendulum;
  const lissajousRef = useRef(lissajous);
  lissajousRef.current = lissajous;
  const rippleRef = useRef(ripple);
  rippleRef.current = ripple;
  const vizFxRef = useRef(vizFx);
  vizFxRef.current = vizFx;
  const sharedRef = useRef(shared);
  sharedRef.current = shared;
  const engineIdRef = useRef(engineId);
  engineIdRef.current = engineId;

  const engines = useMemo(
    () => ({
      linear: createLinearEngine(() => linearRef.current),
      radar: createRadarEngine(() => radarRef.current),
      bounce: createBounceEngine(() => bounceRef.current),
      rain: createRainEngine(() => rainRef.current),
      strings: createStringsEngine(() => stringsRef.current),
      tree: createTreeEngine(() => treeRef.current),
      pulses: createPulsesEngine(() => pulsesRef.current),
      ratchet: createRatchetEngine(() => ratchetRef.current),
      cycles: createCyclesEngine(() => cyclesRef.current),
      phrase: createPhraseEngine(() => phraseRef.current),
      arp: createArpEngine(() => arpRef.current),
      brownian: createBrownianEngine(() => brownianRef.current),
      orbit: createOrbitEngine(() => orbitRef.current),
      cellular: createCellularEngine(() => cellularRef.current),
      markov: createMarkovEngine(() => markovRef.current),
      polyrhythm: createPolyrhythmEngine(() => polyrhythmRef.current),
      swarm: createSwarmEngine(() => swarmRef.current),
      pendulum: createPendulumEngine(() => pendulumRef.current),
      lissajous: createLissajousEngine(() => lissajousRef.current),
      ripple: createRippleEngine(() => rippleRef.current),
    }),
    [],
  );

  const enableMidi = useCallback(async () => {
    const status = await midiRef.current.enable();
    setMidiStatus(status === 'empty' ? 'empty' : status);
    const list = midiRef.current.listOutputs();
    setOutputs(list);
    if (status === 'ready' || (status === 'empty' && list.length > 0)) {
      setMidiStatus(list.length ? 'ready' : 'empty');
      if (list[0] && !outputId) {
        setOutputId(list[0].id);
        midiRef.current.setOutputId(list[0].id);
      }
    }
    midiRef.current.setOnChange(() => {
      const next = midiRef.current.listOutputs();
      setOutputs(next);
      setMidiStatus(next.length ? 'ready' : 'empty');
      if (next[0] && !outputId) {
        setOutputId(next[0].id);
        midiRef.current.setOutputId(next[0].id);
      }
    });
  }, [outputId]);

  useEffect(() => {
    midiRef.current.channel = midiChannel;
  }, [midiChannel]);

  useEffect(() => {
    midiRef.current.setOutputId(outputId);
  }, [outputId]);

  useEffect(() => {
    const t = transportRef.current;
    t.bpm = bpm;
    t.swing = swing;
    t.humanize = humanize;
  }, [bpm, swing, humanize]);

  const pendingOffRef = useRef<{ note: number; at: number }[]>([]);

  const fireNotes = useCallback((notes: ScheduledNote[]) => {
    if (notes.length === 0) return;
    const midi = midiRef.current;
    const t = transportRef.current;
    const msPerBeat = 60000 / t.bpm;
    const h = Math.max(0, Math.min(1, t.humanize));
    for (const n of notes) {
      const humDelay = h > 0 ? (Math.random() * 2 - 1) * h * 18 : 0;
      const delay = Math.max(0, (n.delayMs ?? 0) + humDelay);
      const velJitter =
        h > 0 ? 1 + (Math.random() * 2 - 1) * h * 0.18 : 1;
      const velocity = Math.max(
        1,
        Math.min(127, Math.round(n.velocity * velJitter)),
      );
      const fire = () => {
        midi.noteOn(n.note, velocity);
        pendingOffRef.current.push({
          note: n.note,
          at: performance.now() + n.durationBeats * msPerBeat,
        });
      };
      if (delay < 1) fire();
      else window.setTimeout(fire, delay);
    }
  }, []);

  useEffect(() => {
    const t = transportRef.current;

    t.setTick((beat, timeMs) => {
      const eng = engines[engineIdRef.current];
      // Grid engines only; continuous engines fire from RAF step()
      const notes = eng.onTick(beat, sharedRef.current);
      if (notes.length === 0) return;
      const delay = Math.max(0, timeMs - performance.now());
      if (delay < 1) {
        fireNotes(notes);
      } else {
        window.setTimeout(() => fireNotes(notes), delay);
      }
    });

    const offTimer = window.setInterval(() => {
      const now = performance.now();
      const pendingOff = pendingOffRef.current;
      for (let i = pendingOff.length - 1; i >= 0; i -= 1) {
        const p = pendingOff[i]!;
        if (p.at <= now) {
          midiRef.current.noteOff(p.note);
          pendingOff.splice(i, 1);
        }
      }
    }, 16);

    return () => {
      t.setTick(null);
      clearInterval(offTimer);
    };
  }, [engines, fireNotes]);

  // WebGL viz + physics step
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: SceneRenderer;
    try {
      renderer = new SceneRenderer(canvas);
    } catch (err) {
      console.error('Sequencer WebGL init failed', err);
      return;
    }
    rendererRef.current = renderer;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width > 1 ? rect.width : canvas.clientWidth || 640;
      const cssH = rect.height > 1 ? rect.height : canvas.clientHeight || 300;
      renderer.resize(cssW, cssH);
      const eng = engines[engineIdRef.current];
      if (playingRef.current) {
        const notes = eng.step(
          dt,
          sharedRef.current,
          transportRef.current.currentBeat,
        );
        fireNotes(notes);
      }
      {
        const scene = eng.getScene();
        const g = vizFxRef.current;
        scene.fx = {
          trail: Math.max(g.trail, scene.fx?.trail ?? 0),
          bloom: g.bloom,
          vignette: g.vignette,
          flash: scene.fx?.flash ?? 0,
          time: scene.fx?.time ?? 0,
        };
        if (!scene.particles) scene.particles = [];
        renderer.draw(scene);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [engines, fireNotes]);

  // Redraw once when engine/mode params change while stopped
  useEffect(() => {
    if (playing) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    renderer.resize(rect.width || 640, rect.height || 300);
    {
      const scene = engines[engineId].getScene();
      const g = vizFx;
      scene.fx = {
        trail: Math.max(g.trail, scene.fx?.trail ?? 0),
        bloom: g.bloom,
        vignette: g.vignette,
        flash: scene.fx?.flash ?? 0,
        time: scene.fx?.time ?? 0,
      };
      if (!scene.particles) scene.particles = [];
      renderer.draw(scene);
    }
  }, [
    playing,
    engineId,
    engines,
    linear,
    radar,
    bounce,
    rain,
    strings,
    tree,
    pulses,
    ratchet,
    cycles,
    phrase,
    arp,
    brownian,
    orbit,
    cellular,
    markov,
    polyrhythm,
    swarm,
    pendulum,
    lissajous,
    ripple,
    vizFx,
  ]);

  const stop = useCallback(() => {
    transportRef.current.stop();
    engines[engineId].reset();
    midiRef.current.panic();
    setPlaying(false);
  }, [engines, engineId]);

  const play = useCallback(() => {
    engines[engineId].reset();
    transportRef.current.play();
    setPlaying(true);
  }, [engines, engineId]);

  const applyPreset = useCallback(
    (p: SeqPreset) => {
      stop();
      setEngineId(
        (p.engineId as string) === 'chain'
          ? 'strings'
          : (p.engineId as string) === 'rotating'
            ? 'radar'
            : p.engineId,
      );
      setBpm(p.bpm);
      setSwing(p.swing ?? 0);
      setHumanize(p.humanize ?? 0);
      setMidiChannel(p.midiChannel);
      setShared(p.shared);
      setLinear(normalizeLinear(p.linear));
      setRadar(
        normalizeRadar(
          p.radar ?? (p as { rotating?: unknown }).rotating,
        ),
      );
      setBounce(normalizeBounce(p.bounce));
      setRain(normalizeRain(p.rain));
      setStrings(normalizeStrings(p.strings));
      setTree(normalizeTree(p.tree));
      setPulses(normalizePulses(p.pulses));
      setRatchet(normalizeRatchet(p.ratchet));
      setCycles(normalizeCycles(p.cycles));
      setPhrase(normalizePhrase(p.phrase));
      setArp(normalizeArp(p.arp));
      setBrownian(normalizeBrownian(p.brownian));
      setOrbit(normalizeOrbit(p.orbit));
      setCellular(normalizeCellular(p.cellular));
      setMarkov(normalizeMarkov(p.markov));
      setPolyrhythm(normalizePolyrhythm(p.polyrhythm));
      setSwarm(normalizeSwarm(p.swarm));
      setPendulum(normalizePendulum(p.pendulum));
      setLissajous(normalizeLissajous(p.lissajous));
      setRipple(normalizeRipple(p.ripple));
      setVizFx({ ...defaultFx(), ...(p.vizFx ?? {}) });
    },
    [stop],
  );

  const currentPreset = useCallback(
    (): SeqPreset =>
      blankPreset({
        name: 'Current',
        engineId,
        bpm,
        swing,
        humanize,
        midiChannel,
        shared,
        linear,
        radar,
        bounce,
        rain,
        strings,
        tree,
        pulses,
        ratchet,
        cycles,
        phrase,
        arp,
        brownian,
        orbit,
        cellular,
        markov,
        polyrhythm,
        swarm,
        pendulum,
        lissajous,
        ripple,
        vizFx,
      }),
    [
      engineId,
      bpm,
      swing,
      humanize,
      midiChannel,
      shared,
      linear,
      radar,
      bounce,
      rain,
      strings,
      tree,
      pulses,
      ratchet,
      cycles,
      phrase,
      arp,
      brownian,
      orbit,
      cellular,
      markov,
      polyrhythm,
      swarm,
      pendulum,
      lissajous,
      ripple,
      vizFx,
    ],
  );

  const saveCurrent = useCallback(() => {
    const name = window.prompt('Preset name', 'My pattern');
    if (!name) return;
    const p = { ...currentPreset(), name };
    const next = [p, ...userPresets];
    setUserPresets(next);
    saveUserPresets(next);
  }, [currentPreset, userPresets]);

  const exportCurrent = useCallback(() => {
    const blob = new Blob([exportPresetJson(currentPreset())], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seq-preset-${engineId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentPreset, engineId]);

  const importPreset = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const p = parsePresetJson(text);
      if (!p) {
        window.alert('Invalid preset JSON');
        return;
      }
      applyPreset(p);
      const next = [p, ...userPresets];
      setUserPresets(next);
      saveUserPresets(next);
    };
    input.click();
  }, [applyPreset, userPresets]);

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Mutating Pattern Sequencer</h1>
          <p className="meta">
            MIDI out → OS loopback (IAC / loopMIDI) → Mutating Waveform Synth ·
            match channel · synth in ADSR
          </p>
        </div>
      </header>

      <section className="panel row">
        <button
          type="button"
          className="btn primary"
          onClick={playing ? stop : play}
        >
          {playing ? 'Stop' : 'Play'}
        </button>
        <div className="field">
          <label htmlFor="bpm">BPM</label>
          <input
            id="bpm"
            type="number"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="swing">Swing</label>
          <input
            id="swing"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={swing}
            onChange={(e) => setSwing(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="humanize">Humanize</label>
          <input
            id="humanize"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={humanize}
            onChange={(e) => setHumanize(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="trail">Trail</label>
          <input
            id="trail"
            type="range"
            min={0}
            max={0.95}
            step={0.01}
            value={vizFx.trail}
            onChange={(e) =>
              setVizFx((s) => ({ ...s, trail: Number(e.target.value) }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="bloom">Bloom</label>
          <input
            id="bloom"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vizFx.bloom}
            onChange={(e) =>
              setVizFx((s) => ({ ...s, bloom: Number(e.target.value) }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="vignette">Vignette</label>
          <input
            id="vignette"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vizFx.vignette}
            onChange={(e) =>
              setVizFx((s) => ({ ...s, vignette: Number(e.target.value) }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="midi-ch">MIDI ch</label>
          <select
            id="midi-ch"
            value={midiChannel}
            onChange={(e) => setMidiChannel(Number(e.target.value))}
          >
            {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="midi-out">MIDI out</label>
          <select
            id="midi-out"
            value={outputId}
            onChange={(e) => setOutputId(e.target.value)}
            disabled={midiStatus !== 'ready'}
          >
            <option value="">Select…</option>
            {outputs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        {midiStatus !== 'ready' && (
          <button type="button" className="btn" onClick={enableMidi}>
            {midiStatus === 'denied' || midiStatus === 'empty'
              ? 'Retry MIDI'
              : 'Enable MIDI'}
          </button>
        )}
        <span className="meta">
          {midiStatus === 'ready'
            ? `MIDI ready · ${outputs.length} port${outputs.length === 1 ? '' : 's'}`
            : midiStatus === 'unsupported'
              ? 'No Web MIDI (use Chrome/Edge)'
              : midiStatus === 'denied' || midiStatus === 'empty'
                ? 'No MIDI ports — enable IAC, then reload'
                : 'MIDI off'}
        </span>
      </section>

      {(midiStatus === 'denied' || midiStatus === 'empty') && (
        <p className="hint">
          Chromium blocks MIDI when zero devices exist. On macOS: open{' '}
          <strong>Audio MIDI Setup</strong> → Window → Show MIDI Studio →
          double-click <strong>IAC Driver</strong> → enable{' '}
          <strong>Device is online</strong> → quit and reopen the browser →
          Retry MIDI. Then pick the IAC port here and on the synth (same
          channel, ADSR).
        </p>
      )}

      <section className="panel">
        <div className="modes">
          {ENGINE_META.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`btn${engineId === m.id ? ' active' : ''}`}
              onClick={() => {
                stop();
                setEngineId(m.id);
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      </section>

      <div className="layout">
        <section className="panel">
          <canvas ref={canvasRef} className="viz" width={640} height={300} />
          <div className="row" style={{ marginTop: '0.75rem' }}>
            <div className="field">
              <label htmlFor="root">Root</label>
              <select
                id="root"
                value={shared.rootNote}
                onChange={(e) =>
                  setShared((s) => ({
                    ...s,
                    rootNote: Number(e.target.value),
                  }))
                }
              >
                {NOTE_NAMES.map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="oct">Octave</label>
              <input
                id="oct"
                type="number"
                min={1}
                max={5}
                value={shared.octave}
                onChange={(e) =>
                  setShared((s) => ({ ...s, octave: Number(e.target.value) }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="scale">Scale</label>
              <select
                id="scale"
                value={shared.scaleId}
                onChange={(e) =>
                  setShared((s) => ({
                    ...s,
                    scaleId: e.target.value as ScaleId,
                  }))
                }
              >
                {SCALES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="gate">Gate</label>
              <input
                id="gate"
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={shared.gate}
                onChange={(e) =>
                  setShared((s) => ({ ...s, gate: Number(e.target.value) }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="vel">Velocity</label>
              <input
                id="vel"
                type="number"
                min={1}
                max={127}
                value={shared.velocity}
                onChange={(e) =>
                  setShared((s) => ({
                    ...s,
                    velocity: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <EngineParams
            engineId={engineId}
            linear={linear}
            setLinear={setLinear}
            radar={radar}
            setRadar={setRadar}
            bounce={bounce}
            setBounce={setBounce}
            rain={rain}
            setRain={setRain}
            strings={strings}
            setStrings={setStrings}
            tree={tree}
            setTree={setTree}
            pulses={pulses}
            setPulses={setPulses}
            ratchet={ratchet}
            setRatchet={setRatchet}
            cycles={cycles}
            setCycles={setCycles}
            phrase={phrase}
            setPhrase={setPhrase}
            arp={arp}
            setArp={setArp}
            brownian={brownian}
            setBrownian={setBrownian}
            orbit={orbit}
            setOrbit={setOrbit}
            cellular={cellular}
            setCellular={setCellular}
            markov={markov}
            setMarkov={setMarkov}
            polyrhythm={polyrhythm}
            setPolyrhythm={setPolyrhythm}
            swarm={swarm}
            setSwarm={setSwarm}
            pendulum={pendulum}
            setPendulum={setPendulum}
            lissajous={lissajous}
            setLissajous={setLissajous}
            ripple={ripple}
            setRipple={setRipple}
          />
        </section>

        <aside className="panel">
          <div className="row">
            <button type="button" className="btn" onClick={saveCurrent}>
              Save preset
            </button>
            <button type="button" className="btn" onClick={exportCurrent}>
              Export
            </button>
            <button type="button" className="btn" onClick={importPreset}>
              Import
            </button>
          </div>
          <p className="hint">Factory</p>
          <div className="preset-list">
            {FACTORY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn"
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {userPresets.length > 0 && (
            <>
              <p className="hint">Yours</p>
              <div className="preset-list">
                {userPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn"
                    onClick={() => applyPreset(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      <p className="hint">
        Setup: enable IAC Driver (macOS Audio MIDI Setup) or loopMIDI
        (Windows). Select that port as MIDI out here and as MIDI in on the
        synth. Use the same channel. Set the synth to ADSR.
      </p>
    </div>
  );
}
