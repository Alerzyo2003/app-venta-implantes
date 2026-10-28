import type { Permission } from '@repo/domain';
import { z } from 'zod';

/** Respuesta de public.get_my_access(). */
export const accessSchema = z.object({
  is_staff: z.boolean(),
  aal: z.string(),
  mfa_required: z.boolean(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type Access = z.infer<typeof accessSchema>;

export type AccessKind = 'anonymous' | 'not_staff' | 'mfa_pending' | 'staff';

/** Decide qué puede ver el usuario. El backend vuelve a validar cada operación. */
export function classifyAccess(access: Access | null): AccessKind {
  if (!access) return 'anonymous';
  if (!access.is_staff) return 'not_staff';
  if (access.mfa_required && access.aal !== 'aal2') return 'mfa_pending';
  return 'staff';
}

export interface PermissionHolder {
  permissions: ReadonlySet<string>;
}

export function can(holder: PermissionHolder, permission: Permission): boolean {
  return holder.permissions.has(permission);
}

export function canAny(holder: PermissionHolder, permissions: readonly Permission[]): boolean {
  return permissions.length === 0 || permissions.some((p) => holder.permissions.has(p));
}
