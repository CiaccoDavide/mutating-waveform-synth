import { RandomizeButton } from './RandomizeButton';
import { randRange } from './random';

interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
}: SliderFieldProps) {
  return (
    <div className="field">
      <div className="field-row">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <div className="field-value-row">
          <span className="field-value">{display}</span>
          <RandomizeButton
            compact
            disabled={disabled}
            title={`Randomize ${label}`}
            onClick={() => onChange(randRange(min, max, step))}
          />
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
