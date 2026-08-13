import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient';

interface UserOption {
  id: string;
  full_name: string;
  email: string;
}

export function UserMultiSelect({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [options, setOptions] = useState<UserOption[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => {
      api.get<{ data: UserOption[] }>('/api/users', query ? { q: query } : undefined).then((res) => setOptions(res.data));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div>
      <input placeholder="Search people by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {options.map((u) => (
          <button
            type="button"
            key={u.id}
            className={`badge ${selected.includes(u.id) ? 'badge-info' : 'badge-neutral'}`}
            style={{ border: 'none', cursor: 'pointer' }}
            onClick={() => toggle(u.id)}
          >
            {selected.includes(u.id) ? '✓ ' : ''}
            {u.full_name}
          </button>
        ))}
        {options.length === 0 && <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Type to search colleagues…</span>}
      </div>
    </div>
  );
}
