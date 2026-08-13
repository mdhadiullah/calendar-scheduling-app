import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { TopBar } from './TopBar';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/calendar', label: 'Calendar', icon: '📅' },
  { to: '/meetings', label: 'Meetings', icon: '🤝' },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/team', label: 'Team', icon: '👥' },
  { to: '/notes', label: 'Notes', icon: '📝' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function AppLayout() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">📆 Calendar &amp; Scheduling</div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>{item.icon}</span> {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <>
            <div style={{ margin: '16px 12px 6px', fontSize: 11, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Administration</div>
            <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>📊</span> Admin Dashboard
            </NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>🧑‍💼</span> Users &amp; Clients
            </NavLink>
            <NavLink to="/admin/audit-log" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>🗂️</span> Audit Log
            </NavLink>
          </>
        )}
      </aside>
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
