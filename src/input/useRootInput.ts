import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isEditableTarget,
  keyToMidiNote,
  keyToMidiOffset,
  midiToRoot,
  type MidiStatus,
  type PlayMode,
  type RootPitch,
} from './RootInput';

export interface MidiInputDevice {
  id: string;
  name: string;
}

interface UseRootInputOptions {
  enabled?: boolean;
  playMode: PlayMode;
  playOctave: number;
  /** MIDI channel 1–16 */
  midiChannel?: number;
  /** Empty string = all inputs */
  midiInputId?: string;
  onRootChange: (root: RootPitch) => void;
  onPlayOctaveChange: (octave: number) => void;
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
}

export function useRootInput({
  enabled = true,
  playMode,
  playOctave,
  midiChannel = 1,
  midiInputId = '',
  onRootChange,
  onPlayOctaveChange,
  onNoteOn,
  onNoteOff,
}: UseRootInputOptions) {
  const [midiStatus, setMidiStatus] = useState<MidiStatus>(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      ? 'idle'
      : 'unsupported',
  );
  const [midiActive, setMidiActive] = useState(false);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [midiInputs, setMidiInputs] = useState<MidiInputDevice[]>([]);
  const accessRef = useRef<MIDIAccess | null>(null);
  const onRootRef = useRef(onRootChange);
  const onOctaveRef = useRef(onPlayOctaveChange);
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);
  onRootRef.current = onRootChange;
  onOctaveRef.current = onPlayOctaveChange;
  onNoteOnRef.current = onNoteOn;
  onNoteOffRef.current = onNoteOff;
  const playOctaveRef = useRef(playOctave);
  playOctaveRef.current = playOctave;
  const playModeRef = useRef(playMode);
  playModeRef.current = playMode;
  const midiChannelRef = useRef(midiChannel);
  midiChannelRef.current = midiChannel;
  const midiInputIdRef = useRef(midiInputId);
  midiInputIdRef.current = midiInputId;
  const heldKeysRef = useRef(new Set<string>());
  const midiFlashTimer = useRef<number | null>(null);

  const flashMidi = useCallback(() => {
    setMidiActive(true);
    if (midiFlashTimer.current !== null) clearTimeout(midiFlashTimer.current);
    midiFlashTimer.current = window.setTimeout(() => {
      midiFlashTimer.current = null;
      setMidiActive(false);
    }, 160);
  }, []);

  const refreshInputs = useCallback((access: MIDIAccess) => {
    const list: MidiInputDevice[] = [];
    for (const input of access.inputs.values()) {
      list.push({
        id: input.id,
        name: input.name || input.id,
      });
    }
    setMidiInputs(list);
  }, []);

  const handleMidiMessage = useCallback(
    (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 2) return;
      const statusByte = data[0]!;
      const status = statusByte & 0xf0;
      const channel = (statusByte & 0x0f) + 1;
      const want = Math.min(16, Math.max(1, midiChannelRef.current));
      if (channel !== want) return;

      const note = data[1]!;
      const velocity = data.length > 2 ? data[2]! : 0;

      if (status === 0x90 || status === 0x80) {
        flashMidi();
      }

      if (playModeRef.current === 'adsr') {
        if (status === 0x90 && velocity > 0) {
          onNoteOnRef.current?.(note, velocity / 127);
        } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
          onNoteOffRef.current?.(note);
        }
        return;
      }

      if (status === 0x90 && velocity > 0) {
        onRootRef.current(midiToRoot(note));
      }
    },
    [flashMidi],
  );

  const bindInputs = useCallback(
    (access: MIDIAccess) => {
      refreshInputs(access);
      const prefer = midiInputIdRef.current;
      for (const input of access.inputs.values()) {
        input.onmidimessage = null;
      }
      for (const input of access.inputs.values()) {
        if (prefer && input.id !== prefer) continue;
        input.onmidimessage = handleMidiMessage;
        if (prefer) break;
      }
      // If preferred id missing, listen on all
      if (prefer) {
        let found = false;
        for (const input of access.inputs.values()) {
          if (input.id === prefer) {
            found = true;
            break;
          }
        }
        if (!found) {
          for (const input of access.inputs.values()) {
            input.onmidimessage = handleMidiMessage;
          }
        }
      }
    },
    [handleMidiMessage, refreshInputs],
  );

  const enableMidi = useCallback(async () => {
    if (!('requestMIDIAccess' in navigator)) {
      setMidiStatus('unsupported');
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      bindInputs(access);
      access.onstatechange = () => bindInputs(access);
      setMidiStatus('ready');
    } catch {
      setMidiStatus('denied');
    }
  }, [bindInputs]);

  // Rebind when selected input changes
  useEffect(() => {
    const access = accessRef.current;
    if (!access || midiStatus !== 'ready') return;
    bindInputs(access);
  }, [midiInputId, midiStatus, bindInputs]);

  useEffect(() => {
    return () => {
      if (midiFlashTimer.current !== null) clearTimeout(midiFlashTimer.current);
      const access = accessRef.current;
      if (!access) return;
      for (const input of access.inputs.values()) {
        input.onmidimessage = null;
      }
    };
  }, []);

  useEffect(() => {
    if (playMode !== 'adsr') {
      heldKeysRef.current.clear();
      setKeyboardActive(false);
    }
  }, [playMode]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const offset = keyToMidiOffset(event.key);
      if (offset === null) return;
      event.preventDefault();

      if (offset === 'octave-down') {
        onOctaveRef.current(Math.max(1, playOctaveRef.current - 1));
        return;
      }
      if (offset === 'octave-up') {
        onOctaveRef.current(Math.min(4, playOctaveRef.current + 1));
        return;
      }

      const key = event.key.toLowerCase();
      if (playModeRef.current === 'adsr') {
        if (heldKeysRef.current.has(key)) return;
        heldKeysRef.current.add(key);
        setKeyboardActive(true);
        const midi = keyToMidiNote(key, playOctaveRef.current);
        if (midi !== null) onNoteOnRef.current?.(midi, 0.85);
        return;
      }

      setKeyboardActive(true);
      window.setTimeout(() => {
        if (heldKeysRef.current.size === 0) setKeyboardActive(false);
      }, 120);
      const root = midiToRoot((playOctaveRef.current + 1) * 12 + offset);
      onRootRef.current(root);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (playModeRef.current === 'adsr') {
        if (!heldKeysRef.current.has(key)) return;
        heldKeysRef.current.delete(key);
        setKeyboardActive(heldKeysRef.current.size > 0);
        const midi = keyToMidiNote(key, playOctaveRef.current);
        if (midi !== null) onNoteOffRef.current?.(midi);
        return;
      }

      if (keyToMidiOffset(key) !== null) {
        setKeyboardActive(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);

  return {
    midiStatus,
    enableMidi,
    midiActive,
    keyboardActive,
    midiInputs,
  };
}
