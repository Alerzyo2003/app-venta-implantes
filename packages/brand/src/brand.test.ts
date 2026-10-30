import { describe, expect, it } from 'vitest';
import { brand, type BrandPalette, type ColorScheme } from './brand';
import { contrastRatio } from './contrast';

const AA_TEXT = 4.5;
const AA_UI = 3;

/** Pares texto/fondo que deben cumplir AA (4.5:1) en ambos esquemas. */
const textPairs: Array<[keyof BrandPalette, keyof BrandPalette]> = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceAlt'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['onPrimary', 'primary'],
  ['onAccent', 'accent'],
  ['accentText', 'background'],
  ['accentText', 'surface'],
  ['highlight', 'background'],
  ['highlight', 'surface'],
  ['success', 'successSurface'],
  ['warning', 'warningSurface'],
  ['danger', 'dangerSurface'],
  ['info', 'infoSurface'],
  ['success', 'background'],
  ['danger', 'background'],
  ['info', 'background'],
];

/** Elementos de interfaz no textuales (bordes de foco, íconos activos): 3:1. */
const uiPairs: Array<[keyof BrandPalette, keyof BrandPalette]> = [
  ['primary', 'background'],
  ['accentText', 'background'],
];

describe('paleta de la marca', () => {
  for (const scheme of ['light', 'dark'] as ColorScheme[]) {
    const p = brand.palettes[scheme];
    for (const [fg, bg] of textPairs) {
      it(`${scheme}: ${fg} sobre ${bg} cumple AA texto`, () => {
        expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
    for (const [fg, bg] of uiPairs) {
      it(`${scheme}: ${fg} sobre ${bg} cumple AA interfaz`, () => {
        expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(AA_UI);
      });
    }
  }

  it('el nombre está marcado como provisional mientras no se defina la marca', () => {
    expect(brand.isProvisional).toBe(true);
  });
});

describe('contrastRatio', () => {
  it('negro sobre blanco es 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });
  it('rechaza colores inválidos', () => {
    expect(() => contrastRatio('blue', '#FFFFFF')).toThrow();
  });
});
