import type { ArpState } from '../audio/Arpeggiator';
import type { AdsrParams } from '../audio/Envelope';
import type { FilterState } from '../audio/FilterModel';
import type { HarmonyPresetId, VoiceState } from '../audio/HarmonyModel';
import type { MutatorState } from '../audio/LfoModel';
import type { PlayMode } from '../input/RootInput';
import { DEFAULT_ADSR } from '../audio/Envelope';
import { DEFAULT_ARP } from '../audio/Arpeggiator';

export const PRESET_SCHEMA_VERSION = 2;
export const PRESET_STORAGE_KEY = 'mwd-global-presets-v1';

export interface InstrumentSnapshot {
  expression: string;
  formulaPresetId: string;
  mutators: MutatorState;
  rootNote: number;
  rootOctave: number;
  playOctave: number;
  harmonyId: HarmonyPresetId;
  masterVolume: number;
  arp: ArpState;
  playMode?: PlayMode;
  adsr?: AdsrParams;
  filters: FilterState[];
  voices: VoiceState[];
  selectedVoice: number;
  selectedFilter: number;
}

export function normalizeSnapshot(snap: InstrumentSnapshot): InstrumentSnapshot {
  return {
    ...snap,
    playMode: snap.playMode === 'adsr' ? 'adsr' : 'drone',
    adsr: snap.adsr ? { ...DEFAULT_ADSR, ...snap.adsr } : { ...DEFAULT_ADSR },
    arp: snap.arp ? { ...DEFAULT_ARP, ...snap.arp } : { ...DEFAULT_ARP },
  };
}

export interface SavedPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  snapshot: InstrumentSnapshot;
}

export interface PresetLibrary {
  version: number;
  presets: SavedPreset[];
}

export function createPresetId(): string {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPresetLibrary(): PresetLibrary {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return { version: PRESET_SCHEMA_VERSION, presets: [] };
    const parsed = JSON.parse(raw) as PresetLibrary;
    if (!parsed || !Array.isArray(parsed.presets)) {
      return { version: PRESET_SCHEMA_VERSION, presets: [] };
    }
    return {
      version: PRESET_SCHEMA_VERSION,
      presets: parsed.presets.filter(
        (p) => p && typeof p.id === 'string' && p.snapshot,
      ),
    };
  } catch {
    return { version: PRESET_SCHEMA_VERSION, presets: [] };
  }
}

export function savePresetLibrary(library: PresetLibrary): void {
  localStorage.setItem(
    PRESET_STORAGE_KEY,
    JSON.stringify({
      version: PRESET_SCHEMA_VERSION,
      presets: library.presets,
    }),
  );
}

export function upsertPreset(
  library: PresetLibrary,
  preset: SavedPreset,
): PresetLibrary {
  const idx = library.presets.findIndex((p) => p.id === preset.id);
  const presets = [...library.presets];
  if (idx >= 0) presets[idx] = preset;
  else presets.unshift(preset);
  return { version: PRESET_SCHEMA_VERSION, presets };
}

export function deletePreset(
  library: PresetLibrary,
  id: string,
): PresetLibrary {
  return {
    version: PRESET_SCHEMA_VERSION,
    presets: library.presets.filter((p) => p.id !== id),
  };
}

export function exportPresetToFile(preset: SavedPreset): void {
  const blob = new Blob([JSON.stringify(preset, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = preset.name.replace(/[^\w\-]+/g, '_').slice(0, 48) || 'preset';
  a.href = url;
  a.download = `${safe}.mwd.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLibraryToFile(library: PresetLibrary): void {
  const blob = new Blob([JSON.stringify(library, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mwd-presets-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function isSnapshot(value: unknown): value is InstrumentSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as InstrumentSnapshot;
  return (
    typeof s.expression === 'string' &&
    typeof s.rootNote === 'number' &&
    typeof s.rootOctave === 'number' &&
    Array.isArray(s.voices) &&
    Array.isArray(s.filters) &&
    s.mutators != null &&
    s.arp != null
  );
}

/** Parse a single preset or a full library from imported JSON. */
export function parseImportedJson(raw: string): {
  presets: SavedPreset[];
  error?: string;
} {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') {
      return { presets: [], error: 'Invalid JSON' };
    }

    // Full library
    if ('presets' in data && Array.isArray((data as PresetLibrary).presets)) {
      const lib = data as PresetLibrary;
      const presets = lib.presets.filter(
        (p) => p && typeof p.id === 'string' && isSnapshot(p.snapshot),
      );
      if (presets.length === 0) {
        return { presets: [], error: 'No valid presets in file' };
      }
      return { presets };
    }

    // Single SavedPreset
    if (
      'snapshot' in data &&
      isSnapshot((data as SavedPreset).snapshot)
    ) {
      const p = data as SavedPreset;
      return {
        presets: [
          {
            id: typeof p.id === 'string' ? p.id : createPresetId(),
            name:
              typeof p.name === 'string' && p.name.trim()
                ? p.name
                : 'Imported',
            createdAt:
              typeof p.createdAt === 'string'
                ? p.createdAt
                : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: PRESET_SCHEMA_VERSION,
            snapshot: p.snapshot,
          },
        ],
      };
    }

    // Bare snapshot
    if (isSnapshot(data)) {
      const now = new Date().toISOString();
      return {
        presets: [
          {
            id: createPresetId(),
            name: 'Imported',
            createdAt: now,
            updatedAt: now,
            version: PRESET_SCHEMA_VERSION,
            snapshot: data,
          },
        ],
      };
    }

    return { presets: [], error: 'Unrecognized preset format' };
  } catch {
    return { presets: [], error: 'Failed to parse JSON' };
  }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
