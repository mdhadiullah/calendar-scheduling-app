import { useState } from 'react';
import { Modal } from '../Modal';
import { UserMultiSelect } from '../UserMultiSelect';
import { api } from '../../lib/apiClient';

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MeetingFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [start, setStart] = useState(toLocalInput(new Date(Date.now() + 30 * 60_000)));
  const [end, setEnd] = useState(toLocalInput(new Date(Date.now() + 90 * 60_000)));
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/meetings', {
        title,
        description: description || undefined,
        location: location || undefined,
        video_link: videoLink || undefined,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        participant_ids: participantIds,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Meeting" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        {error && <div className="badge badge-danger">{error}</div>}
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Start</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="field">
            <label>End</label>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="field">
          <label>Video meeting link (optional)</label>
          <input value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://..." />
        </div>
        <div className="field">
          <label>Agenda / description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label>Invite participants</label>
          <UserMultiSelect selected={participantIds} onChange={setParticipantIds} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Schedule Meeting'}</button>
        </div>
      </form>
    </Modal>
  );
}
