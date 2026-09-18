/**
 * Wavetable oscillator AudioWorklet processor.
 * Receives Float32Array tables via port messages and morphs between
 * current and next table for click-free updates.
 */
class WavetableProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    /** @type {Float32Array} */
    this.tableA = new Float32Array(2048);
    /** @type {Float32Array} */
    this.tableB = new Float32Array(2048);
    this.tableSize = 2048;
    this.phase = 0;
    this.morph = 1; // 1 = fully on tableB (current)
    this.morphSpeed = 0.002;
    this.frequency = 110;
    this.gain = 0.3;
    this.active = false;

    for (let i = 0; i < this.tableSize; i += 1) {
      const x = (i / this.tableSize) * Math.PI * 2;
      this.tableA[i] = Math.sin(x);
      this.tableB[i] = Math.sin(x);
    }

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'table' && data.samples) {
        const samples = data.samples;
        // Swap: current B becomes A, new table becomes B, morph from 0→1
        this.tableA.set(this.tableB);
        const n = Math.min(samples.length, this.tableSize);
        for (let i = 0; i < n; i += 1) this.tableB[i] = samples[i];
        this.morph = 0;
      }
      if (data.type === 'params') {
        if (typeof data.frequency === 'number') this.frequency = data.frequency;
        if (typeof data.gain === 'number') this.gain = data.gain;
        if (typeof data.active === 'boolean') this.active = data.active;
        if (typeof data.morphSpeed === 'number') this.morphSpeed = data.morphSpeed;
      }
    };
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'frequency',
        defaultValue: 110,
        minValue: 20,
        maxValue: 4000,
        automationRate: 'a-rate',
      },
      {
        name: 'gain',
        defaultValue: 0.3,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ];
  }

  /**
   * @param {Float32Array} table
   * @param {number} phase 0..1
   */
  sample(table, phase) {
    const size = this.tableSize;
    const pos = phase * size;
    const i0 = Math.floor(pos) % size;
    const i1 = (i0 + 1) % size;
    const frac = pos - Math.floor(pos);
    return table[i0] * (1 - frac) + table[i1] * frac;
  }

  process(_inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const channel = output[0];
    const freqParam = parameters.frequency;
    const gainParam = parameters.gain;
    const constFreq = freqParam.length === 1;
    const constGain = gainParam.length === 1;
    const sr = sampleRate;

    for (let i = 0; i < channel.length; i += 1) {
      if (this.morph < 1) {
        this.morph = Math.min(1, this.morph + this.morphSpeed);
      }

      const freq = constFreq ? freqParam[0] : freqParam[i];
      const gain = constGain ? gainParam[0] : gainParam[i];
      this.frequency = freq;
      this.gain = gain;

      if (!this.active || gain <= 0.0001) {
        channel[i] = 0;
        this.phase += freq / sr;
        if (this.phase >= 1) this.phase -= Math.floor(this.phase);
        continue;
      }

      const a = this.sample(this.tableA, this.phase);
      const b = this.sample(this.tableB, this.phase);
      const m = this.morph;
      channel[i] = (a * (1 - m) + b * m) * gain;

      this.phase += freq / sr;
      if (this.phase >= 1) this.phase -= Math.floor(this.phase);
    }

    // Mirror to other channels if stereo
    for (let c = 1; c < output.length; c += 1) {
      output[c].set(channel);
    }
    return true;
  }
}

registerProcessor('wavetable-processor', WavetableProcessor);
