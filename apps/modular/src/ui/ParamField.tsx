function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export interface NumParamProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}

export function NumParam({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: NumParamProps) {
  const commit = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    onChange(clamp(raw, min, max));
  };
  const display = Number(value.toFixed(step < 0.1 ? 3 : 2)).toString();

  return (
    <div className="field param-field">
      <label>
        <span>{label}</span>
        <span className="param-val">{display}</span>
      </label>
      <div className="param-controls">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamp(value, min, max)}
          onChange={(e) => commit(Number(e.target.value))}
        />
        <input
          className="param-num"
          type="number"
          min={min}
          max={max}
          step={step}
          value={display}
          onChange={(e) => commit(Number(e.target.value))}
          onBlur={(e) => commit(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export interface EnumParamProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function EnumParam({ label, value, options, onChange }: EnumParamProps) {
  return (
    <div className="field param-field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
