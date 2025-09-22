const pad = (n) => String(n).padStart(2, '0');

export const typePriority = (type) => {
  if (type === 'birthday') return 0;
  if (type === 'cart') return 1;
  return 2;
};

export const toUTCDate = (dateString) =>
  typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);

export const startOfDay = (input) => {
  if (!input) return null;
  const d = input instanceof Date ? new Date(input) : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

export const dateKey = (input) => {
  if (!input) return null;
  const day = startOfDay(input);
  if (!day) return null;
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
};

export const compareEvents = (a, b) => {
  const keyA = dateKey(a?.date);
  const keyB = dateKey(b?.date);
  if (keyA && keyB && keyA !== keyB) return keyA.localeCompare(keyB);

  const typeDiff = typePriority(a?.type) - typePriority(b?.type);
  if (typeDiff !== 0) return typeDiff;

  const timeA = a?.date ? new Date(a.date).getTime() : 0;
  const timeB = b?.date ? new Date(b.date).getTime() : 0;
  const timeDiff = timeA - timeB;
  if (timeDiff !== 0) return timeDiff;

  const labelA = (a?.restaurant ?? a?.label ?? '').toString();
  const labelB = (b?.restaurant ?? b?.label ?? '').toString();
  return labelA.localeCompare(labelB);
};

export const bucketEventsByDay = (events = []) => {
  const buckets = new Map();
  events.forEach((event) => {
    const key = dateKey(event?.date);
    if (!key) return;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(event);
  });

  buckets.forEach((list) => {
    list.sort(compareEvents);
  });

  return buckets;
};

export const addDays = (input, amount) => {
  const base = startOfDay(input);
  if (!base || !Number.isFinite(amount)) return null;
  const next = new Date(base);
  next.setDate(base.getDate() + amount);
  return next;
};

export const buildContinuousDays = (startDate, endDate, buckets) => {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (!start || !end) return [];
  const days = [];
  for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    const key = dateKey(cursor);
    const events = buckets?.get(key) ? [...buckets.get(key)] : [];
    days.push({ date: new Date(cursor), events });
  }
  return days;
};

export const createInitialRange = (pastDays, futureDays) => {
  const today = startOfDay(new Date());
  const start = addDays(today, -Math.abs(pastDays));
  const end = addDays(today, Math.abs(futureDays));
  return { start, end };
};

export const extendRange = (range, { past = 0, future = 0 }) => {
  const start = addDays(range.start, -Math.abs(past));
  const end = addDays(range.end, Math.abs(future));
  return { start, end };
};
