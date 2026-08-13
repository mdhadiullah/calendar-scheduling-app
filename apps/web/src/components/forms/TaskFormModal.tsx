import { useState } from 'react';
import { Modal } from '../Modal';
import { UserSingleSelect } from '../UserSingleSelect';
import { api } from '../../lib/apiClient';

export function TaskFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/tasks', {
        title,
        description: description || undefined,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        priority,
        assigned_to: assignedTo || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Task" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        {error && <div className="badge badge-danger">{error}</div>}
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Due date</label>
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Assign to (leave blank to assign to yourself)</label>
          <UserSingleSelect value={assignedTo} onChange={setAssignedTo} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create Task'}</button>
        </div>
      </form>
    </Modal>
  );
}
