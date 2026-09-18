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
  applyMutators,
  mutatorsForTier,
  mutatorsNeedBake,
  type MutatorState,
} from './audio/LfoModel';
import { useRootInput } from './input/useRootInput';
import { PresetPanel } from './ui/PresetPanel';
import {
  createPresetId,
  deletePreset,
  exportLibraryToFile,
  exportPresetToFile,
  loadPresetLibrary,
  parseImportedJson,
  PRESET_SCHEMA_VERSION,
  readFileAsText,
  savePresetLibrary,
  upsertPreset,
  type InstrumentSnapshot,
  type PresetLibrary,
  type SavedPreset,
} from './state/InstrumentPreset';
import './styles/theme.css';
import './App.css';

const DEFAULT_PRESET = FORMULA_PRESETS.find((p) => p.id === 'sine')!;

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
  const [filters, setFilters] = useState<FilterState[]>(() =>
    createDefaultFilterBank(),
  );
  const [selectedFilter, setSelectedFilter] = useState(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const voicesRef = useRef<VoiceState[]>([]);
  const frequenciesRef = useRef<number[]>([]);
  const arpRef = useRef(arp);
  arpRef.current = arp;
  const [droneOn, setDroneOn] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(0);
  const [busy, setBusy] = useState(false);

  const [presetLibrary, setPresetLibrary] = useState<PresetLibrary>(() =>
    loadPresetLibrary(),
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    null,
  );
  const [presetNameDraft, setPresetNameDraft] = useState('My Patch');
  const [presetStatus, setPresetStatus] = useState<string | null>(null);

  const handleRootChange = useCallback(
    (root: { note: number; octave: number }) => {
      setRootNote(root.note);
      setRootOctave(root.octave);
    },
    [],
  );

  const { midiStatus, enableMidi } = useRootInput({
    enabled: true,
    playOctave,
    onRootChange: handleRootChange,
    onPlayOctaveChange: setPlayOctave,
  });

  const rootHz = useMemo(
    () => midiToFreq(noteOctaveToMidi(rootNote, rootOctave)),
    [rootNote, rootOctave],
  );

  const intervals = useMemo(
    () => intervalsForPreset(harmonyId, CUSTOM_INTERVALS),
    [harmonyId],
  );

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
      prev.map((v, i) => ({
        ...v,
        enabled: i < intervals.length ? true : v.enabled && i < intervals.length,
        freeFreqHz: v.freeMode
          ? v.freeFreqHz
          : Math.round(rootHz * Math.pow(2, (intervals[i] ?? 0) / 12) * 100) / 100,
      })),
    );
  }, [harmonyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const frequencies = useMemo(
    () =>
      voices.map((v, i) => {
        const interval =
          intervals[i] ??
          intervals[i % intervals.length]! + 12 * Math.floor(i / intervals.length);
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
      filters,
      voices,
      selectedVoice,
      selectedFilter,
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
    filters,
    voices,
    selectedVoice,
    selectedFilter,
  ]);

  const applySnapshot = useCallback((snap: InstrumentSnapshot) => {
    setExpression(snap.expression);
    setPresetId(snap.formulaPresetId || 'custom');
    setMutators(snap.mutators);
    setRootNote(snap.rootNote);
    setRootOctave(snap.rootOctave);
    setPlayOctave(snap.playOctave ?? snap.rootOctave);
    setHarmonyId(snap.harmonyId);
    setMasterVolume(snap.masterVolume);
    setArp(snap.arp);
    setFilters(snap.filters);
    setVoices(snap.voices);
    setSelectedVoice(snap.selectedVoice ?? 0);
    setSelectedFilter(snap.selectedFilter ?? 0);
    sampleFnRef.current = null;
    const compiled = compileFormula(snap.expression);
    if (compiled.ok) {
      sampleFnRef.current = compiled.fn;
      setCompileError(null);
      setSamples(bakeWavetable(applyMutators(compiled.fn, snap.mutators), 0));
    } else {
      setCompileError(compiled.error);
    }
  }, []);

  const persistLibrary = useCallback((next: PresetLibrary) => {
    setPresetLibrary(next);
    savePresetLibrary(next);
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = presetNameDraft.trim() || 'Untitled';
    const now = new Date().toISOString();
    const existing = selectedPresetId
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
    setPresetStatus(`Saved “${name}”`);
  }, [
    captureSnapshot,
    persistLibrary,
    presetLibrary,
    presetNameDraft,
    selectedPresetId,
  ]);

  const handleLoadPreset = useCallback(() => {
    if (!selectedPresetId) return;
    const preset = presetLibrary.presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    applySnapshot(preset.snapshot);
    setPresetNameDraft(preset.name);
    setPresetStatus(`Loaded “${preset.name}”`);
  }, [applySnapshot, presetLibrary.presets, selectedPresetId]);

  const handleDeletePreset = useCallback(() => {
    if (!selectedPresetId) return;
    const preset = presetLibrary.presets.find((p) => p.id === selectedPresetId);
    const next = deletePreset(presetLibrary, selectedPresetId);
    persistLibrary(next);
    setSelectedPresetId(null);
    setPresetStatus(preset ? `Deleted “${preset.name}”` : 'Deleted');
  }, [persistLibrary, presetLibrary, selectedPresetId]);

  const handleExportSelected = useCallback(() => {
    if (!selectedPresetId) return;
    const preset = presetLibrary.presets.find((p) => p.id === selectedPresetId);
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
      const preset = presetLibrary.presets.find((p) => p.id === id);
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
    if (droneOn) audioEngine.pushWavetable(table);
  }, [expression]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push voice params when they change (arp handled in RAF when enabled)
  useEffect(() => {
    if (!droneOn) return;
    const mults = computeArpGainMultipliers(
      voices,
      arp,
      performance.now() * 0.001,
    );
    audioEngine.updateVoices(voices, frequencies, mults);
  }, [voices, frequencies, droneOn, arp]);

  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    audioEngine.setFilters(filters, performance.now() * 0.001);
  }, [filters]);

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
          if (droneOn) audioEngine.pushWavetable(table);
        }
      }

      if (
        droneOn &&
        filterBankNeedsTick(filtersRef.current) &&
        now - lastFilter > 1000 / 30
      ) {
        lastFilter = now;
        audioEngine.tickFilters(t);
      }

      if (droneOn && arpRef.current.enabled && now - lastArp > 1000 / 60) {
        lastArp = now;
        const mults = computeArpGainMultipliers(
          voicesRef.current,
          arpRef.current,
          t,
        );
        audioEngine.updateVoices(
          voicesRef.current,
          frequenciesRef.current,
          mults,
        );
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mutators, expression, droneOn]);

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
  }, []);

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

  const handleToggleDrone = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (droneOn) {
        await audioEngine.stop();
        setDroneOn(false);
      } else {
        await audioEngine.start();
        const fn = sampleFnRef.current;
        if (fn) {
          const table = bakeWavetable(applyMutators(fn, mutators), 0);
          audioEngine.pushWavetable(table);
        }
        audioEngine.setMasterVolume(masterVolume);
        audioEngine.setFilters(filters, 0);
        const mults = computeArpGainMultipliers(voices, arp, 0);
        audioEngine.updateVoices(voices, frequencies, mults);
        setDroneOn(true);
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
                  rootHz * Math.pow(2, (intervals[i] ?? 0) / 12) * 100,
                ) / 100,
            },
      ),
    );
  }, [rootHz, intervals]);

  return (
    <div className="app">
      <Visualizer engine={audioEngine} active={droneOn} />

      <div className="app-overlay">
        <header className="app-brand">
          <h1>Mutating Waveform Drones</h1>
          <p>Formula-shaped oscillators · harmonized · time-warped</p>
        </header>

        <main className="app-stage">
          <aside className="stage-left">
            <FormulaPanel
              expression={expression}
              error={compileError}
              presets={FORMULA_PRESETS}
              selectedPresetId={presetId}
              mutators={mutators}
              onExpressionChange={handleExpressionChange}
              onPresetChange={handlePresetChange}
              onMutatorsChange={setMutators}
            />
          </aside>

          <section className="stage-center">
            <div className="plot-frame">
              <FormulaPlot samples={samples} />
            </div>
            <div className="center-controls">
              <HarmonyControls
                rootNote={rootNote}
                rootOctave={rootOctave}
                rootHz={rootHz}
                harmonyId={harmonyId}
                masterVolume={masterVolume}
                droneOn={droneOn}
                arp={arp}
                midiStatus={midiStatus}
                playOctave={playOctave}
                onRootNoteChange={setRootNote}
                onRootOctaveChange={(o) => {
                  setRootOctave(o);
                  setPlayOctave(o);
                }}
                onHarmonyChange={setHarmonyId}
                onMasterVolumeChange={setMasterVolume}
                onToggleDrone={handleToggleDrone}
                onRandomizeSection={handleRandomizeHarmony}
                onArpChange={setArp}
                onEnableMidi={enableMidi}
              />
              <FilterPanel
                filters={filters}
                selectedIndex={selectedFilter}
                onSelect={setSelectedFilter}
                onChange={setFilters}
              />
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
              presets={presetLibrary.presets}
              selectedId={selectedPresetId}
              nameDraft={presetNameDraft}
              status={presetStatus}
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
      </div>
    </div>
  );
}
