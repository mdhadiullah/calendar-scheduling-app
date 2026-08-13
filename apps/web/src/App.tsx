import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { CalendarPage } from './pages/CalendarPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { TasksPage } from './pages/TasksPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { NotesPage } from './pages/NotesPage';
import { TeamPage } from './pages/TeamPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage';
import { AdminAuditLogPage } from './pages/admin/AdminAuditLogPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/set-password" element={<SetPasswordPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute adminOnly>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <ProtectedRoute adminOnly>
              <AdminUserDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <ProtectedRoute adminOnly>
              <AdminAuditLogPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
