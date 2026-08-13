import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Meeting, Task, AppNotification } from '@calendar-app/shared';
import { trialDaysRemaining } from '@calendar-app/shared';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/apiClient';

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfTodayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function DashboardPage() {
  const { profile, access } = useAuth();
  const [todayMeetings, setTodayMeetings] = useState<Meeting[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    api.get<{ data: Meeting[] }>('/api/meetings', { start: startOfTodayIso(), end: endOfTodayIso() }).then((r) => setTodayMeetings(r.data));
    api
      .get<{ data: Meeting[] }>('/api/meetings', { start: new Date().toISOString(), end: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .then((r) => setUpcomingMeetings(r.data.slice(0, 5)));
    api.get<{ data: Task[] }>('/api/tasks').then((r) => {
      const today = r.data.filter((t) => t.due_at && t.due_at >= startOfTodayIso() && t.due_at <= endOfTodayIso());
      const pending = r.data.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS');
      setTodayTasks(today);
      setPendingTasks(pending.slice(0, 6));
    });
    api.get<{ data: AppNotification[] }>('/api/notifications', { pageSize: 5 }).then((r) => setNotifications(r.data));
  }, []);

  const remaining = access ? trialDaysRemaining(access) : null;

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0, fontSize: 22 }}>Welcome back, {profile?.full_name?.split(' ')[0]} 👋</h1>
        {remaining !== null && (
          <span className={`badge ${remaining <= 3 ? 'badge-warning' : 'badge-info'}`}>
            {remaining} day{remaining === 1 ? '' : 's'} left in trial
          </span>
        )}
      </div>

      <div className="grid grid-4">
        <div className="stat-tile"><div className="value">{todayMeetings.length}</div><div className="label">Today's meetings</div></div>
        <div className="stat-tile"><div className="value">{upcomingMeetings.length}</div><div className="label">Upcoming (7 days)</div></div>
        <div className="stat-tile"><div className="value">{todayTasks.length}</div><div className="label">Tasks due today</div></div>
        <div className="stat-tile"><div className="value">{pendingTasks.length}</div><div className="label">Pending tasks</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="row-between"><h2 style={{ fontSize: 16, margin: 0 }}>Today's meetings</h2><Link to="/meetings">View all</Link></div>
          <div className="stack" style={{ marginTop: 12 }}>
            {todayMeetings.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>No meetings scheduled today.</p>}
            {todayMeetings.map((m) => (
              <div key={m.id} className="row-between">
                <div>
                  <div style={{ fontWeight: 600 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{new Date(m.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <span className="badge badge-info">{m.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row-between"><h2 style={{ fontSize: 16, margin: 0 }}>Pending tasks</h2><Link to="/tasks">View all</Link></div>
          <div className="stack" style={{ marginTop: 12 }}>
            {pendingTasks.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>You're all caught up.</p>}
            {pendingTasks.map((t) => (
              <div key={t.id} className="row-between">
                <div>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  {t.due_at && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Due {new Date(t.due_at).toLocaleString()}</div>}
                </div>
                <span className={`badge ${t.priority === 'URGENT' || t.priority === 'HIGH' ? 'badge-danger' : 'badge-neutral'}`}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row-between"><h2 style={{ fontSize: 16, margin: 0 }}>Recent notifications</h2><Link to="/notifications">View all</Link></div>
        <div className="stack" style={{ marginTop: 12 }}>
          {notifications.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>No notifications yet.</p>}
          {notifications.map((n) => (
            <div key={n.id}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{n.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
