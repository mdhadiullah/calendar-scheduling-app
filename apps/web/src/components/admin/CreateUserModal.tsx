import { useState } from 'react';
import type { UserRole } from '@calendar-app/shared';
import { Modal } from '../Modal';
import { api } from '../../lib/apiClient';

export function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState<UserRole>('CLIENT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/admin/users', { full_name: fullName, email, mobile: mobile || undefined, company: company || undefined, role });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create User / Client" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        {error && <div className="badge badge-danger">{error}</div>}
        <div className="field"><label>Full name</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="grid grid-2">
          <div className="field"><label>Mobile</label><input value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
          <div className="field"><label>Company</label><input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="CLIENT">Client</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          A secure account-activation email will be sent — no password is ever transmitted directly. Non-admin roles start on a 15-day trial automatically.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create & send activation email'}</button>
        </div>
      </form>
    </Modal>
  );
}
