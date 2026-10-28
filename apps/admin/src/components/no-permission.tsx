import { Alert } from '@/components/ui/feedback';

export function NoPermission({ section }: { section: string }) {
  return (
    <Alert tone="warning" title={`Sin acceso a ${section}`}>
      Tu rol no incluye esta sección. Si la necesitas, pide a un administrador que revise tus permisos.
    </Alert>
  );
}
