import { DEFAULT_ARP } from '../audio/Arpeggiator';
import { FORMULA_PRESETS } from '../audio/FormulaCompiler';
import {
  createDefaultEffects,
  createDefaultFm,
  createDefaultLadder,
  effectsToSlots,
} from '../audio/EffectsModel';
import {
  createDefaultFilter,
  type FilterState,
} from '../audio/FilterModel';
import {
  createDefaultVoices,
  intervalsForPreset,
  midiToFreq,
  noteOctaveToMidi,
  type HarmonyPresetId,
  type VoiceState,
} from '../audio/HarmonyModel';
import {
  createDefaultMutators,
  mutatorsForTier,
  type MutatorState,
} from '../audio/LfoModel';
import {
  CURRENT_FACTORY_SEED_VERSION,
  PRESET_SCHEMA_VERSION,
  type InstrumentSnapshot,
  type PresetLibrary,
  type SavedPreset,
} from './InstrumentPreset';

const FACTORY_EPOCH = '2026-09-18T00:00:00.000Z';

function formulaById(id: string) {
  const preset = FORMULA_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Missing formula preset ${id}`);
  return preset;
}

function baseVoices(
  rootNote: number,
  rootOctave: number,
  harmonyId: HarmonyPresetId,
): VoiceState[] {
  const rootHz = midiToFreq(noteOctaveToMidi(rootNote, rootOctave));
  return createDefaultVoices(rootHz, intervalsForPreset(harmonyId, []));
}

function patchVoices(
  voices: VoiceState[],
  patches: Array<Partial<VoiceState> & { index: number }>,
): VoiceState[] {
  const next = voices.map((v) => ({ ...v }));
  for (const { index, ...patch } of patches) {
    const voice = next[index];
    if (voice) next[index] = { ...voice, ...patch };
  }
  // Disable any voices beyond what patches enable explicitly when enableAll false
  return next;
}

function enableFirst(voices: VoiceState[], count: number): VoiceState[] {
  return voices.map((v, i) => ({
    ...v,
    enabled: i < count,
  }));
}

function factoryPreset(
  id: string,
  name: string,
  snapshot: InstrumentSnapshot,
): SavedPreset {
  return {
    id,
    name,
    createdAt: FACTORY_EPOCH,
    updatedAt: FACTORY_EPOCH,
    version: PRESET_SCHEMA_VERSION,
    snapshot,
  };
}

function staticMutators(): MutatorState {
  return mutatorsForTier('character');
}

function softPadMutators(): MutatorState {
  return createDefaultMutators({
    enabled: true,
    morphRate: 0.55,
    lfos: [
      {
        enabled: true,
        shape: 'sine',
        rate: 0.06,
        depth: 0.18,
        target: 'phase',
        sub: { enabled: false },
      },
      {
        enabled: true,
        shape: 'triangle',
        rate: 0.04,
        depth: 0.12,
        target: 'amp',
        sub: { enabled: false },
      },
      { enabled: false },
    ],
  });
}

function ladderLead(): SavedPreset {
  const formula = formulaById('char-ladder');
  const rootNote = 4; // E
  const rootOctave = 2;
  const harmonyId: HarmonyPresetId = 'sub';
  let voices = baseVoices(rootNote, rootOctave, harmonyId);
  voices = enableFirst(voices, 2);
  voices = patchVoices(voices, [
    { index: 0, gain: 0.42, detuneCents: -4, pan: -0.15 },
    { index: 1, gain: 0.28, detuneCents: 3, pan: 0.1 },
  ]);
  const filters: FilterState[] = [
    createDefaultFilter(0, {
      enabled: true,
      mode: 'lowpass',
      cutoff: 2400,
      q: 0.7,
      gainDb: 0,
      cutoffLfo: { enabled: false },
    }),
    createDefaultFilter(1, { enabled: false }),
    createDefaultFilter(2, { enabled: false }),
  ];
  return factoryPreset('factory-ladder-lead', 'Ladder Lead · Moog-ish', {
    expression: formula.expression,
    formulaPresetId: formula.id,
    mutators: staticMutators(),
    rootNote,
    rootOctave,
    playOctave: 0,
    harmonyId,
    masterVolume: 0.72,
    arp: { ...DEFAULT_ARP },
    playMode: 'adsr',
    adsr: { attack: 0.02, decay: 0.28, sustain: 0.55, release: 0.35 },
    filters,
    voices,
    selectedVoice: 0,
    selectedFilter: 0,
    ladder: createDefaultLadder({
      enabled: true,
      cutoff: 1100,
      resonance: 0.55,
      drive: 0.35,
    }),
    effects: effectsToSlots(
      createDefaultEffects({
        delay: {
          enabled: true,
          mix: 0.18,
          params: { algorithm: 'digital', timeMs: 95, feedback: 0.2, tone: 3500 },
        },
      }),
    ),
    fm: createDefaultFm(),
  });
}

function acidSquelch(): SavedPreset {
  const formula = formulaById('char-acid');
  const rootNote = 9; // A
  const rootOctave = 2;
  const harmonyId: HarmonyPresetId = 'sub';
  let voices = baseVoices(rootNote, rootOctave, harmonyId);
  voices = enableFirst(voices, 2);
  voices = patchVoices(voices, [
    { index: 0, gain: 0.4, detuneCents: 0, pan: 0 },
    { index: 1, gain: 0.22, detuneCents: 0, pan: 0 },
  ]);
  const filters: FilterState[] = [
    createDefaultFilter(0, {
      enabled: false,
      mode: 'lowpass',
      cutoff: 480,
      q: 0.7,
      gainDb: 0,
    }),
    createDefaultFilter(1, { enabled: false }),
    createDefaultFilter(2, { enabled: false }),
  ];
  return factoryPreset('factory-acid-squelch', 'Acid Squelch · 303-ish', {
    expression: formula.expression,
    formulaPresetId: formula.id,
    mutators: staticMutators(),
    rootNote,
    rootOctave,
    playOctave: 0,
    harmonyId,
    masterVolume: 0.68,
    arp: { enabled: true, mode: 'up', rateHz: 4.5, gate: 0.55 },
    playMode: 'adsr',
    adsr: { attack: 0.005, decay: 0.18, sustain: 0.15, release: 0.12 },
    filters,
    voices,
    selectedVoice: 0,
    selectedFilter: 0,
    ladder: createDefaultLadder({
      enabled: true,
      cutoff: 520,
      resonance: 0.82,
      drive: 0.55,
    }),
    effects: effectsToSlots(
      createDefaultEffects({
        delay: {
          enabled: true,
          mix: 0.22,
          params: {
            algorithm: 'tape',
            timeMs: 180,
            feedback: 0.4,
            tone: 2800,
          },
        },
      }),
    ),
    fm: createDefaultFm(),
  });
}

function chorusPad(): SavedPreset {
  const formula = formulaById('char-chorus');
  const rootNote = 0; // C
  const rootOctave = 3;
  const harmonyId: HarmonyPresetId = 'major';
  let voices = baseVoices(rootNote, rootOctave, harmonyId);
  // major has 3 intervals — enable those; add 3 more stacked pairs for chorus width
  voices = enableFirst(voices, 6);
  voices = patchVoices(voices, [
    { index: 0, gain: 0.28, detuneCents: -8, pan: -0.55 },
    { index: 1, gain: 0.24, detuneCents: 6, pan: 0.1 },
    { index: 2, gain: 0.22, detuneCents: -3, pan: 0.5 },
    { index: 3, gain: 0.18, detuneCents: 11, pan: -0.35 },
    { index: 4, gain: 0.16, detuneCents: -12, pan: 0.25 },
    { index: 5, gain: 0.14, detuneCents: 5, pan: 0.65 },
  ]);
  const filters: FilterState[] = [
    createDefaultFilter(0, {
      enabled: true,
      mode: 'lowpass',
      cutoff: 3200,
      q: 0.55,
      gainDb: 0,
    }),
    createDefaultFilter(1, {
      enabled: true,
      mode: 'highshelf',
      cutoff: 4500,
      q: 0.7,
      gainDb: 2.5,
    }),
    createDefaultFilter(2, { enabled: false }),
  ];
  return factoryPreset('factory-chorus-pad', 'Chorus Pad · Juno-ish', {
    expression: formula.expression,
    formulaPresetId: formula.id,
    mutators: softPadMutators(),
    rootNote,
    rootOctave,
    playOctave: 0,
    harmonyId,
    masterVolume: 0.62,
    arp: { ...DEFAULT_ARP },
    playMode: 'drone',
    adsr: { attack: 0.4, decay: 0.6, sustain: 0.85, release: 1.2 },
    filters,
    voices,
    selectedVoice: 0,
    selectedFilter: 0,
    ladder: createDefaultLadder(),
    effects: effectsToSlots(
      createDefaultEffects({
        chorus: {
          enabled: true,
          mix: 0.45,
          params: {
            rate: 0.55,
            depth: 0.42,
            voices: 4,
            feedback: 0.12,
            stereoWidth: 0.85,
          },
        },
        reverb: {
          enabled: true,
          mix: 0.28,
          params: {
            algorithm: 'hall',
            size: 0.6,
            decay: 0.55,
            damping: 0.4,
            preDelayMs: 30,
          },
        },
      }),
    ),
    fm: createDefaultFm(),
  });
}

function electricKeys(): SavedPreset {
  const formula = formulaById('char-keys');
  const rootNote = 4; // E
  const rootOctave = 3;
  const harmonyId: HarmonyPresetId = 'unison';
  let voices = baseVoices(rootNote, rootOctave, harmonyId);
  voices = enableFirst(voices, 2);
  voices = patchVoices(voices, [
    { index: 0, gain: 0.38, detuneCents: 0, pan: -0.2 },
    { index: 1, enabled: true, gain: 0.2, detuneCents: 7, pan: 0.25 },
  ]);
  const filters: FilterState[] = [
    createDefaultFilter(0, {
      enabled: true,
      mode: 'highpass',
      cutoff: 220,
      q: 0.6,
      gainDb: 0,
    }),
    createDefaultFilter(1, {
      enabled: true,
      mode: 'peaking',
      cutoff: 2800,
      q: 1.8,
      gainDb: 4,
    }),
    createDefaultFilter(2, {
      enabled: true,
      mode: 'lowpass',
      cutoff: 6500,
      q: 0.5,
      gainDb: 0,
    }),
  ];
  return factoryPreset('factory-electric-keys', 'Electric Keys · DX-ish', {
    expression: formula.expression,
    formulaPresetId: formula.id,
    mutators: staticMutators(),
    rootNote,
    rootOctave,
    playOctave: 0,
    harmonyId,
    masterVolume: 0.7,
    arp: { ...DEFAULT_ARP },
    playMode: 'adsr',
    adsr: { attack: 0.002, decay: 1.1, sustain: 0.25, release: 0.45 },
    filters,
    voices,
    selectedVoice: 0,
    selectedFilter: 0,
    ladder: createDefaultLadder(),
    effects: effectsToSlots(
      createDefaultEffects({
        reverb: {
          enabled: true,
          mix: 0.22,
          params: {
            algorithm: 'plate',
            size: 0.35,
            decay: 0.4,
            damping: 0.55,
            preDelayMs: 12,
          },
        },
      }),
    ),
    fm: createDefaultFm({ enabled: true, ratio: 14, index: 2.2 }),
  });
}

function cinemaPad(): SavedPreset {
  const formula = formulaById('char-cinema');
  const rootNote = 7; // G
  const rootOctave = 2;
  const harmonyId: HarmonyPresetId = 'minor';
  let voices = baseVoices(rootNote, rootOctave, harmonyId);
  voices = enableFirst(voices, 5);
  voices = patchVoices(voices, [
    { index: 0, gain: 0.3, detuneCents: -5, pan: -0.4 },
    { index: 1, gain: 0.26, detuneCents: 4, pan: 0.15 },
    { index: 2, gain: 0.24, detuneCents: -2, pan: 0.45 },
    { index: 3, gain: 0.16, detuneCents: 9, pan: -0.2 },
    { index: 4, gain: 0.14, detuneCents: -8, pan: 0.55 },
  ]);
  const filters: FilterState[] = [
    createDefaultFilter(0, {
      enabled: true,
      mode: 'lowpass',
      cutoff: 1400,
      q: 1.1,
      gainDb: 0,
      cutoffLfo: {
        enabled: true,
        shape: 'sine',
        rate: 0.07,
        depth: 0.45,
      },
    }),
    createDefaultFilter(1, {
      enabled: true,
      mode: 'lowshelf',
      cutoff: 180,
      q: 0.7,
      gainDb: 3,
    }),
    createDefaultFilter(2, { enabled: false }),
  ];
  return factoryPreset('factory-cinema-pad', 'Cinema Pad · CS-ish', {
    expression: formula.expression,
    formulaPresetId: formula.id,
    mutators: softPadMutators(),
    rootNote,
    rootOctave,
    playOctave: 0,
    harmonyId,
    masterVolume: 0.58,
    arp: { ...DEFAULT_ARP },
    playMode: 'drone',
    adsr: { attack: 1.2, decay: 0.8, sustain: 0.9, release: 2.5 },
    filters,
    voices,
    selectedVoice: 0,
    selectedFilter: 0,
    ladder: createDefaultLadder({
      enabled: true,
      cutoff: 1600,
      resonance: 0.25,
      drive: 0.15,
    }),
    effects: effectsToSlots(
      createDefaultEffects({
        chorus: {
          enabled: true,
          mix: 0.28,
          params: {
            rate: 0.25,
            depth: 0.3,
            voices: 3,
            feedback: 0.08,
            stereoWidth: 0.7,
          },
        },
        reverb: {
          enabled: true,
          mix: 0.4,
          params: {
            algorithm: 'hall',
            size: 0.75,
            decay: 0.7,
            damping: 0.35,
            preDelayMs: 40,
          },
        },
      }),
    ),
    fm: createDefaultFm(),
  });
}

function polyBrass(): SavedPreset {
  const formula = formulaById('char-brass');
  const rootNote = 2; // D
  const rootOctave = 3;
  const harmonyId: HarmonyPresetId = 'fifth';
  let voices = baseVoices(rootNote, rootOctave, harmonyId);
  voices = enableFirst(voices, 4);
  voices = patchVoices(voices, [
    { index: 0, gain: 0.36, detuneCents: -6, pan: -0.35 },
    { index: 1, gain: 0.32, detuneCents: 5, pan: 0.3 },
    { index: 2, gain: 0.22, detuneCents: -10, pan: -0.15 },
    { index: 3, gain: 0.2, detuneCents: 8, pan: 0.4 },
  ]);
  const filters: FilterState[] = [
    createDefaultFilter(0, {
      enabled: true,
      mode: 'bandpass',
      cutoff: 900,
      q: 1.6,
      gainDb: 0,
    }),
    createDefaultFilter(1, {
      enabled: true,
      mode: 'lowpass',
      cutoff: 2800,
      q: 1.2,
      gainDb: 0,
    }),
    createDefaultFilter(2, {
      enabled: true,
      mode: 'peaking',
      cutoff: 1600,
      q: 2,
      gainDb: 3.5,
    }),
  ];
  return factoryPreset('factory-poly-brass', 'Poly Brass · OB-ish', {
    expression: formula.expression,
    formulaPresetId: formula.id,
    mutators: staticMutators(),
    rootNote,
    rootOctave,
    playOctave: 0,
    harmonyId,
    masterVolume: 0.7,
    arp: { ...DEFAULT_ARP },
    playMode: 'adsr',
    adsr: { attack: 0.08, decay: 0.35, sustain: 0.7, release: 0.5 },
    filters,
    voices,
    selectedVoice: 0,
    selectedFilter: 0,
    ladder: createDefaultLadder(),
    effects: effectsToSlots(
      createDefaultEffects({
        chorus: {
          enabled: true,
          mix: 0.32,
          params: {
            rate: 0.7,
            depth: 0.28,
            voices: 3,
            feedback: 0.1,
            stereoWidth: 0.6,
          },
        },
        reverb: {
          enabled: true,
          mix: 0.2,
          params: {
            algorithm: 'room',
            size: 0.4,
            decay: 0.35,
            damping: 0.5,
            preDelayMs: 18,
          },
        },
      }),
    ),
    fm: createDefaultFm(),
  });
}

/** Read-only inspired-by instrument patches (not stored in localStorage). */
export const FACTORY_PRESETS: SavedPreset[] = [
  ladderLead(),
  acidSquelch(),
  chorusPad(),
  electricKeys(),
  cinemaPad(),
  polyBrass(),
];

export function isFactoryPresetId(id: string | null | undefined): boolean {
  if (!id) return false;
  return FACTORY_PRESETS.some((p) => p.id === id);
}

export function findFactoryPreset(id: string): SavedPreset | undefined {
  return FACTORY_PRESETS.find((p) => p.id === id);
}

export function findAnyPreset(
  id: string,
  userPresets: SavedPreset[],
): SavedPreset | undefined {
  return findFactoryPreset(id) ?? userPresets.find((p) => p.id === id);
}

/**
 * Insert seeded copies of factory presets into the user library when missing.
 * Never overwrites existing `seeded-*` entries. Advances factorySeedVersion.
 */
export function seedFactoryCopies(
  library: PresetLibrary,
  factory: SavedPreset[] = FACTORY_PRESETS,
): PresetLibrary {
  const current = library.factorySeedVersion ?? 0;
  if (current >= CURRENT_FACTORY_SEED_VERSION) return library;

  let presets = [...library.presets];
  for (const factoryPreset of factory) {
    const seededId = `seeded-${factoryPreset.id}`;
    if (presets.some((p) => p.id === seededId)) continue;
    const now = new Date().toISOString();
    presets = [
      {
        id: seededId,
        name: factoryPreset.name,
        createdAt: now,
        updatedAt: now,
        version: PRESET_SCHEMA_VERSION,
        snapshot: { ...factoryPreset.snapshot },
      },
      ...presets,
    ];
  }

  return {
    version: PRESET_SCHEMA_VERSION,
    factorySeedVersion: CURRENT_FACTORY_SEED_VERSION,
    presets,
  };
}
