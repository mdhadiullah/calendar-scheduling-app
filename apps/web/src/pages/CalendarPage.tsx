import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
import withDragAndDrop, { type EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { CalendarEvent } from '@calendar-app/shared';
import { rangeForView } from '@calendar-app/shared';
import { api } from '../lib/apiClient';
import { EventFormModal } from '../components/forms/EventFormModal';
import { YearView } from '../components/calendar/YearView';
import { ThreeDayNote } from '../components/calendar/ThreeDayNote';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface RbcEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: CalendarEvent;
}

const DnDCalendar = withDragAndDrop<RbcEvent, object>(Calendar);

const APP_VIEWS = ['day', '3day', 'week', 'month', 'agenda', 'year'] as const;
type AppView = (typeof APP_VIEWS)[number];

export function CalendarPage() {
  const [appView, setAppView] = useState<AppView>('month');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    const { start, end } = rangeForView(appView === '3day' ? 'week' : appView === 'year' ? 'year' : appView, anchorDate);
    api.get<{ data: CalendarEvent[] }>('/api/events', { start: start.toISOString(), end: end.toISOString() }).then((r) => setRawEvents(r.data));
  }, [appView, anchorDate]);

  useEffect(() => {
    load();
  }, [load]);

  const events: RbcEvent[] = useMemo(
    () =>
      rawEvents.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start_at),
        end: new Date(e.end_at),
        allDay: e.all_day,
        resource: e,
      })),
    [rawEvents]
  );

  async function handleEventDrop({ event, start, end }: EventInteractionArgs<RbcEvent>) {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;
    await api.patch(`/api/events/${event.id}/move`, { start_at: startDate.toISOString(), end_at: endDate.toISOString() });
    load();
  }

  const rbcView: View = appView === '3day' ? Views.WEEK : (appView as View);

  return (
    <div className="stack">
      <div className="row-between">
        <div className="row">
          {APP_VIEWS.map((v) => (
            <button key={v} className={`btn btn-sm ${appView === v ? '' : 'btn-secondary'}`} onClick={() => setAppView(v)}>
              {v === '3day' ? '3-Day' : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => setShowCreate(true)}>+ New Event</button>
      </div>

      <div className="card" style={{ padding: 12 }}>
        {appView === 'year' ? (
          <YearView anchorDate={anchorDate} events={rawEvents} onNavigate={setAnchorDate} onSelectDay={(d) => { setAnchorDate(d); setAppView('day'); }} />
        ) : (
          <>
            {appView === '3day' && <ThreeDayNote />}
            <div style={{ height: 700 }}>
              <DnDCalendar
                localizer={localizer}
                events={events}
                date={anchorDate}
                view={rbcView}
                onNavigate={setAnchorDate}
                onView={() => {}}
                views={[Views.DAY, Views.WEEK, Views.MONTH, Views.AGENDA]}
                toolbar
                selectable
                resizable
                onEventDrop={handleEventDrop}
                onEventResize={handleEventDrop}
                eventPropGetter={(event: RbcEvent) => ({ style: { backgroundColor: event.resource.color ?? '#4F46E5', borderRadius: 4 } })}
                onSelectEvent={() => {}}
                popup
              />
            </div>
          </>
        )}
      </div>

      {showCreate && <EventFormModal defaultStart={anchorDate} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}
