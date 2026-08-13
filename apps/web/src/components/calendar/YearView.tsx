import { useMemo } from 'react';
import type { CalendarEvent } from '@calendar-app/shared';

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstWeekday(year: number, month: number) {
  // Monday-first grid
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export function YearView({
  anchorDate,
  events,
  onNavigate,
  onSelectDay,
}: {
  anchorDate: Date;
  events: CalendarEvent[];
  onNavigate: (d: Date) => void;
  onSelectDay: (d: Date) => void;
}) {
  const year = anchorDate.getFullYear();

  const eventDaysByMonth = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const e of events) {
      const d = new Date(e.start_at);
      if (d.getFullYear() !== year) continue;
      const key = String(d.getMonth());
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(d.getDate());
    }
    return map;
  }, [events, year]);

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(new Date(year - 1, 0, 1))}>← {year - 1}</button>
        <h2 style={{ margin: 0 }}>{year}</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(new Date(year + 1, 0, 1))}>{year + 1} →</button>
      </div>
      <div className="grid grid-4">
        {Array.from({ length: 12 }, (_, month) => {
          const totalDays = daysInMonth(year, month);
          const offset = firstWeekday(year, month);
          const markedDays = eventDaysByMonth.get(String(month)) ?? new Set<number>();
          const monthName = new Date(year, month, 1).toLocaleString(undefined, { month: 'long' });

          return (
            <div key={month} className="card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{monthName}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, fontSize: 10 }}>
                {Array.from({ length: offset }, (_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: totalDays }, (_, i) => {
                  const day = i + 1;
                  const hasEvent = markedDays.has(day);
                  return (
                    <button
                      key={day}
                      onClick={() => onSelectDay(new Date(year, month, day))}
                      style={{
                        border: 'none',
                        background: hasEvent ? '#eef2ff' : 'transparent',
                        color: hasEvent ? 'var(--color-primary)' : 'var(--color-text)',
                        fontWeight: hasEvent ? 700 : 400,
                        borderRadius: 4,
                        padding: '2px 0',
                        cursor: 'pointer',
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
