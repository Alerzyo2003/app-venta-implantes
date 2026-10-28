'use client';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';

/** Errores inesperados (p. ej., sin conexión con Supabase). No muestra detalles técnicos. */
export default function PanelError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="danger" title="No pudimos cargar esta sección">
        Puede ser un problema de conexión con el servidor. Intenta nuevamente en unos segundos.
      </Alert>
      <div>
        <Button variant="outline" onClick={() => reset()}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
