import {
  DELAY_ALGORITHMS,
  REVERB_ALGORITHMS,
  type EffectsState,
} from '../audio/EffectsModel';
import { SliderField } from './SliderField';

interface EffectsPanelProps {
  effects: EffectsState;
  onChange: (next: EffectsState) => void;
}

export function EffectsPanel({ effects, onChange }: EffectsPanelProps) {
  const { chorus, delay, reverb } = effects;

  return (
    <>
      <div className="panel-subheader">
        <span className="panel-title">Chorus</span>
        <button
          type="button"
          className={`btn btn-ghost ${chorus.enabled ? 'active' : ''}`}
          onClick={() =>
            onChange({
              ...effects,
              chorus: { ...chorus, enabled: !chorus.enabled },
            })
          }
        >
          {chorus.enabled ? 'On' : 'Off'}
        </button>
      </div>
      <SliderField
        id="chorus-mix"
        label="Mix"
        value={chorus.mix}
        min={0}
        max={1}
        step={0.01}
        display={chorus.mix.toFixed(2)}
        disabled={!chorus.enabled}
        onChange={(mix) =>
          onChange({ ...effects, chorus: { ...chorus, mix } })
        }
      />
      <SliderField
        id="chorus-rate"
        label="Rate"
        value={chorus.params.rate}
        min={0.05}
        max={4}
        step={0.01}
        display={`${chorus.params.rate.toFixed(2)} Hz`}
        disabled={!chorus.enabled}
        onChange={(rate) =>
          onChange({
            ...effects,
            chorus: { ...chorus, params: { ...chorus.params, rate } },
          })
        }
      />
      <SliderField
        id="chorus-depth"
        label="Depth"
        value={chorus.params.depth}
        min={0}
        max={1}
        step={0.01}
        display={chorus.params.depth.toFixed(2)}
        disabled={!chorus.enabled}
        onChange={(depth) =>
          onChange({
            ...effects,
            chorus: { ...chorus, params: { ...chorus.params, depth } },
          })
        }
      />
      <SliderField
        id="chorus-voices"
        label="Voices"
        value={chorus.params.voices}
        min={2}
        max={4}
        step={1}
        display={String(chorus.params.voices)}
        disabled={!chorus.enabled}
        onChange={(voices) =>
          onChange({
            ...effects,
            chorus: {
              ...chorus,
              params: { ...chorus.params, voices: Math.round(voices) },
            },
          })
        }
      />
      <SliderField
        id="chorus-fb"
        label="Feedback"
        value={chorus.params.feedback}
        min={0}
        max={0.9}
        step={0.01}
        display={chorus.params.feedback.toFixed(2)}
        disabled={!chorus.enabled}
        onChange={(feedback) =>
          onChange({
            ...effects,
            chorus: { ...chorus, params: { ...chorus.params, feedback } },
          })
        }
      />
      <SliderField
        id="chorus-width"
        label="Width"
        value={chorus.params.stereoWidth}
        min={0}
        max={1}
        step={0.01}
        display={chorus.params.stereoWidth.toFixed(2)}
        disabled={!chorus.enabled}
        onChange={(stereoWidth) =>
          onChange({
            ...effects,
            chorus: { ...chorus, params: { ...chorus.params, stereoWidth } },
          })
        }
      />

      <div className="panel-subheader">
        <span className="panel-title">Delay</span>
        <button
          type="button"
          className={`btn btn-ghost ${delay.enabled ? 'active' : ''}`}
          onClick={() =>
            onChange({
              ...effects,
              delay: { ...delay, enabled: !delay.enabled },
            })
          }
        >
          {delay.enabled ? 'On' : 'Off'}
        </button>
      </div>
      <div className="field">
        <label className="label" htmlFor="delay-algo">
          Algorithm
        </label>
        <select
          id="delay-algo"
          value={delay.params.algorithm}
          disabled={!delay.enabled}
          onChange={(e) =>
            onChange({
              ...effects,
              delay: {
                ...delay,
                params: {
                  ...delay.params,
                  algorithm: e.target.value as typeof delay.params.algorithm,
                },
              },
            })
          }
        >
          {DELAY_ALGORITHMS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <SliderField
        id="delay-mix"
        label="Mix"
        value={delay.mix}
        min={0}
        max={1}
        step={0.01}
        display={delay.mix.toFixed(2)}
        disabled={!delay.enabled}
        onChange={(mix) => onChange({ ...effects, delay: { ...delay, mix } })}
      />
      <SliderField
        id="delay-time"
        label="Time"
        value={delay.params.timeMs}
        min={20}
        max={1200}
        step={1}
        display={`${Math.round(delay.params.timeMs)} ms`}
        disabled={!delay.enabled}
        onChange={(timeMs) =>
          onChange({
            ...effects,
            delay: { ...delay, params: { ...delay.params, timeMs } },
          })
        }
      />
      <SliderField
        id="delay-fb"
        label="Feedback"
        value={delay.params.feedback}
        min={0}
        max={0.92}
        step={0.01}
        display={delay.params.feedback.toFixed(2)}
        disabled={!delay.enabled}
        onChange={(feedback) =>
          onChange({
            ...effects,
            delay: { ...delay, params: { ...delay.params, feedback } },
          })
        }
      />
      <SliderField
        id="delay-tone"
        label="Tone"
        value={delay.params.tone}
        min={200}
        max={12000}
        step={10}
        display={`${Math.round(delay.params.tone)} Hz`}
        disabled={!delay.enabled}
        onChange={(tone) =>
          onChange({
            ...effects,
            delay: { ...delay, params: { ...delay.params, tone } },
          })
        }
      />

      <div className="panel-subheader">
        <span className="panel-title">Reverb</span>
        <button
          type="button"
          className={`btn btn-ghost ${reverb.enabled ? 'active' : ''}`}
          onClick={() =>
            onChange({
              ...effects,
              reverb: { ...reverb, enabled: !reverb.enabled },
            })
          }
        >
          {reverb.enabled ? 'On' : 'Off'}
        </button>
      </div>
      <div className="field">
        <label className="label" htmlFor="reverb-algo">
          Algorithm
        </label>
        <select
          id="reverb-algo"
          value={reverb.params.algorithm}
          disabled={!reverb.enabled}
          onChange={(e) =>
            onChange({
              ...effects,
              reverb: {
                ...reverb,
                params: {
                  ...reverb.params,
                  algorithm: e.target.value as typeof reverb.params.algorithm,
                },
              },
            })
          }
        >
          {REVERB_ALGORITHMS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <SliderField
        id="reverb-mix"
        label="Mix"
        value={reverb.mix}
        min={0}
        max={1}
        step={0.01}
        display={reverb.mix.toFixed(2)}
        disabled={!reverb.enabled}
        onChange={(mix) =>
          onChange({ ...effects, reverb: { ...reverb, mix } })
        }
      />
      <SliderField
        id="reverb-size"
        label="Size"
        value={reverb.params.size}
        min={0.05}
        max={1}
        step={0.01}
        display={reverb.params.size.toFixed(2)}
        disabled={!reverb.enabled}
        onChange={(size) =>
          onChange({
            ...effects,
            reverb: { ...reverb, params: { ...reverb.params, size } },
          })
        }
      />
      <SliderField
        id="reverb-decay"
        label="Decay"
        value={reverb.params.decay}
        min={0.05}
        max={0.98}
        step={0.01}
        display={reverb.params.decay.toFixed(2)}
        disabled={!reverb.enabled}
        onChange={(decay) =>
          onChange({
            ...effects,
            reverb: { ...reverb, params: { ...reverb.params, decay } },
          })
        }
      />
      <SliderField
        id="reverb-damp"
        label="Damping"
        value={reverb.params.damping}
        min={0}
        max={1}
        step={0.01}
        display={reverb.params.damping.toFixed(2)}
        disabled={!reverb.enabled}
        onChange={(damping) =>
          onChange({
            ...effects,
            reverb: { ...reverb, params: { ...reverb.params, damping } },
          })
        }
      />
      <SliderField
        id="reverb-pre"
        label="Pre-delay"
        value={reverb.params.preDelayMs}
        min={0}
        max={120}
        step={1}
        display={`${Math.round(reverb.params.preDelayMs)} ms`}
        disabled={!reverb.enabled}
        onChange={(preDelayMs) =>
          onChange({
            ...effects,
            reverb: { ...reverb, params: { ...reverb.params, preDelayMs } },
          })
        }
      />
    </>
  );
}
