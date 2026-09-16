import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CustomHandlerDef, FieldMapping, FieldType, MappingConfig, SchemaNode, TransformSpec } from '../../types';
import { detectType, introspect } from '../../lib/introspect';
import { applyMapping } from '../../lib/applyMapping';
import { applyEdits, buildFieldNode, uniqueKey } from '../../lib/schemaEdits';
import { pathIsOrUnder } from '../../lib/paths';
import {
  addLoopConnection,
  addValueConnection,
  getContainer,
  pruneMappingsForRemovedPath,
  removeMapping,
  removeSource,
  setTransform,
  updateContainer,
} from '../../lib/mappingOps';
import { MapperContext, type DragState, type Side } from './MapperContext';
import { findByPath } from './treeUtils';
import { SchemaTree } from './SchemaTree';
import { ConnectionsLayer } from './ConnectionsLayer';
import { TransformPopover } from './TransformPopover';
import { Toolbar } from './Toolbar';
import { JsonPreviewPanel } from './JsonPreviewPanel';

export interface DataMapperProps {
  /** Example of the source data, e.g. a form state object. Its shape is
   * inferred automatically (keys, types, nested objects/arrays). */
  source: unknown;
  /** Example/template of the desired target shape, e.g. a request body. */
  target: unknown;
  /** Extra values available alongside `source` — not shown as a mappable
   * tree, but offered as "+ Добавить поле" autocomplete on the source side
   * (e.g. platform/session variables). Editable live via the "Контекст" tab
   * next to the JSON preview; seeds that editor's initial value. */
  context?: unknown;
  /** Initial mapping, e.g. loaded from a saved config. Uncontrolled after mount. */
  initialMapping?: FieldMapping[];
  /** Called whenever the mapping changes. */
  onChange?: (config: MappingConfig) => void;
  /** App-defined named transform functions, offered alongside the built-ins
   * and filtered by the connected field's type. */
  customHandlers?: CustomHandlerDef[];
  sourceLabel?: string;
  targetLabel?: string;
  className?: string;
}

function flattenNodes(node: SchemaNode): SchemaNode[] {
  const acc: SchemaNode[] = [];
  const walk = (n: SchemaNode, isRoot: boolean) => {
    if (!isRoot) acc.push(n);
    if (n.children) for (const c of n.children) walk(c, false);
  };
  walk(node, true);
  return acc;
}

function countMappingsDeep(mappings: FieldMapping[]): number {
  let n = 0;
  for (const m of mappings) {
    n += 1;
    if (m.children) n += countMappingsDeep(m.children);
  }
  return n;
}

export function DataMapper({
  source,
  target,
  context,
  initialMapping,
  onChange,
  customHandlers = [],
  sourceLabel = 'Источник данных',
  targetLabel = 'Тело запроса',
  className,
}: DataMapperProps) {
  // The actual data the mapper works off of on the source side — seeded from
  // the `source` prop, then editable live via the "Состояние формы" tab
  // (JsonPreviewPanel). Kept separate from the `source` prop itself (which
  // stays whatever the host passed) so an in-UI edit doesn't require the host
  // to control the prop; see handleSourceTextBlur below for the commit rule.
  const [effectiveSource, setEffectiveSource] = useState<unknown>(source);
  const [sourceText, setSourceText] = useState(() => JSON.stringify(source, null, 2));

  const rawSourceRoot = useMemo(() => introspect(effectiveSource), [effectiveSource]);
  const rawTargetRoot = useMemo(() => introspect(target), [target]);
  const customHandlersMap = useMemo(
    () => Object.fromEntries(customHandlers.map((h) => [h.id, h])),
    [customHandlers],
  );

  const [mappings, setMappings] = useState<FieldMapping[]>(initialMapping ?? []);
  const [expandedSource, setExpandedSource] = useState<Set<string>>(new Set());
  const [expandedTarget, setExpandedTarget] = useState<Set<string>>(new Set());
  // Fields the user added/removed by hand on top of the introspected example
  // shape — kept separate from `source`/`target` so those props stay pure
  // examples the schema is derived from (see lib/schemaEdits.ts).
  const [addedSourceFields, setAddedSourceFields] = useState<Map<string, SchemaNode[]>>(new Map());
  const [addedTargetFields, setAddedTargetFields] = useState<Map<string, SchemaNode[]>>(new Map());
  const [removedSourcePaths, setRemovedSourcePaths] = useState<Set<string>>(new Set());
  const [removedTargetPaths, setRemovedTargetPaths] = useState<Set<string>>(new Set());
  // Raw text of the "Контекст" tab — an editable JSON object of extra values
  // (not part of the mappable trees) offered as autocomplete for new source
  // fields. Seeded from the `context` prop, then edited live in the UI.
  const [contextText, setContextText] = useState(() => JSON.stringify(context ?? {}, null, 2));
  const [scopeChain, setScopeChain] = useState<string[]>([]);
  const [mode, setMode] = useState<'drag' | 'click'>('click');
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [hover, setHover] = useState<{ side: Side; path: string } | null>(null);
  const [openTransformFor, setOpenTransformFor] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState('');
  const [searchTarget, setSearchTarget] = useState('');
  const [layoutVersion, setLayoutVersion] = useState(0);

  const anchorsRef = useRef(new Map<string, HTMLElement>());
  const rafRef = useRef<number | null>(null);

  const bumpLayout = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setLayoutVersion((v) => v + 1);
    });
  }, []);

  const registerAnchor = useCallback(
    (side: Side, path: string, el: HTMLElement | null) => {
      const key = `${side}:${path}`;
      if (el) anchorsRef.current.set(key, el);
      else anchorsRef.current.delete(key);
      bumpLayout();
    },
    [bumpLayout],
  );

  const getAnchorEl = useCallback((side: Side, path: string) => anchorsRef.current.get(`${side}:${path}`) ?? null, []);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current?.({ version: 1, mappings });
  }, [mappings]);

  const sourceRoot = useMemo(
    () => applyEdits(rawSourceRoot, addedSourceFields, removedSourcePaths),
    [rawSourceRoot, addedSourceFields, removedSourcePaths],
  );
  const targetRoot = useMemo(
    () => applyEdits(rawTargetRoot, addedTargetFields, removedTargetPaths),
    [rawTargetRoot, addedTargetFields, removedTargetPaths],
  );

  const { parsedContext, contextError } = useMemo(() => {
    if (!contextText.trim()) return { parsedContext: {} as Record<string, unknown>, contextError: null as string | null };
    try {
      const parsed = JSON.parse(contextText);
      const obj = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
      return { parsedContext: obj, contextError: null as string | null };
    } catch (err) {
      return { parsedContext: {} as Record<string, unknown>, contextError: (err as Error).message };
    }
  }, [contextText]);

  // Live parse check for the "Состояние формы" editor, shown as the user
  // types — purely informational; committing to `effectiveSource` only
  // happens on blur (handleSourceTextBlur), and never with invalid JSON.
  const sourceTextError = useMemo(() => {
    try {
      JSON.parse(sourceText);
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }, [sourceText]);

  const handleSourceTextBlur = useCallback(() => {
    try {
      const parsed = JSON.parse(sourceText);
      setEffectiveSource(parsed);
      setSourceText(JSON.stringify(parsed, null, 2));
    } catch {
      // Invalid JSON on blur: leave `effectiveSource` (and the mapper's
      // schema/output built from it) exactly as it was — nothing is applied.
    }
  }, [sourceText]);

  // Fields present in the raw source example but not a live child of the
  // same parent right now (e.g. removed via 🗑) become re-addable via
  // autocomplete, alongside top-level keys of the (live-edited) context —
  // see "+ Добавить поле" on the source tree only.
  const getSourceFieldSuggestions = useCallback(
    (parentPath: string): { key: string; type: FieldType }[] => {
      const rawParent = findByPath(rawSourceRoot, parentPath);
      const liveParent = findByPath(sourceRoot, parentPath);
      const liveKeys = new Set((liveParent?.children ?? []).map((c) => c.key));

      const fromSource = (rawParent?.children ?? [])
        .filter((c) => !liveKeys.has(c.key))
        .map((c) => ({ key: c.key, type: c.type }));

      const fromContext = Object.entries(parsedContext)
        .filter(([key]) => !liveKeys.has(key))
        .map(([key, value]) => ({ key, type: detectType(value) }));

      const seen = new Set<string>();
      const merged: { key: string; type: FieldType }[] = [];
      for (const item of [...fromSource, ...fromContext]) {
        if (seen.has(item.key)) continue;
        seen.add(item.key);
        merged.push(item);
      }
      return merged;
    },
    [rawSourceRoot, sourceRoot, parsedContext],
  );

  const mappingsAtScope = useMemo(() => getContainer(mappings, scopeChain), [mappings, scopeChain]);

  const { visibleSourceRoot, visibleTargetRoot } = useMemo(() => {
    if (scopeChain.length === 0) return { visibleSourceRoot: sourceRoot, visibleTargetRoot: targetRoot };
    const outer = getContainer(mappings, scopeChain.slice(0, -1));
    const lastTargetPath = scopeChain[scopeChain.length - 1];
    const loop = outer.find((m) => m.targetPath === lastTargetPath && m.kind === 'loop');
    const vs = loop ? findByPath(sourceRoot, loop.sources[0]?.path ?? '')?.itemNode : undefined;
    const vt = loop ? findByPath(targetRoot, loop.targetPath)?.itemNode : undefined;
    return { visibleSourceRoot: vs ?? sourceRoot, visibleTargetRoot: vt ?? targetRoot };
  }, [scopeChain, mappings, sourceRoot, targetRoot]);

  const mappedSourcePrefixes = useMemo(() => {
    const set = new Set<string>();
    for (const m of mappingsAtScope) for (const s of m.sources) set.add(s.path);
    return set;
  }, [mappingsAtScope]);
  const mappedTargetPrefixes = useMemo(() => new Set(mappingsAtScope.map((m) => m.targetPath)), [mappingsAtScope]);

  const findMappingForTarget = useCallback(
    (targetPath: string) => mappingsAtScope.find((m) => m.targetPath === targetPath),
    [mappingsAtScope],
  );
  const isSourceConnected = useCallback(
    (sourcePath: string) => mappingsAtScope.some((m) => m.sources.some((s) => s.path === sourcePath)),
    [mappingsAtScope],
  );

  // Creates a field the user added by hand — either explicitly via "+
  // Добавить поле", or implicitly when connecting a source field onto a
  // target *object* row that has no matching child yet (see commitConnection
  // below). Returns the new node so the caller can connect to it right away.
  const createFieldAndRegister = useCallback(
    (side: Side, parentPath: string, desiredKey: string, type: FieldType): SchemaNode => {
      const root = side === 'source' ? sourceRoot : targetRoot;
      const parent = findByPath(root, parentPath);
      const existingKeys = new Set((parent?.children ?? []).map((c) => c.key));
      const finalKey = uniqueKey(existingKeys, desiredKey);
      const path = parentPath ? `${parentPath}.${finalKey}` : finalKey;
      const node = buildFieldNode(path, finalKey, type);
      const setAdded = side === 'source' ? setAddedSourceFields : setAddedTargetFields;
      const setRemoved = side === 'source' ? setRemovedSourcePaths : setRemovedTargetPaths;
      setAdded((prev) => {
        const next = new Map(prev);
        next.set(parentPath, [...(next.get(parentPath) ?? []), node]);
        return next;
      });
      setRemoved((prev) => {
        if (!prev.has(path)) return prev;
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      return node;
    },
    [sourceRoot, targetRoot],
  );

  const addField = useCallback(
    (side: Side, parentPath: string, key: string, type: FieldType) => {
      createFieldAndRegister(side, parentPath, key, type);
    },
    [createFieldAndRegister],
  );

  const removeField = useCallback(
    (side: Side, path: string) => {
      const setRemoved = side === 'source' ? setRemovedSourcePaths : setRemovedTargetPaths;
      setRemoved((prev) => (prev.has(path) ? prev : new Set(prev).add(path)));
      setMappings((prev) => pruneMappingsForRemovedPath(prev, side, path));
      if (side === 'source' && pendingSource && pathIsOrUnder(pendingSource, path)) setPendingSource(null);
      if (side === 'target' && openTransformFor && pathIsOrUnder(openTransformFor, path)) setOpenTransformFor(null);
      // A removed field can invalidate the current loop drill-down (its own
      // array, or an ancestor of it, might just have been removed) — bounce
      // back to the root rather than risk showing a dangling scope.
      setScopeChain((prev) => (prev.length > 0 ? [] : prev));
    },
    [pendingSource, openTransformFor],
  );

  const commitConnection = useCallback(
    (sourceNode: SchemaNode, targetNode: SchemaNode) => {
      if (targetNode.type === 'object') {
        // Dropping onto an object row (rather than one of its specific
        // fields) adds a new field named after the source — this is how an
        // empty/free-form target object (or one that simply doesn't have a
        // matching field yet) gets filled in. Reuses a same-named live child
        // instead of creating a duplicate.
        const existingChild = targetNode.children?.find((c) => c.key.toLowerCase() === sourceNode.key.toLowerCase());
        const fieldNode = existingChild ?? createFieldAndRegister('target', targetNode.path, sourceNode.key, sourceNode.type);
        setMappings((prev) =>
          fieldNode.type === 'array'
            ? addLoopConnection(prev, scopeChain, fieldNode.path, sourceNode.path)
            : addValueConnection(prev, scopeChain, fieldNode.path, sourceNode.path),
        );
        setPendingSource(null);
        return;
      }
      const sourceIsArray = sourceNode.type === 'array';
      const targetIsArray = targetNode.type === 'array';
      if (sourceIsArray !== targetIsArray) return; // type mismatch: array can only pair with array
      setMappings((prev) =>
        targetIsArray
          ? addLoopConnection(prev, scopeChain, targetNode.path, sourceNode.path)
          : addValueConnection(prev, scopeChain, targetNode.path, sourceNode.path),
      );
      setPendingSource(null);
    },
    [scopeChain, createFieldAndRegister],
  );

  const removeConnectionSource = useCallback(
    (targetPath: string, sourcePath: string) => {
      setMappings((prev) => removeSource(prev, scopeChain, targetPath, sourcePath));
    },
    [scopeChain],
  );
  const removeConnectionAll = useCallback(
    (targetPath: string) => {
      setMappings((prev) => removeMapping(prev, scopeChain, targetPath));
    },
    [scopeChain],
  );
  const commitTransform = useCallback(
    (targetPath: string, transform: TransformSpec) => {
      setMappings((prev) => setTransform(prev, scopeChain, targetPath, transform));
    },
    [scopeChain],
  );

  const startDrag = useCallback((node: SchemaNode, e: React.PointerEvent) => {
    setPendingSource(null);
    setDragState({ sourcePath: node.path, sourceNode: node, x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const initial = dragState;
    function onMove(e: PointerEvent) {
      setDragState((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dropEl = (el as HTMLElement | null)?.closest('[data-target-path]') as HTMLElement | null;
      setDropTargetPath(dropEl?.dataset.targetPath ?? null);
    }
    function onUp(e: PointerEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dropEl = (el as HTMLElement | null)?.closest('[data-target-path]') as HTMLElement | null;
      const targetPath = dropEl?.dataset.targetPath;
      if (targetPath) {
        const targetNode = findByPath(targetRoot, targetPath);
        if (targetNode) commitConnection(initial.sourceNode, targetNode);
      }
      setDragState(null);
      setDropTargetPath(null);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on drag start/stop only
  }, [dragState !== null]);

  const enterLoop = useCallback((targetNode: SchemaNode) => {
    setScopeChain((prev) => [...prev, targetNode.path]);
    setPendingSource(null);
    setSearchSource('');
    setSearchTarget('');
  }, []);
  const goToScope = useCallback((depth: number) => {
    setScopeChain((prev) => prev.slice(0, depth));
    setPendingSource(null);
    setSearchSource('');
    setSearchTarget('');
  }, []);

  function handleAutoMap() {
    const targetNodes = flattenNodes(visibleTargetRoot);
    const sourceNodes = flattenNodes(visibleSourceRoot);
    setMappings((prev) => {
      let next = prev;
      for (const tNode of targetNodes) {
        const already = getContainer(next, scopeChain).some((m) => m.targetPath === tNode.path);
        if (already) continue;
        const match = sourceNodes.find(
          (sNode) => sNode.key.toLowerCase() === tNode.key.toLowerCase() && (sNode.type === 'array') === (tNode.type === 'array'),
        );
        if (!match) continue;
        next =
          match.type === 'array'
            ? addLoopConnection(next, scopeChain, tNode.path, match.path)
            : addValueConnection(next, scopeChain, tNode.path, match.path);
      }
      return next;
    });
  }

  function handleClearAll() {
    setMappings((prev) => updateContainer(prev, scopeChain, () => []));
  }

  const computedOutput = useMemo(
    () => applyMapping(effectiveSource, mappings, customHandlersMap),
    [effectiveSource, mappings, customHandlersMap],
  );
  const mappingConfig: MappingConfig = useMemo(() => ({ version: 1, mappings }), [mappings]);

  const totalTargetFields = useMemo(() => flattenNodes(targetRoot).length, [targetRoot]);
  const totalMapped = useMemo(() => countMappingsDeep(mappings), [mappings]);

  const toggleExpanded = useCallback((side: Side, path: string) => {
    const setter = side === 'source' ? setExpandedSource : setExpandedTarget;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const ctxValue = {
    mode,
    setMode,
    scopeChain,
    mappingsAtScope,
    expanded: { source: expandedSource, target: expandedTarget },
    toggleExpanded,
    registerAnchor,
    hover,
    setHover,
    pendingSource,
    setPendingSource,
    dragState,
    startDrag,
    dropTargetPath,
    setDropTargetPath,
    commitConnection,
    removeConnectionSource,
    removeConnectionAll,
    openTransformFor,
    setOpenTransformFor,
    commitTransform,
    findMappingForTarget,
    isSourceConnected,
    enterLoop,
    goToScope,
    sourceRoot,
    targetRoot,
    customHandlers: customHandlersMap,
    mappedSourcePrefixes,
    mappedTargetPrefixes,
    searchSource,
    searchTarget,
    setSearchSource,
    setSearchTarget,
    bumpLayout,
    layoutVersion,
    getAnchorEl,
    addField,
    removeField,
    getSourceFieldSuggestions,
  };

  return (
    <MapperContext.Provider value={ctxValue}>
      <div className={className}>
        <Toolbar onAutoMap={handleAutoMap} onClearAll={handleClearAll} mappedCount={totalMapped} totalCount={totalTargetFields} />
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SchemaTree
            side="source"
            root={visibleSourceRoot}
            title={sourceLabel}
            subtitle={scopeChain.length > 0 ? 'Поля одного элемента массива' : undefined}
          />
          <SchemaTree
            side="target"
            root={visibleTargetRoot}
            title={targetLabel}
            subtitle={scopeChain.length > 0 ? 'Заполняется для каждого элемента' : undefined}
          />
          <ConnectionsLayer />
        </div>
        <div className="mt-4">
          <JsonPreviewPanel
            output={computedOutput}
            config={mappingConfig}
            contextText={contextText}
            onContextTextChange={setContextText}
            contextError={contextError}
            sourceLabel={sourceLabel}
            sourceText={sourceText}
            onSourceTextChange={setSourceText}
            onSourceTextBlur={handleSourceTextBlur}
            sourceTextError={sourceTextError}
          />
        </div>
        <TransformPopover />
      </div>
    </MapperContext.Provider>
  );
}
