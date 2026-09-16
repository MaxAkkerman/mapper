import { useMemo, useState } from 'react';
import { useMapperCtx } from './MapperContext';
import { findByPath } from './treeUtils';
import { getHandler, getHandlersForTypes } from '../../lib/handlers';
import type { FieldType, HandlerParamDef, TransformSpec } from '../../types';

export function TransformPopover() {
  const ctx = useMapperCtx();
  const targetPath = ctx.openTransformFor;
  const mapping = targetPath ? ctx.findMappingForTarget(targetPath) : undefined;

  const [inlineDraft, setInlineDraft] = useState('');
  const [inlineOpen, setInlineOpen] = useState(false);

  const sourceTypes: FieldType[] = useMemo(() => {
    if (!mapping) return [];
    return mapping.sources
      .map((s) => findByPath(ctx.sourceRoot, s.path)?.type)
      .filter((t): t is FieldType => !!t);
  }, [mapping, ctx.sourceRoot]);

  if (!targetPath || !mapping) return null;

  const previewValues = mapping.sources.map((s) => findByPath(ctx.sourceRoot, s.path)?.sample);
  const builtins = getHandlersForTypes(sourceTypes, mapping.sources.length);
  const customs = Object.values(ctx.customHandlers).filter((h) => {
    const min = h.minSources ?? 1;
    const max = h.maxSources ?? 1;
    if (mapping.sources.length < min || mapping.sources.length > max) return false;
    return sourceTypes.some((t) => h.appliesTo.includes(t) || h.appliesTo.includes('any'));
  });

  function apply(spec: TransformSpec) {
    ctx.commitTransform(targetPath!, spec);
    ctx.setOpenTransformFor(null);
  }

  function preview(spec: TransformSpec): string {
    try {
      if (spec.kind === 'identity') return JSON.stringify(previewValues[0]);
      if (spec.kind === 'builtin') {
        const h = getHandler(spec.handlerId);
        if (!h) return '';
        return JSON.stringify(h.run(previewValues, spec.params ?? {}));
      }
      if (spec.kind === 'custom') {
        const h = ctx.customHandlers[spec.handlerId];
        if (!h) return '';
        return JSON.stringify(h.run(previewValues));
      }
      return '';
    } catch {
      return '#ERROR';
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30" onClick={() => ctx.setOpenTransformFor(null)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 p-4"
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold text-slate-800">Преобразование поля</h4>
          <button onClick={() => ctx.setOpenTransformFor(null)} className="text-slate-400 hover:text-slate-700">
            ×
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mb-3 font-mono truncate">→ {targetPath}</p>

        <div className="space-y-1 mb-3">
          <p className="text-[11px] font-medium text-slate-500 mb-1">Источники ({mapping.sources.length})</p>
          {mapping.sources.map((s, i) => (
            <div key={s.path} className="text-xs flex items-center justify-between bg-slate-50 rounded px-2 py-1">
              <span className="font-mono text-slate-700 truncate">{s.path}</span>
              <span className="text-slate-400 ml-2 shrink-0">{JSON.stringify(previewValues[i])}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 max-h-52 overflow-y-auto">
          <p className="text-[11px] font-medium text-slate-500">Встроенные обработчики</p>
          {builtins.length === 0 && <p className="text-xs text-slate-400 italic">Нет обработчиков для этого типа</p>}
          {builtins.map((h) => {
            const active = mapping.transform?.kind === 'builtin' && mapping.transform.handlerId === h.id;
            return (
              <HandlerRow
                key={h.id}
                label={h.label}
                description={h.description}
                active={active}
                previewText={preview({ kind: 'builtin', handlerId: h.id, params: defaultParams(h.params) })}
                params={h.params}
                initialParams={active && mapping.transform?.kind === 'builtin' ? mapping.transform.params : undefined}
                onApply={(params) => apply({ kind: 'builtin', handlerId: h.id, params })}
              />
            );
          })}

          {customs.length > 0 && (
            <>
              <p className="text-[11px] font-medium text-slate-500 pt-2">Кастомные обработчики</p>
              {customs.map((h) => {
                const active = mapping.transform?.kind === 'custom' && mapping.transform.handlerId === h.id;
                return (
                  <button
                    key={h.id}
                    onClick={() => apply({ kind: 'custom', handlerId: h.id })}
                    className={`w-full text-left text-xs rounded-md border px-2 py-1.5 hover:bg-fuchsia-50 ${
                      active ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-slate-200'
                    }`}
                  >
                    <div className="font-medium text-slate-700">{h.label}</div>
                    {h.description && <div className="text-slate-400 text-[11px]">{h.description}</div>}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100">
          {!inlineOpen ? (
            <button
              onClick={() => {
                setInlineOpen(true);
                setInlineDraft(mapping.transform?.kind === 'inline' ? mapping.transform.code : 'return values[0];');
              }}
              className="text-xs text-indigo-600 hover:underline"
            >
              ✎ Написать свой JS-обработчик
            </button>
          ) : (
            <div>
              <p className="text-[11px] text-slate-500 mb-1">
                function(values) {'{'} … {'}'} — <span className="font-mono">values</span> это массив значений источников
              </p>
              <textarea
                value={inlineDraft}
                onChange={(e) => setInlineDraft(e.target.value)}
                rows={5}
                className="w-full text-xs font-mono border border-slate-200 rounded-md p-2 outline-none focus:border-indigo-400"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setInlineOpen(false)} className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700">
                  Отмена
                </button>
                <button
                  onClick={() => apply({ kind: 'inline', code: inlineDraft })}
                  className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Применить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultParams(params?: { name: string; default?: unknown }[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const p of params ?? []) result[p.name] = p.default;
  return result;
}

function HandlerRow({
  label,
  description,
  active,
  previewText,
  params,
  initialParams,
  onApply,
}: {
  label: string;
  description?: string;
  active: boolean;
  previewText: string;
  params?: HandlerParamDef[];
  initialParams?: Record<string, unknown>;
  onApply: (params: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialParams ?? defaultParams(params));

  return (
    <div className={`w-full rounded-md border px-2 py-1.5 ${active ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
      <button onClick={() => onApply(values)} className="w-full text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700">{label}</span>
          <span className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]">{previewText}</span>
        </div>
        {description && <div className="text-[11px] text-slate-400">{description}</div>}
      </button>
      {params && params.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {params.map((p) => (
            <label key={p.name} className="text-[11px] text-slate-500 flex items-center gap-1">
              {p.label}
              <input
                value={String(values[p.name] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                className="w-16 border border-slate-200 rounded px-1 py-0.5 text-[11px]"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
