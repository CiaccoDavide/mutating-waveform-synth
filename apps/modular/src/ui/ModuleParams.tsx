import { MODULE_DEFS } from '../modules/registry';
import type { ModuleType } from '../modules/types';
import { EnumParam, NumParam } from './ParamField';

interface Props {
  moduleType: ModuleType;
  params: Record<string, number | string>;
  onChange: (key: string, value: number | string) => void;
  compact?: boolean;
}

/** Shared param editors for inspector and expanded module nodes. */
export function ModuleParams({
  moduleType,
  params,
  onChange,
  compact = false,
}: Props) {
  const def = MODULE_DEFS[moduleType];
  const steps = Number(params.steps ?? 8) === 16 ? 16 : 8;
  const genericParams =
    moduleType === 'seq'
      ? def.params.filter((p) => !/^p\d+$/.test(p.key))
      : def.params;

  return (
    <div className={`module-params${compact ? ' compact' : ''}`}>
      {genericParams.map((p) => {
        if (p.kind === 'enum' && p.options) {
          return (
            <EnumParam
              key={p.key}
              label={p.label}
              value={String(params[p.key] ?? p.options[0]?.value ?? '')}
              options={p.options}
              onChange={(v) => onChange(p.key, v)}
            />
          );
        }
        return (
          <NumParam
            key={p.key}
            label={p.label}
            value={Number(params[p.key] ?? 0)}
            min={p.min ?? 0}
            max={p.max ?? 1}
            step={p.step ?? 0.01}
            onChange={(v) => onChange(p.key, v)}
          />
        );
      })}
      {moduleType === 'seq' && (
        <div className="seq-steps">
          <div className="param-section-title">Steps</div>
          <div className="seq-grid">
            {Array.from({ length: steps }, (_, i) => (
              <label key={i} className="seq-cell">
                <span>{i + 1}</span>
                <input
                  type="number"
                  min={0}
                  max={14}
                  step={1}
                  value={Number(params[`p${i}`] ?? 0)}
                  onChange={(e) =>
                    onChange(`p${i}`, Math.round(Number(e.target.value)))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
