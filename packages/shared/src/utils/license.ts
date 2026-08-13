import type { LicenseStatus, UserAccess } from '../types';

export const TRIAL_DURATION_DAYS = 15;

/** Days remaining in the trial, floored at 0. Returns null when not on trial. */
export function trialDaysRemaining(access: Pick<UserAccess, 'license_status' | 'trial_ends_at'>, now: Date = new Date()): number | null {
  if (access.license_status !== 'TRIAL') return null;
  const end = new Date(access.trial_ends_at).getTime();
  const diffMs = end - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function isTrialExpiring(access: Pick<UserAccess, 'license_status' | 'trial_ends_at'>, thresholdDays = 3, now: Date = new Date()): boolean {
  const remaining = trialDaysRemaining(access, now);
  return remaining !== null && remaining <= thresholdDays;
}

/** Whether the account should currently be allowed into the app (non-admin). */
export function isLicenseUsable(status: LicenseStatus): boolean {
  return status === 'TRIAL' || status === 'ACTIVE';
}

export function licenseStatusLabel(status: LicenseStatus): string {
  switch (status) {
    case 'TRIAL':
      return 'Trial';
    case 'ACTIVE':
      return 'Active';
    case 'EXPIRED':
      return 'Expired';
    case 'LOCKED':
      return 'Locked';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}
