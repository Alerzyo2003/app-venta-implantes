/**
 * Tipos de producto y campos técnicos aplicables (CAT-04). Los formularios del panel y la
 * ficha de la app muestran solo los campos que corresponden a cada tipo.
 */

export type TechnicalField =
  | 'implantSystem'
  | 'platform'
  | 'connectionType'
  | 'diameterMm'
  | 'lengthMm';

export interface ProductKindSpec {
  label: string;
  technicalFields: readonly TechnicalField[];
  /** Valores sugeridos al crear el producto (editables). */
  tracksLotsDefault: boolean;
  tracksExpiryDefault: boolean;
  /** Puede ser el "lado implante" de una compatibilidad. */
  isImplant: boolean;
  /** Puede ser el "lado componente" de una compatibilidad. */
  isComponent: boolean;
}

export const PRODUCT_KINDS = {
  implant: {
    label: 'Implante',
    technicalFields: ['implantSystem', 'platform', 'connectionType', 'diameterMm', 'lengthMm'],
    tracksLotsDefault: true,
    tracksExpiryDefault: true,
    isImplant: true,
    isComponent: false,
  },
  abutment: {
    label: 'Pilar',
    technicalFields: ['implantSystem', 'platform', 'connectionType'],
    tracksLotsDefault: true,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: true,
  },
  healing_abutment: {
    label: 'Tornillo o pilar de cicatrización',
    technicalFields: ['implantSystem', 'platform', 'connectionType', 'diameterMm'],
    tracksLotsDefault: true,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: true,
  },
  transfer: {
    label: 'Transfer',
    technicalFields: ['implantSystem', 'platform', 'connectionType'],
    tracksLotsDefault: true,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: true,
  },
  screw: {
    label: 'Tornillo o componente de conexión',
    technicalFields: ['implantSystem', 'platform', 'connectionType'],
    tracksLotsDefault: true,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: true,
  },
  analog: {
    label: 'Análogo',
    technicalFields: ['implantSystem', 'platform', 'connectionType'],
    tracksLotsDefault: true,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: true,
  },
  prosthetic: {
    label: 'Componente protésico',
    technicalFields: ['implantSystem', 'platform', 'connectionType'],
    tracksLotsDefault: true,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: true,
  },
  biomaterial: {
    label: 'Biomaterial',
    technicalFields: [],
    tracksLotsDefault: true,
    tracksExpiryDefault: true,
    isImplant: false,
    isComponent: false,
  },
  instrument: {
    label: 'Instrumental quirúrgico',
    technicalFields: ['implantSystem'],
    tracksLotsDefault: false,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: true,
  },
  surgical_kit: {
    label: 'Kit o accesorio de cirugía',
    technicalFields: ['implantSystem'],
    tracksLotsDefault: false,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: true,
  },
  general_supply: {
    label: 'Insumo odontológico general',
    technicalFields: [],
    tracksLotsDefault: false,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: false,
  },
  other: {
    label: 'Otro',
    technicalFields: [],
    tracksLotsDefault: false,
    tracksExpiryDefault: false,
    isImplant: false,
    isComponent: false,
  },
} as const satisfies Record<string, ProductKindSpec>;

export type ProductKind = keyof typeof PRODUCT_KINDS;
export const PRODUCT_KIND_CODES = Object.keys(PRODUCT_KINDS) as ProductKind[];

export function productKindHasField(kind: ProductKind, field: TechnicalField): boolean {
  return (PRODUCT_KINDS[kind].technicalFields as readonly TechnicalField[]).includes(field);
}
