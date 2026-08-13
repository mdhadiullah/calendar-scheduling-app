import { useEffect, useState } from 'react';
import type { AdminDashboardStats } from '@calendar-app/shared';
import { api } from '../../lib/apiClient';

const TILES: { key: keyof AdminDashboardStats; label: string }[] = [
  { key: 'total_users', label: 'Total users' },
  { key: 'active_users', label: 'Active users' },
  { key: 'trial_users', label: 'Trial users' },
  { key: 'expired_users', label: 'Expired users' },
  { key: 'locked_users', label: 'Locked users' },
  { key: 'clients', label: 'Clients' },
  { key: 'employees', label: 'Employees' },
  { key: 'upcoming_meetings', label: 'Upcoming meetings (7d)' },
  { key: 'notification_failures', label: 'Notification failures' },
];

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    api.get<AdminDashboardStats>('/api/admin/dashboard').then(setStats);
  }, []);

  return (
    <div className="stack">
      <h1 style={{ fontSize: 22, margin: 0 }}>Admin Dashboard</h1>
      <div className="grid grid-4">
        {TILES.map((t) => (
          <div key={t.key} className="stat-tile">
            <div className="value">{stats ? stats[t.key] : '—'}</div>
            <div className="label">{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
