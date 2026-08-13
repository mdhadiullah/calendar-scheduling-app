import { useCallback, useEffect, useState } from 'react';
import type { Task, TaskStatus } from '@calendar-app/shared';
import { api } from '../lib/apiClient';
import { TaskFormModal } from '../components/forms/TaskFormModal';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'COMPLETED', label: 'Completed' },
  { status: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'badge-neutral',
  MEDIUM: 'badge-info',
  HIGH: 'badge-warning',
  URGENT: 'badge-danger',
};

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    api.get<{ data: Task[] }>('/api/tasks').then((r) => setTasks(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: TaskStatus) {
    await api.patch(`/api/tasks/${id}`, { status });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this task?')) return;
    await api.delete(`/api/tasks/${id}`);
    load();
  }

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ fontSize: 22, margin: 0 }}>Tasks</h1>
        <button className="btn" onClick={() => setShowCreate(true)}>+ New Task</button>
      </div>

      <div className="grid grid-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="stack">
            <div className="row-between">
              <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--color-muted)', margin: 0 }}>{col.label}</h3>
              <span className="badge badge-neutral">{tasks.filter((t) => t.status === col.status).length}</span>
            </div>
            {tasks
              .filter((t) => t.status === col.status)
              .map((t) => (
                <div key={t.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                  {t.due_at && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Due {new Date(t.due_at).toLocaleString()}</div>}
                  <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                    <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value as TaskStatus)} style={{ fontSize: 12, padding: 4 }}>
                      {COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>{c.label}</option>
                      ))}
                    </select>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(t.id)}>Delete</button>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>

      {showCreate && <TaskFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}
