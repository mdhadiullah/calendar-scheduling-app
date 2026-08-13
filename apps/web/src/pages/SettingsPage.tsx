import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/apiClient';
import { supabase } from '../lib/supabaseClient';

interface NotificationPreferences {
  in_app_enabled: boolean;
  email_enabled: boolean;
  telegram_enabled: boolean;
  meeting_notifications: boolean;
  task_notifications: boolean;
  reminder_notifications: boolean;
  trial_notifications: boolean;
}

export function SettingsPage() {
  const { profile, refresh } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [mobile, setMobile] = useState(profile?.mobile ?? '');
  const [company, setCompany] = useState(profile?.company ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<{ is_active: boolean; telegram_username: string | null } | null>(null);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ preferences: NotificationPreferences }>('/api/me/notification-preferences').then((r) => setPrefs(r.preferences));
    api.get<{ connection: { is_active: boolean; telegram_username: string | null } | null }>('/api/telegram/status').then((r) => setTelegramStatus(r.connection));
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    await api.patch('/api/me', { full_name: fullName, mobile, company });
    await refresh();
    setSavingProfile(false);
  }

  async function savePrefs(next: NotificationPreferences) {
    setPrefs(next);
    await api.put('/api/me/notification-preferences', next);
  }

  async function connectTelegram() {
    const res = await api.get<{ link: string }>('/api/telegram/connect');
    setTelegramLink(res.link);
    window.open(res.link, '_blank');
  }

  async function disconnectTelegram() {
    await api.post('/api/telegram/disconnect');
    setTelegramStatus({ is_active: false, telegram_username: null });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 8) return setPasswordMsg('Password must be at least 8 characters.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : 'Password updated.');
    setNewPassword('');
  }

  return (
    <div className="stack">
      <h1 style={{ fontSize: 22, margin: 0 }}>Settings</h1>

      <div className="card">
        <h2 style={{ fontSize: 16 }}>Profile</h2>
        <form onSubmit={saveProfile} className="stack">
          <div className="field"><label>Full name</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="field"><label>Mobile</label><input value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
          <div className="field"><label>Company</label><input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
          <button className="btn" type="submit" disabled={savingProfile} style={{ alignSelf: 'flex-start' }}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16 }}>Change password</h2>
        <form onSubmit={changePassword} className="row">
          <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ maxWidth: 260 }} />
          <button className="btn" type="submit">Update password</button>
        </form>
        {passwordMsg && <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>{passwordMsg}</p>}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16 }}>Notifications</h2>
        {prefs && (
          <div className="stack">
            {(
              [
                ['in_app_enabled', 'In-app notifications'],
                ['email_enabled', 'Email notifications'],
                ['telegram_enabled', 'Telegram notifications'],
                ['meeting_notifications', 'Meeting updates'],
                ['task_notifications', 'Task updates'],
                ['reminder_notifications', 'Reminders'],
                ['trial_notifications', 'Trial / license updates'],
              ] as [keyof NotificationPreferences, string][]
            ).map(([key, label]) => (
              <label key={key} className="row" style={{ fontWeight: 400 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={prefs[key]}
                  onChange={(e) => savePrefs({ ...prefs, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16 }}>Telegram</h2>
        {telegramStatus?.is_active ? (
          <div className="row-between">
            <span>Connected as @{telegramStatus.telegram_username ?? 'unknown'}</span>
            <button className="btn btn-secondary btn-sm" onClick={disconnectTelegram}>Disconnect</button>
          </div>
        ) : (
          <div className="stack">
            <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Connect Telegram to receive meeting and task reminders instantly.</p>
            <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={connectTelegram}>Connect Telegram</button>
            {telegramLink && <p style={{ fontSize: 12 }}>If the chat didn't open automatically, <a href={telegramLink} target="_blank" rel="noreferrer">click here</a>.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
