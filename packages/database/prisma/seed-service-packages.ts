/**
 * Seed: ServicePackage rows — source of truth for hours / overage / SLA per
 * tier. Values locked in PLAN_ops_core.md §9 (2026-06-16).
 *
 * Run: cd packages/database && npx ts-node --transpile-only prisma/seed-service-packages.ts
 * Idempotent — upserts on plan.
 */
import { PrismaClient, SubscriptionPlan } from '@prisma/client';

const prisma = new PrismaClient();

// overage flat 150 zł/h net; carryover cap = 1× monthly included hours;
// SLA reaction: START 24h / FIRMA 8h / FIRMA_PLUS 4h (business hours).
const PACKAGES = [
  { plan: SubscriptionPlan.START,      monthlyPriceNet: '390',  hoursIncluded: 2,  overageRatePerHour: '150', reactionTimeHours: 24, carryoverCapHours: 2 },
  { plan: SubscriptionPlan.FIRMA,      monthlyPriceNet: '690',  hoursIncluded: 5,  overageRatePerHour: '150', reactionTimeHours: 8,  carryoverCapHours: 5 },
  { plan: SubscriptionPlan.FIRMA_PLUS, monthlyPriceNet: '1190', hoursIncluded: 10, overageRatePerHour: '150', reactionTimeHours: 4,  carryoverCapHours: 10 },
];

async function main() {
  for (const p of PACKAGES) {
    await prisma.servicePackage.upsert({
      where: { plan: p.plan },
      update: p,
      create: p,
    });
    console.log(`✓ ${p.plan}: ${p.hoursIncluded}h incl, ${p.overageRatePerHour} zł/h overage, SLA ${p.reactionTimeHours}h, carryover≤${p.carryoverCapHours}h`);
  }
  console.log(`Seeded ${PACKAGES.length} service packages.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Failed to seed service packages:', err);
  process.exit(1);
});
