/** Se muestra cuando faltan las variables de Supabase: el panel no simula datos (principio P-02). */
export function ConfigMissing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-bold text-fg">Configuración pendiente</h1>
      <p className="text-sm text-fg-muted">
        El panel aún no está conectado a un proyecto de Supabase. Define en el servidor las variables{' '}
        <code className="rounded bg-subtle px-1 py-0.5 text-fg">SUPABASE_URL</code> y{' '}
        <code className="rounded bg-subtle px-1 py-0.5 text-fg">SUPABASE_ANON_KEY</code> (clave publicable) y vuelve a
        iniciar el panel. Ver <code className="rounded bg-subtle px-1 py-0.5 text-fg">apps/admin/README.md</code>.
      </p>
    </main>
  );
}
