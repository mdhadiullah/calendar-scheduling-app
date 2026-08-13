import { useEffect, useState } from 'react';
import { reminderPresetOptions } from '@calendar-app/shared';
import { Modal } from '../Modal';
import { api } from '../../lib/apiClient';

type EntityType = 'EVENT' | 'MEETING' | 'TASK';

interface EntityOption {
  id: string;
  title: string;
}

export function ReminderFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [entityType, setEntityType] = useState<EntityType>('MEETING');
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [entityId, setEntityId] = useState('');
  const [minutesBefore, setMinutesBefore] = useState<number>(15);
  const [channels, setChannels] = useState<string[]>(['IN_APP']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = entityType === 'EVENT' ? '/api/events' : entityType === 'MEETING' ? '/api/meetings' : '/api/tasks';
    api.get<{ data: Array<{ id: string; title: string }> }>(endpoint).then((res) => {
      setEntityOptions(res.data.map((d) => ({ id: d.id, title: d.title })));
      setEntityId('');
    });
  }, [entityType]);

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/reminders', {
        entity_type: entityType,
        entity_id: entityId,
        minutes_before: minutesBefore,
        channels,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reminder');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Reminder" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        {error && <div className="badge badge-danger">{error}</div>}
        <div className="field">
          <label>Remind me about</label>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value as EntityType)}>
            <option value="MEETING">A meeting</option>
            <option value="EVENT">A calendar event</option>
            <option value="TASK">A task</option>
          </select>
        </div>
        <div className="field">
          <label>Which one</label>
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} required>
            <option value="" disabled>Select…</option>
            {entityOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>When</label>
          <select value={minutesBefore} onChange={(e) => setMinutesBefore(Number(e.target.value))}>
            {reminderPresetOptions().map((o) => (
              <option key={o.minutes} value={o.minutes}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Notify me via</label>
          <div className="row">
            {['IN_APP', 'EMAIL', 'TELEGRAM'].map((c) => (
              <button
                key={c}
                type="button"
                className={`badge ${channels.includes(c) ? 'badge-info' : 'badge-neutral'}`}
                style={{ border: 'none' }}
                onClick={() => toggleChannel(c)}
              >
                {channels.includes(c) ? '✓ ' : ''}{c.replace('_', '-')}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving || !entityId}>{saving ? 'Saving…' : 'Create Reminder'}</button>
        </div>
      </form>
    </Modal>
  );
}
