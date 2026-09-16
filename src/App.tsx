import { useState } from 'react';
import { DataMapper } from './components/DataMapper';
import type { MappingConfig } from './components/DataMapper';
import { contextExample, formStateExample, payloadTemplate } from './demo/exampleData';
import { demoCustomHandlers } from './demo/customHandlers';

export default function App() {
  const [lastConfig, setLastConfig] = useState<MappingConfig | null>(null);

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4">
          <h1 className="text-lg font-semibold text-slate-800">Визуальный маппинг данных</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Перетащите поле из «{'Источник данных'}» на поле «{'Тело запроса'}», чтобы связать их. Несколько полей
            источника можно перетащить в одно поле цели — появится обработчик объединения. Для массивов сначала
            свяжите сам массив, затем нажмите «Открыть перебор →», чтобы замапить поля внутри каждого элемента.
          </p>
        </header>

        <DataMapper
          source={formStateExample}
          target={payloadTemplate}
          context={contextExample}
          customHandlers={demoCustomHandlers}
          sourceLabel="Состояние формы"
          targetLabel="Тело запроса (payload)"
          onChange={setLastConfig}
        />

        <p className="text-[11px] text-slate-400 mt-3">
          Активных связей (включая вложенные, в т.ч. внутри циклов): {lastConfig ? countAll(lastConfig.mappings) : 0}
        </p>
      </div>
    </div>
  );
}

function countAll(mappings: MappingConfig['mappings']): number {
  let n = 0;
  for (const m of mappings) {
    n += 1;
    if (m.children) n += countAll(m.children);
  }
  return n;
}
