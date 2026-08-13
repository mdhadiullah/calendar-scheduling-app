import { REMINDER_PRESETS_MINUTES, type ReminderPresetMinutes } from '../types';

export const REMINDER_PRESET_LABELS: Record<ReminderPresetMinutes, string> = {
  5: '5 minutes before',
  10: '10 minutes before',
  15: '15 minutes before',
  30: '30 minutes before',
  60: '1 hour before',
  1440: '1 day before',
};

export function reminderPresetOptions() {
  return REMINDER_PRESETS_MINUTES.map((minutes) => ({
    minutes,
    label: REMINDER_PRESET_LABELS[minutes],
  }));
}

/** Compute the absolute UTC instant a reminder should fire. */
export function computeReminderFireTime(entityStartAt: string, minutesBefore: number | null, customRemindAt: string | null): Date {
  if (customRemindAt) return new Date(customRemindAt);
  const start = new Date(entityStartAt).getTime();
  return new Date(start - (minutesBefore ?? 0) * 60_000);
}
