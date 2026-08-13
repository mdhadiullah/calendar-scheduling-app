import { useEffect, useState } from 'react';
import type { Calendar } from '@calendar-app/shared';
import { Modal } from '../Modal';
import { UserMultiSelect } from '../UserMultiSelect';
import { api } from '../../lib/apiClient';

const CATEGORIES = ['Work', 'Personal', 'Client', 'Internal', 'Other'];
const COLORS = ['#4F46E5', '#DC2626', '#16A34A', '#D97706', '#0891B2', '#9333EA'];

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventFormModal({ defaultStart, onClose, onSaved }: { defaultStart?: Date; onClose: () => void; onSaved: () => void }) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(toLocalInput(defaultStart ?? new Date()));
  const [end, setEnd] = useState(toLocalInput(new Date((defaultStart ?? new Date()).getTime() + 60 * 60_000)));
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Calendar[] }>('/api/calendars').then((res) => {
      setCalendars(res.data);
      if (res.data[0]) setCalendarId(res.data[0].id);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/events', {
        calendar_id: calendarId,
        title,
        description: description || undefined,
        location: location || undefined,
        video_link: videoLink || undefined,
        category,
        color,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        all_day: allDay,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        participant_ids: participantIds,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Event" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        {error && <div className="badge badge-danger">{error}</div>}
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Calendar</label>
          <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} required>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Start</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="field">
            <label>End</label>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
        </div>
        <div className="field row">
          <input type="checkbox" style={{ width: 'auto' }} checked={allDay} onChange={(e) => setAllDay(e.target.checked)} id="allday" />
          <label htmlFor="allday" style={{ margin: 0 }}>All-day event</label>
        </div>
        <div className="field">
          <label>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, address, or room" />
        </div>
        <div className="field">
          <label>Video meeting link (optional)</label>
          <input value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://..." />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Color</label>
            <div className="row">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '2px solid #111827' : '2px solid transparent' }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="field">
          <label>Invite participants</label>
          <UserMultiSelect selected={participantIds} onChange={setParticipantIds} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create Event'}</button>
        </div>
      </form>
    </Modal>
  );
}
