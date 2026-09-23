export type TickFn = (beat: number, timeMs: number) => void;

/** Simple look-ahead transport clock in beats. */
export class Transport {
  bpm = 120;
  swing = 0;
  /** 0–1 random delay/velocity jitter (applied in App fireNotes, not swing). */
  humanize = 0;
  playing = false;
  private beat = 0;
  private startPerf = 0;
  private startBeat = 0;
  private timer: number | null = null;
  private onTick: TickFn | null = null;
  private lookaheadMs = 40;
  private intervalMs = 25;

  setTick(fn: TickFn | null) {
    this.onTick = fn;
  }

  get currentBeat() {
    if (!this.playing) return this.beat;
    const elapsed = (performance.now() - this.startPerf) / 1000;
    return this.startBeat + (elapsed * this.bpm) / 60;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.startPerf = performance.now();
    this.startBeat = this.beat;
    this.schedule();
  }

  stop() {
    this.playing = false;
    this.beat = 0;
    this.startBeat = 0;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  pause() {
    this.beat = this.currentBeat;
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    if (!this.playing) return;
    const now = performance.now();
    const horizon = now + this.lookaheadMs;
    const msPerBeat = 60000 / this.bpm;

    while (true) {
      const nextBeatTime =
        this.startPerf + ((this.beat - this.startBeat) * msPerBeat);
      if (nextBeatTime > horizon) break;

      let t = nextBeatTime;
      // Swing only on odd 16ths when swing is meaningfully on
      if (this.swing > 0.001) {
        const step = Math.floor(this.beat * 4 + 1e-6);
        if (step % 2 === 1) {
          t += this.swing * 0.08 * msPerBeat;
        }
      }
      this.onTick?.(this.beat, t);
      this.beat += 0.25; // 16th grid
    }

    this.timer = window.setTimeout(() => this.schedule(), this.intervalMs);
  }
}
