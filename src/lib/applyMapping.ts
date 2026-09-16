import type { CustomHandlerDef, FieldMapping, TransformSpec } from '../types';
import { getByPath, setByPath } from './introspect';
import { getHandler } from './handlers';

function stripArrayMarkers(path: string): string {
  return path.replace(/\[\]/g, '');
}

/** Removes an exact ancestor-scope prefix (e.g. "items[]." ) before stripping
 * remaining "[]" markers, so a path like "items[].code" resolves to "code"
 * relative to one array item — not "items.code". Without the prefix removal,
 * nested loop fields would collide with the array's own key. */
function relativize(path: string, prefix: string): string {
  const withoutPrefix = prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path;
  return stripArrayMarkers(withoutPrefix);
}

function runTransform(
  spec: TransformSpec | undefined,
  values: unknown[],
  customHandlers: Record<string, CustomHandlerDef>,
): unknown {
  if (!spec || spec.kind === 'identity') return values[0];

  if (spec.kind === 'builtin') {
    const handler = getHandler(spec.handlerId);
    if (!handler) return values[0];
    return handler.run(values, spec.params ?? {});
  }

  if (spec.kind === 'custom') {
    const handler = customHandlers[spec.handlerId];
    if (!handler) return values[0];
    return handler.run(values);
  }

  if (spec.kind === 'inline') {
    try {
      // eslint-disable-next-line no-new-func -- intentional: lets power users write
      // one-off transforms in the UI. Only ever runs against local example data
      // inside the visual builder; see README "Безопасность custom-кода".
      const fn = new Function('values', spec.code) as (values: unknown[]) => unknown;
      return fn(values);
    } catch (err) {
      return `#ERROR: ${(err as Error).message}`;
    }
  }

  return values[0];
}

function applyOne(
  mapping: FieldMapping,
  scope: unknown,
  target: Record<string, unknown>,
  customHandlers: Record<string, CustomHandlerDef>,
  targetPrefix: string,
  sourcePrefix: string,
) {
  const relativeTargetPath = relativize(mapping.targetPath, targetPrefix);

  if (mapping.kind === 'value') {
    const values = mapping.sources.map((s) => getByPath(scope, relativize(s.path, sourcePrefix)));
    const result = runTransform(mapping.transform, values, customHandlers);
    setByPath(target, relativeTargetPath, result);
    return;
  }

  // loop mapping
  const sourceArrayPath = relativize(mapping.sources[0]?.path ?? '', sourcePrefix);
  const sourceArray = getByPath(scope, sourceArrayPath);
  if (!Array.isArray(sourceArray)) {
    setByPath(target, relativeTargetPath, []);
    return;
  }
  // By default an array is transferred as-is (no per-item mapping has been
  // set up yet) — only once the user opens "Открыть перебор" and connects at
  // least one field inside does it switch to computing each item from
  // `children`. This matches the array row itself, which is only editable
  // after drilling in.
  if (!mapping.children || mapping.children.length === 0) {
    setByPath(target, relativeTargetPath, sourceArray.slice());
    return;
  }
  // Nested paths (e.g. "items[].code") are always absolute from the schema
  // root. An array *field* itself has no "[]" in its own path (only the
  // shape of one item does, via SchemaNode.itemNode.path), so the prefix to
  // strip from this mapping's children re-adds the "[]" marker before the dot.
  const childTargetPrefix = `${mapping.targetPath}[].`;
  const childSourcePrefix = `${mapping.sources[0]?.path ?? ''}[].`;
  const items = sourceArray.map((item) => {
    const itemTarget: Record<string, unknown> = {};
    for (const child of mapping.children ?? []) {
      applyOne(child, item, itemTarget, customHandlers, childTargetPrefix, childSourcePrefix);
    }
    return itemTarget;
  });
  setByPath(target, relativeTargetPath, items);
}

export function applyMapping(
  source: unknown,
  mappings: FieldMapping[],
  customHandlers: Record<string, CustomHandlerDef> = {},
): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const mapping of mappings) {
    try {
      applyOne(mapping, source, target, customHandlers, '', '');
    } catch (err) {
      setByPath(target, relativize(mapping.targetPath, ''), `#ERROR: ${(err as Error).message}`);
    }
  }
  return target;
}
