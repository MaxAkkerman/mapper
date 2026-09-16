import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMapperCtx } from './MapperContext';
import type { Side } from './MapperContext';
import type { FieldType } from '../../types';
import { TYPE_COLORS } from './treeUtils';

const TYPE_OPTIONS: FieldType[] = ['string', 'number', 'boolean', 'date', 'object', 'array'];

interface AddFieldFormProps {
  side: Side;
  parentPath: string;
  depth: number;
}

export function AddFieldForm({ side, parentPath, depth }: AddFieldFormProps) {
  const ctx = useMapperCtx();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('string');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Autocomplete is a source-tree-only affordance: suggests fields that
  // exist in `source`/`context` but aren't a live child here right now (e.g.
  // removed via 🗑, or simply not added yet) — see DataMapper.getSourceFieldSuggestions.
  const allSuggestions = side === 'source' ? ctx.getSourceFieldSuggestions(parentPath) : [];
  const searchTerm = name.trim().toLowerCase();
  const filteredSuggestions = (searchTerm ? allSuggestions.filter((s) => s.key.toLowerCase().includes(searchTerm)) : allSuggestions).slice(
    0,
    8,
  );
  const suggestionsVisible = showSuggestions && filteredSuggestions.length > 0;

  // The tree panel scrolls with `overflow-y-auto`, which would clip an
  // absolutely-positioned dropdown — render it through a portal, positioned
  // from the input's live viewport rect, so it always renders on top.
  // Measuring a live DOM rect is exactly what an effect is for — there's no
  // value to derive during render before the input has actually painted.
  useLayoutEffect(() => {
    if (!suggestionsVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDropdownRect(null);
      return;
    }
    function updateRect() {
      const el = wrapperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) });
    }
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [suggestionsVisible]);

  function submit(finalName = name, finalType = type) {
    if (!finalName.trim()) return;
    ctx.addField(side, parentPath, finalName, finalType);
    setName('');
    setType('string');
    setShowSuggestions(false);
    setOpen(false);
  }

  function pickSuggestion(s: { key: string; type: FieldType }) {
    setName(s.key);
    setType(s.type);
    setShowSuggestions(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ paddingLeft: depth * 16 + 6 }}
        className="w-full text-left text-[11px] text-slate-400 hover:text-indigo-600 py-1 rounded hover:bg-indigo-50/60"
      >
        + Добавить поле
      </button>
    );
  }

  return (
    <div style={{ paddingLeft: depth * 16 + 6 }} className="flex items-center gap-1 py-1 pr-2">
      <div ref={wrapperRef} className="min-w-0 flex-1">
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="имя поля"
          className="w-full text-xs border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-indigo-400"
        />
      </div>
      {suggestionsVisible &&
        dropdownRect &&
        createPortal(
          <div
            style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            className="z-50 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1"
          >
            {filteredSuggestions.map((s) => (
              <button
                key={s.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickSuggestion(s);
                }}
                className="w-full flex items-center gap-1.5 text-left px-2 py-1 text-xs hover:bg-indigo-50"
              >
                <span className="truncate flex-1 text-slate-700">{s.key}</span>
                <span className={`shrink-0 text-[10px] leading-4 px-1.5 rounded border ${TYPE_COLORS[s.type]}`}>{s.type}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      <select
        value={type}
        onChange={(e) => setType(e.target.value as FieldType)}
        className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white shrink-0"
      >
        {TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button onClick={() => submit()} className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 shrink-0">
        Добавить
      </button>
      <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 shrink-0">
        ×
      </button>
    </div>
  );
}
