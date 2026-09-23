# Mutating Pattern Sequencer

Companion MIDI sequencer for [Mutating Waveform Synth](../../README.md).

Sends Note On/Off over **Web MIDI** through an OS loopback (macOS **IAC Driver**, Windows **loopMIDI**). Match MIDI channel on both apps and set the synth to **ADSR**. Prefer **Chrome or Edge**.

There is no built-in virtual MIDI port.

## MIDI pairing

### macOS (IAC)

Chromium blocks MIDI when no devices exist (`Silently denying site request for MIDI access because no devices were detected`):

1. **Audio MIDI Setup** → Window → **Show MIDI Studio**
2. Double-click **IAC Driver** → enable **Device is online** (add a port if needed)
3. **Quit and reopen the browser**
4. Sequencer: Enable MIDI → select IAC as **MIDI out** → set channel
5. Synth: Enable MIDI → same IAC as **MIDI in** → same channel → **ADSR**

### Windows (loopMIDI)

1. Install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html), create a port
2. Restart the browser if needed
3. Sequencer MIDI out / synth MIDI in on that port; match channels; ADSR

## Engines

| Mode | Behavior |
| --- | --- |
| Linear | Polyphonic step grid + probability / division / mutate |
| Radar | Concentric Euclid donuts; sync phase / per-ring mute |
| Bouncing spheres | RAF physics; gravity / elasticity / pitch axis |
| Rain | Lane drops + wind / gravity / splash / chord |
| Strings | Random waves + scan line or detector points |
| Tree | Left→right branches; division / degree step / prune |
| Pulses | Euclid + accent / rotate-on-loop / gate skew |
| Ratchet | Pulse repeats with velocity ramp |
| Cycles | Parameter morphs each loop |
| Phrase | Pitch-range LFO over Euclid rhythm |
| Arp | Chord arpeggio patterns |
| Brownian | Scale-degree random walk |
| Orbit | Bodies cross spokes / align → notes |
| Cellular | 1D elementary CA rows → hits |
| Markov | Pitch chain with stay/jump bias |
| Polyrhythm | Stacked Euclid lanes (polyphonic) |
| Swarm | Boids; notes on neighbor approach |
| Pendulum | Multi pendulums; bottom / sync hits |
| Lissajous | a:b curve; axis + lattice hits |
| Ripple | Euclid emits rings that hit nodes |

Transport: BPM, swing, **humanize**, viz **trail / bloom / vignette**. Params use twin slider+number fields with clamp. Soft particles + FBO trail/bloom WebGL2. From the repo root: `npm run seq:dev` / `seq:build` / `seq:tauri:dev`.
