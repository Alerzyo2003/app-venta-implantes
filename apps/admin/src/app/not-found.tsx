import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-bold text-fg">Página no encontrada</h1>
      <p className="text-sm text-fg-muted">La dirección no existe o el registro fue eliminado.</p>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
