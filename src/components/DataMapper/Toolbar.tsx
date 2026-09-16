import { useMapperCtx } from './MapperContext';
import { TYPE_DOT } from './treeUtils';

interface ToolbarProps {
  onAutoMap: () => void;
  onClearAll: () => void;
  mappedCount: number;
  totalCount: number;
}

export function Toolbar({ onAutoMap, onClearAll, mappedCount, totalCount }: ToolbarProps) {
  const ctx = useMapperCtx();

  function scopeLabel(path: string): string {
    const stripped = path.replace(/\[\]$/, '');
    const last = stripped.split('.').pop() ?? stripped;
    return `🔁 ${last}`;
  }

  return (
    <div className="flex items-center gap-3 flex-wrap bg-white rounded-lg border border-slate-200 px-3 py-2 mb-3">
      <div className="flex items-center gap-1 text-xs">
        <button
          onClick={() => ctx.goToScope(0)}
          className={`px-2 py-1 rounded ${ctx.scopeChain.length === 0 ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Корень
        </button>
        {ctx.scopeChain.map((p, i) => (
          <div key={p} className="flex items-center gap-1">
            <span className="text-slate-300">/</span>
            <button
              onClick={() => ctx.goToScope(i + 1)}
              className={`px-2 py-1 rounded ${
                i === ctx.scopeChain.length - 1 ? 'bg-amber-50 text-amber-700 font-medium' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {scopeLabel(p)}
            </button>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      <div className="text-[11px] text-slate-400 hidden md:flex items-center gap-2">
        {Object.entries(TYPE_DOT).slice(0, 6).map(([type, dot]) => (
          <span key={type} className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {type}
          </span>
        ))}
      </div>

      <span className="text-[11px] text-slate-400">
        Связано: <span className="font-medium text-slate-600">{mappedCount}</span>/{totalCount}
      </span>

      <div className="flex items-center rounded-md border border-slate-200 overflow-hidden text-xs">
        <button
          className={`px-2 py-1 ${ctx.mode === 'drag' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          onClick={() => ctx.setMode('drag')}
        >
          ⇢ Перетаскивание
        </button>
        <button
          className={`px-2 py-1 ${ctx.mode === 'click' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          onClick={() => ctx.setMode('click')}
        >
          ⇥ Клик-клик
        </button>
      </div>

      <button
        onClick={onAutoMap}
        title="Связать поля с одинаковыми именами автоматически"
        className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
      >
        ✨ Авто-связать
      </button>
      <button
        onClick={onClearAll}
        className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
      >
        Очистить всё
      </button>
    </div>
  );
}
