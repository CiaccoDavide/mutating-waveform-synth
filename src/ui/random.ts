/** Inclusive float in [min, max], snapped to step when provided. */
export function randRange(min: number, max: number, step = 0.01): number {
  const raw = min + Math.random() * (max - min);
  if (step <= 0) return raw;
  const snapped = Math.round(raw / step) * step;
  const decimals = String(step).includes('.')
    ? (String(step).split('.')[1]?.length ?? 0)
    : 0;
  const clamped = Math.min(max, Math.max(min, snapped));
  return Number(clamped.toFixed(decimals));
}

export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function randPick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function randBool(pTrue = 0.5): boolean {
  return Math.random() < pTrue;
}
