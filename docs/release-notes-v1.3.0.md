# Mutating Waveform family — v1.3.0

Three apps, one release tag.

| App | What it is | Platforms |
| --- | --- | --- |
| **Mutating Waveform Synth** | Formula wavetable synth | macOS (arm64 + x64), Linux, Windows, **Android APK** |
| **Mutating Pattern Sequencer** | Generative MIDI sequencer companion | macOS (arm64 + x64), Linux, Windows |
| **Mutating Modular** | Mono modular node patcher | macOS (arm64 + x64), Linux, Windows |

### Try in the browser

- [Synth live demo](https://ciaccodavi.de/projects/mutating-waveform-synth)

### Highlights

- **Mutating Modular** — React Flow patch bay with Voice / Effects / Timing modules
- **Turing** + **Euclid** sequencers, richer Osc/LFO (pulse, fold, FM, bipolar)
- **Expanded** inline controls, **Blueprints** that merge into your patch, factory presets
- Envelope attack timing fixed (linear ADSR with reliable times)

### Pairing tip (Sequencer ↔ Synth)

Use an OS MIDI loopback (**IAC** on macOS, **loopMIDI** on Windows), match channels, set the synth to **ADSR**. Prefer Chrome or Edge for Web MIDI.

### Changelog

Full notes: [CHANGELOG.md](https://github.com/CiaccoDavide/mutating-waveform-synth/blob/main/CHANGELOG.md)

---

MIT © CiaccoDavide
