import { brand } from '@repo/brand';
import type { ReactNode } from 'react';

import { ConfigMissing } from '@/components/config-missing';
import { AppShell } from '@/components/shell/app-shell';
import { requireStaff } from '@/lib/auth/dal';
import { isBackendConfigured } from '@/lib/env';
import { navFor } from '@/lib/navigation';
import { roleLabel } from '@/lib/roles';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  if (!isBackendConfigured()) return <ConfigMissing />;
  // El layout solo arma la navegación; cada página vuelve a validar el acceso (requireStaff).
  const ctx = await requireStaff();
  return (
    <AppShell brandName={brand.name} items={navFor(ctx)} email={ctx.email} roles={ctx.roles.map(roleLabel)}>
      {children}
    </AppShell>
  );
}
