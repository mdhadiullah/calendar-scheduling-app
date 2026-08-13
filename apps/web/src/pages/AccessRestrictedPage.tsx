import { useAuth } from '../contexts/AuthContext';

const COPY: Record<string, { title: string; body: string }> = {
  EXPIRED: {
    title: 'Your trial has ended',
    body: 'Your 15-day trial has finished. Contact your administrator to activate your full account and regain access to your calendar, meetings, and tasks.',
  },
  LOCKED: {
    title: 'Your account is locked',
    body: 'An administrator has locked this account. Please reach out to your administrator for details.',
  },
  CANCELLED: {
    title: 'Your license has been cancelled',
    body: 'Your access has been cancelled. Contact your administrator if you believe this is a mistake.',
  },
  SUSPENDED: {
    title: 'Your account is suspended',
    body: 'Your account has been temporarily suspended by an administrator.',
  },
};

export function AccessRestrictedPage({ reason }: { reason: keyof typeof COPY }) {
  const { profile, signOut } = useAuth();
  const copy = COPY[reason] ?? COPY.LOCKED;

  return (
    <div className="center-screen">
      <div className="card" style={{ width: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>⏳</div>
        <h1 style={{ fontSize: 20 }}>{copy.title}</h1>
        <p style={{ color: 'var(--color-muted)' }}>{copy.body}</p>
        {profile && <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Signed in as {profile.email}</p>}
        <button className="btn btn-secondary" onClick={() => signOut()}>Sign out</button>
      </div>
    </div>
  );
}
