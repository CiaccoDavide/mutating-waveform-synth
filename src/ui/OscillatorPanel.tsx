import type { VoiceState } from '../audio/HarmonyModel';
import { CollapsibleSection } from './CollapsibleSection';
import { RandomizeButton } from './RandomizeButton';
import { SliderField } from './SliderField';
import { randBool, randRange } from './random';

interface OscillatorPanelProps {
  voices: VoiceState[];
  frequencies: number[];
  selectedVoice: number;
  onSelectVoice: (index: number) => void;
  onVoiceChange: (index: number, patch: Partial<VoiceState>) => void;
  onRandomizeAll: () => void;
}

function randomVoicePatch(): Partial<VoiceState> {
  return {
    enabled: randBool(0.65),
    freeMode: randBool(0.35),
    freeFreqHz: randRange(30, 800, 0.5),
    detuneCents: randRange(-50, 50, 1),
    gain: randRange(0.05, 0.55, 0.01),
    pan: randRange(-1, 1, 0.01),
  };
}

export function OscillatorPanel({
  voices,
  frequencies,
  selectedVoice,
  onSelectVoice,
  onVoiceChange,
  onRandomizeAll,
}: OscillatorPanelProps) {
  const voice = voices[selectedVoice];
  if (!voice) return null;

  return (
    <CollapsibleSection
      mode="mobile"
      className="panel osc-panel"
      title="Oscillators"
      actions={
        <>
          <span className="panel-hint">
            {voices.filter((v) => v.enabled).length} active
          </span>
          <RandomizeButton
            title="Randomize all oscillators"
            onClick={onRandomizeAll}
          />
        </>
      }
    >
      <div className="voice-tabs">
        {voices.map((v, i) => (
          <button
            key={i}
            type="button"
            className={`voice-tab ${selectedVoice === i ? 'selected' : ''} ${v.enabled ? 'enabled' : ''}`}
            onClick={() => onSelectVoice(i)}
          >
            <span className="voice-tab-index">{i + 1}</span>
            <span className="voice-tab-freq">
              {frequencies[i]?.toFixed(0) ?? '—'}
            </span>
          </button>
        ))}
      </div>

      <div className="voice-controls">
        <div className="field-row">
          <label className="label">Voice {selectedVoice + 1}</label>
          <RandomizeButton
            compact
            title="Randomize this voice"
            onClick={() => onVoiceChange(selectedVoice, randomVoicePatch())}
          />
        </div>

        <div className="field-row">
          <label className="label">Enable</label>
          <button
            type="button"
            className={`btn btn-ghost ${voice.enabled ? 'active' : ''}`}
            onClick={() =>
              onVoiceChange(selectedVoice, { enabled: !voice.enabled })
            }
          >
            {voice.enabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="field-row">
          <label className="label">Free Frequency</label>
          <button
            type="button"
            className={`btn btn-ghost ${voice.freeMode ? 'active' : ''}`}
            onClick={() =>
              onVoiceChange(selectedVoice, { freeMode: !voice.freeMode })
            }
          >
            {voice.freeMode ? 'Free' : 'Harmonic'}
          </button>
        </div>

        <SliderField
          id="free-freq"
          label="Frequency"
          value={voice.freeFreqHz}
          min={30}
          max={800}
          step={0.5}
          display={
            voice.freeMode
              ? `${voice.freeFreqHz.toFixed(1)} Hz`
              : `${frequencies[selectedVoice]?.toFixed(1) ?? '—'} Hz`
          }
          disabled={!voice.freeMode}
          onChange={(freeFreqHz) =>
            onVoiceChange(selectedVoice, { freeFreqHz })
          }
        />

        <SliderField
          id="detune"
          label="Detune"
          value={voice.detuneCents}
          min={-50}
          max={50}
          step={1}
          display={`${voice.detuneCents.toFixed(0)} ¢`}
          onChange={(detuneCents) =>
            onVoiceChange(selectedVoice, { detuneCents })
          }
        />

        <SliderField
          id="voice-gain"
          label="Gain"
          value={voice.gain}
          min={0}
          max={0.8}
          step={0.01}
          display={voice.gain.toFixed(2)}
          onChange={(gain) => onVoiceChange(selectedVoice, { gain })}
        />

        <SliderField
          id="voice-pan"
          label="Pan"
          value={voice.pan}
          min={-1}
          max={1}
          step={0.01}
          display={voice.pan.toFixed(2)}
          onChange={(pan) => onVoiceChange(selectedVoice, { pan })}
        />
      </div>
    </CollapsibleSection>
  );
}
