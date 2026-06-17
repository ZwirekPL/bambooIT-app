/*
  Warnings:

  - You are about to drop the column `breakfastTime` on the `NotificationPreferences` table. All the data in the column will be lost.
  - You are about to drop the column `dinnerTime` on the `NotificationPreferences` table. All the data in the column will be lost.
  - You are about to drop the column `lunchTime` on the `NotificationPreferences` table. All the data in the column will be lost.
  - You are about to drop the column `reminderLeadMinutes` on the `NotificationPreferences` table. All the data in the column will be lost.
  - You are about to drop the column `snackTime` on the `NotificationPreferences` table. All the data in the column will be lost.
  - You are about to drop the column `weeklySummary` on the `NotificationPreferences` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NotificationPreferences" DROP COLUMN "breakfastTime",
DROP COLUMN "dinnerTime",
DROP COLUMN "lunchTime",
DROP COLUMN "reminderLeadMinutes",
DROP COLUMN "snackTime",
DROP COLUMN "weeklySummary";
