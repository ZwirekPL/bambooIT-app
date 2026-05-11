import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { AppError } from '../utils/errors';
import type { PlanContent, PlanMeal } from './planValidation.service';

/**
 * Generate iCalendar (.ics) string from a diet plan.
 * Creates events for each meal in the plan, starting from the given Monday.
 */
export async function generateCalendar(
  planId: string,
  userId?: string,
  role?: string,
  userPatientId?: string,
  startDate?: string, // ISO date for the Monday to start from
): Promise<string> {
  // Access check
  let plan;
  if (role === 'PATIENT') {
    if (!userPatientId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
    plan = await prisma.dietPlan.findFirst({
      where: { id: planId, patientId: userPatientId, status: { in: ['PUBLISHED', 'SENT'] } },
    });
  } else {
    plan = await prisma.dietPlan.findUnique({ where: { id: planId } });
  }

  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Plan not found');

  const content = decryptJson(plan.content) as PlanContent;
  if (!content.days || content.days.length === 0) {
    throw new AppError(422, 'EMPTY_PLAN', 'Plan has no days');
  }

  // Get notification preferences for meal times (if user has them)
  const prefs = userId
    ? await prisma.notificationPreferences.findUnique({ where: { userId } })
    : null;

  // Determine start date (default: next Monday)
  const start = startDate ? new Date(startDate) : getNextMonday();

  const events: string[] = [];

  for (let dayIdx = 0; dayIdx < content.days.length; dayIdx++) {
    const day = content.days[dayIdx];
    const eventDate = new Date(start);
    eventDate.setDate(start.getDate() + dayIdx);

    for (let mealIdx = 0; mealIdx < day.meals.length; mealIdx++) {
      const meal = day.meals[mealIdx];
      const mealTime = getMealTime(mealIdx, prefs);
      const totalKcal = meal.items.reduce((sum, item) => sum + (item.kcal ?? 0), 0);

      events.push(createEvent(
        meal,
        eventDate,
        mealTime,
        Math.round(totalKcal),
        planId,
        dayIdx,
        mealIdx,
      ));
    }
  }

  return buildIcs(events);
}

interface MealTimeConfig {
  breakfastTime?: string | null;
  lunchTime?: string | null;
  dinnerTime?: string | null;
  snackTime?: string | null;
}

function getMealTime(mealIndex: number, prefs: MealTimeConfig | null): string {
  // Default meal times
  const defaults = ['08:00', '12:00', '15:00', '18:00', '20:00'];

  if (prefs) {
    const prefTimes = [
      prefs.breakfastTime,
      prefs.lunchTime,
      prefs.dinnerTime,
      prefs.snackTime,
    ];
    const prefTime = prefTimes[mealIndex];
    if (prefTime) return prefTime;
  }

  return defaults[mealIndex] ?? defaults[defaults.length - 1];
}

function createEvent(
  meal: PlanMeal,
  date: Date,
  time: string,
  kcal: number,
  planId: string,
  dayIdx: number,
  mealIdx: number,
): string {
  const [hours, minutes] = time.split(':').map(Number);
  const dtStart = new Date(date);
  dtStart.setHours(hours, minutes, 0, 0);

  const dtEnd = new Date(dtStart);
  dtEnd.setMinutes(dtEnd.getMinutes() + 30); // 30 min per meal

  const description = buildDescription(meal, kcal);
  const uid = `${planId}-d${dayIdx}-m${mealIdx}@dietetykai`;

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${formatIcsDate(dtStart)}`,
    `DTEND:${formatIcsDate(dtEnd)}`,
    `SUMMARY:${escapeIcs(meal.name)} (${kcal} kcal)`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'STATUS:CONFIRMED',
    `DTSTAMP:${formatIcsDate(new Date())}`,
    'END:VEVENT',
  ].join('\r\n');
}

function buildDescription(meal: PlanMeal, kcal: number): string {
  const lines: string[] = [];
  lines.push(`${meal.name} — ${kcal} kcal`);
  lines.push('');

  for (const item of meal.items) {
    lines.push(`- ${item.name}: ${item.grams}g (${Math.round(item.kcal)} kcal)`);
  }

  if (meal.recipe?.steps && meal.recipe.steps.length > 0) {
    lines.push('');
    lines.push('Przepis:');
    meal.recipe.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    if (meal.recipe.tips) {
      lines.push(`Tip: ${meal.recipe.tips}`);
    }
  }

  return lines.join('\\n');
}

function buildIcs(events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//e-dietetyk.com//Plan Diety//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Plan Diety — e-dietetyk.com',
    'X-WR-TIMEZONE:Europe/Warsaw',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function formatIcsDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function getNextMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
