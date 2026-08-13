import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';

interface AuditLogRow {
  id: string;
  action: string;
  created_at: string;
  metadata: Record<string, unknown>;
  admin: { full_name: string; email: string } | null;
  target: { full_name: string; email: string } | null;
}

export function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);

  useEffect(() => {
    api.get<{ data: AuditLogRow[] }>('/api/admin/audit-logs', { pageSize: 50 }).then((r) => setLogs(r.data));
  }, []);

  return (
    <div className="stack">
      <h1 style={{ fontSize: 22, margin: 0 }}>Audit Log</h1>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>When</th><th>Administrator</th><th>Action</th><th>Target</th><th>Details</th></tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.admin?.full_name ?? '—'}</td>
                <td><span className="badge badge-neutral">{log.action}</span></td>
                <td>{log.target?.full_name ?? '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--color-muted)' }}>{JSON.stringify(log.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
