import type { FieldType, TransformHandler } from '../types';

const MANY = Infinity;

export const BUILTIN_HANDLERS: TransformHandler[] = [
  {
    id: 'identity',
    label: 'Без изменений',
    description: 'Значение передаётся как есть',
    appliesTo: ['string', 'number', 'boolean', 'date', 'object', 'array', 'null', 'any'],
    run: (values) => values[0],
  },
  {
    id: 'toString',
    label: 'В строку',
    appliesTo: ['number', 'boolean', 'date', 'any'],
    run: (values) => (values[0] == null ? '' : String(values[0])),
  },
  {
    id: 'upperCase',
    label: 'В ВЕРХНИЙ РЕГИСТР',
    appliesTo: ['string'],
    run: (values) => String(values[0] ?? '').toUpperCase(),
  },
  {
    id: 'lowerCase',
    label: 'в нижний регистр',
    appliesTo: ['string'],
    run: (values) => String(values[0] ?? '').toLowerCase(),
  },
  {
    id: 'trim',
    label: 'Обрезать пробелы',
    appliesTo: ['string'],
    run: (values) => String(values[0] ?? '').trim(),
  },
  {
    id: 'concat',
    label: 'Склеить через разделитель',
    description: 'Соединяет несколько полей в одну строку',
    appliesTo: ['string', 'number', 'boolean', 'date', 'any'],
    minSources: 2,
    maxSources: MANY,
    params: [{ name: 'separator', label: 'Разделитель', type: 'string', default: ' ' }],
    run: (values, params) =>
      values
        .filter((v) => v !== undefined && v !== null && v !== '')
        .join(String(params.separator ?? ' ')),
  },
  {
    id: 'template',
    label: 'Шаблон строки',
    description: 'Используйте {0}, {1}, ... для подстановки значений источников',
    appliesTo: ['string', 'number', 'boolean', 'date', 'any'],
    minSources: 1,
    maxSources: MANY,
    params: [{ name: 'template', label: 'Шаблон', type: 'string', default: '{0}', placeholder: 'г. {1}, {0}' }],
    run: (values, params) =>
      String(params.template ?? '').replace(/\{(\d+)\}/g, (_, i) => {
        const v = values[Number(i)];
        return v === undefined || v === null ? '' : String(v);
      }),
  },
  {
    id: 'toNumber',
    label: 'В число',
    appliesTo: ['string', 'boolean', 'any'],
    run: (values) => {
      const n = Number(values[0]);
      return Number.isNaN(n) ? 0 : n;
    },
  },
  {
    id: 'round',
    label: 'Округлить',
    appliesTo: ['number'],
    params: [{ name: 'digits', label: 'Знаков после запятой', type: 'number', default: 0 }],
    run: (values, params) => {
      const digits = Number(params.digits ?? 0);
      const factor = 10 ** digits;
      return Math.round(Number(values[0] ?? 0) * factor) / factor;
    },
  },
  {
    id: 'multiply',
    label: 'Умножить на',
    appliesTo: ['number'],
    params: [{ name: 'factor', label: 'Множитель', type: 'number', default: 1 }],
    run: (values, params) => Number(values[0] ?? 0) * Number(params.factor ?? 1),
  },
  {
    id: 'toBoolean',
    label: 'В логическое',
    appliesTo: ['string', 'number', 'any'],
    run: (values) => Boolean(values[0]),
  },
  {
    id: 'negate',
    label: 'Инвертировать (НЕ)',
    appliesTo: ['boolean'],
    run: (values) => !values[0],
  },
  {
    id: 'yesNo',
    label: 'В "да/нет"',
    appliesTo: ['boolean'],
    params: [
      { name: 'trueLabel', label: 'Если true', type: 'string', default: 'да' },
      { name: 'falseLabel', label: 'Если false', type: 'string', default: 'нет' },
    ],
    run: (values, params) => (values[0] ? params.trueLabel ?? 'да' : params.falseLabel ?? 'нет'),
  },
  {
    id: 'toISOString',
    label: 'В ISO-строку',
    appliesTo: ['date', 'string'],
    run: (values) => {
      const v = values[0];
      const d = v instanceof Date ? v : new Date(String(v));
      return Number.isNaN(d.getTime()) ? '' : d.toISOString();
    },
  },
  {
    id: 'formatDate',
    label: 'Форматировать дату',
    appliesTo: ['date', 'string'],
    params: [{ name: 'format', label: 'Формат (DD.MM.YYYY)', type: 'string', default: 'DD.MM.YYYY' }],
    run: (values, params) => {
      const v = values[0];
      const d = v instanceof Date ? v : new Date(String(v));
      if (Number.isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return String(params.format ?? 'DD.MM.YYYY')
        .replace('YYYY', String(d.getFullYear()))
        .replace('MM', pad(d.getMonth() + 1))
        .replace('DD', pad(d.getDate()));
    },
  },
  {
    id: 'join',
    label: 'Склеить массив',
    appliesTo: ['array'],
    params: [{ name: 'separator', label: 'Разделитель', type: 'string', default: ', ' }],
    run: (values, params) => (Array.isArray(values[0]) ? values[0].join(String(params.separator ?? ', ')) : ''),
  },
  {
    id: 'length',
    label: 'Длина / количество',
    appliesTo: ['array', 'string'],
    run: (values) => {
      const v = values[0];
      if (Array.isArray(v) || typeof v === 'string') return v.length;
      return 0;
    },
  },
];

export function getHandlersForTypes(types: FieldType[], sourceCount: number): TransformHandler[] {
  return BUILTIN_HANDLERS.filter((h) => {
    const min = h.minSources ?? 1;
    const max = h.maxSources ?? 1;
    if (sourceCount < min || sourceCount > max) return false;
    return types.some((t) => h.appliesTo.includes(t) || t === 'any' || h.appliesTo.includes('any'));
  });
}

export function getHandler(id: string): TransformHandler | undefined {
  return BUILTIN_HANDLERS.find((h) => h.id === id);
}
