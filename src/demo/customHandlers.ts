import type { CustomHandlerDef } from '../types';

// Handlers registered by the host application (the low-code platform), on top
// of the mapper's built-ins. Filtered in the UI by the connected field's type,
// exactly like built-ins — the only difference is they run app-defined code
// instead of a generic one.
export const demoCustomHandlers: CustomHandlerDef[] = [
  {
    id: 'priceWithVat',
    label: 'Цена с НДС (×1.2)',
    description: 'Умножает цену на 1.2 и округляет до 2 знаков',
    appliesTo: ['number'],
    run: (values) => Math.round(Number(values[0] ?? 0) * 1.2 * 100) / 100,
  },
  {
    id: 'lineTotal',
    label: 'Сумма строки (цена × кол-во)',
    appliesTo: ['number'],
    minSources: 2,
    maxSources: 2,
    run: (values) => Number(values[0] ?? 0) * Number(values[1] ?? 0),
  },
  {
    id: 'initials',
    label: 'Инициалы (И. П.)',
    appliesTo: ['string'],
    minSources: 2,
    maxSources: 2,
    run: (values) => {
      const [first, last] = values as [string, string];
      const f = first?.trim()?.[0] ?? '';
      const l = last?.trim()?.[0] ?? '';
      return [f && `${f}.`, l && `${l}.`].filter(Boolean).join(' ');
    },
  },
];
