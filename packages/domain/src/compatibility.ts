/**
 * Compatibilidad entre implantes y componentes (ADR-0005). Solo existe "compatible" si hay
 * un vínculo VERIFICADO con evidencia; en cualquier otro caso es "pendiente de verificación".
 */

export type CompatibilityResult = 'verified' | 'incompatible' | 'unverified';

export const COMPATIBILITY_LABELS: Readonly<Record<CompatibilityResult, string>> = {
  verified: 'Compatible (verificado)',
  incompatible: 'No compatible (verificado)',
  unverified: 'Compatibilidad pendiente de verificación',
};

export type CompatibilityScope = 'variant' | 'product' | 'platform';

export const COMPATIBILITY_SCOPE_LABELS: Readonly<Record<CompatibilityScope, string>> = {
  variant: 'Para esta medida específica',
  product: 'Para toda la línea del implante',
  platform: 'Para la plataforma del implante',
};

export type EvidenceType =
  | 'manufacturer_catalog'
  | 'manufacturer_ifu'
  | 'manufacturer_statement'
  | 'technical_validation'
  | 'other';

export const EVIDENCE_TYPE_LABELS: Readonly<Record<EvidenceType, string>> = {
  manufacturer_catalog: 'Catálogo del fabricante',
  manufacturer_ifu: 'Instrucciones de uso del fabricante',
  manufacturer_statement: 'Declaración escrita del fabricante',
  technical_validation: 'Validación técnica documentada',
  other: 'Otra fuente documentada',
};
