/** Página solicitada en la URL (?pagina=N), acotada a un entero >= 1. */
export function parsePage(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1;
}

export function pageRange(page: number, pageSize: number, total: number) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return { from, to, hasPrev: page > 1, hasNext: page * pageSize < total, offset: (page - 1) * pageSize };
}

/** Construye la URL de una lista conservando los filtros no vacíos. */
export function listHref(path: string, params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || (key === 'pagina' && value === 1)) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Primer valor de un parámetro de búsqueda de Next (string | string[] | undefined). */
export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}
