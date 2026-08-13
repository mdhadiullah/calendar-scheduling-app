import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Profile, UserAccess } from '@calendar-app/shared';
import { trialDaysRemaining, licenseStatusLabel } from '@calendar-app/shared';
import { api } from '../../lib/apiClient';
import { CreateUserModal } from '../../components/admin/CreateUserModal';

type UserRow = Profile & { user_access: UserAccess[] };

const LICENSE_BADGE: Record<string, string> = {
  TRIAL: 'badge-info',
  ACTIVE: 'badge-success',
  EXPIRED: 'badge-warning',
  LOCKED: 'badge-danger',
  CANCELLED: 'badge-neutral',
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ data: UserRow[] }>('/api/admin/users', query ? { q: query } : undefined).then((r) => setUsers(r.data));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(id: string, action: 'activate' | 'lock' | 'unlock') {
    setBusyId(id);
    try {
      await api.post(`/api/admin/users/${id}/${action}`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ fontSize: 22, margin: 0 }}>Users &amp; Clients</h1>
        <div className="row">
          <input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 220 }} />
          <button className="btn" onClick={() => setShowCreate(true)}>+ Create User</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>License</th><th>Trial remaining</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const access = u.user_access?.[0];
              const remaining = access ? trialDaysRemaining(access) : null;
              return (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-neutral">{u.role}</span></td>
                  <td>
                    <span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : u.status === 'LOCKED' ? 'badge-danger' : 'badge-warning'}`}>{u.status}</span>
                  </td>
                  <td>{access && <span className={`badge ${LICENSE_BADGE[access.license_status]}`}>{licenseStatusLabel(access.license_status)}</span>}</td>
                  <td>{remaining !== null ? `${remaining}d` : '—'}</td>
                  <td>
                    <div className="row">
                      <Link to={`/admin/users/${u.id}`} className="btn btn-sm btn-secondary">Manage</Link>
                      {access?.license_status !== 'ACTIVE' && (
                        <button className="btn btn-sm" disabled={busyId === u.id} onClick={() => runAction(u.id, 'activate')}>Activate</button>
                      )}
                      {u.status !== 'LOCKED' ? (
                        <button className="btn btn-sm btn-danger" disabled={busyId === u.id} onClick={() => runAction(u.id, 'lock')}>Lock</button>
                      ) : (
                        <button className="btn btn-sm btn-secondary" disabled={busyId === u.id} onClick={() => runAction(u.id, 'unlock')}>Unlock</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}
