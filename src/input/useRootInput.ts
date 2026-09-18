import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isEditableTarget,
  keyToRoot,
  midiToRoot,
  type MidiStatus,
  type RootPitch,
} from './RootInput';

interface UseRootInputOptions {
  enabled?: boolean;
  playOctave: number;
  onRootChange: (root: RootPitch) => void;
  onPlayOctaveChange: (octave: number) => void;
}

export function useRootInput({
  enabled = true,
  playOctave,
  onRootChange,
  onPlayOctaveChange,
}: UseRootInputOptions) {
  const [midiStatus, setMidiStatus] = useState<MidiStatus>(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      ? 'idle'
      : 'unsupported',
  );
  const accessRef = useRef<MIDIAccess | null>(null);
  const onRootRef = useRef(onRootChange);
  const onOctaveRef = useRef(onPlayOctaveChange);
  onRootRef.current = onRootChange;
  onOctaveRef.current = onPlayOctaveChange;
  const playOctaveRef = useRef(playOctave);
  playOctaveRef.current = playOctave;

  const handleMidiMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 2) return;
    const status = data[0]! & 0xf0;
    const note = data[1]!;
    const velocity = data.length > 2 ? data[2]! : 0;
    // Note on with velocity, or note on channel message
    if (status === 0x90 && velocity > 0) {
      onRootRef.current(midiToRoot(note));
    }
  }, []);

  const bindInputs = useCallback(
    (access: MIDIAccess) => {
      for (const input of access.inputs.values()) {
        input.onmidimessage = handleMidiMessage;
      }
    },
    [handleMidiMessage],
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

  useEffect(() => {
    return () => {
      const access = accessRef.current;
      if (!access) return;
      for (const input of access.inputs.values()) {
        input.onmidimessage = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const result = keyToRoot(event.key, playOctaveRef.current);
      if (!result) return;
      event.preventDefault();

      if (result === 'octave-down') {
        onOctaveRef.current(Math.max(1, playOctaveRef.current - 1));
        return;
      }
      if (result === 'octave-up') {
        onOctaveRef.current(Math.min(4, playOctaveRef.current + 1));
        return;
      }
      onRootRef.current(result);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  return { midiStatus, enableMidi };
}
