import type { ProductKind } from '@repo/domain';

import type { IconName } from '@/components/ui';

/**
 * Ícono e ilustración de cada categoría base (slugs de la migración de datos de referencia).
 * Las categorías nuevas usan el ícono genérico y no tienen ilustración hasta asignarlas aquí.
 * Ilustraciones: renders generados para la marca provisional (assets/images/catalog).
 */
const BY_SLUG: Record<string, { icon: IconName; image: number }> = {
  'implantes-dentales': { icon: 'implant', image: require('@/assets/images/catalog/implant.png') },
  'aditamentos-componentes-protesicos': { icon: 'layers', image: require('@/assets/images/catalog/abutment.png') },
  pilares: { icon: 'pillar', image: require('@/assets/images/catalog/abutments.png') },
  transfers: { icon: 'transfer', image: require('@/assets/images/catalog/transfer.png') },
  'tornillos-componentes-conexion': { icon: 'screw', image: require('@/assets/images/catalog/screws.png') },
  analogos: { icon: 'cube', image: require('@/assets/images/catalog/analog.png') },
  biomateriales: { icon: 'drop', image: require('@/assets/images/catalog/biomaterial.png') },
  'instrumental-quirurgico': { icon: 'scissors', image: require('@/assets/images/catalog/instruments.png') },
  'kits-accesorios-cirugia': { icon: 'medicalKit', image: require('@/assets/images/catalog/kit.png') },
  'protesis-rehabilitacion-oral': { icon: 'smile', image: require('@/assets/images/catalog/prosthesis.png') },
  'insumos-odontologicos-generales': { icon: 'bag', image: require('@/assets/images/catalog/supplies.png') },
  'ofertas-destacados': { icon: 'tag', image: require('@/assets/images/catalog/offer.png') },
};

export function categoryIcon(slug: string): IconName {
  return BY_SLUG[slug]?.icon ?? 'categories';
}

export function categoryImage(slug: string): number | undefined {
  return BY_SLUG[slug]?.image;
}

/** Ilustraciones de la cabecera y la promoción de inicio. */
export const ILLUSTRATIONS = {
  implant: require('@/assets/images/catalog/implant.png') as number,
  abutment: require('@/assets/images/catalog/abutment.png') as number,
  prosthesis: require('@/assets/images/catalog/prosthesis.png') as number,
  offer: require('@/assets/images/catalog/offer.png') as number,
};

/**
 * Ilustración genérica por tipo de producto, para productos sin foto publicada. Siempre se
 * muestra rotulada como «Imagen referencial»: no es una foto del producto (principio P-01).
 */
const BY_KIND: Partial<Record<ProductKind, number>> = {
  implant: require('@/assets/images/catalog/implant.png'),
  abutment: require('@/assets/images/catalog/abutment.png'),
  healing_abutment: require('@/assets/images/catalog/abutment.png'),
  transfer: require('@/assets/images/catalog/transfer.png'),
  screw: require('@/assets/images/catalog/screws.png'),
  analog: require('@/assets/images/catalog/analog.png'),
  prosthetic: require('@/assets/images/catalog/prosthesis.png'),
  biomaterial: require('@/assets/images/catalog/biomaterial.png'),
  instrument: require('@/assets/images/catalog/instruments.png'),
  surgical_kit: require('@/assets/images/catalog/kit.png'),
  general_supply: require('@/assets/images/catalog/supplies.png'),
};

export function kindIllustration(kind: ProductKind): number | undefined {
  return BY_KIND[kind];
}
