/** Bjorklund / Euclidean rhythm: `fills` hits distributed across `steps`. */
export function euclideanPattern(steps: number, fills: number): boolean[] {
  const n = Math.max(1, Math.floor(steps));
  const k = clampInt(Math.floor(fills), 0, n);
  if (k === 0) return Array.from({ length: n }, () => false);
  if (k >= n) return Array.from({ length: n }, () => true);

  // Bjorklund via repeated pairing of residue groups
  let groups: number[][] = [
    ...Array.from({ length: k }, () => [1]),
    ...Array.from({ length: n - k }, () => [0]),
  ];

  while (true) {
    const first = groups[0]!;
    let cut = 0;
    while (cut < groups.length && sameArr(groups[cut]!, first)) cut++;
    const remaining = groups.length - cut;
    if (remaining <= 1 || cut === 0) break;
    const take = Math.min(cut, remaining);
    const next: number[][] = [];
    for (let i = 0; i < take; i++) {
      next.push([...groups[i]!, ...groups[cut + i]!]);
    }
    for (let i = take; i < cut; i++) next.push(groups[i]!);
    for (let i = cut + take; i < groups.length; i++) next.push(groups[i]!);
    groups = next;
    if (groups.length <= 1) break;
  }

  return groups.flat().map((v) => v === 1);
}

export function rotatePattern(pattern: boolean[], rotate: number): boolean[] {
  const n = pattern.length;
  if (n === 0) return pattern;
  const r = ((Math.floor(rotate) % n) + n) % n;
  if (r === 0) return pattern.slice();
  return [...pattern.slice(r), ...pattern.slice(0, r)];
}

function sameArr(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
