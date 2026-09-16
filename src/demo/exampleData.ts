// Example "source" — a typical multi-step form state kept in the app.
export const formStateExample = {
  name: 'Иван',
  lastName: 'Петров',
  city: 'Москва',
  age: 34,
  birthDate: '1990-05-12',
  isSubscribed: true,
  address: {
    street: 'ул. Ленина, 10',
    zip: '101000',
  },
  cart: [
    { sku: 'A100', title: 'Механическая клавиатура', price: 4990, qty: 1 },
    { sku: 'B200', title: 'Беспроводная мышь', price: 1990, qty: 2 },
  ],
};

// Example "target" — the shape of the request body the platform needs to
// send. Only used to infer field names/types; the values themselves are
// placeholders and are never read directly (see AUTO-MAP / applyMapping).
export const payloadTemplate = {
  customer: {
    fullName: '',
    location: '',
    age: 0,
    isActive: false,
    registeredAt: '',
  },
  shipping: {
    addressLine: '',
  },
  items: [{ code: '', name: '', unitPrice: 0, total: 0 }],
  // Deliberately empty — its exact shape isn't known ahead of time, so
  // fields are added by hand (drag a source field onto it, or "+ Добавить
  // поле") instead of coming from this example.
  meta: {},
};

// Example "context" — platform/session values that aren't part of the form
// but are still worth offering when adding a source field by hand (see the
// "Контекст" tab and "+ Добавить поле" autocomplete).
export const contextExample = {
  sessionId: 'sess_8f21ac',
  locale: 'ru-RU',
  isTestOrder: false,
};
