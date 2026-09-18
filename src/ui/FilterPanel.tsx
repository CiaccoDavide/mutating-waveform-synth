import { useEffect, useState } from 'react';
import {
  createDefaultFilterBank,
  createDefaultFilter,
  createDefaultParamLfo,
  cutoffToSlider,
  FILTER_MODES,
  filterModeUsesGain,
  formatCutoff,
  LFO_SHAPES,
  resolveFilterParams,
  sliderToCutoff,
  type FilterState,
  type ParamLfo,
} from '../audio/FilterModel';
import type { LfoShape } from '../audio/LfoModel';
import type { LadderState } from '../audio/EffectsModel';
import { CollapsibleSection } from './CollapsibleSection';
import { RandomizeButton } from './RandomizeButton';
import { SliderField } from './SliderField';
import { randBool, randPick, randRange } from './random';

interface FilterPanelProps {
  filters: FilterState[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onChange: (filters: FilterState[]) => void;
  ladder: LadderState;
  onLadderChange: (ladder: LadderState) => void;
}

function randomParamLfo(): ParamLfo {
  return createDefaultParamLfo({
    enabled: randBool(0.55),
    shape: randPick(LFO_SHAPES).id,
    formula: randPick(['sin(x)', 'sin(x)+0.3*sin(3*x)', 'tanh(2*sin(x))', 'abs(sin(x))*2-1']),
    rate: randRange(0.02, 0.8, 0.01),
    depth: randRange(0.1, 0.75, 0.01),
  });
}

export function randomFilterState(index = 0): FilterState {
  const mode = randPick(FILTER_MODES).id;
  return createDefaultFilter(index, {
    enabled: randBool(0.7),
    mode,
    cutoff: Math.round(sliderToCutoff(Math.random())),
    q: randRange(0.2, 8, 0.01),
    gainDb: filterModeUsesGain(mode) ? randRange(-12, 12, 0.1) : 0,
    cutoffLfo: randomParamLfo(),
    qLfo: randomParamLfo(),
    gainLfo: filterModeUsesGain(mode) ? randomParamLfo() : createDefaultParamLfo(),
  });
}

function randomFilterBank(): FilterState[] {
  return Array.from({ length: 3 }, (_, i) => randomFilterState(i));
}

function patchFilter(
  filters: FilterState[],
  index: number,
  patch: Partial<FilterState>,
): FilterState[] {
  return filters.map((f, i) => (i === index ? { ...f, ...patch } : f));
}

function ParamLfoControls({
  idPrefix,
  label,
  lfo,
  disabled,
  onChange,
}: {
  idPrefix: string;
  label: string;
  lfo: ParamLfo;
  disabled: boolean;
  onChange: (next: ParamLfo) => void;
}) {
  const inactive = disabled || !lfo.enabled;

  return (
    <CollapsibleSection
      mode="always"
      defaultOpen={lfo.enabled}
      className={`param-lfo ${lfo.enabled ? 'active' : ''}`}
      headerClassName="panel-subheader"
      title={`${label} LFO`}
      actions={
        <>
          <button
            type="button"
            className={`btn btn-ghost ${lfo.enabled ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => onChange({ ...lfo, enabled: !lfo.enabled })}
          >
            {lfo.enabled ? 'On' : 'Off'}
          </button>
          <RandomizeButton
            compact
            disabled={disabled}
            title={`Randomize ${label} LFO`}
            onClick={() => onChange(randomParamLfo())}
          />
        </>
      }
    >
      <div className="lfo-grid">
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-shape`}>
            Shape
          </label>
          <select
            id={`${idPrefix}-shape`}
            value={lfo.shape}
            disabled={inactive}
            onChange={(e) =>
              onChange({ ...lfo, shape: e.target.value as LfoShape })
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
            <label className="label" htmlFor={`${idPrefix}-rate`}>
              Rate
            </label>
            <span className="field-value">{lfo.rate.toFixed(2)}</span>
          </div>
          <input
            id={`${idPrefix}-rate`}
            type="range"
            min={0.01}
            max={2}
            step={0.01}
            value={lfo.rate}
            disabled={inactive}
            onChange={(e) =>
              onChange({ ...lfo, rate: Number(e.target.value) })
            }
          />
        </div>
      </div>

      {lfo.shape === 'custom' && (
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-formula`}>
            Formula
          </label>
          <input
            id={`${idPrefix}-formula`}
            type="text"
            spellCheck={false}
            className="formula-input"
            value={lfo.formula}
            disabled={inactive}
            onChange={(e) => onChange({ ...lfo, formula: e.target.value })}
          />
        </div>
      )}

      <SliderField
        id={`${idPrefix}-depth`}
        label="Depth"
        value={lfo.depth}
        min={0}
        max={1}
        step={0.01}
        display={lfo.depth.toFixed(2)}
        disabled={inactive}
        onChange={(depth) => onChange({ ...lfo, depth })}
      />
    </CollapsibleSection>
  );
}

export function FilterPanel({
  filters,
  selectedIndex,
  onSelect,
  onChange,
  ladder,
  onLadderChange,
}: FilterPanelProps) {
  const filter = filters[selectedIndex] ?? filters[0];
  const [nowSec, setNowSec] = useState(() => performance.now() * 0.001);

  useEffect(() => {
    let raf = 0;
    const needsLive =
      filter &&
      filter.enabled &&
      (filter.cutoffLfo.enabled || filter.qLfo.enabled || filter.gainLfo.enabled);
    if (!needsLive) return;
    const tick = (now: number) => {
      setNowSec(now * 0.001);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    filter?.enabled,
    filter?.cutoffLfo.enabled,
    filter?.qLfo.enabled,
    filter?.gainLfo.enabled,
  ]);

  if (!filter) return null;

  const usesGain = filterModeUsesGain(filter.mode);
  const live = resolveFilterParams(filter, nowSec);
  const cutoffSlider = cutoffToSlider(filter.cutoff);

  return (
    <CollapsibleSection
      mode="mobile"
      className="panel filter-panel"
      title="Filters"
      actions={
        <>
          <span className="panel-hint">
            {filters.filter((f) => f.enabled).length} active
          </span>
          <RandomizeButton
            title="Randomize all filters"
            onClick={() => onChange(randomFilterBank())}
          />
        </>
      }
    >
      <div className="filter-tabs">
        {filters.map((f, i) => (
          <button
            key={i}
            type="button"
            className={`voice-tab ${selectedIndex === i ? 'selected' : ''} ${f.enabled ? 'enabled' : ''}`}
            onClick={() => onSelect(i)}
          >
            <span className="voice-tab-index">F{i + 1}</span>
            <span className="voice-tab-freq">{f.mode.slice(0, 2).toUpperCase()}</span>
          </button>
        ))}
      </div>

      <div className="field-row">
        <label className="label">Filter {selectedIndex + 1}</label>
        <div className="panel-header-actions">
          <button
            type="button"
            className={`btn btn-ghost ${filter.enabled ? 'active' : ''}`}
            onClick={() =>
              onChange(
                patchFilter(filters, selectedIndex, {
                  enabled: !filter.enabled,
                }),
              )
            }
          >
            {filter.enabled ? 'On' : 'Off'}
          </button>
          <RandomizeButton
            compact
            title="Randomize this filter"
            onClick={() =>
              onChange(
                patchFilter(
                  filters,
                  selectedIndex,
                  randomFilterState(selectedIndex),
                ),
              )
            }
          />
        </div>
      </div>

      <div className="field">
        <div className="field-row">
          <label className="label" htmlFor="filter-mode">
            Mode
          </label>
          <RandomizeButton
            compact
            disabled={!filter.enabled}
            title="Randomize filter mode"
            onClick={() => {
              const mode = randPick(FILTER_MODES).id;
              onChange(
                patchFilter(filters, selectedIndex, {
                  mode,
                  gainDb: filterModeUsesGain(mode) ? filter.gainDb : 0,
                }),
              );
            }}
          />
        </div>
        <select
          id="filter-mode"
          value={filter.mode}
          disabled={!filter.enabled}
          onChange={(e) =>
            onChange(
              patchFilter(filters, selectedIndex, {
                mode: e.target.value as FilterState['mode'],
              }),
            )
          }
        >
          {FILTER_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <div className="field-row">
          <label className="label" htmlFor="filter-cutoff">
            Cutoff
          </label>
          <div className="field-value-row">
            <span className="field-value">
              {formatCutoff(live.cutoff)}
              {filter.cutoffLfo.enabled ? ' ~' : ''}
            </span>
            <RandomizeButton
              compact
              disabled={!filter.enabled}
              title="Randomize cutoff base"
              onClick={() =>
                onChange(
                  patchFilter(filters, selectedIndex, {
                    cutoff: Math.round(sliderToCutoff(Math.random())),
                  }),
                )
              }
            />
          </div>
        </div>
        <input
          id="filter-cutoff"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={cutoffSlider}
          disabled={!filter.enabled}
          onChange={(e) =>
            onChange(
              patchFilter(filters, selectedIndex, {
                cutoff: Math.round(sliderToCutoff(Number(e.target.value))),
              }),
            )
          }
        />
      </div>

      <ParamLfoControls
        idPrefix={`f${selectedIndex}-cut`}
        label="Cutoff"
        lfo={filter.cutoffLfo}
        disabled={!filter.enabled}
        onChange={(cutoffLfo) =>
          onChange(patchFilter(filters, selectedIndex, { cutoffLfo }))
        }
      />

      <SliderField
        id="filter-q"
        label="Resonance"
        value={filter.q}
        min={0.1}
        max={18}
        step={0.01}
        display={`${live.q.toFixed(2)}${filter.qLfo.enabled ? ' ~' : ''}`}
        disabled={!filter.enabled}
        onChange={(q) => onChange(patchFilter(filters, selectedIndex, { q }))}
      />

      <ParamLfoControls
        idPrefix={`f${selectedIndex}-q`}
        label="Res"
        lfo={filter.qLfo}
        disabled={!filter.enabled}
        onChange={(qLfo) =>
          onChange(patchFilter(filters, selectedIndex, { qLfo }))
        }
      />

      <SliderField
        id="filter-gain"
        label="Gain"
        value={filter.gainDb}
        min={-24}
        max={24}
        step={0.1}
        display={`${live.gainDb.toFixed(1)} dB${filter.gainLfo.enabled ? ' ~' : ''}`}
        disabled={!filter.enabled || !usesGain}
        onChange={(gainDb) =>
          onChange(patchFilter(filters, selectedIndex, { gainDb }))
        }
      />

      <ParamLfoControls
        idPrefix={`f${selectedIndex}-gain`}
        label="Gain"
        lfo={filter.gainLfo}
        disabled={!filter.enabled || !usesGain}
        onChange={(gainLfo) =>
          onChange(patchFilter(filters, selectedIndex, { gainLfo }))
        }
      />

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onChange(createDefaultFilterBank())}
      >
        Reset Filters
      </button>

      <div className="panel-subheader">
        <span className="panel-title">Ladder</span>
        <button
          type="button"
          className={`btn btn-ghost ${ladder.enabled ? 'active' : ''}`}
          onClick={() =>
            onLadderChange({ ...ladder, enabled: !ladder.enabled })
          }
        >
          {ladder.enabled ? 'On' : 'Off'}
        </button>
      </div>
      <p className="hint">4-pole transistor-ladder after the biquad bank</p>
      <SliderField
        id="ladder-cutoff"
        label="Cutoff"
        value={ladder.cutoff}
        min={40}
        max={12000}
        step={1}
        display={`${Math.round(ladder.cutoff)} Hz`}
        disabled={!ladder.enabled}
        onChange={(cutoff) => onLadderChange({ ...ladder, cutoff })}
      />
      <SliderField
        id="ladder-res"
        label="Resonance"
        value={ladder.resonance}
        min={0}
        max={1}
        step={0.01}
        display={ladder.resonance.toFixed(2)}
        disabled={!ladder.enabled}
        onChange={(resonance) => onLadderChange({ ...ladder, resonance })}
      />
      <SliderField
        id="ladder-drive"
        label="Drive"
        value={ladder.drive}
        min={0}
        max={1}
        step={0.01}
        display={ladder.drive.toFixed(2)}
        disabled={!ladder.enabled}
        onChange={(drive) => onLadderChange({ ...ladder, drive })}
      />
    </CollapsibleSection>
  );
}

export { createDefaultFilterBank as DEFAULT_FILTER_BANK };
