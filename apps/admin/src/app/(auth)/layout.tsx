import { brand } from '@repo/brand';
import type { ReactNode } from 'react';

import { ConfigMissing } from '@/components/config-missing';
import { isBackendConfigured } from '@/lib/env';

export default function AuthLayout({ children }: { children: ReactNode }) {
  if (!isBackendConfigured()) return <ConfigMissing />;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent-text uppercase">Panel interno</p>
          <p className="text-xl font-bold text-fg">{brand.name}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </main>
  );
}
