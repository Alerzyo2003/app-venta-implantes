import type { NextConfig } from 'next';

/**
 * Panel interno: todas las páginas se generan por solicitud (dependen de la sesión) y nunca
 * se indexan. La política de contenido (CSP) con nonce se arma en src/proxy.ts.
 */
const nextConfig: NextConfig = {
  // Los paquetes del monorepo se distribuyen como código TypeScript.
  transpilePackages: ['@repo/brand', '@repo/domain'],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
