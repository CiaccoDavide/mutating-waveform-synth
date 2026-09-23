# Changelog

All notable changes to Mutating Waveform Synth are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-09-23

### Added

- **Mutating Modular** companion (`apps/modular/`) — Vite + React Flow + Tauri mono modular patcher
- Modular **modules**: Osc, Env, Filter, VCA, Mixer, Noise, Out, Chorus, Delay, Reverb, Dist, Clock, Seq, Quant, LFO, S&H, Att, **Turing**, **Euclid**
- Osc extras: pulse / fold waves, pulse width, detune, 1-op FM; LFO extras: pulse / random / S&H waves, PW, uni/bi polarity
- Cable rules: same-kind ports, plus **audio → CV** modulation into float knobs
- **Expanded** mode — inline module params; compact chrome for denser patching; inspector when compact
- Palette **Modules / Blueprints / Presets** tabs; blueprints merge into the current graph
- Factory presets (Core, Bright lead, Self-play, Drifting drone, Dual mix, Noise & hold, Seq grit, Turing loop, Euclid pulse, PWM pad, Euclid + Turing, FM grit, Bipolar filter)
- Live env stage viz; Turing bit LEDs; Euclid pattern strip
- Root scripts: `mod:dev`, `mod:build`, `mod:tauri:dev`, `mod:tauri:build`
- Multi-app GitHub release builds for Synth, Sequencer, and Modular (desktop); Android APK for the Synth

### Fixed

- Envelope attack used analyser-lagged level on retrigger (sounded instant); ADSR times now use reliable stored values and linear ramps

### Changed

- Modular README and root docs cover the full module set, blueprints, and transport

## [1.2.0] - 2026-09-23

### Added

- **MIDI channel / input filter** on the synth (listen channel 1–16 + optional input port); persisted in presets (**schema v4**)
- **Mutating Pattern Sequencer** companion (`apps/sequencer/`) — Vite + React + Tauri app with Web MIDI out, transport clock, WebGL2 viz, and factory presets
- Sequencer engines: Linear, Radar, Bounce, Rain, Strings, Tree, Pulses, Ratchet, Cycles, Phrase, Arp, Brownian, Orbit, Cellular, Markov, Polyrhythm, Swarm, Pendulum, Lissajous, Ripple
- Sequencer transport **humanize** plus viz FX (**trail / bloom / vignette / flash**)
- Twin slider+number **ParamField** panels with per-engine **normalize** on preset load

### Changed

- Sequencer viz uses shared **WebGL2** scene renderer (soft particles, FBO trail, post grain); physics modes simulate on RAF `dt`
- Radar concentric Euclid rings; Strings waves + detector; polyphonic Linear steps; deeper Rain / Tree / Pulses / Bounce / Ratchet / Cycles settings
- Root scripts: `seq:dev`, `seq:build`, `seq:tauri:dev`, `seq:tauri:build`
- README docs for IAC Driver (macOS) and loopMIDI (Windows) pairing

## [1.1.3] - 2026-09-18

### Added

- Mobile Play surface — floating Play button with touch piano and just-intonation hexagonal lattice
- Live demo link in the README
- App subtitle shows the current version, linked to the GitHub changelog

### Changed

- Mobile layout puts the Formula panel first
- Web favicon uses the Tauri waveform mark; asset paths stay relative
- Android release CI uses `setup-android@v4` so the universal APK attaches to the GitHub release

## [1.1.2] - 2026-09-18

### Added

- Android APK packaging via Tauri (universal APK attached to GitHub Releases; sideload-signed for install)
- Android launcher icon uses the same Tauri waveform mark as desktop

## [1.1.1] - 2026-09-18

### Changed

- New desktop app icon — layered teal/amber mutating waveform mark for Tauri builds

## [1.1.0] - 2026-09-18

### Added

- **Post-filter FX bus** — chorus, delay (digital / ping-pong / tape), algorithmic reverb (room / hall / plate / freeverb) with wet/dry mix
- **Ladder filter** — 4-pole transistor-ladder stage (cutoff, resonance, drive) after the biquad bank
- **2-op FM** — global phase-modulation path (ratio + index) on wavetable voices; replaces the table while enabled
- **Effects panel** UI; ladder controls in Filters; FM controls in Formula
- **Character** formula presets (Ladder Saw, Acid Edge, Chorus Pulse, Electric Keys, Cinema Warm, Poly Brass)
- **Inspired by** factory instrument patches (Ladder Lead, Acid Squelch, Chorus Pad, Electric Keys, Cinema Pad, Poly Brass) using real DSP
- Auto-seed editable `seeded-*` copies of factory patches into localStorage (once per seed version)
- Harmony presets **Osc + Sub** and **Osc + Sub (−2)** with octave-stacked pairs when more voices are enabled
- ADSR arpeggiator gating for chord tones; Start is no longer required in ADSR mode (audio unlocks on note)

### Changed

- Preset schema **v3** (`effects`, `ladder`, `fm`); v2 snapshots still load with defaults
- Randomize controls are icon-only (no border)
- Brand meta under the title: GitHub · MIT · author links
- Factory patches retuned for ladder, chorus, delay, reverb, and FM where appropriate

## [1.0.1] - 2026-09-18

### Added

- Wave edit mode on the formula visualizer: place and drag control points, choose Linear / Smooth / Steps connections, then **Apply** to bake a formula
- **Steps** and **Linear** can export exact piecewise expressions (`step` / `lerp`) or a Fourier approximation; **Smooth** always approximates
- Edit-mode toggle: Exact vs Approximate export
- Formula language helpers: `step`, `clamp`, `lerp`, `mod`
- Click empty canvas to add points; drag to move; double-click or Alt-click to delete (minimum two points)
- Reset points from the current baked wave while editing
- This changelog

### Changed

- Version bump to 1.0.1 across npm, Tauri, and Cargo manifests

## [1.0.0] - 2026-09-18

### Added

- Initial release: formula wavetables, multi-LFO / sub-LFO mutators, 8 oscillators, series filters, drone / ADSR modes, MIDI and PC keyboard, presets, monitor strip
- Tauri desktop packaging for macOS (Apple Silicon + Intel), Linux, and Windows
- Multi-platform GitHub Actions release workflow
