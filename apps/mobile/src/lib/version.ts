/** Compara versiones semánticas simples "1.2.3". Devuelve <0, 0 o >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isBelowMinimum(current: string, minimum: string | undefined): boolean {
  return !!minimum && compareVersions(current, minimum) < 0;
}
