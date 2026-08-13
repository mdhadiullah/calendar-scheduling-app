import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Landed on from the "activate account" or "reset password" email link.
// Supabase's detectSessionInUrl automatically exchanges the link's token
// for a temporary session before this page renders, so we just need to
// collect a new password and call updateUser.
export function SetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else navigate('/');
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: 380 }}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>Set your password</h1>
        <p style={{ color: 'var(--color-muted)', marginTop: -8 }}>Choose a password to activate your account.</p>
        <form onSubmit={handleSubmit} className="stack">
          {error && <div className="badge badge-danger">{error}</div>}
          <div className="field">
            <label>New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Saving…' : 'Set password & continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
