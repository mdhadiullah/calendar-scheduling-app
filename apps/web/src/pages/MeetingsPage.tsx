import { useCallback, useEffect, useState } from 'react';
import type { Meeting, MeetingParticipant } from '@calendar-app/shared';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/apiClient';
import { MeetingFormModal } from '../components/forms/MeetingFormModal';

type MeetingWithParticipants = Meeting & { meeting_participants: MeetingParticipant[] };

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'badge-info',
  RESCHEDULED: 'badge-warning',
  CANCELLED: 'badge-danger',
  COMPLETED: 'badge-neutral',
};

export function MeetingsPage() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<MeetingWithParticipants[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api.get<{ data: MeetingWithParticipants[] }>('/api/meetings').then((r) => setMeetings(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(id: string, status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') {
    await api.patch(`/api/meetings/${id}/respond`, { response_status: status });
    load();
  }

  async function cancel(id: string) {
    const reason = window.prompt('Reason for cancelling (optional):') ?? undefined;
    await api.post(`/api/meetings/${id}/cancel`, { reason });
    load();
  }

  async function reschedule(id: string, current: Meeting) {
    const input = window.prompt('New start time (YYYY-MM-DDTHH:mm):', current.start_at.slice(0, 16));
    if (!input) return;
    const newStart = new Date(input);
    const duration = new Date(current.end_at).getTime() - new Date(current.start_at).getTime();
    await api.post(`/api/meetings/${id}/reschedule`, { start_at: newStart.toISOString(), end_at: new Date(newStart.getTime() + duration).toISOString() });
    load();
  }

  async function saveNotes(id: string) {
    await api.patch(`/api/meetings/${id}/notes`, { notes: notesDraft[id] ?? '' });
    load();
  }

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ fontSize: 22, margin: 0 }}>Meetings</h1>
        <button className="btn" onClick={() => setShowCreate(true)}>+ New Meeting</button>
      </div>

      <div className="stack">
        {meetings.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No meetings yet.</p>}
        {meetings.map((m) => {
          const mine = m.meeting_participants.find((p) => p.user_id === profile?.id);
          const isOrganizer = m.organizer_id === profile?.id;
          return (
            <div key={m.id} className="card">
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 700 }}>{m.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    {new Date(m.start_at).toLocaleString()} – {new Date(m.end_at).toLocaleTimeString()}
                    {m.location ? ` · ${m.location}` : ''}
                  </div>
                  {m.video_link && (
                    <a href={m.video_link} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                      Join video call
                    </a>
                  )}
                </div>
                <span className={`badge ${STATUS_BADGE[m.status] ?? 'badge-neutral'}`}>{m.status}</span>
              </div>

              <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                {m.meeting_participants.map((p) => (
                  <span key={p.id} className="badge badge-neutral">
                    {p.role === 'ORGANIZER' ? '👑 ' : ''}
                    {p.response_status}
                  </span>
                ))}
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                {!isOrganizer && mine && mine.response_status !== 'ACCEPTED' && (
                  <button className="btn btn-sm" onClick={() => respond(m.id, 'ACCEPTED')}>Accept</button>
                )}
                {!isOrganizer && mine && mine.response_status !== 'DECLINED' && (
                  <button className="btn btn-sm btn-secondary" onClick={() => respond(m.id, 'DECLINED')}>Decline</button>
                )}
                {!isOrganizer && mine && mine.response_status !== 'TENTATIVE' && (
                  <button className="btn btn-sm btn-secondary" onClick={() => respond(m.id, 'TENTATIVE')}>Maybe</button>
                )}
                {isOrganizer && m.status !== 'CANCELLED' && (
                  <>
                    <button className="btn btn-sm btn-secondary" onClick={() => reschedule(m.id, m)}>Reschedule</button>
                    <button className="btn btn-sm btn-danger" onClick={() => cancel(m.id)}>Cancel</button>
                  </>
                )}
              </div>

              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)' }}>Meeting notes</summary>
                <textarea
                  rows={3}
                  style={{ marginTop: 8 }}
                  defaultValue={m.notes ?? ''}
                  onChange={(e) => setNotesDraft((prev) => ({ ...prev, [m.id]: e.target.value }))}
                />
                <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => saveNotes(m.id)}>Save notes</button>
              </details>
            </div>
          );
        })}
      </div>

      {showCreate && <MeetingFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}
