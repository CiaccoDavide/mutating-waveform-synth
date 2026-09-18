interface RandomizeButtonProps {
  onClick: () => void;
  label?: string;
  title?: string;
  disabled?: boolean;
  compact?: boolean;
}

function DiceIcon() {
  return (
    <svg
      className="btn-random-icon"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden
    >
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <circle cx="5" cy="5" r="1.1" fill="currentColor" />
      <circle cx="11" cy="5" r="1.1" fill="currentColor" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" />
      <circle cx="5" cy="11" r="1.1" fill="currentColor" />
      <circle cx="11" cy="11" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** Dice-style randomize control for panels and individual sliders. */
export function RandomizeButton({
  onClick,
  label,
  title = 'Randomize',
  disabled,
  compact,
}: RandomizeButtonProps) {
  return (
    <button
      type="button"
      className={`btn-random ${compact ? 'btn-random-compact' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <DiceIcon />
      {label ? <span className="btn-random-label">{label}</span> : null}
    </button>
  );
}
