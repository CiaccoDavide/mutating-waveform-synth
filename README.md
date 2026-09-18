# Mutating Waveform Drones

A browser-based drone instrument: math formulas become morphing wavetables for harmonized oscillators, with a WebGL audio visualizer.

## Stack

- React + Vite + TypeScript
- Web Audio API + AudioWorklet (custom wavetable voices)
- WebGL2 background visualizer
- Tiny formula expression compiler (`sin`, `cos`, `t`, …)

## Run

```bash
npm install
npm run dev
```

Click **Start Drone** to unlock the audio context (browser gesture required).

## Controls

- **Formula** — presets or an expression in `x` (phase 0…2π) and `t` (time)
- **Time Mutators** — LFO warp + morph rate that re-bakes the shared wavetable
- **Harmony** — root note/octave and ET interval sets
- **Oscillators** — up to 4 voices; harmonic or free frequency, detune, gain, pan
