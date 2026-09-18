# Changelog

All notable changes to Mutating Waveform Synth are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
