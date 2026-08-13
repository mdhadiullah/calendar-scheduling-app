import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
    else navigate('/');
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email first, then click "Forgot password".');
      return;
    }
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/set-password` });
    setResetSent(true);
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: 380 }}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>📆 Calendar &amp; Scheduling</h1>
        <p style={{ color: 'var(--color-muted)', marginTop: -8 }}>Sign in to your account</p>
        <form onSubmit={handleSubmit} className="stack">
          {error && <div className="badge badge-danger">{error}</div>}
          {resetSent && <div className="badge badge-success">Password reset email sent.</div>}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={handleForgotPassword}>
            Forgot password?
          </button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 16 }}>
          Accounts are created by your administrator. If you don't have one yet, contact them for an invitation.
        </p>
      </div>
    </div>
  );
}
