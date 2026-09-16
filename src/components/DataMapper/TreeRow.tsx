import { useMapperCtx } from './MapperContext';
import type { SchemaNode } from '../../types';
import { arrayItemSummary, countPrefixed, findByPath, matchesSearch, partitionByConnection, TYPE_COLORS } from './treeUtils';
import { getHandler } from '../../lib/handlers';
import { AddFieldForm } from './AddFieldForm';

interface TreeRowProps {
  node: SchemaNode;
  side: 'source' | 'target';
  depth: number;
}

export function TreeRow({ node, side, depth }: TreeRowProps) {
  const ctx = useMapperCtx();
  const search = side === 'source' ? ctx.searchSource : ctx.searchTarget;
  if (!matchesSearch(node, search)) return null;

  const isObject = node.type === 'object';
  const isArray = node.type === 'array';
  const hasChildren = isObject && (node.children?.length ?? 0) > 0;
  // Object rows are always expandable, even with zero fields right now — an
  // empty object (e.g. a free-form request-body payload) still needs to be
  // opened to reach "+ Добавить поле" and start filling it in.
  const canExpand = isObject;
  const expandedSet = ctx.expanded[side];
  const isExpanded = search !== '' ? true : expandedSet.has(node.path);

  const isHover = ctx.hover?.path === node.path && ctx.hover?.side === side;
  const isDropTarget = side === 'target' && ctx.dropTargetPath === node.path;
  const isPendingSource = side === 'source' && ctx.pendingSource === node.path;
  const isBeingDragged = side === 'source' && ctx.dragState?.sourcePath === node.path;

  const mapping = side === 'target' ? ctx.findMappingForTarget(node.path) : undefined;
  const isConnectedSource = side === 'source' ? ctx.isSourceConnected(node.path) : false;

  const prefixSet = side === 'source' ? ctx.mappedSourcePrefixes : ctx.mappedTargetPrefixes;
  const collapsedHiddenCount = isObject && hasChildren && !isExpanded ? countPrefixed(prefixSet, node.path) : 0;

  function toggleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    if (canExpand) ctx.toggleExpanded(side, node.path);
  }

  function handleRowClick() {
    if (side === 'source') {
      if (ctx.mode === 'click') {
        ctx.setPendingSource(ctx.pendingSource === node.path ? null : node.path);
      } else if (canExpand) {
        ctx.toggleExpanded(side, node.path);
      }
    } else {
      if (ctx.mode === 'click' && ctx.pendingSource) {
        commitFromPending();
      } else if (canExpand) {
        ctx.toggleExpanded(side, node.path);
      }
    }
  }

  function commitFromPending() {
    if (!ctx.pendingSource) return;
    const sourceNode = findByPath(ctx.sourceRoot, ctx.pendingSource);
    if (sourceNode) ctx.commitConnection(sourceNode, node);
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    ctx.startDrag(node, e);
  }

  const rowRef = (el: HTMLDivElement | null) => ctx.registerAnchor(side, node.path, el);

  return (
    <div>
      <div
        ref={rowRef}
        data-target-path={side === 'target' ? node.path : undefined}
        onClick={handleRowClick}
        onMouseEnter={() => ctx.setHover({ side, path: node.path })}
        onMouseLeave={() => ctx.setHover(null)}
        className={[
          'group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm cursor-pointer select-none border border-transparent',
          isHover ? 'bg-indigo-50' : '',
          isDropTarget ? 'bg-indigo-100 border-indigo-400 ring-2 ring-indigo-300' : '',
          isPendingSource ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-300' : '',
          isBeingDragged ? 'opacity-40' : '',
        ].join(' ')}
        style={{ paddingLeft: depth * 16 + 6 }}
      >
        {canExpand ? (
          <button
            onClick={toggleExpand}
            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0"
            aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          </button>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        <span className="truncate font-medium text-slate-800">{node.key}</span>

        <span className={`shrink-0 text-[10px] leading-4 px-1.5 rounded border ${TYPE_COLORS[node.type]}`}>
          {node.type}
        </span>

        {node.custom && (
          <span
            title="Поле добавлено вручную"
            className="shrink-0 text-[10px] leading-4 px-1 rounded border border-dashed border-slate-300 text-slate-400"
          >
            доб.
          </span>
        )}

        {isObject && !hasChildren && (
          <span className="shrink-0 text-[10px] text-slate-400 italic">пусто</span>
        )}

        {isArray && (
          <span className="shrink-0 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">
            🔁 for each
          </span>
        )}

        {isArray && !mapping && (
          <span className="truncate text-[11px] text-slate-400 italic">{arrayItemSummary(node)}</span>
        )}

        {collapsedHiddenCount > 0 && (
          <span className="shrink-0 text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-1.5">
            {collapsedHiddenCount}
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            ctx.removeField(side, node.path);
          }}
          title="Удалить поле (сделать необязательным / убрать из схемы)"
          className="shrink-0 text-[11px] w-4 h-4 flex items-center justify-center rounded text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
        >
          🗑
        </button>

        <span className="flex-1" />

        {side === 'source' && (
          <>
            {isConnectedSource && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
            <button
              onPointerDown={handlePointerDown}
              title="Перетащите, чтобы связать с полем цели"
              className="shrink-0 w-4 h-4 rounded-full border-2 border-indigo-400 bg-white opacity-0 group-hover:opacity-100 hover:bg-indigo-400 cursor-grab active:cursor-grabbing transition-opacity"
            />
          </>
        )}

        {side === 'target' && mapping && (
          <div className="flex items-center gap-1 shrink-0">
            {mapping.kind === 'loop' ? (
              <>
                <span
                  title={
                    (mapping.children?.length ?? 0) > 0
                      ? 'Элементы преобразуются по заданным внутри правилам'
                      : 'Массив копируется как есть, без изменений'
                  }
                  className="text-[11px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 font-mono"
                >
                  {(mapping.children?.length ?? 0) > 0 ? `✎ ${mapping.children!.length} полей` : '= как есть'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.enterLoop(node, node.key);
                  }}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
                >
                  Открыть перебор →
                </button>
              </>
            ) : (
              <TransformBadge targetPath={node.path} handlerId={mapping.transform} />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                ctx.removeConnectionAll(node.path);
              }}
              title="Удалить связь"
              className="text-[11px] w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {side === 'target' && mapping && mapping.kind === 'value' && mapping.sources.length > 0 && (
        <div style={{ paddingLeft: depth * 16 + 24 }} className="flex flex-wrap gap-1 pb-1 pr-2">
          {mapping.sources.map((s) => (
            <span
              key={s.path}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-1.5 py-0.5"
            >
              {s.path}
              <button
                className="text-indigo-400 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.removeConnectionSource(node.path, s.path);
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {isObject && isExpanded && (
        <div>
          {(() => {
            const { connected, rest } = partitionByConnection(node.children ?? [], ctx.mappingsAtScope, side);
            return (
              <>
                {connected.map((child) => (
                  <TreeRow key={child.path} node={child} side={side} depth={depth + 1} />
                ))}
                {connected.length > 0 && rest.length > 0 && (
                  <div style={{ marginLeft: (depth + 1) * 16 + 6 }} className="border-t border-dashed border-slate-200 my-0.5" />
                )}
                {rest.map((child) => (
                  <TreeRow key={child.path} node={child} side={side} depth={depth + 1} />
                ))}
              </>
            );
          })()}
          {!search && <AddFieldForm side={side} parentPath={node.path} depth={depth + 1} />}
        </div>
      )}
    </div>
  );
}

function TransformBadge({
  targetPath,
  handlerId,
}: {
  targetPath: string;
  handlerId: import('../../types').TransformSpec | undefined;
}) {
  const ctx = useMapperCtx();
  const label = describeTransform(handlerId, ctx.customHandlers);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        ctx.setOpenTransformFor(targetPath);
      }}
      title="Настроить преобразование"
      className="text-[11px] px-1.5 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 border border-fuchsia-200 font-mono"
    >
      ƒx {label}
    </button>
  );
}

function describeTransform(
  spec: import('../../types').TransformSpec | undefined,
  customHandlers: Record<string, import('../../types').CustomHandlerDef>,
): string {
  if (!spec || spec.kind === 'identity') return '=';
  if (spec.kind === 'builtin') return getHandler(spec.handlerId)?.label ?? spec.handlerId;
  if (spec.kind === 'custom') return customHandlers[spec.handlerId]?.label ?? spec.handlerId;
  if (spec.kind === 'inline') return 'custom code';
  return '';
}
