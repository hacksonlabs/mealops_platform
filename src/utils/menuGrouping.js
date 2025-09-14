// src/utils/menuGrouping.js
export const slugifyId = (str = '') =>
  String(str).toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');

export function groupFlatMenu(flat) {
  const groups = new Map();
  for (const it of flat || []) {
    const name = it.category || 'Menu';
    const id = slugifyId(name);
    if (!groups.has(id)) groups.set(id, { id, name, items: [] });
    groups.get(id).items.push(it);
  }
  const cats = Array.from(groups.values()).map((g) => ({
    id: g.id,
    name: g.name,
    itemCount: g.items.length,
    description: '',
  })).sort((a, b) => a.name.localeCompare(b.name));

  const byCat = {};
  for (const c of cats) byCat[c.id] = groups.get(c.id).items;
  return { categories: cats, itemsByCat: byCat };
}