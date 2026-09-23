import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  bakeWavetable,
  compileFormula,
  FORMULA_PRESETS,
  type SampleFn,
} from './audio/FormulaCompiler';
import { audioEngine } from './audio/AudioEngine';
import {
  createDefaultVoices,
  CUSTOM_INTERVALS,
  intervalsForPreset,
  intervalForVoice,
  midiToFreq,
  noteOctaveToMidi,
  resolveVoiceFrequency,
  type HarmonyPresetId,
  type VoiceState,
} from './audio/HarmonyModel';
import {
  computeArpGainMultipliers,
  DEFAULT_ARP,
  type ArpState,
} from './audio/Arpeggiator';
import { DEFAULT_ADSR, type AdsrParams } from './audio/Envelope';
import type { PlayMode } from './input/RootInput';
import { FormulaPlot } from './ui/FormulaPlot';
import { FormulaPanel } from './ui/FormulaPanel';
import { OscillatorPanel } from './ui/OscillatorPanel';
import {
  HarmonyControls,
  randomHarmonySection,
} from './ui/HarmonyControls';
import { FilterPanel } from './ui/FilterPanel';
import { randBool, randRange } from './ui/random';
import { Visualizer } from './viz/Visualizer';
import {
  createDefaultFilterBank,
  filterBankNeedsTick,
  type FilterState,
} from './audio/FilterModel';
import {
  createDefaultEffects,
  createDefaultFm,
  createDefaultLadder,
  effectsFromSlots,
  effectsToSlots,
  type EffectsState,
  type FmState,
  type LadderState,
} from './audio/EffectsModel';
import {
  applyMutators,
  mutatorsForTier,
  mutatorsNeedBake,
  type MutatorState,
} from './audio/LfoModel';
import { useRootInput } from './input/useRootInput';
import { MobilePlaySurface } from './ui/MobilePlaySurface';
import { PresetPanel } from './ui/PresetPanel';
import { EffectsPanel } from './ui/EffectsPanel';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { MonitorStrip } from './ui/MonitorStrip';
import {
  CONNECT_MODES,
  defaultSketchPoints,
  pointsFromSamples,
  sketchToExpression,
  type ConnectMode,
  type WavePoint,
} from './audio/WaveSketch';
import {
  createPresetId,
  deletePreset,
  exportLibraryToFile,
  exportPresetToFile,
  loadPresetLibrary,
  normalizeSnapshot,
  parseImportedJson,
  PRESET_SCHEMA_VERSION,
  readFileAsText,
  savePresetLibrary,
  upsertPreset,
  type InstrumentSnapshot,
  type PresetLibrary,
  type SavedPreset,
} from './state/InstrumentPreset';
import {
  FACTORY_PRESETS,
  findAnyPreset,
  isFactoryPresetId,
  seedFactoryCopies,
} from './state/FactoryPresets';
import './styles/theme.css';
import './App.css';

const APP_VERSION = __APP_VERSION__;
const CHANGELOG_URL =
  'https://github.com/CiaccoDavide/mutating-waveform-synth/blob/main/CHANGELOG.md';

const DEFAULT_PRESET = FORMULA_PRESETS.find((p) => p.id === 'sine')!;

function loadLibraryWithSeed(): PresetLibrary {
  const lib = loadPresetLibrary();
  const seeded = seedFactoryCopies(lib, FACTORY_PRESETS);
  if (seeded !== lib) savePresetLibrary(seeded);
  return seeded;
}

export default function App() {
  const [expression, setExpression] = useState(DEFAULT_PRESET.expression);
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [samples, setSamples] = useState(() => {
    const r = compileFormula(DEFAULT_PRESET.expression);
    return r.ok ? bakeWavetable(r.fn, 0) : new Float32Array(2048);
  });
  const sampleFnRef = useRef<SampleFn | null>(null);

  const [mutators, setMutators] = useState<MutatorState>(() =>
    mutatorsForTier(DEFAULT_PRESET.tier),
  );

  const [rootNote, setRootNote] = useState(0); // C
  const [rootOctave, setRootOctave] = useState(2);
  const [playOctave, setPlayOctave] = useState(2);
  const [harmonyId, setHarmonyId] = useState<HarmonyPresetId>('minor');
  const [masterVolume, setMasterVolume] = useState(0.55);
  const [arp, setArp] = useState<ArpState>(DEFAULT_ARP);
  const [playMode, setPlayMode] = useState<PlayMode>('drone');
  const [adsr, setAdsr] = useState<AdsrParams>(DEFAULT_ADSR);
  const [midiChannel, setMidiChannel] = useState(1);
  const [midiInputId, setMidiInputId] = useState('');
  const [filters, setFilters] = useState<FilterState[]>(() =>
    createDefaultFilterBank(),
  );
  const [ladder, setLadder] = useState<LadderState>(() => createDefaultLadder());
  const [effects, setEffects] = useState<EffectsState>(() =>
    createDefaultEffects(),
  );
  const [fm, setFm] = useState<FmState>(() => createDefaultFm());
  const [selectedFilter, setSelectedFilter] = useState(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const voicesRef = useRef<VoiceState[]>([]);
  const frequenciesRef = useRef<number[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const arpRef = useRef(arp);
  arpRef.current = arp;
  const playModeRef = useRef(playMode);
  playModeRef.current = playMode;
  const [audioOn, setAudioOn] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(0);
  const [busy, setBusy] = useState(false);

  const [presetLibrary, setPresetLibrary] = useState<PresetLibrary>(() =>
    loadLibraryWithSeed(),
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    null,
  );
  const [presetNameDraft, setPresetNameDraft] = useState('My Patch');
  const [presetStatus, setPresetStatus] = useState<string | null>(null);

  const [waveEditMode, setWaveEditMode] = useState(false);
  const [wavePoints, setWavePoints] = useState<WavePoint[]>(() =>
    defaultSketchPoints(),
  );
  const [waveConnectMode, setWaveConnectMode] =
    useState<ConnectMode>('smooth');
  const [waveApproximate, setWaveApproximate] = useState(false);
  const waveDraftRef = useRef<WavePoint[] | null>(null);

  const handleRootChange = useCallback(
    (root: { note: number; octave: number }) => {
      setRootNote(root.note);
      setRootOctave(root.octave);
    },
    [],
  );

  const ensureAudioStarted = useCallback(async () => {
    if (audioEngine.isStarted) {
      if (audioEngine.context?.state === 'suspended') {
        await audioEngine.context.resume();
      }
      if (!audioOn) setAudioOn(true);
      return;
    }
    await audioEngine.start();
    audioEngine.setPlayMode(playModeRef.current);
    audioEngine.setAdsr(adsr);
    const fn = sampleFnRef.current;
    if (fn) {
      const table = bakeWavetable(applyMutators(fn, mutators), 0);
      audioEngine.pushWavetable(table);
    }
    audioEngine.setMasterVolume(masterVolume);
    audioEngine.setFilters(filtersRef.current, 0);
    audioEngine.setLadder(ladder);
    audioEngine.setEffects(effects);
    audioEngine.setFm(fm);
    if (playModeRef.current === 'drone') {
      const mults = computeArpGainMultipliers(
        voicesRef.current,
        arpRef.current,
        0,
      );
      audioEngine.updateVoices(
        voicesRef.current,
        frequenciesRef.current,
        mults,
      );
    }
    setAudioOn(true);
  }, [audioOn, adsr, mutators, masterVolume, ladder, effects, fm]);

  const handleNoteOn = useCallback(
    async (midi: number, velocity: number) => {
      try {
        await ensureAudioStarted();
      } catch (err) {
        console.error(err);
        setCompileError(
          err instanceof Error ? err.message : 'Failed to start audio',
        );
        return;
      }

      const vs = voicesRef.current;
      const ints = intervalsRef.current;
      const chordIntervals: number[] = [];
      const templates: { gain: number; pan: number }[] = [];
      for (let i = 0; i < vs.length; i += 1) {
        const v = vs[i];
        if (!v?.enabled) continue;
        const interval =
          ints[i] ??
          ints[i % Math.max(1, ints.length)]! +
            12 * Math.floor(i / Math.max(1, ints.length));
        chordIntervals.push(interval);
        templates.push({ gain: v.gain, pan: v.pan });
      }
      if (chordIntervals.length === 0) {
        chordIntervals.push(0);
        templates.push({ gain: 0.35, pan: 0 });
      }
      audioEngine.adsrNoteOn(midi, velocity, chordIntervals, templates);
      if (arpRef.current.enabled) {
        const mults = computeArpGainMultipliers(
          voicesRef.current,
          arpRef.current,
          performance.now() * 0.001,
        );
        audioEngine.applyAdsrArp(voicesRef.current, mults);
      }
    },
    [ensureAudioStarted],
  );

  const handleNoteOff = useCallback((midi: number) => {
    audioEngine.adsrNoteOff(midi);
  }, []);

  const handleFreqNoteOn = useCallback(
    async (noteId: string, baseHz: number, velocity: number) => {
      try {
        await ensureAudioStarted();
      } catch (err) {
        console.error(err);
        setCompileError(
          err instanceof Error ? err.message : 'Failed to start audio',
        );
        return;
      }

      const vs = voicesRef.current;
      const ints = intervalsRef.current;
      const frequencies: number[] = [];
      const templates: { gain: number; pan: number }[] = [];
      for (let i = 0; i < vs.length; i += 1) {
        const v = vs[i];
        if (!v?.enabled) continue;
        const interval =
          ints[i] ??
          ints[i % Math.max(1, ints.length)]! +
            12 * Math.floor(i / Math.max(1, ints.length));
        frequencies.push(baseHz * Math.pow(2, interval / 12));
        templates.push({ gain: v.gain, pan: v.pan });
      }
      if (frequencies.length === 0) {
        frequencies.push(baseHz);
        templates.push({ gain: 0.35, pan: 0 });
      }
      audioEngine.adsrNoteOnFreq(noteId, frequencies, velocity, templates);
      if (arpRef.current.enabled) {
        const mults = computeArpGainMultipliers(
          voicesRef.current,
          arpRef.current,
          performance.now() * 0.001,
        );
        audioEngine.applyAdsrArp(voicesRef.current, mults);
      }
    },
    [ensureAudioStarted],
  );

  const handleFreqNoteOff = useCallback((noteId: string) => {
    audioEngine.adsrNoteOffId(noteId);
  }, []);

  const { midiStatus, enableMidi, midiActive, keyboardActive, midiInputs } =
    useRootInput({
    enabled: true,
    playMode,
    playOctave,
    midiChannel,
    midiInputId,
    onRootChange: handleRootChange,
    onPlayOctaveChange: setPlayOctave,
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff,
  });

  const rootHz = useMemo(
    () => midiToFreq(noteOctaveToMidi(rootNote, rootOctave)),
    [rootNote, rootOctave],
  );

  const intervals = useMemo(
    () => intervalsForPreset(harmonyId, CUSTOM_INTERVALS),
    [harmonyId],
  );
  intervalsRef.current = intervals;

  const [voices, setVoices] = useState<VoiceState[]>(() =>
    createDefaultVoices(
      midiToFreq(noteOctaveToMidi(0, 2)),
      intervalsForPreset('minor', []),
    ),
  );
  voicesRef.current = voices;

  // Re-sync voice enablement when harmony preset changes (keep free/detune/gain)
  useEffect(() => {
    setVoices((prev) =>
      prev.map((v, i) => {
        const interval = intervalForVoice(intervals, i);
        return {
          ...v,
          // Core pattern voices on; extras keep prior enable so you can stack osc+sub pairs
          enabled: i < intervals.length ? true : v.enabled,
          freeFreqHz: v.freeMode
            ? v.freeFreqHz
            : Math.round(rootHz * Math.pow(2, interval / 12) * 100) / 100,
        };
      }),
    );
  }, [harmonyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const frequencies = useMemo(
    () =>
      voices.map((v, i) => {
        const interval = intervalForVoice(intervals, i);
        return resolveVoiceFrequency(v, rootHz, interval);
      }),
    [voices, rootHz, intervals],
  );
  frequenciesRef.current = frequencies;

  const captureSnapshot = useCallback((): InstrumentSnapshot => {
    return {
      expression,
      formulaPresetId: presetId,
      mutators,
      rootNote,
      rootOctave,
      playOctave,
      harmonyId,
      masterVolume,
      arp,
      playMode,
      adsr,
      filters,
      voices,
      selectedVoice,
      selectedFilter,
      effects: effectsToSlots(effects),
      ladder,
      fm,
      midiChannel,
      midiInputId,
    };
  }, [
    expression,
    presetId,
    mutators,
    rootNote,
    rootOctave,
    playOctave,
    harmonyId,
    masterVolume,
    arp,
    playMode,
    adsr,
    filters,
    voices,
    selectedVoice,
    selectedFilter,
    effects,
    ladder,
    fm,
    midiChannel,
    midiInputId,
  ]);

  const applySnapshot = useCallback((snap: InstrumentSnapshot) => {
    const s = normalizeSnapshot(snap);
    setExpression(s.expression);
    setPresetId(s.formulaPresetId || 'custom');
    setMutators(s.mutators);
    setRootNote(s.rootNote);
    setRootOctave(s.rootOctave);
    setPlayOctave(s.playOctave ?? s.rootOctave);
    setHarmonyId(s.harmonyId);
    setMasterVolume(s.masterVolume);
    setArp(s.arp);
    setPlayMode(s.playMode ?? 'drone');
    setAdsr(s.adsr ?? DEFAULT_ADSR);
    setFilters(s.filters);
    setVoices(s.voices);
    setSelectedVoice(s.selectedVoice ?? 0);
    setSelectedFilter(s.selectedFilter ?? 0);
    const nextEffects = Array.isArray(s.effects)
      ? effectsFromSlots(s.effects)
      : createDefaultEffects();
    setEffects(nextEffects);
    setLadder(s.ladder ?? createDefaultLadder());
    setFm(s.fm ?? createDefaultFm());
    setMidiChannel(s.midiChannel ?? 1);
    setMidiInputId(s.midiInputId ?? '');
    sampleFnRef.current = null;
    const compiled = compileFormula(s.expression);
    if (compiled.ok) {
      sampleFnRef.current = compiled.fn;
      setCompileError(null);
      setSamples(bakeWavetable(applyMutators(compiled.fn, s.mutators), 0));
    } else {
      setCompileError(compiled.error);
    }
    audioEngine.setPlayMode(s.playMode ?? 'drone');
    audioEngine.setAdsr(s.adsr ?? DEFAULT_ADSR);
    audioEngine.setEffects(nextEffects);
    audioEngine.setLadder(s.ladder ?? createDefaultLadder());
    audioEngine.setFm(s.fm ?? createDefaultFm());
  }, []);

  const persistLibrary = useCallback((next: PresetLibrary) => {
    setPresetLibrary(next);
    savePresetLibrary(next);
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = presetNameDraft.trim() || 'Untitled';
    const now = new Date().toISOString();
    // Never overwrite factory patches — Save always creates/updates a user preset
    const existing =
      selectedPresetId && !isFactoryPresetId(selectedPresetId)
        ? presetLibrary.presets.find((p) => p.id === selectedPresetId)
        : undefined;
    const preset: SavedPreset = {
      id: existing?.id ?? createPresetId(),
      name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: PRESET_SCHEMA_VERSION,
      snapshot: captureSnapshot(),
    };
    const next = upsertPreset(presetLibrary, preset);
    persistLibrary(next);
    setSelectedPresetId(preset.id);
    setPresetStatus(
      existing
        ? `Saved “${name}”`
        : isFactoryPresetId(selectedPresetId)
          ? `Saved “${name}” as your copy`
          : `Saved “${name}”`,
    );
  }, [
    captureSnapshot,
    persistLibrary,
    presetLibrary,
    presetNameDraft,
    selectedPresetId,
  ]);

  const handleLoadPreset = useCallback(() => {
    if (!selectedPresetId) return;
    const preset = findAnyPreset(selectedPresetId, presetLibrary.presets);
    if (!preset) return;
    applySnapshot(preset.snapshot);
    setPresetNameDraft(preset.name);
    setPresetStatus(`Loaded “${preset.name}”`);
  }, [applySnapshot, presetLibrary.presets, selectedPresetId]);

  const handleDeletePreset = useCallback(() => {
    if (!selectedPresetId || isFactoryPresetId(selectedPresetId)) return;
    const preset = presetLibrary.presets.find((p) => p.id === selectedPresetId);
    const next = deletePreset(presetLibrary, selectedPresetId);
    persistLibrary(next);
    setSelectedPresetId(null);
    setPresetStatus(preset ? `Deleted “${preset.name}”` : 'Deleted');
  }, [persistLibrary, presetLibrary, selectedPresetId]);

  const handleExportSelected = useCallback(() => {
    if (!selectedPresetId) return;
    const preset = findAnyPreset(selectedPresetId, presetLibrary.presets);
    if (!preset) return;
    exportPresetToFile(preset);
    setPresetStatus(`Exported “${preset.name}”`);
  }, [presetLibrary.presets, selectedPresetId]);

  const handleExportAll = useCallback(() => {
    exportLibraryToFile(presetLibrary);
    setPresetStatus('Exported library');
  }, [presetLibrary]);

  const handleImportFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      let library = presetLibrary;
      let imported = 0;
      let lastError: string | undefined;
      for (const file of Array.from(files)) {
        try {
          const text = await readFileAsText(file);
          const { presets, error } = parseImportedJson(text);
          if (error || presets.length === 0) {
            lastError = error ?? 'Empty import';
            continue;
          }
          for (const p of presets) {
            const now = new Date().toISOString();
            library = upsertPreset(library, {
              ...p,
              id: createPresetId(),
              updatedAt: now,
              version: PRESET_SCHEMA_VERSION,
            });
            imported += 1;
          }
        } catch {
          lastError = `Failed to read ${file.name}`;
        }
      }
      if (imported > 0) {
        persistLibrary(library);
        setPresetStatus(
          `Imported ${imported} preset${imported === 1 ? '' : 's'}`,
        );
      } else {
        setPresetStatus(lastError ?? 'Import failed');
      }
    },
    [persistLibrary, presetLibrary],
  );

  const handleSelectPreset = useCallback(
    (id: string) => {
      setSelectedPresetId(id);
      const preset = findAnyPreset(id, presetLibrary.presets);
      if (preset) setPresetNameDraft(preset.name);
      setPresetStatus(null);
    },
    [presetLibrary.presets],
  );

  // Compile expression when it changes
  useEffect(() => {
    const result = compileFormula(expression);
    if (!result.ok) {
      setCompileError(result.error);
      return;
    }
    setCompileError(null);
    sampleFnRef.current = result.fn;
    const table = bakeWavetable(applyMutators(result.fn, mutators), 0);
    setSamples(table);
    if (audioOn) audioEngine.pushWavetable(table);
  }, [expression]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push voice params when they change (drone mode only; arp in RAF)
  useEffect(() => {
    if (!audioOn || playMode !== 'drone') return;
    const mults = computeArpGainMultipliers(
      voices,
      arp,
      performance.now() * 0.001,
    );
    audioEngine.updateVoices(voices, frequencies, mults);
  }, [voices, frequencies, audioOn, arp, playMode]);

  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    audioEngine.setAdsr(adsr);
  }, [adsr]);

  useEffect(() => {
    audioEngine.setFilters(filters, performance.now() * 0.001);
  }, [filters]);

  useEffect(() => {
    audioEngine.setLadder(ladder);
  }, [ladder]);

  useEffect(() => {
    audioEngine.setEffects(effects);
  }, [effects]);

  useEffect(() => {
    audioEngine.setFm(fm);
  }, [fm]);

  // Time mutator / formula-t / filter-LFO / arp clock loop
  useEffect(() => {
    let raf = 0;
    let lastBake = 0;
    let lastFilter = 0;
    let lastArp = 0;
    const tick = (now: number) => {
      const t = now * 0.001;

      const fn = sampleFnRef.current;
      if (fn) {
        const needsMutate =
          mutatorsNeedBake(mutators) || expression.includes('t');
        if (needsMutate && now - lastBake > 1000 / 45) {
          lastBake = now;
          const table = bakeWavetable(applyMutators(fn, mutators), t);
          setSamples(table);
          if (audioOn) audioEngine.pushWavetable(table);
        }
      }

      if (
        audioOn &&
        filterBankNeedsTick(filtersRef.current) &&
        now - lastFilter > 1000 / 30
      ) {
        lastFilter = now;
        audioEngine.tickFilters(t);
      }

      if (
        audioOn &&
        arpRef.current.enabled &&
        now - lastArp > 1000 / 60
      ) {
        lastArp = now;
        const mults = computeArpGainMultipliers(
          voicesRef.current,
          arpRef.current,
          t,
        );
        if (playModeRef.current === 'drone') {
          audioEngine.updateVoices(
            voicesRef.current,
            frequenciesRef.current,
            mults,
          );
        } else {
          audioEngine.applyAdsrArp(voicesRef.current, mults);
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mutators, expression, audioOn]);

  const handlePresetChange = useCallback((id: string) => {
    setPresetId(id);
    const preset = FORMULA_PRESETS.find((p) => p.id === id);
    if (preset) {
      setExpression(preset.expression);
      setMutators(mutatorsForTier(preset.tier));
    }
  }, []);

  const handleExpressionChange = useCallback((value: string) => {
    setExpression(value);
    setPresetId('custom');
  }, []);

  const enterWaveEdit = useCallback(() => {
    waveDraftRef.current = wavePoints;
    const seeded =
      samples.length > 0 ? pointsFromSamples(samples, 8) : defaultSketchPoints();
    setWavePoints(seeded);
    setWaveEditMode(true);
  }, [samples, wavePoints]);

  const cancelWaveEdit = useCallback(() => {
    if (waveDraftRef.current) setWavePoints(waveDraftRef.current);
    waveDraftRef.current = null;
    setWaveEditMode(false);
  }, []);

  const applyWaveEdit = useCallback(() => {
    const expr = sketchToExpression(wavePoints, waveConnectMode, {
      approximate: waveApproximate || waveConnectMode === 'smooth',
    });
    setExpression(expr);
    setPresetId('custom');
    waveDraftRef.current = null;
    setWaveEditMode(false);
  }, [wavePoints, waveConnectMode, waveApproximate]);

  const resetWavePoints = useCallback(() => {
    setWavePoints(
      samples.length > 0 ? pointsFromSamples(samples, 8) : defaultSketchPoints(),
    );
  }, [samples]);

  const handleVoiceChange = useCallback(
    (index: number, patch: Partial<VoiceState>) => {
      setVoices((prev) =>
        prev.map((v, i) => (i === index ? { ...v, ...patch } : v)),
      );
    },
    [],
  );

  const handleRandomizeHarmony = useCallback(() => {
    const next = randomHarmonySection();
    setRootNote(next.rootNote);
    setRootOctave(next.rootOctave);
    setPlayOctave(next.rootOctave);
    setHarmonyId(next.harmonyId);
    setMasterVolume(next.masterVolume);
    setArp(next.arp);
    setPlayMode(next.playMode);
    setAdsr(next.adsr);
    audioEngine.setPlayMode(next.playMode);
    audioEngine.setAdsr(next.adsr);
  }, []);

  const handlePlayModeChange = useCallback(
    async (mode: PlayMode) => {
      setPlayMode(mode);
      audioEngine.setPlayMode(mode);
      if (mode === 'adsr') {
        try {
          await ensureAudioStarted();
        } catch (err) {
          console.error(err);
        }
        return;
      }
      if (mode === 'drone' && audioEngine.isStarted) {
        const mults = computeArpGainMultipliers(
          voicesRef.current,
          arpRef.current,
          performance.now() * 0.001,
        );
        audioEngine.updateVoices(
          voicesRef.current,
          frequenciesRef.current,
          mults,
        );
      }
    },
    [ensureAudioStarted],
  );

  const handleToggleAudio = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (audioOn) {
        audioEngine.releaseAllAdsr(true);
        await audioEngine.stop();
        setAudioOn(false);
      } else {
        await ensureAudioStarted();
      }
    } catch (err) {
      console.error(err);
      setCompileError(
        err instanceof Error ? err.message : 'Failed to start audio',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRandomizeOscillators = useCallback(() => {
    setVoices((prev) =>
      prev.map((v, i) => ({
        ...v,
        enabled: randBool(0.55 + (i < 3 ? 0.25 : 0)),
        freeMode: randBool(0.3),
        freeFreqHz: randRange(40, 520, 0.5),
        detuneCents: randRange(-35, 35, 1),
        gain: randRange(0.08, 0.42, 0.01),
        pan: randRange(-0.9, 0.9, 0.01),
      })),
    );
  }, []);

  // When root changes, update freeFreq for harmonic voices
  useEffect(() => {
    setVoices((prev) =>
      prev.map((v, i) =>
        v.freeMode
          ? v
          : {
              ...v,
              freeFreqHz:
                Math.round(
                  rootHz *
                    Math.pow(2, intervalForVoice(intervals, i) / 12) *
                    100,
                ) / 100,
            },
      ),
    );
  }, [rootHz, intervals]);

  return (
    <div className="app">
      <Visualizer engine={audioEngine} active={audioOn} />

      <div className="app-overlay">
        <header className="app-top">
          <div className="app-brand">
            <h1>Mutating Waveform Synth</h1>
            <p className="app-meta">
              <a
                href={CHANGELOG_URL}
                target="_blank"
                rel="noreferrer"
                title="Changelog"
              >
                v{APP_VERSION}
              </a>
              <a
                href="https://github.com/CiaccoDavide/mutating-waveform-synth"
                target="_blank"
                rel="noreferrer"
              >
                <svg
                  className="app-meta-icon"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
                  />
                </svg>
                GitHub
              </a>
              <a
                href="https://github.com/CiaccoDavide/mutating-waveform-synth/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer"
              >
                <svg
                  className="app-meta-icon"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 2.5v9.5M5.5 14h5M3 6.5l5-2.5 5 2.5M3 6.5l1.5 3h-3L3 6.5Zm10 0 1.5 3h-3L13 6.5Z"
                  />
                </svg>
                MIT
              </a>
              <a
                href="https://github.com/CiaccoDavide"
                target="_blank"
                rel="noreferrer"
              >
                <svg
                  className="app-meta-icon"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 6.5A5.5 5.5 0 0 1 8 9a5.5 5.5 0 0 1 5.5 5.5.75.75 0 0 1-.75.75h-9.5a.75.75 0 0 1-.75-.75Z"
                  />
                </svg>
                CiaccoDavide
              </a>
            </p>
          </div>
          <MonitorStrip
            engine={audioEngine}
            active={audioOn}
            mutators={mutators}
            midiStatus={midiStatus}
            midiActive={midiActive}
            keyboardActive={keyboardActive}
          />
        </header>

        <main className="app-stage">
          <aside className="stage-left">
            <FormulaPanel
              expression={expression}
              error={compileError}
              presets={FORMULA_PRESETS}
              selectedPresetId={presetId}
              mutators={mutators}
              fm={fm}
              onExpressionChange={handleExpressionChange}
              onPresetChange={handlePresetChange}
              onMutatorsChange={setMutators}
              onFmChange={setFm}
            />
          </aside>

          <section className="stage-center">
            <div className={`plot-frame${waveEditMode ? ' is-editing' : ''}`}>
              <div className="plot-toolbar">
                {!waveEditMode ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={enterWaveEdit}
                  >
                    Edit wave
                  </button>
                ) : (
                  <>
                    <span className="panel-hint">Edit mode</span>
                    <div className="plot-connect-modes">
                      {CONNECT_MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`btn btn-ghost${waveConnectMode === m.id ? ' active' : ''}`}
                          onClick={() => setWaveConnectMode(m.id)}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                    <div className="plot-connect-modes" title="Export style">
                      <button
                        type="button"
                        className={`btn btn-ghost${!waveApproximate && waveConnectMode !== 'smooth' ? ' active' : ''}`}
                        disabled={waveConnectMode === 'smooth'}
                        onClick={() => setWaveApproximate(false)}
                        title={
                          waveConnectMode === 'smooth'
                            ? 'Smooth always uses Fourier approximation'
                            : 'Exact piecewise formula (hard edges)'
                        }
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        className={`btn btn-ghost${waveApproximate || waveConnectMode === 'smooth' ? ' active' : ''}`}
                        onClick={() => setWaveApproximate(true)}
                        title="Fourier series approximation"
                      >
                        Approximate
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetWavePoints}
                      title="Reseed points from current wave"
                    >
                      Reset points
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={cancelWaveEdit}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={applyWaveEdit}
                    >
                      Apply
                    </button>
                  </>
                )}
              </div>
              <FormulaPlot
                samples={samples}
                editMode={waveEditMode}
                points={wavePoints}
                connectMode={waveConnectMode}
                onPointsChange={setWavePoints}
              />
              {waveEditMode && (
                <p className="plot-edit-hint">
                  Click to add · drag to move · double-click or Alt-click to
                  delete · Exact keeps hard edges · Approximate uses Fourier
                  {waveConnectMode === 'smooth' ? ' · Smooth is always Approximate' : ''}
                </p>
              )}
            </div>
            <div className="center-controls">
              <HarmonyControls
                rootNote={rootNote}
                rootOctave={rootOctave}
                rootHz={rootHz}
                harmonyId={harmonyId}
                masterVolume={masterVolume}
                audioOn={audioOn}
                playMode={playMode}
                adsr={adsr}
                arp={arp}
                midiStatus={midiStatus}
                playOctave={playOctave}
                midiChannel={midiChannel}
                midiInputId={midiInputId}
                midiInputs={midiInputs}
                onRootNoteChange={setRootNote}
                onRootOctaveChange={(o) => {
                  setRootOctave(o);
                  setPlayOctave(o);
                }}
                onHarmonyChange={setHarmonyId}
                onMasterVolumeChange={setMasterVolume}
                onToggleAudio={handleToggleAudio}
                onRandomizeSection={handleRandomizeHarmony}
                onPlayModeChange={handlePlayModeChange}
                onAdsrChange={setAdsr}
                onArpChange={setArp}
                onEnableMidi={enableMidi}
                onMidiChannelChange={setMidiChannel}
                onMidiInputIdChange={setMidiInputId}
              />
              <CollapsibleSection
                mode="mobile"
                className="panel filter-panel"
                title="Filters and Effects"
                actions={
                  <span className="panel-hint">
                    {filters.filter((f) => f.enabled).length} filters ·{' '}
                    {
                      [
                        effects.chorus.enabled,
                        effects.delay.enabled,
                        effects.reverb.enabled,
                      ].filter(Boolean).length
                    }{' '}
                    fx
                  </span>
                }
              >
                <FilterPanel
                  filters={filters}
                  selectedIndex={selectedFilter}
                  onSelect={setSelectedFilter}
                  onChange={setFilters}
                  ladder={ladder}
                  onLadderChange={setLadder}
                />
                <EffectsPanel effects={effects} onChange={setEffects} />
              </CollapsibleSection>
        </div>
      </section>

          <aside className="stage-right">
            <OscillatorPanel
              voices={voices}
              frequencies={frequencies}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              onVoiceChange={handleVoiceChange}
              onRandomizeAll={handleRandomizeOscillators}
            />
            <PresetPanel
              factoryPresets={FACTORY_PRESETS}
              presets={presetLibrary.presets}
              selectedId={selectedPresetId}
              nameDraft={presetNameDraft}
              status={presetStatus}
              factorySelected={isFactoryPresetId(selectedPresetId)}
              onNameDraftChange={setPresetNameDraft}
              onSelect={handleSelectPreset}
              onSave={handleSavePreset}
              onLoad={handleLoadPreset}
              onDelete={handleDeletePreset}
              onExportSelected={handleExportSelected}
              onExportAll={handleExportAll}
              onImportFiles={handleImportFiles}
            />
          </aside>
        </main>

        <MobilePlaySurface
          playMode={playMode}
          playOctave={playOctave}
          rootNote={rootNote}
          rootOctave={rootOctave}
          onPlayOctaveChange={(o) => {
            setPlayOctave(o);
            if (playMode === 'drone') setRootOctave(o);
          }}
          onRootChange={handleRootChange}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          onFreqNoteOn={handleFreqNoteOn}
          onFreqNoteOff={handleFreqNoteOff}
        />
      </div>
    </div>
  );
}
