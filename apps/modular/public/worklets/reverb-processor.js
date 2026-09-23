/**
 * Algorithmic reverb: Freeverb-style comb/allpass network.
 * Algorithms (room/hall/plate/freeverb) change delay lengths via port message.
 */
class ReverbProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.algorithm = 'hall';
    this.size = 0.55;
    this.decay = 0.5;
    this.damping = 0.45;
    this.initBuffers('hall');

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'algorithm' && typeof data.algorithm === 'string') {
        if (data.algorithm !== this.algorithm) {
          this.initBuffers(data.algorithm);
        }
      }
    };
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'size',
        defaultValue: 0.55,
        minValue: 0.05,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'decay',
        defaultValue: 0.5,
        minValue: 0.05,
        maxValue: 0.98,
        automationRate: 'k-rate',
      },
      {
        name: 'damping',
        defaultValue: 0.45,
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

  /** @param {string} algo */
  combBase(algo) {
    if (algo === 'room') return [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
    if (algo === 'plate') return [1557, 1617, 1780, 1900, 2011, 2140, 2250, 2390];
    if (algo === 'freeverb')
      return [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
    return [1800, 1950, 2100, 2250, 2400, 2550, 2700, 2850];
  }

  /** @param {string} algo */
  allpassBase(algo) {
    if (algo === 'room') return [225, 341, 441, 556];
    if (algo === 'plate') return [556, 441, 341, 225];
    if (algo === 'freeverb') return [225, 556, 441, 341];
    return [556, 441, 341, 225];
  }

  /** @param {string} algo */
  initBuffers(algo) {
    this.algorithm = algo;
    const scale = sampleRate / 44100;
    const combs = this.combBase(algo);
    const aps = this.allpassBase(algo);

    this.combsL = combs.map((n) => ({
      buf: new Float32Array(Math.max(16, Math.floor(n * scale))),
      idx: 0,
      filter: 0,
    }));
    this.combsR = combs.map((n, i) => ({
      buf: new Float32Array(
        Math.max(16, Math.floor((n + 23 * (i + 1)) * scale)),
      ),
      idx: 0,
      filter: 0,
    }));
    this.allpassL = aps.map((n) => ({
      buf: new Float32Array(Math.max(8, Math.floor(n * scale))),
      idx: 0,
    }));
    this.allpassR = aps.map((n) => ({
      buf: new Float32Array(Math.max(8, Math.floor((n + 17) * scale))),
      idx: 0,
    }));
  }

  /**
   * @param {{buf: Float32Array, idx: number, filter: number}} comb
   * @param {number} input
   * @param {number} feedback
   * @param {number} damp
   */
  processComb(comb, input, feedback, damp) {
    const y = comb.buf[comb.idx];
    comb.filter = y * (1 - damp) + comb.filter * damp;
    comb.buf[comb.idx] = input + comb.filter * feedback;
    comb.idx = (comb.idx + 1) % comb.buf.length;
    return y;
  }

  /**
   * @param {{buf: Float32Array, idx: number}} ap
   * @param {number} input
   */
  processAllpass(ap, input) {
    const bufOut = ap.buf[ap.idx];
    const out = -input + bufOut;
    ap.buf[ap.idx] = input + bufOut * 0.5;
    ap.idx = (ap.idx + 1) % ap.buf.length;
    return out;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const enabled = (parameters.enabled[0] ?? 0) > 0.5;
    if (!enabled || !input || !input[0]) {
      for (let c = 0; c < output.length; c += 1) {
        if (input && input[c]) output[c].set(input[c]);
        else output[c].fill(0);
      }
      return true;
    }

    const size = parameters.size[0] ?? this.size;
    const decay = parameters.decay[0] ?? this.decay;
    const damping = parameters.damping[0] ?? this.damping;
    const feedback = Math.min(0.97, decay * (0.7 + size * 0.28));
    const damp = 0.15 + damping * 0.8;

    const leftIn = input[0];
    const rightIn = input[1] || input[0];
    const leftOut = output[0];
    const rightOut = output[1] || output[0];

    for (let i = 0; i < leftOut.length; i += 1) {
      let l = 0;
      let r = 0;
      const xinL = leftIn[i] ?? 0;
      const xinR = rightIn[i] ?? 0;

      for (let c = 0; c < this.combsL.length; c += 1) {
        l += this.processComb(this.combsL[c], xinL, feedback, damp);
        r += this.processComb(this.combsR[c], xinR, feedback, damp);
      }
      l *= 0.12;
      r *= 0.12;

      for (let a = 0; a < this.allpassL.length; a += 1) {
        l = this.processAllpass(this.allpassL[a], l);
        r = this.processAllpass(this.allpassR[a], r);
      }

      leftOut[i] = l;
      if (output.length > 1) rightOut[i] = r;
    }
    return true;
  }
}

registerProcessor('reverb-processor', ReverbProcessor);
