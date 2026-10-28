import { brand } from '@repo/brand';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { brandCss } from '@/lib/brand-css';

import './globals.css';

export const metadata: Metadata = {
  title: { default: `Panel · ${brand.name}`, template: `%s · Panel ${brand.name}` },
  description: 'Panel administrativo interno.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: brand.palettes.light.background },
    { media: '(prefers-color-scheme: dark)', color: brand.palettes.dark.background },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // El nonce de la CSP lo genera el proxy. Leer los encabezados hace que cada página se genere
  // por solicitud, requisito para aplicar nonces (y natural en un panel con sesión).
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="es-CL">
      <head>
        <style nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: brandCss() }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
