import type { FieldMapping, SchemaNode } from '../../types';
import { pathIsOrUnder } from '../../lib/paths';
import type { Side } from './MapperContext';

export function matchesSearch(node: SchemaNode, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  if (node.key.toLowerCase().includes(t) || node.path.toLowerCase().includes(t)) return true;
  if (node.children) return node.children.some((c) => matchesSearch(c, t));
  if (node.itemNode) return matchesSearch(node.itemNode, t);
  return false;
}

export function arrayItemSummary(node: SchemaNode): string {
  if (!node.itemNode) return '';
  const item = node.itemNode;
  if (item.type === 'object' && item.children) {
    const keys = item.children.map((c) => c.key);
    const shown = keys.slice(0, 4).join(', ');
    return keys.length > 4 ? `${shown}, +${keys.length - 4}` : shown;
  }
  return item.type;
}

export const TYPE_LABEL: Record<string, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  date: 'date',
  object: 'object',
  array: 'array',
  null: 'null',
  any: 'any',
};

export const TYPE_COLORS: Record<string, string> = {
  string: 'bg-sky-50 text-sky-700 border-sky-200',
  number: 'bg-violet-50 text-violet-700 border-violet-200',
  boolean: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  date: 'bg-teal-50 text-teal-700 border-teal-200',
  object: 'bg-slate-100 text-slate-600 border-slate-300',
  array: 'bg-amber-50 text-amber-700 border-amber-200',
  null: 'bg-gray-50 text-gray-500 border-gray-200',
  any: 'bg-gray-50 text-gray-500 border-gray-200',
};

export function findByPath(root: SchemaNode, path: string): SchemaNode | undefined {
  if (root.path === path) return root;
  if (root.children) {
    for (const c of root.children) {
      const found = findByPath(c, path);
      if (found) return found;
    }
  }
  if (root.itemNode) return findByPath(root.itemNode, path);
  return undefined;
}

/** True when `path` itself is a mapped path in `prefixSet`, or is the
 * ancestor of one (an object/array field containing a mapped descendant). */
export function countPrefixed(set: Set<string>, prefix: string): number {
  let count = 0;
  for (const p of set) {
    if (p === prefix || p.startsWith(`${prefix}.`) || p.startsWith(`${prefix}[`)) count++;
  }
  return count;
}

/** Where a node sits in mapping order: `[mappingIndex, sourceIndex]` of the
 * *earliest* mapping (in `mappings`, i.e. creation order at this scope) that
 * connects `path` — directly, or via a descendant (a container whose
 * contents are connected). `sourceIndex` is the position of `path` within
 * that mapping's `sources` (always 0 on the target side, since a target path
 * belongs to at most one mapping — ties there only happen for a container
 * matched through more than one descendant mapping, and fall back to
 * original order). `undefined` means unconnected. */
function connectionOrderKey(mappings: FieldMapping[], path: string, side: Side): [number, number] | undefined {
  let best: [number, number] | undefined;
  mappings.forEach((m, mappingIndex) => {
    if (side === 'target') {
      if (pathIsOrUnder(m.targetPath, path) && (!best || mappingIndex < best[0])) best = [mappingIndex, 0];
      return;
    }
    m.sources.forEach((s, sourceIndex) => {
      if (!pathIsOrUnder(s.path, path)) return;
      if (!best || mappingIndex < best[0] || (mappingIndex === best[0] && sourceIndex < best[1])) {
        best = [mappingIndex, sourceIndex];
      }
    });
  });
  return best;
}

/** Splits sibling nodes into "connected" (linked to something, directly or
 * via a descendant) and "the rest". "The rest" keeps its original relative
 * order; "connected" is instead ordered by `connectionOrderKey` — the same
 * mapping-creation order on both the source and target trees — so a row and
 * its counterpart land at (or very near) the same position in their
 * respective lists: connector lines run close to horizontal instead of
 * criss-crossing past unrelated rows. This is a two-list ordering heuristic,
 * not a full crossing-minimization solve (see README §2.1) — it produces
 * exact alignment for the common 1-to-1 and "one target, several ordered
 * sources" cases, and a good-enough grouping otherwise. */
export function partitionByConnection(
  nodes: SchemaNode[],
  mappings: FieldMapping[],
  side: Side,
): { connected: SchemaNode[]; rest: SchemaNode[] } {
  const rest: SchemaNode[] = [];
  const keyed: { node: SchemaNode; key: [number, number] }[] = [];
  for (const node of nodes) {
    const key = connectionOrderKey(mappings, node.path, side);
    if (key) keyed.push({ node, key });
    else rest.push(node);
  }
  keyed.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1]);
  return { connected: keyed.map((k) => k.node), rest };
}

export const TYPE_DOT: Record<string, string> = {
  string: 'bg-sky-500',
  number: 'bg-violet-500',
  boolean: 'bg-emerald-500',
  date: 'bg-teal-500',
  object: 'bg-slate-400',
  array: 'bg-amber-500',
  null: 'bg-gray-400',
  any: 'bg-gray-400',
};
