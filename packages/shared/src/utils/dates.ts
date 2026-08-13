export type CalendarViewType = 'day' | '3day' | 'week' | 'month' | 'agenda' | 'year';

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const r = startOfDay(d);
  const day = r.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  return addDays(r, -diff);
}

export function rangeForView(view: CalendarViewType, anchor: Date): { start: Date; end: Date } {
  switch (view) {
    case 'day':
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    case '3day':
      return { start: startOfDay(anchor), end: endOfDay(addDays(anchor, 2)) };
    case 'week': {
      const start = startOfWeek(anchor);
      return { start, end: endOfDay(addDays(start, 6)) };
    }
    case 'month': {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'year': {
      const start = new Date(anchor.getFullYear(), 0, 1);
      const end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    }
    case 'agenda':
      return { start: startOfDay(anchor), end: endOfDay(addDays(anchor, 30)) };
    default:
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
  }
}
