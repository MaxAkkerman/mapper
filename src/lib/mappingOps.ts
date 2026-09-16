import type { FieldMapping, TransformSpec } from '../types';
import { pathIsOrUnder } from './paths';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Returns the (possibly nested, inside loops) array of sibling mappings that
 * `scopeChain` points at, without mutating anything. `scopeChain` is a list of
 * loop-mapping targetPaths from outermost to innermost. */
export function getContainer(mappings: FieldMapping[], scopeChain: string[]): FieldMapping[] {
  let current = mappings;
  for (const scopeTargetPath of scopeChain) {
    const found = current.find((m) => m.targetPath === scopeTargetPath && m.kind === 'loop');
    if (!found) return [];
    current = found.children ?? [];
  }
  return current;
}

export function updateContainer(
  mappings: FieldMapping[],
  scopeChain: string[],
  updater: (container: FieldMapping[]) => FieldMapping[],
): FieldMapping[] {
  if (scopeChain.length === 0) return updater(mappings);
  const [head, ...rest] = scopeChain;
  return mappings.map((m) =>
    m.targetPath === head && m.kind === 'loop'
      ? { ...m, children: updateContainer(m.children ?? [], rest, updater) }
      : m,
  );
}

export function findMapping(
  mappings: FieldMapping[],
  scopeChain: string[],
  targetPath: string,
): FieldMapping | undefined {
  return getContainer(mappings, scopeChain).find((m) => m.targetPath === targetPath);
}

/** Connects a single-value source field to a target field. If the target is
 * already mapped, the source is appended (multi-source combine), automatically
 * defaulting to a "concat" transform the first time it becomes multi-source. */
export function addValueConnection(
  mappings: FieldMapping[],
  scopeChain: string[],
  targetPath: string,
  sourcePath: string,
): FieldMapping[] {
  return updateContainer(mappings, scopeChain, (container) => {
    const idx = container.findIndex((m) => m.targetPath === targetPath);
    if (idx === -1) {
      return [...container, { id: uid(), targetPath, kind: 'value', sources: [{ path: sourcePath }] }];
    }
    const existing = container[idx];
    if (existing.sources.some((s) => s.path === sourcePath)) return container;
    const newSources = [...existing.sources, { path: sourcePath }];
    const newTransform: TransformSpec | undefined =
      newSources.length > 1 && (!existing.transform || existing.transform.kind === 'identity')
        ? { kind: 'builtin', handlerId: 'concat', params: { separator: ' ' } }
        : existing.transform;
    return container.map((m, i) => (i === idx ? { ...existing, sources: newSources, transform: newTransform } : m));
  });
}

/** Connects a source array to a target array, establishing (or replacing the
 * source of) a loop mapping. Existing item-level mappings are preserved. */
export function addLoopConnection(
  mappings: FieldMapping[],
  scopeChain: string[],
  targetPath: string,
  sourcePath: string,
): FieldMapping[] {
  return updateContainer(mappings, scopeChain, (container) => {
    const idx = container.findIndex((m) => m.targetPath === targetPath);
    if (idx === -1) {
      return [...container, { id: uid(), targetPath, kind: 'loop', sources: [{ path: sourcePath }], children: [] }];
    }
    const existing = container[idx];
    return container.map((m, i) =>
      i === idx ? { ...existing, kind: 'loop', sources: [{ path: sourcePath }], children: existing.children ?? [] } : m,
    );
  });
}

export function removeSource(
  mappings: FieldMapping[],
  scopeChain: string[],
  targetPath: string,
  sourcePath: string,
): FieldMapping[] {
  return updateContainer(mappings, scopeChain, (container) => {
    const idx = container.findIndex((m) => m.targetPath === targetPath);
    if (idx === -1) return container;
    const existing = container[idx];
    const newSources = existing.sources.filter((s) => s.path !== sourcePath);
    if (newSources.length === 0) return container.filter((_, i) => i !== idx);
    const newTransform = newSources.length === 1 ? undefined : existing.transform;
    return container.map((m, i) => (i === idx ? { ...existing, sources: newSources, transform: newTransform } : m));
  });
}

export function removeMapping(mappings: FieldMapping[], scopeChain: string[], targetPath: string): FieldMapping[] {
  return updateContainer(mappings, scopeChain, (container) => container.filter((m) => m.targetPath !== targetPath));
}

/** Cascades a schema field's removal into the mapping tree, at every scope
 * level: drops any mapping whose target field (or an ancestor of it) was
 * removed, drops a loop mapping whose source array was removed, and strips
 * the removed path out of multi-source `sources` lists (dropping the whole
 * mapping if no source is left). Recurses into loop children so a removal
 * inside an already-drilled-into array item is cleaned up too. */
export function pruneMappingsForRemovedPath(
  mappings: FieldMapping[],
  side: 'source' | 'target',
  removedPath: string,
): FieldMapping[] {
  const result: FieldMapping[] = [];
  for (const m of mappings) {
    if (side === 'target' && pathIsOrUnder(m.targetPath, removedPath)) continue;
    if (side === 'source' && m.kind === 'loop' && pathIsOrUnder(m.sources[0]?.path ?? '', removedPath)) continue;

    let next = m;
    if (side === 'source' && m.kind === 'value') {
      const newSources = m.sources.filter((s) => !pathIsOrUnder(s.path, removedPath));
      if (newSources.length === 0) continue;
      if (newSources.length !== m.sources.length) {
        next = { ...m, sources: newSources, transform: newSources.length === 1 ? undefined : m.transform };
      }
    }
    if (next.children) {
      next = { ...next, children: pruneMappingsForRemovedPath(next.children, side, removedPath) };
    }
    result.push(next);
  }
  return result;
}

export function setTransform(
  mappings: FieldMapping[],
  scopeChain: string[],
  targetPath: string,
  transform: TransformSpec,
): FieldMapping[] {
  return updateContainer(mappings, scopeChain, (container) =>
    container.map((m) => (m.targetPath === targetPath ? { ...m, transform } : m)),
  );
}
