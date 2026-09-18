import {
  HARMONY_PRESETS,
  NOTE_NAMES,
  type HarmonyPresetId,
} from '../audio/HarmonyModel';
import {
  ARP_MODES,
  DEFAULT_ARP,
  type ArpMode,
  type ArpState,
} from '../audio/Arpeggiator';
import { DEFAULT_ADSR, type AdsrParams } from '../audio/Envelope';
import type { MidiStatus, PlayMode } from '../input/RootInput';
import { CollapsibleSection } from './CollapsibleSection';
import { RandomizeButton } from './RandomizeButton';
import { SliderField } from './SliderField';
import { randBool, randInt, randPick, randRange } from './random';

interface HarmonyControlsProps {
  rootNote: number;
  rootOctave: number;
  rootHz: number;
  harmonyId: HarmonyPresetId;
  masterVolume: number;
  audioOn: boolean;
  playMode: PlayMode;
  adsr: AdsrParams;
  arp: ArpState;
  midiStatus: MidiStatus;
  playOctave: number;
  onRootNoteChange: (note: number) => void;
  onRootOctaveChange: (octave: number) => void;
  onHarmonyChange: (id: HarmonyPresetId) => void;
  onMasterVolumeChange: (v: number) => void;
  onToggleAudio: () => void;
  onRandomizeSection: () => void;
  onPlayModeChange: (mode: PlayMode) => void;
  onAdsrChange: (next: AdsrParams) => void;
  onArpChange: (next: ArpState) => void;
  onEnableMidi: () => void;
}

export function HarmonyControls({
  rootNote,
  rootOctave,
  rootHz,
  harmonyId,
  masterVolume,
  audioOn,
  playMode,
  adsr,
  arp,
  midiStatus,
  playOctave,
  onRootNoteChange,
  onRootOctaveChange,
  onHarmonyChange,
  onMasterVolumeChange,
  onToggleAudio,
  onRandomizeSection,
  onPlayModeChange,
  onAdsrChange,
  onArpChange,
  onEnableMidi,
}: HarmonyControlsProps) {
  const isAdsr = playMode === 'adsr';
  const midiLabel =
    midiStatus === 'ready'
      ? 'MIDI ready'
      : midiStatus === 'denied'
        ? 'MIDI denied'
        : midiStatus === 'unsupported'
          ? 'No MIDI'
          : 'MIDI off';

  return (
    <CollapsibleSection
      mode="mobile"
      className="panel harmony-panel"
      title="Harmony"
      actions={
        <>
          <span className="panel-hint">{rootHz.toFixed(1)} Hz</span>
          <RandomizeButton
            title="Randomize harmony section"
            onClick={onRandomizeSection}
          />
        </>
      }
    >
      <div className="mode-toggle">
        <button
          type="button"
          className={`btn btn-ghost ${!isAdsr ? 'active' : ''}`}
          onClick={() => onPlayModeChange('drone')}
        >
          Drone
        </button>
        <button
          type="button"
          className={`btn btn-ghost ${isAdsr ? 'active' : ''}`}
          onClick={() => onPlayModeChange('adsr')}
        >
          ADSR
        </button>
      </div>

      <p className="panel-hint input-hint">
        {isAdsr
          ? `PC/MIDI play notes · polyphonic chords (oct ${playOctave})`
          : `PC keys Z–M · ,/. octave · MIDI sets root (oct ${playOctave})`}
      </p>

      <div className="field-row midi-row">
        <span className="panel-hint">{midiLabel}</span>
        {midiStatus !== 'ready' && midiStatus !== 'unsupported' && (
          <button type="button" className="btn btn-ghost" onClick={onEnableMidi}>
            Enable MIDI
          </button>
        )}
      </div>

      <div className="harmony-grid">
        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor="root-note">
              Root
            </label>
            <RandomizeButton
              compact
              title="Randomize root note"
              onClick={() => onRootNoteChange(randInt(0, NOTE_NAMES.length - 1))}
            />
          </div>
          <select
            id="root-note"
            value={rootNote}
            onChange={(e) => onRootNoteChange(Number(e.target.value))}
          >
            {NOTE_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor="root-octave">
              Octave
            </label>
            <RandomizeButton
              compact
              title="Randomize octave"
              onClick={() => onRootOctaveChange(randInt(1, 4))}
            />
          </div>
          <select
            id="root-octave"
            value={rootOctave}
            onChange={(e) => onRootOctaveChange(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-span">
          <div className="field-row">
            <label className="label" htmlFor="harmony">
              Intervals
            </label>
            <RandomizeButton
              compact
              title="Randomize interval set"
              onClick={() => onHarmonyChange(randPick(HARMONY_PRESETS).id)}
            />
          </div>
          <select
            id="harmony"
            value={harmonyId}
            onChange={(e) => onHarmonyChange(e.target.value as HarmonyPresetId)}
          >
            {HARMONY_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {(harmonyId === 'sub' || harmonyId === 'sub2') && (
            <p className="hint">
              Enable extra oscillators to stack more osc+sub pairs (each pair one
              octave higher).
            </p>
          )}
        </div>
      </div>

      {isAdsr && (
        <>
          <div className="panel-subheader">
            <span className="panel-title">Envelope</span>
            <RandomizeButton
              compact
              title="Randomize ADSR"
              onClick={() => onAdsrChange(randomAdsrState())}
            />
          </div>
          <SliderField
            id="adsr-a"
            label="Attack"
            value={adsr.attack}
            min={0.001}
            max={2}
            step={0.001}
            display={`${adsr.attack.toFixed(3)} s`}
            onChange={(attack) => onAdsrChange({ ...adsr, attack })}
          />
          <SliderField
            id="adsr-d"
            label="Decay"
            value={adsr.decay}
            min={0.001}
            max={2}
            step={0.001}
            display={`${adsr.decay.toFixed(3)} s`}
            onChange={(decay) => onAdsrChange({ ...adsr, decay })}
          />
          <SliderField
            id="adsr-s"
            label="Sustain"
            value={adsr.sustain}
            min={0}
            max={1}
            step={0.01}
            display={adsr.sustain.toFixed(2)}
            onChange={(sustain) => onAdsrChange({ ...adsr, sustain })}
          />
          <SliderField
            id="adsr-r"
            label="Release"
            value={adsr.release}
            min={0.001}
            max={4}
            step={0.001}
            display={`${adsr.release.toFixed(3)} s`}
            onChange={(release) => onAdsrChange({ ...adsr, release })}
          />
        </>
      )}

      <div className="panel-subheader">
        <span className="panel-title">Arpeggiator</span>
        <div className="panel-header-actions">
          <button
            type="button"
            className={`btn btn-ghost ${arp.enabled ? 'active' : ''}`}
            onClick={() => onArpChange({ ...arp, enabled: !arp.enabled })}
          >
            {arp.enabled ? 'On' : 'Off'}
          </button>
          <RandomizeButton
            compact
            title="Randomize arpeggiator"
            onClick={() => onArpChange(randomArpState())}
          />
        </div>
      </div>

      <div className="field">
        <div className="field-row">
          <label className="label" htmlFor="arp-mode">
            Pattern
          </label>
          <RandomizeButton
            compact
            disabled={!arp.enabled}
            title="Randomize arp pattern"
            onClick={() =>
              onArpChange({ ...arp, mode: randPick(ARP_MODES).id })
            }
          />
        </div>
        <select
          id="arp-mode"
          value={arp.mode}
          disabled={!arp.enabled}
          onChange={(e) =>
            onArpChange({ ...arp, mode: e.target.value as ArpMode })
          }
        >
          {ARP_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <SliderField
        id="arp-rate"
        label="Rate"
        value={arp.rateHz}
        min={0.1}
        max={12}
        step={0.05}
        display={`${arp.rateHz.toFixed(2)} Hz`}
        disabled={!arp.enabled}
        onChange={(rateHz) => onArpChange({ ...arp, rateHz })}
      />

      <SliderField
        id="arp-gate"
        label="Gate"
        value={arp.gate}
        min={0.1}
        max={1}
        step={0.01}
        display={arp.gate.toFixed(2)}
        disabled={!arp.enabled}
        onChange={(gate) => onArpChange({ ...arp, gate })}
      />

      <SliderField
        id="master"
        label="Master"
        value={masterVolume}
        min={0}
        max={1}
        step={0.01}
        display={`${Math.round(masterVolume * 100)}%`}
        onChange={onMasterVolumeChange}
      />

      {!isAdsr && (
        <button
          type="button"
          className={`btn drone-btn ${audioOn ? 'btn-active' : 'btn-primary'}`}
          onClick={onToggleAudio}
        >
          {audioOn ? 'Stop' : 'Start'}
        </button>
      )}
      {isAdsr && (
        <p className="panel-hint input-hint">
          Play notes to sound — audio starts automatically
        </p>
      )}
    </CollapsibleSection>
  );
}

export function randomArpState(): ArpState {
  return {
    enabled: randBool(0.55),
    mode: randPick(ARP_MODES).id,
    rateHz: randRange(0.4, 6, 0.05),
    gate: randRange(0.35, 0.95, 0.01),
  };
}

export function randomAdsrState(): AdsrParams {
  return {
    attack: randRange(0.005, 0.8, 0.001),
    decay: randRange(0.05, 1.2, 0.001),
    sustain: randRange(0.2, 1, 0.01),
    release: randRange(0.05, 2, 0.001),
  };
}

export function randomHarmonySection(): {
  rootNote: number;
  rootOctave: number;
  harmonyId: HarmonyPresetId;
  masterVolume: number;
  arp: ArpState;
  playMode: PlayMode;
  adsr: AdsrParams;
} {
  return {
    rootNote: randInt(0, NOTE_NAMES.length - 1),
    rootOctave: randInt(1, 4),
    harmonyId: randPick(HARMONY_PRESETS).id,
    masterVolume: randRange(0.25, 0.85, 0.01),
    arp: randomArpState(),
    playMode: randBool(0.35) ? 'adsr' : 'drone',
    adsr: randomAdsrState(),
  };
}

export { DEFAULT_ARP, DEFAULT_ADSR };
