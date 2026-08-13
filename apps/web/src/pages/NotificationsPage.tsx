import { useCallback, useEffect, useState } from 'react';
import type { AppNotification } from '@calendar-app/shared';
import { api } from '../lib/apiClient';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const load = useCallback(() => {
    api.get<{ data: AppNotification[] }>('/api/notifications', { pageSize: 50 }).then((r) => setNotifications(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    await api.post(`/api/notifications/${id}/read`);
    load();
  }

  return (
    <div className="stack">
      <h1 style={{ fontSize: 22, margin: 0 }}>Notifications</h1>
      <div className="stack">
        {notifications.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No notifications yet.</p>}
        {notifications.map((n) => (
          <div key={n.id} className="card row-between">
            <div>
              <div style={{ fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{n.body}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>{new Date(n.scheduled_at).toLocaleString()}</div>
            </div>
            {!n.sent_at ? (
              <button className="btn btn-sm btn-secondary" onClick={() => markRead(n.id)}>Mark read</button>
            ) : (
              <span className="badge badge-neutral">Read</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
