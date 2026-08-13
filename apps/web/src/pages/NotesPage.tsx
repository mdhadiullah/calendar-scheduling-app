import { useCallback, useEffect, useState } from 'react';
import type { Note } from '@calendar-app/shared';
import { api } from '../lib/apiClient';

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const load = useCallback(() => {
    api.get<{ data: Note[] }>('/api/notes').then((r) => setNotes(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    await api.post('/api/notes', { title: title || undefined, content, entity_type: 'GENERAL' });
    setTitle('');
    setContent('');
    load();
  }

  async function remove(id: string) {
    await api.delete(`/api/notes/${id}`);
    load();
  }

  return (
    <div className="stack">
      <h1 style={{ fontSize: 22, margin: 0 }}>Notes</h1>
      <form onSubmit={createNote} className="card stack">
        <input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Write a quick note…" rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
        <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }}>Add Note</button>
      </form>

      <div className="grid grid-3">
        {notes.map((n) => (
          <div key={n.id} className="card">
            {n.title && <div style={{ fontWeight: 700, marginBottom: 6 }}>{n.title}</div>}
            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{n.content}</div>
            <div className="row-between" style={{ marginTop: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{new Date(n.updated_at).toLocaleDateString()}</span>
              <button className="btn btn-sm btn-danger" onClick={() => remove(n.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
