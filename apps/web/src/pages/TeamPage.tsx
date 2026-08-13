import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

export function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => {
      api.get<{ data: TeamMember[] }>('/api/users', query ? { q: query } : undefined).then((r) => setMembers(r.data));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ fontSize: 22, margin: 0 }}>Team</h1>
        <input style={{ maxWidth: 260 }} placeholder="Search team…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="grid grid-3">
        {members.map((m) => (
          <div key={m.id} className="card row">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--color-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              {m.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{m.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{m.email}</div>
              <span className="badge badge-neutral" style={{ marginTop: 4 }}>{m.role}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
