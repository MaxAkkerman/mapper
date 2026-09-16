import type { FieldType, SchemaNode } from '../types';

export function detectType(value: unknown): FieldType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  if (t === 'object') return 'object';
  return 'any';
}

/**
 * Builds a SchemaNode tree by inspecting a real example value (form state,
 * a payload template, an API response sample, ...). This is what lets the
 * mapper work purely from runtime JS/TS objects instead of a separate
 * schema-definition language.
 */
export function introspect(value: unknown, path = '', key = path || 'root'): SchemaNode {
  const type = detectType(value);

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const children = Object.keys(obj).map((childKey) =>
      introspect(obj[childKey], path ? `${path}.${childKey}` : childKey, childKey),
    );
    return { path, key, type, children, sample: value };
  }

  if (type === 'array') {
    const arr = value as unknown[];
    const itemPath = `${path}[]`;
    const itemNode =
      arr.length > 0
        ? introspect(arr[0], itemPath, itemPath)
        : { path: itemPath, key: itemPath, type: 'any' as FieldType, sample: undefined };
    return { path, key, type, itemNode, sample: value };
  }

  return { path, key, type, sample: value };
}

/** Depth-first search for a node by its path within a tree. */
export function findNode(root: SchemaNode, path: string): SchemaNode | undefined {
  if (root.path === path) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, path);
      if (found) return found;
    }
  }
  if (root.itemNode) {
    const found = findNode(root.itemNode, path);
    if (found) return found;
  }
  return undefined;
}

export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const segments = path.split('.').filter(Boolean);
  let current: unknown = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.').filter(Boolean);
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof current[seg] !== 'object' || current[seg] === null) {
      current[seg] = {};
    }
    current = current[seg] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}
