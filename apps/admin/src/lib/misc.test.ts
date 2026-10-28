import { describe, expect, it } from 'vitest';

import { qrImageSrc, normalizeTotpCode } from './auth/mfa';
import { brandCss } from './brand-css';
import { isBackendConfigured } from './env';
import { categoryOptions, toOptions } from './options';
import { listHref, pageRange, parsePage } from './pagination';
import { slugify } from './slug';

describe('slugify', () => {
  it('quita tildes y símbolos', () => {
    expect(slugify('Pilar Recto Ø 4,5 — Conexión Cónica')).toBe('pilar-recto-4-5-conexion-conica');
    expect(slugify('  ***  ')).toBe('');
  });
  it('respeta el largo máximo sin terminar en guion', () => {
    expect(slugify('a'.repeat(79) + ' bcd', 80)).toBe('a'.repeat(79));
  });
});

describe('paginación', () => {
  it('interpreta ?pagina de forma segura', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-2')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });
  it('calcula el rango mostrado', () => {
    expect(pageRange(2, 25, 60)).toEqual({ from: 26, to: 50, hasPrev: true, hasNext: true, offset: 25 });
    expect(pageRange(1, 25, 0)).toMatchObject({ from: 0, to: 0, hasNext: false });
  });
  it('construye URLs sin filtros vacíos ni la página 1', () => {
    expect(listHref('/productos', { q: 'implante cónico', estado: null, pagina: 1 })).toBe('/productos?q=implante+c%C3%B3nico');
    expect(listHref('/productos', { pagina: 2 })).toBe('/productos?pagina=2');
  });
});

describe('opciones de selectores', () => {
  it('marca los registros inactivos', () => {
    expect(toOptions([{ id: '1', name: 'Marca A', is_active: false }])).toEqual([{ value: '1', label: 'Marca A (inactivo)' }]);
  });
  it('ordena el árbol de categorías con sangría', () => {
    const opts = categoryOptions([
      { id: 'b', name: 'Pilares', parent_id: null },
      { id: 'c', name: 'Pilares rectos', parent_id: 'b' },
      { id: 'a', name: 'Implantes', parent_id: null },
      { id: 'd', name: 'Huérfana', parent_id: 'no-existe' },
    ]);
    expect(opts.map((o) => o.label)).toEqual(['Pilares', '— Pilares rectos', 'Implantes', 'Huérfana']);
  });
});

describe('MFA', () => {
  it('codifica el QR para usarlo como imagen', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#000"/></svg>';
    const fromRaw = qrImageSrc(svg);
    const fromPrefixed = qrImageSrc(`data:image/svg+xml;utf-8,${svg}`);
    expect(fromRaw).toBe(fromPrefixed);
    expect(fromRaw.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(fromRaw).not.toContain('#');
    expect(qrImageSrc('data:image/svg+xml;base64,PHN2Zy8+')).toBe('data:image/svg+xml;base64,PHN2Zy8+');
  });
  it('acepta códigos de 6 dígitos con espacios', () => {
    expect(normalizeTotpCode('123 456')).toBe('123456');
    expect(normalizeTotpCode('12345')).toBeNull();
    expect(normalizeTotpCode('12345a')).toBeNull();
  });
});

describe('configuración', () => {
  it('exige URL y clave publicable', () => {
    expect(isBackendConfigured({ url: '', anonKey: '' })).toBe(false);
    expect(isBackendConfigured({ url: 'proyecto.supabase.co', anonKey: 'x' })).toBe(false);
    expect(isBackendConfigured({ url: 'https://proyecto.supabase.co', anonKey: ' ' })).toBe(false);
    expect(isBackendConfigured({ url: 'https://proyecto.supabase.co', anonKey: 'sb_publishable_x' })).toBe(true);
  });
});

describe('brandCss', () => {
  it('genera las variables de marca para claro y oscuro', () => {
    const css = brandCss();
    expect(css).toContain('--brand-primary:#0B2545;');
    expect(css).toContain('--brand-text-muted:');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).not.toMatch(/<\/?style/i);
  });
});
