import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trialDaysRemaining } from '@calendar-app/shared';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/apiClient';
import { EventFormModal } from '../forms/EventFormModal';
import { MeetingFormModal } from '../forms/MeetingFormModal';
import { TaskFormModal } from '../forms/TaskFormModal';
import { ReminderFormModal } from '../forms/ReminderFormModal';

interface SearchResults {
  events: Array<{ id: string; title: string }>;
  meetings: Array<{ id: string; title: string }>;
  tasks: Array<{ id: string; title: string }>;
  users: Array<{ id: string; full_name: string }>;
  notes: Array<{ id: string; title: string | null; content: string }>;
}

export function TopBar() {
  const { profile, access, signOut } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'event' | 'meeting' | 'task' | 'reminder' | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      api.get<SearchResults>('/api/search', { q: query }).then(setResults).catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    api
      .get<{ total: number }>('/api/notifications', { unread: 'true', pageSize: 1 })
      .then((res) => setUnreadCount(res.total))
      .catch(() => {});
  }, []);

  const remaining = access ? trialDaysRemaining(access) : null;

  return (
    <header className="app-topbar">
      <div ref={searchBoxRef} style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
        <input placeholder="Search events, meetings, tasks, people…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {results && (
          <div className="card" style={{ position: 'absolute', top: 42, left: 0, right: 0, zIndex: 30, maxHeight: 360, overflowY: 'auto' }}>
            {(['events', 'meetings', 'tasks', 'users', 'notes'] as const).map((key) =>
              results[key].length > 0 ? (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 4 }}>{key}</div>
                  {results[key].map((item: any) => (
                    <div key={item.id} style={{ padding: '4px 0', fontSize: 14 }}>
                      {item.title ?? item.full_name ?? item.content}
                    </div>
                  ))}
                </div>
              ) : null
            )}
            {Object.values(results).every((arr) => arr.length === 0) && <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>No results</div>}
          </div>
        )}
      </div>

      <div className="row">
        {remaining !== null && (
          <span className={`badge ${remaining <= 3 ? 'badge-warning' : 'badge-info'}`}>Trial: {remaining}d left</span>
        )}

        <div style={{ position: 'relative' }}>
          <button className="btn" onClick={() => setCreateOpen((o) => !o)}>+ Create</button>
          {createOpen && (
            <div className="card" style={{ position: 'absolute', right: 0, top: 40, zIndex: 30, minWidth: 180, padding: 8 }}>
              {[
                { key: 'event', label: 'New Event' },
                { key: 'meeting', label: 'New Meeting' },
                { key: 'task', label: 'New Task' },
                { key: 'reminder', label: 'Reminder' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                  onClick={() => {
                    setActiveModal(opt.key as typeof activeModal);
                    setCreateOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-secondary" onClick={() => navigate('/notifications')} style={{ position: 'relative' }}>
          🔔 {unreadCount > 0 && <span className="badge badge-danger" style={{ marginLeft: 4 }}>{unreadCount}</span>}
        </button>

        <div style={{ position: 'relative' }}>
          <button className="btn btn-secondary" onClick={() => setProfileOpen((o) => !o)}>
            {profile?.full_name ?? 'Account'}
          </button>
          {profileOpen && (
            <div className="card" style={{ position: 'absolute', right: 0, top: 40, zIndex: 30, minWidth: 160, padding: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ display: 'block', width: '100%', marginBottom: 4 }} onClick={() => navigate('/settings')}>
                Settings
              </button>
              <button className="btn btn-danger btn-sm" style={{ display: 'block', width: '100%' }} onClick={() => signOut()}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {activeModal === 'event' && <EventFormModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); navigate('/calendar'); }} />}
      {activeModal === 'meeting' && <MeetingFormModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); navigate('/meetings'); }} />}
      {activeModal === 'task' && <TaskFormModal onClose={() => setActiveModal(null)} onSaved={() => { setActiveModal(null); navigate('/tasks'); }} />}
      {activeModal === 'reminder' && <ReminderFormModal onClose={() => setActiveModal(null)} onSaved={() => setActiveModal(null)} />}
    </header>
  );
}
