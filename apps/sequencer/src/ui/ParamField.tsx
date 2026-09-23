import type { ReactNode } from 'react';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export interface ParamSectionProps {
  title: string;
  children: ReactNode;
}

export function ParamSection({ title, children }: ParamSectionProps) {
  return (
    <div className="param-section">
      <div className="param-section-title">{title}</div>
      <div className="row">{children}</div>
    </div>
  );
}

export interface NumParamProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  onChange: (v: number) => void;
}

export function NumParam({
  label,
  value,
  min,
  max,
  step = 0.01,
  integer = false,
  onChange,
}: NumParamProps) {
  const commit = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    const v = integer ? Math.round(raw) : raw;
    onChange(clamp(v, min, max));
  };
  const display = integer
    ? String(Math.round(value))
    : Number(value.toFixed(step < 0.1 ? 2 : 3)).toString();

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

export interface BoolParamProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function BoolParam({ label, value, onChange }: BoolParamProps) {
  return (
    <div className="field param-field">
      <label>{label}</label>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
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

export interface TextParamProps {
  label: string;
  value: string;
  title?: string;
  onChange: (v: string) => void;
}

export function TextParam({ label, value, title, onChange }: TextParamProps) {
  return (
    <div className="field param-field param-field-wide">
      <label>{label}</label>
      <input
        type="text"
        value={value}
        title={title}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function parseDegreesCsv(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
}
