import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isLicenseUsable } from '@calendar-app/shared';
import { useAuth } from '../contexts/AuthContext';
import { AccessRestrictedPage } from '../pages/AccessRestrictedPage';

export function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { session, profile, access, loading } = useAuth();

  if (loading) return <div className="center-screen">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="center-screen">Loading your profile…</div>;

  if (profile.status === 'LOCKED') return <AccessRestrictedPage reason="LOCKED" />;
  if (profile.status === 'SUSPENDED') return <AccessRestrictedPage reason="SUSPENDED" />;

  if (profile.role !== 'ADMIN' && access && !isLicenseUsable(access.license_status)) {
    return <AccessRestrictedPage reason={access.license_status === 'CANCELLED' ? 'CANCELLED' : 'EXPIRED'} />;
  }

  if (adminOnly && profile.role !== 'ADMIN') return <Navigate to="/" replace />;

  return <>{children}</>;
}
