import { useState } from 'react';

interface JsonPreviewPanelProps {
  output: unknown;
  config: unknown;
  contextText: string;
  onContextTextChange: (text: string) => void;
  contextError: string | null;
  sourceLabel: string;
  sourceText: string;
  onSourceTextChange: (text: string) => void;
  onSourceTextBlur: () => void;
  sourceTextError: string | null;
}

export function JsonPreviewPanel({
  output,
  config,
  contextText,
  onContextTextChange,
  contextError,
  sourceLabel,
  sourceText,
  onSourceTextChange,
  onSourceTextBlur,
  sourceTextError,
}: JsonPreviewPanelProps) {
  const [tab, setTab] = useState<'output' | 'config' | 'source' | 'context'>('output');
  const readOnlyText = JSON.stringify(tab === 'output' ? output : config, null, 2);

  async function copy() {
    try {
      const text = tab === 'context' ? contextText : tab === 'source' ? sourceText : readOnlyText;
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API may be unavailable (e.g. insecure context) — silently ignore
    }
  }

  return (
    <div className="flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden h-full" style={{height: 500}}>
      <div className="flex items-center justify-between border-b border-slate-100 px-2 pt-2">
        <div className="flex gap-1">
          <TabButton active={tab === 'output'} onClick={() => setTab('output')}>
            Результат (JSON)
          </TabButton>
          <TabButton active={tab === 'config'} onClick={() => setTab('config')}>
            Конфиг маппинга
          </TabButton>
          <TabButton active={tab === 'source'} onClick={() => setTab('source')}>
            {sourceLabel}
          </TabButton>
          <TabButton active={tab === 'context'} onClick={() => setTab('context')}>
            Контекст
          </TabButton>
        </div>
        <button onClick={copy} className="text-[11px] text-slate-400 hover:text-indigo-600 mb-2">
          Копировать
        </button>
      </div>

      {tab === 'context' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <textarea
            value={contextText}
            onChange={(e) => onContextTextChange(e.target.value)}
            spellCheck={false}
            placeholder='{ "userId": "123", "locale": "ru" }'
            className="flex-1 resize-none text-[11px] leading-relaxed font-mono text-slate-700 p-3 bg-slate-50 outline-none max-h-[460px]"
          />
          <div className="px-3 py-1.5 border-t border-slate-100 text-[11px]">
            {contextError ? (
              <span className="text-red-600">Невалидный JSON: {contextError}</span>
            ) : (
              <span className="text-slate-400">
                Значения отсюда предлагаются как автодополнение в «+ Добавить поле» слева
              </span>
            )}
          </div>
        </div>
      ) : tab === 'source' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <textarea
            value={sourceText}
            onChange={(e) => onSourceTextChange(e.target.value)}
            onBlur={onSourceTextBlur}
            spellCheck={false}
            placeholder='{ "name": "", "city": "" }'
            className={`flex-1 resize-none text-[11px] leading-relaxed font-mono p-3 outline-none max-h-[460px] ${
              sourceTextError ? 'bg-red-50 text-red-900' : 'bg-slate-50 text-slate-700'
            }`}
          />
          <div className="px-3 py-1.5 border-t border-slate-100 text-[11px]">
            {sourceTextError ? (
              <span className="text-red-600">Невалидный JSON — изменения не применены: {sourceTextError}</span>
            ) : (
              <span className="text-slate-400">Применяется к левому дереву и результату при потере фокуса поля</span>
            )}
          </div>
        </div>
      ) : (
        <pre className="flex-1 overflow-auto text-[11px] leading-relaxed font-mono text-slate-700 p-3 bg-slate-50 max-h-[460px]">
          {readOnlyText}
        </pre>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1.5 border-b-2 -mb-px ${
        active ? 'border-indigo-500 text-indigo-700 font-medium' : 'border-transparent text-slate-400 hover:text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
