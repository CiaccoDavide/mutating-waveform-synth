import type { FormulaPreset } from '../audio/FormulaCompiler';
import { PRESET_TIER_LABELS } from '../audio/FormulaCompiler';
import type { FmState } from '../audio/EffectsModel';
import {
  createDefaultMutators,
  LFO_SHAPES,
  LFO_TARGETS,
  SUB_LFO_TARGETS,
  type LfoState,
  type MutatorState,
  type SubLfoState,
} from '../audio/LfoModel';
import { CollapsibleSection } from './CollapsibleSection';
import { RandomizeButton } from './RandomizeButton';
import { SliderField } from './SliderField';
import { randBool, randPick, randRange } from './random';

export type { MutatorState };

interface FormulaPanelProps {
  expression: string;
  error: string | null;
  presets: FormulaPreset[];
  selectedPresetId: string;
  mutators: MutatorState;
  fm: FmState;
  onExpressionChange: (value: string) => void;
  onPresetChange: (id: string) => void;
  onMutatorsChange: (next: MutatorState) => void;
  onFmChange: (next: FmState) => void;
}

function randomSub(): SubLfoState {
  return {
    enabled: randBool(0.5),
    shape: randPick(LFO_SHAPES).id,
    formula: randPick(['sin(x)', 'sin(x)+0.3*sin(3*x)', 'tanh(2*sin(x))', 'abs(sin(x))*2-1']),
    rate: randRange(0.02, 0.45, 0.01),
    depth: randRange(0.15, 0.85, 0.01),
    target: randPick(SUB_LFO_TARGETS).id,
  };
}

function randomLfo(): LfoState {
  return {
    enabled: randBool(0.6),
    shape: randPick(LFO_SHAPES).id,
    formula: randPick(['sin(x)', 'sin(x)+0.4*sin(2*x)', 'tanh(3*sin(x))', 'cos(x)*sin(2*x)']),
    rate: randRange(0.02, 1.2, 0.01),
    depth: randRange(0.1, 0.7, 0.01),
    target: randPick(LFO_TARGETS).id,
    sub: randomSub(),
  };
}

export function randomMutators(enabled = true): MutatorState {
  return {
    enabled,
    morphRate: randRange(0.2, 1.8, 0.01),
    lfos: [randomLfo(), randomLfo(), randomLfo()],
  };
}

function patchLfo(
  mutators: MutatorState,
  index: number,
  patch: Partial<Omit<LfoState, 'sub'>> & { sub?: Partial<SubLfoState> },
): MutatorState {
  return {
    ...mutators,
    lfos: mutators.lfos.map((lfo, i) => {
      if (i !== index) return lfo;
      const { sub, ...rest } = patch;
      return {
        ...lfo,
        ...rest,
        sub: sub ? { ...lfo.sub, ...sub } : lfo.sub,
      };
    }),
  };
}

function LfoEditor({
  index,
  lfo,
  disabled,
  onChange,
}: {
  index: number;
  lfo: LfoState;
  disabled: boolean;
  onChange: (patch: Partial<Omit<LfoState, 'sub'>> & { sub?: Partial<SubLfoState> }) => void;
}) {
  const inactive = disabled || !lfo.enabled;

  return (
    <CollapsibleSection
      mode="always"
      defaultOpen={lfo.enabled}
      className={`lfo-card ${lfo.enabled ? 'active' : ''}`}
      headerClassName="lfo-card-header"
      titleClassName="lfo-card-title"
      title={`LFO ${index + 1}`}
      actions={
        <>
          <button
            type="button"
            className={`btn btn-ghost ${lfo.enabled ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => onChange({ enabled: !lfo.enabled })}
          >
            {lfo.enabled ? 'On' : 'Off'}
          </button>
          <RandomizeButton
            compact
            disabled={disabled}
            title={`Randomize LFO ${index + 1}`}
            onClick={() => {
              onChange(randomLfo());
            }}
          />
        </>
      }
    >
      <div className="lfo-grid">
        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor={`lfo-shape-${index}`}>
              Shape
            </label>
            <RandomizeButton
              compact
              disabled={inactive}
              title="Randomize shape"
              onClick={() => onChange({ shape: randPick(LFO_SHAPES).id })}
            />
          </div>
          <select
            id={`lfo-shape-${index}`}
            value={lfo.shape}
            disabled={inactive}
            onChange={(e) =>
              onChange({ shape: e.target.value as LfoState['shape'] })
            }
          >
            {LFO_SHAPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor={`lfo-target-${index}`}>
              Target
            </label>
            <RandomizeButton
              compact
              disabled={inactive}
              title="Randomize target"
              onClick={() => onChange({ target: randPick(LFO_TARGETS).id })}
            />
          </div>
          <select
            id={`lfo-target-${index}`}
            value={lfo.target}
            disabled={inactive}
            onChange={(e) =>
              onChange({ target: e.target.value as LfoState['target'] })
            }
          >
            {LFO_TARGETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {lfo.shape === 'custom' && (
        <div className="field">
          <label className="label" htmlFor={`lfo-formula-${index}`}>
            LFO Formula
          </label>
          <input
            id={`lfo-formula-${index}`}
            type="text"
            spellCheck={false}
            className="formula-input"
            value={lfo.formula}
            disabled={inactive}
            onChange={(e) => onChange({ formula: e.target.value })}
          />
        </div>
      )}

      <SliderField
        id={`lfo-rate-${index}`}
        label="Rate"
        value={lfo.rate}
        min={0.01}
        max={2}
        step={0.01}
        display={`${lfo.rate.toFixed(2)} Hz`}
        disabled={inactive}
        onChange={(rate) => onChange({ rate })}
      />

      <SliderField
        id={`lfo-depth-${index}`}
        label="Depth"
        value={lfo.depth}
        min={0}
        max={1}
        step={0.01}
        display={lfo.depth.toFixed(2)}
        disabled={inactive}
        onChange={(depth) => onChange({ depth })}
      />

      <CollapsibleSection
        mode="always"
        defaultOpen={lfo.sub.enabled}
        className="sub-lfo"
        headerClassName="panel-subheader"
        title="Sub-LFO"
        actions={
          <>
            <button
              type="button"
              className={`btn btn-ghost ${lfo.sub.enabled ? 'active' : ''}`}
              disabled={inactive}
              onClick={() => onChange({ sub: { enabled: !lfo.sub.enabled } })}
            >
              {lfo.sub.enabled ? 'On' : 'Off'}
            </button>
            <RandomizeButton
              compact
              disabled={inactive}
              title="Randomize sub-LFO"
              onClick={() => onChange({ sub: randomSub() })}
            />
          </>
        }
      >
        <div className="lfo-grid">
          <div className="field">
            <label className="label" htmlFor={`sub-shape-${index}`}>
              Shape
            </label>
            <select
              id={`sub-shape-${index}`}
              value={lfo.sub.shape}
              disabled={inactive || !lfo.sub.enabled}
              onChange={(e) =>
                onChange({
                  sub: { shape: e.target.value as SubLfoState['shape'] },
                })
              }
            >
              {LFO_SHAPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor={`sub-target-${index}`}>
              Modulates
            </label>
            <select
              id={`sub-target-${index}`}
              value={lfo.sub.target}
              disabled={inactive || !lfo.sub.enabled}
              onChange={(e) =>
                onChange({
                  sub: { target: e.target.value as SubLfoState['target'] },
                })
              }
            >
              {SUB_LFO_TARGETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {lfo.sub.shape === 'custom' && (
          <div className="field">
            <label className="label" htmlFor={`sub-formula-${index}`}>
              Sub Formula
            </label>
            <input
              id={`sub-formula-${index}`}
              type="text"
              spellCheck={false}
              className="formula-input"
              value={lfo.sub.formula}
              disabled={inactive || !lfo.sub.enabled}
              onChange={(e) => onChange({ sub: { formula: e.target.value } })}
            />
          </div>
        )}

        <SliderField
          id={`sub-rate-${index}`}
          label="Sub Rate"
          value={lfo.sub.rate}
          min={0.01}
          max={1}
          step={0.01}
          display={`${lfo.sub.rate.toFixed(2)} Hz`}
          disabled={inactive || !lfo.sub.enabled}
          onChange={(rate) => onChange({ sub: { rate } })}
        />

        <SliderField
          id={`sub-depth-${index}`}
          label="Sub Depth"
          value={lfo.sub.depth}
          min={0}
          max={1}
          step={0.01}
          display={lfo.sub.depth.toFixed(2)}
          disabled={inactive || !lfo.sub.enabled}
          onChange={(depth) => onChange({ sub: { depth } })}
        />
      </CollapsibleSection>
    </CollapsibleSection>
  );
}

export function FormulaPanel({
  expression,
  error,
  presets,
  selectedPresetId,
  mutators,
  fm,
  onExpressionChange,
  onPresetChange,
  onMutatorsChange,
  onFmChange,
}: FormulaPanelProps) {
  const randomizeSection = () => {
    const preset = randPick(presets);
    onPresetChange(preset.id);
    onMutatorsChange(randomMutators(randBool(0.8)));
  };

  return (
    <CollapsibleSection
      mode="mobile"
      className="panel formula-panel"
      title="Formula"
      actions={
        <>
          <span className="panel-hint">x = phase · t = time</span>
          <RandomizeButton
            title="Randomize formula section"
            onClick={randomizeSection}
          />
        </>
      }
    >
      <div className="field">
        <label className="label" htmlFor="preset">
          Preset
        </label>
        <select
          id="preset"
          value={selectedPresetId}
          onChange={(e) => onPresetChange(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              [{PRESET_TIER_LABELS[p.tier]}] {p.name}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {presets.find((p) => p.id === selectedPresetId)?.tier === 'character' && (
          <p className="hint">
            Character waves are timbre bases — load an Inspired-by preset for a
            full patch.
          </p>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="expression">
          Expression
        </label>
        <input
          id="expression"
          type="text"
          spellCheck={false}
          value={expression}
          onChange={(e) => onExpressionChange(e.target.value)}
          className="formula-input"
        />
        {error && <p className="formula-error">{error}</p>}
      </div>

      <div className="panel-subheader">
        <span className="panel-title">FM Operators</span>
        <button
          type="button"
          className={`btn btn-ghost ${fm.enabled ? 'active' : ''}`}
          onClick={() => onFmChange({ ...fm, enabled: !fm.enabled })}
        >
          {fm.enabled ? 'On' : 'Off'}
        </button>
      </div>
      <p className="hint">
        2-op phase modulation replaces the wavetable while enabled
      </p>
      <SliderField
        id="fm-ratio"
        label="Ratio"
        value={fm.ratio}
        min={0.25}
        max={16}
        step={0.01}
        display={fm.ratio.toFixed(2)}
        disabled={!fm.enabled}
        onChange={(ratio) => onFmChange({ ...fm, ratio })}
      />
      <SliderField
        id="fm-index"
        label="Index"
        value={fm.index}
        min={0}
        max={12}
        step={0.01}
        display={fm.index.toFixed(2)}
        disabled={!fm.enabled}
        onChange={(index) => onFmChange({ ...fm, index })}
      />

      <div className="panel-subheader">
        <span className="panel-title">Time Mutators</span>
        <div className="panel-header-actions">
          <button
            type="button"
            className={`btn btn-ghost ${mutators.enabled ? 'active' : ''}`}
            onClick={() =>
              onMutatorsChange({ ...mutators, enabled: !mutators.enabled })
            }
          >
            {mutators.enabled ? 'On' : 'Off'}
          </button>
          <RandomizeButton
            compact
            title="Randomize mutators"
            onClick={() => onMutatorsChange(randomMutators(true))}
          />
        </div>
      </div>

      <SliderField
        id="morph-rate"
        label="Morph Rate"
        value={mutators.morphRate}
        min={0.05}
        max={2}
        step={0.01}
        display={mutators.morphRate.toFixed(2)}
        disabled={!mutators.enabled}
        onChange={(morphRate) => onMutatorsChange({ ...mutators, morphRate })}
      />

      <div className="lfo-stack">
        {mutators.lfos.map((lfo, i) => (
          <LfoEditor
            key={i}
            index={i}
            lfo={lfo}
            disabled={!mutators.enabled}
            onChange={(patch) => onMutatorsChange(patchLfo(mutators, i, patch))}
          />
        ))}
      </div>

      <button
        type="button"
        className="btn btn-ghost"
        disabled={!mutators.enabled}
        onClick={() => onMutatorsChange(createDefaultMutators())}
      >
        Reset LFOs
      </button>
    </CollapsibleSection>
  );
}
