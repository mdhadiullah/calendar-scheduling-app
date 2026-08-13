import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Profile, UserAccess, UserRole } from '@calendar-app/shared';
import { trialDaysRemaining, licenseStatusLabel } from '@calendar-app/shared';
import { api } from '../../lib/apiClient';

type UserDetail = Profile & { user_access: UserAccess[] };

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    api.get<{ user: UserDetail }>(`/api/admin/users/${id}`).then((r) => setUser(r.user));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: string, body?: unknown) {
    if (!id) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/api/admin/users/${id}/${action}`, body);
      setMessage('Done.');
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(role: UserRole) {
    if (!id) return;
    await api.patch(`/api/admin/users/${id}/role`, { role });
    load();
  }

  async function deleteUser() {
    if (!id || !window.confirm('Permanently delete this user? This cannot be undone.')) return;
    await api.delete(`/api/admin/users/${id}`);
    navigate('/admin/users');
  }

  if (!user) return <p>Loading…</p>;
  const access = user.user_access?.[0];
  const remaining = access ? trialDaysRemaining(access) : null;

  return (
    <div className="stack">
      <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/admin/users')}>← Back to users</button>

      <div className="card">
        <div className="row-between">
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>{user.full_name}</h1>
            <p style={{ color: 'var(--color-muted)', margin: '4px 0' }}>{user.email}</p>
          </div>
          <div className="row">
            <span className="badge badge-neutral">{user.role}</span>
            <span className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{user.status}</span>
            {access && <span className="badge badge-info">{licenseStatusLabel(access.license_status)}</span>}
          </div>
        </div>
        {message && <p style={{ fontSize: 13 }}>{message}</p>}
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <h2 style={{ fontSize: 16, margin: 0 }}>License</h2>
          <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            Trial: {access?.trial_started_at ? new Date(access.trial_started_at).toLocaleDateString() : '—'} → {access?.trial_ends_at ? new Date(access.trial_ends_at).toLocaleDateString() : '—'}
            {remaining !== null ? ` (${remaining}d left)` : ''}
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => run('activate')}>Activate Full Version</button>
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => run('reset-trial')}>Reset Trial</button>
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => run('extend-trial', { days: 15 })}>Extend Trial +15d</button>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ fontSize: 16, margin: 0 }}>Account</h2>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {user.status !== 'LOCKED' ? (
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => run('lock', { reason: window.prompt('Reason (optional):') ?? undefined })}>Lock User</button>
            ) : (
              <button className="btn btn-sm" disabled={busy} onClick={() => run('unlock')}>Unlock User</button>
            )}
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => run('suspend')}>Suspend</button>
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => run('reset-password')}>Send Password Reset</button>
          </div>
          <div className="field">
            <label>Change role</label>
            <select value={user.role} onChange={(e) => changeRole(e.target.value as UserRole)}>
              <option value="CLIENT">Client</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <button className="btn btn-sm btn-danger" style={{ alignSelf: 'flex-start' }} onClick={deleteUser}>Delete User</button>
        </div>
      </div>
    </div>
  );
}
