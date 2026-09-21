# Changelog

All notable changes to Mutating Waveform Synth are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
