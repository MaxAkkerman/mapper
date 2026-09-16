import { useMapperCtx } from './MapperContext';
import { TreeRow } from './TreeRow';
import { AddFieldForm } from './AddFieldForm';
import { partitionByConnection } from './treeUtils';
import type { SchemaNode } from '../../types';

interface SchemaTreeProps {
  side: 'source' | 'target';
  root: SchemaNode;
  title: string;
  subtitle?: string;
}

export function SchemaTree({ side, root, title, subtitle }: SchemaTreeProps) {
  const ctx = useMapperCtx();
  const search = side === 'source' ? ctx.searchSource : ctx.searchTarget;
  const setSearch = side === 'source' ? ctx.setSearchSource : ctx.setSearchTarget;
  const rawRows = root.type === 'object' && root.children ? root.children : [root];
  const { connected, rest } = partitionByConnection(rawRows, ctx.mappingsAtScope, side);

  return (
    <div className="flex flex-col min-w-0 flex-1 bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск поля…"
          className="mt-2 w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
        />
      </div>
      <div
        onScroll={ctx.bumpLayout}
        className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-1.5 max-h-[460px]"
      >
        {connected.map((node) => (
          <TreeRow key={node.path} node={node} side={side} depth={0} />
        ))}
        {connected.length > 0 && rest.length > 0 && <div className="border-t border-dashed border-slate-200 mx-1.5 my-0.5" />}
        {rest.map((node) => (
          <TreeRow key={node.path} node={node} side={side} depth={0} />
        ))}
        {root.type === 'object' && !search && <AddFieldForm side={side} parentPath={root.path} depth={0} />}
      </div>
    </div>
  );
}
