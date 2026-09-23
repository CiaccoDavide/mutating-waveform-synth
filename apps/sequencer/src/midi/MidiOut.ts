export interface MidiOutDevice {
  id: string;
  name: string;
}

export type MidiEnableResult =
  | 'ready'
  | 'empty'
  | 'denied'
  | 'unsupported';

export class MidiOut {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;
  private onChange: (() => void) | null = null;
  channel = 1;

  setOnChange(fn: (() => void) | null) {
    this.onChange = fn;
  }

  async enable(): Promise<MidiEnableResult> {
    if (!('requestMIDIAccess' in navigator)) return 'unsupported';
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = () => {
        this.onChange?.();
      };
      const outs = this.listOutputs();
      if (outs.length === 0) return 'empty';
      return 'ready';
    } catch {
      return 'denied';
    }
  }

  listOutputs(): MidiOutDevice[] {
    if (!this.access) return [];
    const list: MidiOutDevice[] = [];
    for (const out of this.access.outputs.values()) {
      list.push({ id: out.id, name: out.name || out.id });
    }
    return list;
  }

  setOutputId(id: string) {
    if (!this.access) {
      this.output = null;
      return;
    }
    this.output = id ? this.access.outputs.get(id) ?? null : null;
    if (!this.output) {
      const first = this.access.outputs.values().next().value as
        | MIDIOutput
        | undefined;
      this.output = first ?? null;
    }
  }

  private status(kind: number): number {
    const ch = Math.min(16, Math.max(1, this.channel)) - 1;
    return kind | ch;
  }

  noteOn(note: number, velocity = 100) {
    const n = Math.min(127, Math.max(0, Math.round(note)));
    const v = Math.min(127, Math.max(1, Math.round(velocity)));
    this.output?.send([this.status(0x90), n, v]);
  }

  noteOff(note: number) {
    const n = Math.min(127, Math.max(0, Math.round(note)));
    this.output?.send([this.status(0x80), n, 0]);
  }

  panic() {
    if (!this.output) return;
    for (let n = 0; n < 128; n += 1) {
      this.output.send([this.status(0x80), n, 0]);
    }
    this.output.send([this.status(0xb0), 123, 0]);
  }
}
