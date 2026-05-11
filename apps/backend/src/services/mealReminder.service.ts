import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { sendMealReminderEmail } from '../utils/email';
import type { PlanContent } from './planValidation.service';

/**
 * Get today's meal name and kcal from the patient's active diet plan.
 * Returns null if no active plan or no matching meal.
 */
async function getTodayMeal(
  patientId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
): Promise<{ name: string; kcal: number } | null> {
  const plan = await prisma.dietPlan.findFirst({
    where: {
      patientId,
      status: { in: ['PUBLISHED', 'SENT'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!plan) return null;

  let content: PlanContent;
  try {
    content = decryptJson(plan.content as string) as PlanContent;
  } catch {
    return null;
  }

  if (!content.days || content.days.length === 0) return null;

  // Map day of week (0=Sunday) to plan day index
  const dayOfWeek = new Date().getDay();
  // Plan days: Mon=0, Tue=1 ... Sun=6; JS getDay: Sun=0, Mon=1 ... Sat=6
  const planDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const day = content.days[planDayIndex % content.days.length];

  if (!day?.meals || day.meals.length === 0) return null;

  // Map meal type to typical index in plan
  const mealIndexMap: Record<string, number> = {
    breakfast: 0,
    lunch: 1, // typically "II śniadanie" or "Obiad"
    dinner: 2,
    snack: 3,
  };

  const mealIndex = mealIndexMap[mealType];
  const meal = day.meals[mealIndex];
  if (!meal) return null;

  const totalKcal = meal.items.reduce((sum, item) => sum + (item.kcal ?? 0), 0);

  return { name: meal.name, kcal: Math.round(totalKcal) };
}

/**
 * Process meal reminders for all patients who have a reminder
 * scheduled around the given time.
 *
 * Called periodically (e.g. every 5 minutes via cron/n8n).
 */
export async function processMealReminders(): Promise<number> {
  const now = new Date();
  const currentHH = now.getUTCHours().toString().padStart(2, '0');
  const currentMM = now.getUTCMinutes().toString().padStart(2, '0');

  // Get all notification preferences with email reminders enabled
  const allPrefs = await prisma.notificationPreferences.findMany({
    where: { emailReminders: true },
    include: {
      user: {
        select: {
          email: true,
          deletedAt: true,
          patient: {
            select: {
              id: true,
              firstName: true,
            },
          },
        },
      },
    },
  });

  let sentCount = 0;

  for (const pref of allPrefs) {
    if (pref.user.deletedAt) continue;
    if (!pref.user.patient) continue;

    const patientId = pref.user.patient.id;
    const firstName = pref.user.patient.firstName ?? '';
    const email = pref.user.email;

    // Check each meal time
    const mealTypes = [
      { type: 'breakfast' as const, time: pref.breakfastTime },
      { type: 'lunch' as const, time: pref.lunchTime },
      { type: 'dinner' as const, time: pref.dinnerTime },
      { type: 'snack' as const, time: pref.snackTime },
    ];

    for (const { type, time } of mealTypes) {
      if (!time) continue;

      // Calculate reminder time (meal time - lead minutes)
      const [mealHH, mealMM] = time.split(':').map(Number);
      const mealMinutesUTC = convertToUTC(mealHH, mealMM, pref.timezone);

      const reminderMinutesUTC = mealMinutesUTC - pref.reminderLeadMinutes;
      const normalizedReminder = ((reminderMinutesUTC % 1440) + 1440) % 1440;

      const currentMinutesUTC = parseInt(currentHH) * 60 + parseInt(currentMM);

      // Match within 5-minute window (for scheduler that runs every 5 min)
      const diff = Math.abs(currentMinutesUTC - normalizedReminder);
      if (diff > 5 && diff < 1435) continue; // also handle midnight wraparound

      // Get today's meal info
      const meal = await getTodayMeal(patientId, type);
      if (!meal) continue;

      try {
        await sendMealReminderEmail(email, firstName, {
          mealName: meal.name,
          kcal: meal.kcal,
          leadMinutes: pref.reminderLeadMinutes,
        });
        sentCount++;
      } catch (err) {
        console.error(`[mealReminder] Failed to send to ${email}:`, (err as Error).message);
      }
    }
  }

  return sentCount;
}

/**
 * Convert local time (HH * 60 + MM) to UTC minutes using rough timezone offset.
 * For production, consider a proper timezone library.
 */
function convertToUTC(hours: number, minutes: number, timezone: string): number {
  // Simple offset map for common Polish/European timezones
  const offsets: Record<string, number> = {
    'Europe/Warsaw': isDST() ? 120 : 60, // CET/CEST in minutes
    'Europe/Berlin': isDST() ? 120 : 60,
    'Europe/London': isDST() ? 60 : 0,
    'UTC': 0,
  };

  const offsetMinutes = offsets[timezone] ?? 60; // default CET
  return hours * 60 + minutes - offsetMinutes;
}

function isDST(): boolean {
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return now.getTimezoneOffset() < stdOffset;
}
