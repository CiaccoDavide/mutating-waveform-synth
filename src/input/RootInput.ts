export interface RootPitch {
  note: number;
  octave: number;
}

export type PlayMode = 'drone' | 'adsr';

/** Inverse of noteOctaveToMidi: MIDI → note index + octave (clamped 1–4). */
export function midiToRoot(midi: number): RootPitch {
  const clamped = Math.max(24, Math.min(84, Math.round(midi)));
  const note = ((clamped % 12) + 12) % 12;
  const octave = Math.min(4, Math.max(1, Math.floor(clamped / 12) - 1));
  return { note, octave };
}

export function rootToMidi(note: number, octave: number): number {
  return (octave + 1) * 12 + note;
}

/** PC keyboard → semitone offset from C in the play octave */
const KEY_OFFSETS: Record<string, number> = {
  z: 0,
  s: 1,
  x: 2,
  d: 3,
  c: 4,
  v: 5,
  g: 6,
  b: 7,
  h: 8,
  n: 9,
  j: 10,
  m: 11,
};

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function keyToMidiOffset(key: string): number | 'octave-up' | 'octave-down' | null {
  const k = key.toLowerCase();
  if (k === ',') return 'octave-down';
  if (k === '.') return 'octave-up';
  const offset = KEY_OFFSETS[k];
  if (offset === undefined) return null;
  return offset;
}

export function keyToRoot(
  key: string,
  playOctave: number,
): RootPitch | 'octave-up' | 'octave-down' | null {
  const result = keyToMidiOffset(key);
  if (result === null) return null;
  if (result === 'octave-up' || result === 'octave-down') return result;
  return midiToRoot((playOctave + 1) * 12 + result);
}

export function keyToMidiNote(key: string, playOctave: number): number | null {
  const result = keyToMidiOffset(key);
  if (result === null || result === 'octave-up' || result === 'octave-down') {
    return null;
  }
  return (playOctave + 1) * 12 + result;
}

export type MidiStatus = 'idle' | 'ready' | 'denied' | 'unsupported';
