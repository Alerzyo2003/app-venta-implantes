'use client';

import { ArrowLeftRight, House, LogOut, Menu, Package, Warehouse, Boxes, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { signOut } from '@/lib/auth/actions';
import { activeHref, type NavIcon, type NavItem } from '@/lib/navigation';

const ICONS: Record<NavIcon, typeof House> = {
  home: House,
  products: Package,
  inventory: Boxes,
  movements: ArrowLeftRight,
  warehouses: Warehouse,
};

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeHref(pathname, items);
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const isActive = item.href === active;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-primary text-on-primary' : 'text-fg hover:bg-subtle'
              }`}>
              <Icon aria-hidden className="size-4" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserBox({ email, roles }: { email: string | null; roles: string[] }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{email ?? 'Usuario interno'}</p>
        <p className="truncate text-xs text-fg-muted">{roles.join(' · ')}</p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-fg hover:bg-subtle">
          <LogOut aria-hidden className="size-4" /> Cerrar sesión
        </button>
      </form>
    </div>
  );
}

/** Estructura del panel: barra lateral en escritorio y menú desplegable en móvil o tablet. */
export function AppShell({
  brandName,
  items,
  email,
  roles,
  children,
}: {
  brandName: string;
  items: NavItem[];
  email: string | null;
  roles: string[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Cierra el menú móvil al cambiar de página y con la tecla Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const brandBlock = (
    <Link href="/" className="flex flex-col px-3">
      <span className="text-xs font-semibold tracking-wide text-accent-text uppercase">Panel interno</span>
      <span className="truncate text-base font-bold text-fg">{brandName}</span>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        Saltar al contenido
      </a>

      {/* Escritorio: la columna lleva el fondo (alto completo) y el menú queda fijo al desplazarse. */}
      <div className="hidden border-r border-line bg-card lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col gap-6 px-3 py-5">
          {brandBlock}
          <nav aria-label="Secciones del panel" className="flex-1 overflow-y-auto">
            <NavLinks items={items} />
          </nav>
          <UserBox email={email} roles={roles} />
        </aside>
      </div>

      {/* Móvil y tablet */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card px-4 py-3 lg:hidden">
        {brandBlock}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="menu-movil"
          className="rounded-lg p-2 text-fg hover:bg-subtle">
          <Menu aria-hidden className="size-5" />
          <span className="sr-only">Abrir menú</span>
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-overlay" onClick={() => setOpen(false)} />
          <div
            id="menu-movil"
            role="dialog"
            aria-modal="true"
            aria-label="Menú del panel"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-card px-3 py-5 shadow-xl">
            <div className="flex items-start justify-between">
              {brandBlock}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-fg hover:bg-subtle">
                <X aria-hidden className="size-5" />
                <span className="sr-only">Cerrar menú</span>
              </button>
            </div>
            <nav aria-label="Secciones del panel" className="flex-1 overflow-y-auto">
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </nav>
            <UserBox email={email} roles={roles} />
          </div>
        </div>
      ) : null}

      <main id="contenido" className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
