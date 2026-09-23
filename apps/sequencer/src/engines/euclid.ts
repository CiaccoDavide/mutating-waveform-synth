/** Euclidean rhythm: distribute `hits` pulses evenly across `steps`, then rotate. */
export function euclid(steps: number, hits: number, rot = 0): boolean[] {
  const n = Math.max(1, steps);
  const k = Math.min(n, Math.max(0, hits));
  const pattern = Array.from({ length: n }, () => false);
  if (k === 0) return pattern;
  for (let i = 0; i < k; i += 1) {
    pattern[Math.floor((i * n) / k)] = true;
  }
  const r = ((rot % n) + n) % n;
  return pattern.map((_, i) => pattern[(i - r + n) % n]!);
}

/** Hit ordinal among active cells (0-based), or -1 if rest. */
export function hitIndex(pattern: boolean[], cell: number): number {
  if (!pattern[cell]) return -1;
  let n = 0;
  for (let i = 0; i <= cell; i += 1) {
    if (pattern[i]) n += 1;
  }
  return n - 1;
}

export function isGridSixteenth(beat: number): boolean {
  return Math.abs(beat * 4 - Math.round(beat * 4)) <= 0.001;
}
