import { brand, type BrandPalette } from '@repo/brand';

const SAFE_COLOR = /^[#a-zA-Z0-9(),.%\s]+$/;

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function variables(palette: BrandPalette): string {
  return Object.entries(palette)
    .map(([key, value]) => {
      // Defensa: un valor mal escrito en la marca no puede cerrar la etiqueta <style>.
      if (!SAFE_COLOR.test(value)) throw new Error(`Color de marca no válido: ${key}`);
      return `--brand-${kebab(key)}:${value};`;
    })
    .join('');
}

/**
 * Variables CSS de la identidad (claro y oscuro) generadas desde @repo/brand: cambiar la marca
 * no exige tocar el panel. Tailwind las usa a través de @theme en globals.css.
 */
export function brandCss(): string {
  return (
    `:root{${variables(brand.palettes.light)}color-scheme:light}` +
    `@media (prefers-color-scheme: dark){:root{${variables(brand.palettes.dark)}color-scheme:dark}}`
  );
}
