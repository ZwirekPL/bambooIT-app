import { prisma } from '@db';

export interface NotificationPreferencesData {
  emailReminders?: boolean;
  timezone?: string;
}

export async function getPreferences(userId: string) {
  const prefs = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    // Return defaults without creating a record
    return {
      emailReminders: false,
      timezone: 'Europe/Warsaw',
    };
  }

  return {
    emailReminders: prefs.emailReminders,
    timezone: prefs.timezone,
  };
}

export async function updatePreferences(userId: string, data: NotificationPreferencesData) {
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
    timezone: prefs.timezone,
  };
}
