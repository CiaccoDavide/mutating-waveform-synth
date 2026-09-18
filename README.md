# Mutating Waveform Synth

Formula-shaped wavetable synth: write an expression, morph it with nested LFOs, and voice it through harmonized oscillators, filters, and MIDI.

**v1.0.1** · [Releases](https://github.com/CiaccoDavide/mutating-waveform-synth/releases) · [Repository](https://github.com/CiaccoDavide/mutating-waveform-synth) · [Changelog](CHANGELOG.md)

![Mutating Waveform Synth UI with the Cascade complex formula](docs/screenshot.png)

## Features

- **Formula wavetables** — expressions in `x` (phase) and `t` (time), with pedagogical presets from static waves to complex nested modulators
- **Wave edit mode** — draw with control points (exact Steps/Linear formulas, Smooth via Fourier), then Apply
- **Time mutators** — up to 3 LFOs + sub-LFOs that warp phase, fold, amp, and morph rate, then re-bake the shared table
- **8 oscillators** — equal-temperament harmony or free frequencies, detune, gain, pan
- **Filters** — three series biquads with per-parameter LFOs
- **Play modes** — continuous drone (optional arpeggiator) or polyphonic ADSR
- **Input** — Web MIDI and PC keyboard (Z–M, octave via `,` / `.`)
- **Presets** — save / load / import / export JSON patches in the browser
- **Monitor strip** — scope, spectrum, spectrogram, LFO traces, voice activity, MIDI/KEY indicators
- **Desktop app** — packaged with [Tauri](https://tauri.app/) for macOS, Windows, and Linux

## Try it

| | |
| --- | --- |
| **Desktop** | Download the latest build from [Releases](https://github.com/CiaccoDavide/mutating-waveform-synth/releases) (macOS Apple Silicon + Intel, Linux, Windows) |
| **Web** | Build with `npm run build` and serve the `dist/` folder on your own host |

Click **Start** once to unlock the audio context (browser gesture required on the web build).

## Develop

```bash
npm install
npm run dev
```

Desktop (requires [Rust](https://rustup.rs/)):

```bash
npm run tauri:dev
```

Production web build (static files in `dist/`, relative asset paths):

```bash
npm run build
npm run preview
```

Desktop bundles:

```bash
npm run tauri:build
```

## Stack

- React 19 + Vite + TypeScript
- Web Audio API + AudioWorklet wavetable voices
- WebGL2 background visualizer
- Tiny formula compiler (`sin`, `cos`, `tanh`, …)
- Tauri 2 for native shells

## License

[MIT](LICENSE) © CiaccoDavide
