import { prisma } from '@db';

export interface NotificationPreferencesData {
  emailReminders?: boolean;
  breakfastTime?: string | null;
  lunchTime?: string | null;
  dinnerTime?: string | null;
  snackTime?: string | null;
  reminderLeadMinutes?: number;
  weeklySummary?: boolean;
  timezone?: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateTimeField(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return TIME_REGEX.test(value);
}

export async function getPreferences(userId: string) {
  const prefs = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    // Return defaults without creating a record
    return {
      emailReminders: false,
      breakfastTime: null,
      lunchTime: null,
      dinnerTime: null,
      snackTime: null,
      reminderLeadMinutes: 30,
      weeklySummary: true,
      timezone: 'Europe/Warsaw',
    };
  }

  return {
    emailReminders: prefs.emailReminders,
    breakfastTime: prefs.breakfastTime,
    lunchTime: prefs.lunchTime,
    dinnerTime: prefs.dinnerTime,
    snackTime: prefs.snackTime,
    reminderLeadMinutes: prefs.reminderLeadMinutes,
    weeklySummary: prefs.weeklySummary,
    timezone: prefs.timezone,
  };
}

export async function updatePreferences(userId: string, data: NotificationPreferencesData) {
  // Validate time fields
  for (const field of ['breakfastTime', 'lunchTime', 'dinnerTime', 'snackTime'] as const) {
    if (field in data && !validateTimeField(data[field])) {
      throw new Error(`Invalid time format for ${field}. Use HH:MM (e.g. "08:00")`);
    }
  }

  const prefs = await prisma.notificationPreferences.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
  });

  return {
    emailReminders: prefs.emailReminders,
    breakfastTime: prefs.breakfastTime,
    lunchTime: prefs.lunchTime,
    dinnerTime: prefs.dinnerTime,
    snackTime: prefs.snackTime,
    reminderLeadMinutes: prefs.reminderLeadMinutes,
    weeklySummary: prefs.weeklySummary,
    timezone: prefs.timezone,
  };
}
