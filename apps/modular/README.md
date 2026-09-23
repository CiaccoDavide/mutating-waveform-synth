# Mutating Modular

Node-based **mono** modular synth. Companion to [Mutating Waveform Synth](../../README.md).

Built with React Flow + Web Audio + Tauri.

## Run

```bash
npm install --prefix apps/modular
npm run mod:dev          # http://localhost:1440
npm run mod:build
npm run mod:tauri:dev    # desktop shell
npm run mod:tauri:build
```

Or from `apps/modular/`: `npm install` then `npm run dev` / `tauri:dev` / `build`.

## Usage

1. **Play** starts clock modules; hold **Gate** (or **Space** / **G**) for a manual envelope when no gate cable is patched.
2. Left palette tabs:
   - **Modules** — drag Voice / Effects / Timing modules onto the canvas
   - **Blueprints** — merge small fragments into the current patch (placed to the right)
   - **Presets** — replace the whole graph with a factory or saved patch
3. Connect same-kind ports, or **audio → CV** to modulate float knobs (LFO / Osc into cutoff, PW, rate, etc.).
4. **Expanded** shows params on every module; compact mode uses the right inspector for the selection.
5. **Save** / **Copy JSON** / **Load JSON** for patch exchange. **Del** removes the selected module.

## Modules

### Voice

| Module | Role |
| --- | --- |
| Osc | Waves: sine / saw / square / tri / **pulse** / **fold**; PW, detune, 1-op FM; freq CV (Hz from Quant / Turing) |
| Env | ADSR CV; UI Gate or gate cable; live stage viz |
| Filter | Biquad LP / HP / BP |
| VCA | Gain, CV-scaled by level |
| Mixer | 4-in audio sum with per-channel + master levels |
| Noise | White / pink noise |
| Out | Master gain → speakers |

### Effects

| Module | Role |
| --- | --- |
| Chorus | Multi-tap modulated delay wet/dry |
| Delay | Mono digital delay + feedback + tone |
| Reverb | Freeverb worklet wet/dry |
| Dist | Waveshaper drive + dry/wet mix |

### Timing

| Module | Role |
| --- | --- |
| Clock | BPM gate pulses (driven by Play) |
| Seq | Step pitch + gate on clock |
| Quant | Scale-quantize degrees → Hz |
| LFO | Wave / rate / depth / offset; **pulse** / **random** / **S&H**; PW; uni/bi polarity |
| S&H | Sample input on gate → held CV |
| Att | Attenuverter (gain ±1 + offset); CV and audio outs |
| Turing | Probabilistic shift-register pitch + gate; lock / scale / root |
| Euclid | Bjorklund fills across steps; gate + step CV |

## Blueprints

Clicking a blueprint **adds** nodes (reminted ids) to the right of the current graph — it does not replace the patch. Examples: Voice chain, FX chain, Clock + Euclid, Clock + Turing, LFO sweep, Dual osc mix.

## Still mono

No polyphonic voice allocator — one voice path through Out.
