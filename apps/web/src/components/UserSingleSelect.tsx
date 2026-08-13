import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient';

interface UserOption {
  id: string;
  full_name: string;
  email: string;
}

export function UserSingleSelect({ value, onChange, placeholder }: { value: string; onChange: (id: string) => void; placeholder?: string }) {
  const [options, setOptions] = useState<UserOption[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => {
      api.get<{ data: UserOption[] }>('/api/users', query ? { q: query } : undefined).then((res) => setOptions(res.data));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  const selected = options.find((o) => o.id === value);

  return (
    <div>
      <input
        placeholder={placeholder ?? 'Search people…'}
        value={selected ? selected.full_name : query}
        onChange={(e) => {
          onChange('');
          setQuery(e.target.value);
        }}
      />
      {!selected && query.length > 0 && options.length > 0 && (
        <div className="card" style={{ marginTop: 4, padding: 6 }}>
          {options.map((u) => (
            <button
              key={u.id}
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
              onClick={() => {
                onChange(u.id);
                setQuery('');
              }}
            >
              {u.full_name} <span style={{ color: 'var(--color-muted)' }}>({u.email})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
