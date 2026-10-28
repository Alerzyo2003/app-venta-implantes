import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { pageRange } from '@/lib/pagination';

import { buttonClasses } from './button';

/** Paginación por enlaces (funciona sin JavaScript y conserva los filtros en la URL). */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const { from, to, hasPrev, hasNext } = pageRange(page, pageSize, total);
  if (total === 0) return null;
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted">
      <p>
        Mostrando {from}–{to} de {total}
      </p>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link href={hrefFor(page - 1)} className={buttonClasses('outline', 'sm')} rel="prev">
            <ChevronLeft aria-hidden className="size-4" /> Anterior
          </Link>
        ) : null}
        {hasNext ? (
          <Link href={hrefFor(page + 1)} className={buttonClasses('outline', 'sm')} rel="next">
            Siguiente <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
