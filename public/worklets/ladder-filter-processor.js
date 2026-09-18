/**
 * Simplified 4-pole transistor-ladder lowpass with tanh nonlinearities.
 * Mono processing; stereo by processing L/R independently when present.
 */
class LadderFilterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.cutoff = 1800;
    this.resonance = 0.35;
    this.drive = 0.25;
    this.enabled = false;
    /** @type {Float64Array} */
    this.z1 = new Float64Array(4);
    /** @type {Float64Array} */
    this.z1R = new Float64Array(4);
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'cutoff',
        defaultValue: 1800,
        minValue: 40,
        maxValue: 16000,
        automationRate: 'k-rate',
      },
      {
        name: 'resonance',
        defaultValue: 0.35,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'drive',
        defaultValue: 0.25,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'enabled',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ];
  }

  /**
   * @param {Float64Array} state
   * @param {number} input
   * @param {number} g
   * @param {number} k
   * @param {number} driveAmt
   */
  processSample(state, input, g, k, driveAmt) {
    const drive = 1 + driveAmt * 4;
    const x = Math.tanh(input * drive) - k * state[3];
    // 4 one-pole stages
    for (let i = 0; i < 4; i += 1) {
      const prev = i === 0 ? x : state[i - 1];
      state[i] += g * (Math.tanh(prev) - Math.tanh(state[i]));
    }
    return state[3];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const enabled = (parameters.enabled[0] ?? 0) > 0.5;
    const cutoff = parameters.cutoff[0] ?? this.cutoff;
    const resonance = parameters.resonance[0] ?? this.resonance;
    const drive = parameters.drive[0] ?? this.drive;

    if (!enabled || !input || !input[0]) {
      for (let c = 0; c < output.length; c += 1) {
        if (input && input[c]) output[c].set(input[c]);
        else output[c].fill(0);
      }
      return true;
    }

    const sr = sampleRate;
    const fc = Math.max(40, Math.min(sr * 0.45, cutoff));
    // bilinear-ish coefficient
    const g = 1 - Math.exp((-2 * Math.PI * fc) / sr);
    const k = resonance * 3.8;

    const leftIn = input[0];
    const rightIn = input[1] || input[0];
    const leftOut = output[0];
    const rightOut = output[1] || output[0];

    for (let i = 0; i < leftOut.length; i += 1) {
      leftOut[i] = this.processSample(this.z1, leftIn[i] ?? 0, g, k, drive);
      if (output.length > 1) {
        rightOut[i] = this.processSample(
          this.z1R,
          rightIn[i] ?? 0,
          g,
          k,
          drive,
        );
      }
    }
    return true;
  }
}

registerProcessor('ladder-filter-processor', LadderFilterProcessor);
