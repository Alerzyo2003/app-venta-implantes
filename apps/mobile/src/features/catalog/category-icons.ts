import type { IconName } from '@/components/ui';

/**
 * Ícono de cada categoría base (slugs de la migración de datos de referencia). Las categorías
 * nuevas usan el ícono genérico hasta que se les asigne uno aquí.
 */
const BY_SLUG: Record<string, IconName> = {
  'implantes-dentales': 'implant',
  'aditamentos-componentes-protesicos': 'layers',
  pilares: 'pillar',
  transfers: 'transfer',
  'tornillos-componentes-conexion': 'screw',
  analogos: 'cube',
  biomateriales: 'drop',
  'instrumental-quirurgico': 'scissors',
  'kits-accesorios-cirugia': 'medicalKit',
  'protesis-rehabilitacion-oral': 'smile',
  'insumos-odontologicos-generales': 'bag',
  'ofertas-destacados': 'tag',
};

export function categoryIcon(slug: string): IconName {
  return BY_SLUG[slug] ?? 'categories';
}
