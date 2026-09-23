import type { Dispatch, SetStateAction } from 'react';
import type { EngineId } from '../engines/types';
import type { LinearState } from '../engines/linear';
import {
  normalizeLinear,
  normalizeLinearSteps,
} from '../engines/linear';
import type { RadarState } from '../engines/radar';
import { defaultRing } from '../engines/radar';
import type { BounceState, BouncePitchAxis } from '../engines/bounce';
import type { RainState } from '../engines/rain';
import type { StringsState, DetectorMode } from '../engines/strings';
import type { TreeState } from '../engines/tree';
import type { PulsesState } from '../engines/pulses';
import type { RatchetState } from '../engines/ratchet';
import type { CyclesState } from '../engines/cycles';
import { defaultCycle } from '../engines/cycles';
import type { PhraseState, PhraseShape } from '../engines/phrase';
import type { ArpState, ArpPattern } from '../engines/arp';
import type { BrownianState } from '../engines/brownian';
import type { OrbitState } from '../engines/orbit';
import type { CellularState } from '../engines/cellular';
import type { MarkovState } from '../engines/markov';
import type { PolyrhythmState } from '../engines/polyrhythm';
import { defaultLane } from '../engines/polyrhythm';
import type { SwarmState } from '../engines/swarm';
import type { PendulumState } from '../engines/pendulum';
import type { LissajousState } from '../engines/lissajous';
import type { RippleState } from '../engines/ripple';
import {
  BoolParam,
  EnumParam,
  NumParam,
  ParamSection,
  TextParam,
  parseDegreesCsv,
} from './ParamField';

type Set<T> = Dispatch<SetStateAction<T>>;

export interface EngineParamsProps {
  engineId: EngineId;
  linear: LinearState;
  setLinear: Set<LinearState>;
  radar: RadarState;
  setRadar: Set<RadarState>;
  bounce: BounceState;
  setBounce: Set<BounceState>;
  rain: RainState;
  setRain: Set<RainState>;
  strings: StringsState;
  setStrings: Set<StringsState>;
  tree: TreeState;
  setTree: Set<TreeState>;
  pulses: PulsesState;
  setPulses: Set<PulsesState>;
  ratchet: RatchetState;
  setRatchet: Set<RatchetState>;
  cycles: CyclesState;
  setCycles: Set<CyclesState>;
  phrase: PhraseState;
  setPhrase: Set<PhraseState>;
  arp: ArpState;
  setArp: Set<ArpState>;
  brownian: BrownianState;
  setBrownian: Set<BrownianState>;
  orbit: OrbitState;
  setOrbit: Set<OrbitState>;
  cellular: CellularState;
  setCellular: Set<CellularState>;
  markov: MarkovState;
  setMarkov: Set<MarkovState>;
  polyrhythm: PolyrhythmState;
  setPolyrhythm: Set<PolyrhythmState>;
  swarm: SwarmState;
  setSwarm: Set<SwarmState>;
  pendulum: PendulumState;
  setPendulum: Set<PendulumState>;
  lissajous: LissajousState;
  setLissajous: Set<LissajousState>;
  ripple: RippleState;
  setRipple: Set<RippleState>;
}

export function EngineParams(p: EngineParamsProps) {
  const { engineId } = p;

  if (engineId === 'linear') {
    return (
      <div className="engine-params">
        <ParamSection title="Pattern">
          <NumParam
            label="Steps"
            integer
            min={1}
            max={32}
            step={1}
            value={p.linear.length}
            onChange={(length) =>
              p.setLinear((s) =>
                normalizeLinear({
                  ...s,
                  length,
                  steps: normalizeLinearSteps(
                    Array.from({ length }, (_, i) => s.steps[i] ?? [i % 8]),
                    length,
                  ),
                }),
              )
            }
          />
          <NumParam
            label="Division"
            integer
            min={1}
            max={8}
            step={1}
            value={p.linear.division}
            onChange={(division) => p.setLinear((s) => ({ ...s, division }))}
          />
          <NumParam
            label="Probability"
            min={0}
            max={1}
            step={0.01}
            value={p.linear.probability}
            onChange={(probability) =>
              p.setLinear((s) => ({ ...s, probability }))
            }
          />
        </ParamSection>
        <ParamSection title="Tone">
          <NumParam
            label="Oct spread"
            integer
            min={0}
            max={2}
            step={1}
            value={p.linear.octaveSpread}
            onChange={(octaveSpread) =>
              p.setLinear((s) => ({ ...s, octaveSpread }))
            }
          />
          <NumParam
            label="Mutate"
            min={0}
            max={1}
            step={0.01}
            value={p.linear.mutate}
            onChange={(mutate) => p.setLinear((s) => ({ ...s, mutate }))}
          />
        </ParamSection>
        <div className="row" style={{ marginTop: '0.5rem' }}>
          {normalizeLinearSteps(p.linear.steps, p.linear.length).map(
            (cell, i) => (
              <button
                key={i}
                type="button"
                className="btn"
                title="Click to cycle degree / rest"
                onClick={() => {
                  p.setLinear((s) => {
                    const steps = normalizeLinearSteps(s.steps, s.length);
                    const cur = steps[i]?.[0];
                    const next =
                      cur === undefined ? [0] : cur >= 7 ? [] : [cur + 1];
                    steps[i] = next;
                    return { ...s, steps };
                  });
                }}
              >
                {cell.length ? cell.join('+') : '·'}
              </button>
            ),
          )}
        </div>
      </div>
    );
  }

  if (engineId === 'radar') {
    return (
      <div className="engine-params">
        <ParamSection title="Pattern">
          <NumParam
            label="Rings"
            integer
            min={1}
            max={6}
            step={1}
            value={p.radar.rings.length}
            onChange={(n) =>
              p.setRadar((s) => {
                const rings = s.rings.slice(0, n);
                while (rings.length < n) rings.push(defaultRing(rings.length));
                return { ...s, rings };
              })
            }
          />
          <BoolParam
            label="Sync phase"
            value={p.radar.sync}
            onChange={(sync) => p.setRadar((s) => ({ ...s, sync }))}
          />
        </ParamSection>
        {p.radar.rings.map((ring, ri) => (
          <ParamSection key={ri} title={`Ring ${ri + 1}`}>
            <BoolParam
              label="Mute"
              value={ring.muted}
              onChange={(muted) =>
                p.setRadar((s) => ({
                  ...s,
                  rings: s.rings.map((r, i) =>
                    i === ri ? { ...r, muted } : r,
                  ),
                }))
              }
            />
            <NumParam
              label="Steps"
              integer
              min={2}
              max={32}
              step={1}
              value={ring.steps}
              onChange={(steps) =>
                p.setRadar((s) => ({
                  ...s,
                  rings: s.rings.map((r, i) =>
                    i === ri ? { ...r, steps } : r,
                  ),
                }))
              }
            />
            <NumParam
              label="Hits"
              integer
              min={0}
              max={32}
              step={1}
              value={ring.hits}
              onChange={(hits) =>
                p.setRadar((s) => ({
                  ...s,
                  rings: s.rings.map((r, i) =>
                    i === ri ? { ...r, hits } : r,
                  ),
                }))
              }
            />
            <NumParam
              label="Beats/rev"
              min={0.5}
              max={32}
              step={0.5}
              value={ring.beatsPerRev}
              onChange={(beatsPerRev) =>
                p.setRadar((s) => ({
                  ...s,
                  rings: s.rings.map((r, i) =>
                    i === ri ? { ...r, beatsPerRev } : r,
                  ),
                }))
              }
            />
            <TextParam
              label="Notes"
              value={ring.notes.join(',')}
              title="Scale degrees"
              onChange={(raw) => {
                const notes = parseDegreesCsv(raw);
                p.setRadar((s) => ({
                  ...s,
                  rings: s.rings.map((r, i) =>
                    i === ri
                      ? { ...r, notes: notes.length ? notes : [0] }
                      : r,
                  ),
                }));
              }}
            />
          </ParamSection>
        ))}
      </div>
    );
  }

  if (engineId === 'bounce') {
    return (
      <div className="engine-params">
        <ParamSection title="Motion">
          <NumParam label="Spheres" integer min={1} max={16} step={1} value={p.bounce.count} onChange={(count) => p.setBounce((s) => ({ ...s, count }))} />
          <NumParam label="Speed" min={0.1} max={3} step={0.05} value={p.bounce.speed} onChange={(speed) => p.setBounce((s) => ({ ...s, speed }))} />
          <NumParam label="Gravity" min={0} max={2} step={0.05} value={p.bounce.gravity} onChange={(gravity) => p.setBounce((s) => ({ ...s, gravity }))} />
          <NumParam label="Elasticity" min={0.2} max={1.2} step={0.02} value={p.bounce.elasticity} onChange={(elasticity) => p.setBounce((s) => ({ ...s, elasticity }))} />
          <NumParam label="Radius" min={0.015} max={0.1} step={0.005} value={p.bounce.radius} onChange={(radius) => p.setBounce((s) => ({ ...s, radius }))} />
          <NumParam label="Chaos" min={0} max={1} step={0.01} value={p.bounce.chaos} onChange={(chaos) => p.setBounce((s) => ({ ...s, chaos }))} />
        </ParamSection>
        <ParamSection title="Tone">
          <EnumParam
            label="Pitch axis"
            value={p.bounce.pitchAxis}
            options={[
              { value: 'x', label: 'X' },
              { value: 'y', label: 'Y' },
              { value: 'both', label: 'Both' },
            ]}
            onChange={(v) =>
              p.setBounce((s) => ({
                ...s,
                pitchAxis: v as BouncePitchAxis,
              }))
            }
          />
          <NumParam label="Trail boost" min={0} max={0.5} step={0.02} value={p.bounce.trailBoost} onChange={(trailBoost) => p.setBounce((s) => ({ ...s, trailBoost }))} />
          <BoolParam label="Multi chord" value={p.bounce.chordOnMulti} onChange={(chordOnMulti) => p.setBounce((s) => ({ ...s, chordOnMulti }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'rain') {
    return (
      <div className="engine-params">
        <ParamSection title="Motion">
          <NumParam label="Density" min={0.02} max={1} step={0.01} value={p.rain.density} onChange={(density) => p.setRain((s) => ({ ...s, density }))} />
          <NumParam label="Fall speed" min={0.2} max={3} step={0.05} value={p.rain.fallSpeed} onChange={(fallSpeed) => p.setRain((s) => ({ ...s, fallSpeed }))} />
          <NumParam label="Lanes" integer min={2} max={24} step={1} value={p.rain.lanes} onChange={(lanes) => p.setRain((s) => ({ ...s, lanes }))} />
          <NumParam label="Wind" min={-1} max={1} step={0.05} value={p.rain.wind} onChange={(wind) => p.setRain((s) => ({ ...s, wind }))} />
          <NumParam label="Gravity" min={0} max={2} step={0.05} value={p.rain.gravity} onChange={(gravity) => p.setRain((s) => ({ ...s, gravity }))} />
        </ParamSection>
        <ParamSection title="Tone">
          <NumParam label="Splash" min={0} max={1} step={0.05} value={p.rain.splashChance} onChange={(splashChance) => p.setRain((s) => ({ ...s, splashChance }))} />
          <NumParam label="Chord" integer min={0} max={6} step={1} value={p.rain.chordSpread} onChange={(chordSpread) => p.setRain((s) => ({ ...s, chordSpread }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'strings') {
    return (
      <div className="engine-params">
        <ParamSection title="Waves">
          <NumParam label="Count" integer min={2} max={12} step={1} value={p.strings.count} onChange={(count) => p.setStrings((s) => ({ ...s, count }))} />
          <NumParam label="Roughness" min={0} max={1} step={0.01} value={p.strings.roughness} onChange={(roughness) => p.setStrings((s) => ({ ...s, roughness }))} />
          <NumParam label="Drift" min={0} max={1} step={0.01} value={p.strings.drift} onChange={(drift) => p.setStrings((s) => ({ ...s, drift }))} />
          <NumParam label="Amplitude" min={0.2} max={2} step={0.05} value={p.strings.amplitude} onChange={(amplitude) => p.setStrings((s) => ({ ...s, amplitude }))} />
          <NumParam label="Wavelength" min={0.25} max={2.5} step={0.05} value={p.strings.wavelength} onChange={(wavelength) => p.setStrings((s) => ({ ...s, wavelength }))} />
          <NumParam label="Harmonics" min={0} max={1} step={0.05} value={p.strings.harmonics} onChange={(harmonics) => p.setStrings((s) => ({ ...s, harmonics }))} />
        </ParamSection>
        <ParamSection title="Detector">
          <EnumParam
            label="Mode"
            value={p.strings.mode}
            options={[
              { value: 'line', label: 'Scan line' },
              { value: 'points', label: 'Points' },
            ]}
            onChange={(v) =>
              p.setStrings((s) => ({ ...s, mode: v as DetectorMode }))
            }
          />
          <NumParam label="Scan speed" min={0.05} max={0.8} step={0.01} value={p.strings.scanSpeed} onChange={(scanSpeed) => p.setStrings((s) => ({ ...s, scanSpeed }))} />
          <NumParam label="Threshold" min={0.01} max={0.15} step={0.005} value={p.strings.threshold} onChange={(threshold) => p.setStrings((s) => ({ ...s, threshold }))} />
          {p.strings.mode === 'points' && (
            <NumParam label="Points" integer min={1} max={8} step={1} value={p.strings.pointCount} onChange={(pointCount) => p.setStrings((s) => ({ ...s, pointCount }))} />
          )}
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'tree') {
    return (
      <div className="engine-params">
        <ParamSection title="Pattern">
          <NumParam label="Depth" integer min={2} max={12} step={1} value={p.tree.depth} onChange={(depth) => p.setTree((s) => ({ ...s, depth }))} />
          <NumParam label="Branches" integer min={1} max={8} step={1} value={p.tree.branchCount} onChange={(branchCount) => p.setTree((s) => ({ ...s, branchCount }))} />
          <NumParam label="Division" integer min={1} max={8} step={1} value={p.tree.tempoDivision} onChange={(tempoDivision) => p.setTree((s) => ({ ...s, tempoDivision }))} />
          <NumParam label="Split" min={0} max={1} step={0.01} value={p.tree.splitChance} onChange={(splitChance) => p.setTree((s) => ({ ...s, splitChance }))} />
          <NumParam label="Prune" min={0} max={0.8} step={0.01} value={p.tree.pruneChance} onChange={(pruneChance) => p.setTree((s) => ({ ...s, pruneChance }))} />
        </ParamSection>
        <ParamSection title="Tone">
          <NumParam label="Degree step" integer min={1} max={5} step={1} value={p.tree.degreeStep} onChange={(degreeStep) => p.setTree((s) => ({ ...s, degreeStep }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'pulses') {
    return (
      <div className="engine-params">
        <ParamSection title="Pattern">
          <NumParam label="Steps" integer min={2} max={64} step={1} value={p.pulses.steps} onChange={(steps) => p.setPulses((s) => ({ ...s, steps }))} />
          <NumParam label="Pulses" integer min={0} max={64} step={1} value={p.pulses.pulses} onChange={(pulses) => p.setPulses((s) => ({ ...s, pulses }))} />
          <NumParam label="Rotate" integer min={0} max={64} step={1} value={p.pulses.rotate} onChange={(rotate) => p.setPulses((s) => ({ ...s, rotate }))} />
          <NumParam label="Division" integer min={1} max={8} step={1} value={p.pulses.division} onChange={(division) => p.setPulses((s) => ({ ...s, division }))} />
          <NumParam label="Probability" min={0} max={1} step={0.01} value={p.pulses.probability} onChange={(probability) => p.setPulses((s) => ({ ...s, probability }))} />
          <BoolParam label="Rotate on loop" value={p.pulses.rotateOnLoop} onChange={(rotateOnLoop) => p.setPulses((s) => ({ ...s, rotateOnLoop }))} />
        </ParamSection>
        <ParamSection title="Tone">
          <TextParam
            label="Notes"
            value={p.pulses.notes.join(',')}
            onChange={(raw) => {
              const notes = parseDegreesCsv(raw);
              p.setPulses((s) => ({
                ...s,
                notes: notes.length ? notes : [0],
              }));
            }}
          />
          <NumParam label="Accent every" integer min={0} max={32} step={1} value={p.pulses.accentEvery} onChange={(accentEvery) => p.setPulses((s) => ({ ...s, accentEvery }))} />
          <NumParam label="Gate skew" min={0} max={1} step={0.01} value={p.pulses.gateSkew} onChange={(gateSkew) => p.setPulses((s) => ({ ...s, gateSkew }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'ratchet') {
    return (
      <div className="engine-params">
        <ParamSection title="Pattern">
          <NumParam label="Steps" integer min={2} max={64} step={1} value={p.ratchet.steps} onChange={(steps) => p.setRatchet((s) => ({ ...s, steps }))} />
          <NumParam label="Pulses" integer min={0} max={64} step={1} value={p.ratchet.pulses} onChange={(pulses) => p.setRatchet((s) => ({ ...s, pulses }))} />
          <NumParam label="Rotate" integer min={0} max={64} step={1} value={p.ratchet.rotate} onChange={(rotate) => p.setRatchet((s) => ({ ...s, rotate }))} />
          <NumParam label="Repeats" integer min={0} max={12} step={1} value={p.ratchet.repeats} onChange={(repeats) => p.setRatchet((s) => ({ ...s, repeats }))} />
        </ParamSection>
        <ParamSection title="Burst">
          <NumParam label="Ramp" min={0} max={1} step={0.01} value={p.ratchet.repeatRamp} onChange={(repeatRamp) => p.setRatchet((s) => ({ ...s, repeatRamp }))} />
          <NumParam label="Spacing ms" integer min={5} max={200} step={1} value={p.ratchet.repeatSpacingMs} onChange={(repeatSpacingMs) => p.setRatchet((s) => ({ ...s, repeatSpacingMs }))} />
          <NumParam label="Accel" min={0} max={1} step={0.01} value={p.ratchet.accel} onChange={(accel) => p.setRatchet((s) => ({ ...s, accel }))} />
          <NumParam label="Vel decay" min={0} max={0.8} step={0.01} value={p.ratchet.velDecay} onChange={(velDecay) => p.setRatchet((s) => ({ ...s, velDecay }))} />
          <TextParam
            label="Notes"
            value={p.ratchet.notes.join(',')}
            onChange={(raw) => {
              const notes = parseDegreesCsv(raw);
              p.setRatchet((s) => ({
                ...s,
                notes: notes.length ? notes : [0],
              }));
            }}
          />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'cycles') {
    return (
      <div className="engine-params">
        <ParamSection title="Morph">
          <NumParam
            label="Cycle count"
            integer
            min={2}
            max={8}
            step={1}
            value={p.cycles.cycles.length}
            onChange={(n) =>
              p.setCycles((s) => {
                const next = s.cycles.slice(0, n);
                while (next.length < n) next.push(defaultCycle(next.length));
                return {
                  ...s,
                  cycles: next,
                  cycleIndex: s.cycleIndex % n,
                };
              })
            }
          />
          <NumParam label="Morph" min={0} max={1} step={0.01} value={p.cycles.morphAmount} onChange={(morphAmount) => p.setCycles((s) => ({ ...s, morphAmount }))} />
          <NumParam label="Hold loops" integer min={1} max={16} step={1} value={p.cycles.holdCycles} onChange={(holdCycles) => p.setCycles((s) => ({ ...s, holdCycles }))} />
        </ParamSection>
        <p className="hint">
          Active {p.cycles.cycleIndex + 1}/{p.cycles.cycles.length}
        </p>
        {p.cycles.cycles.map((c, i) => (
          <ParamSection key={i} title={`Cycle ${i + 1}`}>
            <NumParam label="Steps" integer min={2} max={32} step={1} value={c.steps} onChange={(steps) => p.setCycles((s) => ({ ...s, cycles: s.cycles.map((x, j) => (j === i ? { ...x, steps } : x)) }))} />
            <NumParam label="Pulses" integer min={0} max={32} step={1} value={c.pulses} onChange={(pulses) => p.setCycles((s) => ({ ...s, cycles: s.cycles.map((x, j) => (j === i ? { ...x, pulses } : x)) }))} />
            <NumParam label="Rotate" integer min={0} max={32} step={1} value={c.rotate} onChange={(rotate) => p.setCycles((s) => ({ ...s, cycles: s.cycles.map((x, j) => (j === i ? { ...x, rotate } : x)) }))} />
            <NumParam label="Degree" integer min={0} max={11} step={1} value={c.degreeBase} onChange={(degreeBase) => p.setCycles((s) => ({ ...s, cycles: s.cycles.map((x, j) => (j === i ? { ...x, degreeBase } : x)) }))} />
          </ParamSection>
        ))}
      </div>
    );
  }

  if (engineId === 'phrase') {
    return (
      <div className="engine-params">
        <ParamSection title="Pattern">
          <NumParam label="Steps" integer min={2} max={64} step={1} value={p.phrase.steps} onChange={(steps) => p.setPhrase((s) => ({ ...s, steps }))} />
          <NumParam label="Pulses" integer min={0} max={64} step={1} value={p.phrase.pulses} onChange={(pulses) => p.setPhrase((s) => ({ ...s, pulses }))} />
          <NumParam label="Rotate" integer min={0} max={64} step={1} value={p.phrase.rotate} onChange={(rotate) => p.setPhrase((s) => ({ ...s, rotate }))} />
          <NumParam label="Length (beats)" min={1} max={64} step={0.5} value={p.phrase.phraseLength} onChange={(phraseLength) => p.setPhrase((s) => ({ ...s, phraseLength }))} />
        </ParamSection>
        <ParamSection title="Tone">
          <NumParam label="Deg min" integer min={0} max={14} step={1} value={p.phrase.degMin} onChange={(degMin) => p.setPhrase((s) => ({ ...s, degMin }))} />
          <NumParam label="Deg max" integer min={0} max={14} step={1} value={p.phrase.degMax} onChange={(degMax) => p.setPhrase((s) => ({ ...s, degMax }))} />
          <EnumParam
            label="Shape"
            value={p.phrase.shape}
            options={[
              { value: 'saw', label: 'Saw' },
              { value: 'tri', label: 'Tri' },
              { value: 'sine', label: 'Sine' },
              { value: 'random', label: 'Random' },
            ]}
            onChange={(v) =>
              p.setPhrase((s) => ({ ...s, shape: v as PhraseShape }))
            }
          />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'arp') {
    return (
      <div className="engine-params">
        <ParamSection title="Pattern">
          <EnumParam
            label="Pattern"
            value={p.arp.pattern}
            options={[
              { value: 'up', label: 'Up' },
              { value: 'down', label: 'Down' },
              { value: 'updown', label: 'Up-down' },
              { value: 'random', label: 'Random' },
            ]}
            onChange={(v) =>
              p.setArp((s) => ({ ...s, pattern: v as ArpPattern }))
            }
          />
          <NumParam label="Rate" integer min={1} max={8} step={1} value={p.arp.rate} onChange={(rate) => p.setArp((s) => ({ ...s, rate }))} />
          <NumParam label="Octaves" integer min={0} max={3} step={1} value={p.arp.octaves} onChange={(octaves) => p.setArp((s) => ({ ...s, octaves }))} />
          <TextParam
            label="Degrees"
            value={p.arp.degrees.join(',')}
            onChange={(raw) => {
              const degrees = parseDegreesCsv(raw);
              p.setArp((s) => ({
                ...s,
                degrees: degrees.length ? degrees : [0],
              }));
            }}
          />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'brownian') {
    return (
      <div className="engine-params">
        <ParamSection title="Walk">
          <NumParam label="Step size" integer min={1} max={6} step={1} value={p.brownian.stepSize} onChange={(stepSize) => p.setBrownian((s) => ({ ...s, stepSize }))} />
          <NumParam label="Inertia" min={0} max={0.95} step={0.01} value={p.brownian.inertia} onChange={(inertia) => p.setBrownian((s) => ({ ...s, inertia }))} />
          <NumParam label="Hold" min={0} max={0.95} step={0.01} value={p.brownian.hold} onChange={(hold) => p.setBrownian((s) => ({ ...s, hold }))} />
          <NumParam label="Rate" integer min={1} max={8} step={1} value={p.brownian.rate} onChange={(rate) => p.setBrownian((s) => ({ ...s, rate }))} />
          <NumParam label="Start deg" integer min={0} max={11} step={1} value={p.brownian.startDeg} onChange={(startDeg) => p.setBrownian((s) => ({ ...s, startDeg }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'orbit') {
    return (
      <div className="engine-params">
        <ParamSection title="Motion">
          <NumParam label="Bodies" integer min={1} max={12} step={1} value={p.orbit.count} onChange={(count) => p.setOrbit((s) => ({ ...s, count }))} />
          <NumParam label="Speed" min={0.05} max={2} step={0.05} value={p.orbit.baseSpeed} onChange={(baseSpeed) => p.setOrbit((s) => ({ ...s, baseSpeed }))} />
          <NumParam label="Spokes" integer min={2} max={24} step={1} value={p.orbit.spokeCount} onChange={(spokeCount) => p.setOrbit((s) => ({ ...s, spokeCount }))} />
          <NumParam label="Radius spread" min={0.08} max={0.45} step={0.01} value={p.orbit.radiusSpread} onChange={(radiusSpread) => p.setOrbit((s) => ({ ...s, radiusSpread }))} />
          <NumParam label="Align" min={0} max={1} step={0.05} value={p.orbit.alignChance} onChange={(alignChance) => p.setOrbit((s) => ({ ...s, alignChance }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'cellular') {
    return (
      <div className="engine-params">
        <ParamSection title="Automaton">
          <NumParam label="Rule" integer min={0} max={255} step={1} value={p.cellular.rule} onChange={(rule) => p.setCellular((s) => ({ ...s, rule }))} />
          <NumParam label="Width" integer min={4} max={48} step={1} value={p.cellular.width} onChange={(width) => p.setCellular((s) => ({ ...s, width }))} />
          <NumParam label="Density" min={0.05} max={0.95} step={0.01} value={p.cellular.density} onChange={(density) => p.setCellular((s) => ({ ...s, density }))} />
          <NumParam label="Rate" integer min={1} max={8} step={1} value={p.cellular.rate} onChange={(rate) => p.setCellular((s) => ({ ...s, rate }))} />
          <BoolParam label="Symmetry seed" value={p.cellular.symmetry} onChange={(symmetry) => p.setCellular((s) => ({ ...s, symmetry }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'markov') {
    return (
      <div className="engine-params">
        <ParamSection title="Chain">
          <NumParam label="Stay" min={0} max={0.9} step={0.01} value={p.markov.stay} onChange={(stay) => p.setMarkov((s) => ({ ...s, stay }))} />
          <NumParam label="Jump" min={0} max={0.9} step={0.01} value={p.markov.jump} onChange={(jump) => p.setMarkov((s) => ({ ...s, jump }))} />
          <NumParam label="Range" integer min={1} max={11} step={1} value={p.markov.range} onChange={(range) => p.setMarkov((s) => ({ ...s, range }))} />
          <NumParam label="Rate" integer min={1} max={8} step={1} value={p.markov.rate} onChange={(rate) => p.setMarkov((s) => ({ ...s, rate }))} />
          <NumParam label="Start deg" integer min={0} max={11} step={1} value={p.markov.startDeg} onChange={(startDeg) => p.setMarkov((s) => ({ ...s, startDeg }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'polyrhythm') {
    return (
      <div className="engine-params">
        <ParamSection title="Lanes">
          <NumParam
            label="Count"
            integer
            min={1}
            max={4}
            step={1}
            value={p.polyrhythm.lanes.length}
            onChange={(n) =>
              p.setPolyrhythm((s) => {
                const lanes = s.lanes.slice(0, n);
                while (lanes.length < n) lanes.push(defaultLane(lanes.length));
                return { lanes };
              })
            }
          />
        </ParamSection>
        {p.polyrhythm.lanes.map((lane, li) => (
          <ParamSection key={li} title={`Lane ${li + 1}`}>
            <NumParam label="Steps" integer min={2} max={32} step={1} value={lane.steps} onChange={(steps) => p.setPolyrhythm((s) => ({ lanes: s.lanes.map((x, i) => (i === li ? { ...x, steps } : x)) }))} />
            <NumParam label="Pulses" integer min={0} max={32} step={1} value={lane.pulses} onChange={(pulses) => p.setPolyrhythm((s) => ({ lanes: s.lanes.map((x, i) => (i === li ? { ...x, pulses } : x)) }))} />
            <NumParam label="Division" integer min={1} max={8} step={1} value={lane.division} onChange={(division) => p.setPolyrhythm((s) => ({ lanes: s.lanes.map((x, i) => (i === li ? { ...x, division } : x)) }))} />
            <NumParam label="Degree" integer min={0} max={11} step={1} value={lane.degreeBase} onChange={(degreeBase) => p.setPolyrhythm((s) => ({ lanes: s.lanes.map((x, i) => (i === li ? { ...x, degreeBase } : x)) }))} />
          </ParamSection>
        ))}
      </div>
    );
  }

  if (engineId === 'swarm') {
    return (
      <div className="engine-params">
        <ParamSection title="Motion">
          <NumParam label="Count" integer min={2} max={32} step={1} value={p.swarm.count} onChange={(count) => p.setSwarm((s) => ({ ...s, count }))} />
          <NumParam label="Speed" min={0.05} max={1.5} step={0.05} value={p.swarm.speed} onChange={(speed) => p.setSwarm((s) => ({ ...s, speed }))} />
          <NumParam label="Cohesion" min={0} max={1} step={0.01} value={p.swarm.cohesion} onChange={(cohesion) => p.setSwarm((s) => ({ ...s, cohesion }))} />
          <NumParam label="Separation" min={0} max={1} step={0.01} value={p.swarm.separation} onChange={(separation) => p.setSwarm((s) => ({ ...s, separation }))} />
          <NumParam label="Sense" min={0.02} max={0.3} step={0.01} value={p.swarm.sense} onChange={(sense) => p.setSwarm((s) => ({ ...s, sense }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'pendulum') {
    return (
      <div className="engine-params">
        <ParamSection title="Motion">
          <NumParam label="Count" integer min={1} max={10} step={1} value={p.pendulum.count} onChange={(count) => p.setPendulum((s) => ({ ...s, count }))} />
          <NumParam label="Length spread" min={0} max={1} step={0.01} value={p.pendulum.lengthSpread} onChange={(lengthSpread) => p.setPendulum((s) => ({ ...s, lengthSpread }))} />
          <NumParam label="Damping" min={0} max={0.5} step={0.01} value={p.pendulum.damping} onChange={(damping) => p.setPendulum((s) => ({ ...s, damping }))} />
          <NumParam label="Gravity" min={1} max={20} step={0.5} value={p.pendulum.gravity} onChange={(gravity) => p.setPendulum((s) => ({ ...s, gravity }))} />
          <BoolParam label="Sync chord" value={p.pendulum.chordOnSync} onChange={(chordOnSync) => p.setPendulum((s) => ({ ...s, chordOnSync }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'lissajous') {
    return (
      <div className="engine-params">
        <ParamSection title="Curve">
          <NumParam label="Ratio A" integer min={1} max={12} step={1} value={p.lissajous.ratioA} onChange={(ratioA) => p.setLissajous((s) => ({ ...s, ratioA }))} />
          <NumParam label="Ratio B" integer min={1} max={12} step={1} value={p.lissajous.ratioB} onChange={(ratioB) => p.setLissajous((s) => ({ ...s, ratioB }))} />
          <NumParam label="Phase" min={0} max={1} step={0.01} value={p.lissajous.phase} onChange={(phase) => p.setLissajous((s) => ({ ...s, phase }))} />
          <NumParam label="Speed" min={0.05} max={2} step={0.05} value={p.lissajous.speed} onChange={(speed) => p.setLissajous((s) => ({ ...s, speed }))} />
          <NumParam label="Lattice" integer min={2} max={12} step={1} value={p.lissajous.lattice} onChange={(lattice) => p.setLissajous((s) => ({ ...s, lattice }))} />
        </ParamSection>
      </div>
    );
  }

  if (engineId === 'ripple') {
    return (
      <div className="engine-params">
        <ParamSection title="Pattern">
          <NumParam label="Steps" integer min={2} max={64} step={1} value={p.ripple.steps} onChange={(steps) => p.setRipple((s) => ({ ...s, steps }))} />
          <NumParam label="Pulses" integer min={0} max={64} step={1} value={p.ripple.pulses} onChange={(pulses) => p.setRipple((s) => ({ ...s, pulses }))} />
          <NumParam label="Rotate" integer min={0} max={64} step={1} value={p.ripple.rotate} onChange={(rotate) => p.setRipple((s) => ({ ...s, rotate }))} />
          <NumParam label="Nodes" integer min={3} max={24} step={1} value={p.ripple.nodeCount} onChange={(nodeCount) => p.setRipple((s) => ({ ...s, nodeCount }))} />
          <NumParam label="Speed" min={0.1} max={2} step={0.05} value={p.ripple.speed} onChange={(speed) => p.setRipple((s) => ({ ...s, speed }))} />
        </ParamSection>
      </div>
    );
  }

  return null;
}
