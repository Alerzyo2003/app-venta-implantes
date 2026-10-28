import type { Option } from '@/components/ui/field';

interface Named {
  id: string;
  name: string;
  is_active?: boolean;
}

/** Opciones de un selector; los registros inactivos se marcan para no elegirlos por error. */
export function toOptions(items: readonly Named[]): Option[] {
  return items.map((i) => ({ value: i.id, label: i.is_active === false ? `${i.name} (inactivo)` : i.name }));
}

interface TreeNode extends Named {
  parent_id: string | null;
}

/** Árbol de categorías aplanado con sangría («— Subcategoría»), padres antes que hijos. */
export function categoryOptions(categories: readonly TreeNode[]): Option[] {
  const byParent = new Map<string | null, TreeNode[]>();
  for (const c of categories) {
    const key = c.parent_id && categories.some((p) => p.id === c.parent_id) ? c.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const out: Option[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      const label = `${'— '.repeat(depth)}${c.name}${c.is_active === false ? ' (inactiva)' : ''}`;
      out.push({ value: c.id, label });
      if (depth < 5) visit(c.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}
