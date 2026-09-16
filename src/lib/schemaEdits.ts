import type { FieldType, SchemaNode } from '../types';

/** Builds a brand-new schema field the user added by hand — either via the
 * "+ Добавить поле" control, or implicitly by dropping a source field onto
 * an object row that has no matching child yet. */
export function buildFieldNode(path: string, key: string, type: FieldType): SchemaNode {
  const node: SchemaNode = { path, key, type, custom: true };
  if (type === 'object') node.children = [];
  if (type === 'array') node.itemNode = { path: `${path}[]`, key: `${path}[]`, type: 'object', children: [] };
  return node;
}

/** Picks a free key among `existing`, appending "_2", "_3", ... on collision. */
export function uniqueKey(existing: Set<string>, base: string): string {
  const cleaned = base.trim() || 'field';
  if (!existing.has(cleaned)) return cleaned;
  let i = 2;
  while (existing.has(`${cleaned}_${i}`)) i++;
  return `${cleaned}_${i}`;
}

/** Overlays user edits (fields added by hand, fields removed/hidden) onto a
 * schema tree that was introspected from an example value. Applied
 * recursively so edits work at any depth, including inside an array's item
 * shape (once the user has drilled into "Открыть перебор"). Runs on every
 * render off plain, cheap state (a Map/Set) — no mutation of the introspected
 * tree, which stays a pure function of the `source`/`target` props. */
export function applyEdits(node: SchemaNode, added: Map<string, SchemaNode[]>, removed: Set<string>): SchemaNode {
  if (node.type === 'object') {
    const base = (node.children ?? []).filter((c) => !removed.has(c.path));
    const extra = (added.get(node.path) ?? []).filter((c) => !removed.has(c.path));
    // De-dupe by path, letting a re-added field (extra) win over a same-path
    // base child — lets "delete then re-add with the same name" behave sanely.
    const byPath = new Map<string, SchemaNode>();
    for (const child of [...base, ...extra]) byPath.set(child.path, child);
    return { ...node, children: Array.from(byPath.values()).map((c) => applyEdits(c, added, removed)) };
  }
  if (node.type === 'array' && node.itemNode) {
    return { ...node, itemNode: applyEdits(node.itemNode, added, removed) };
  }
  return node;
}
