import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../../.env' });

import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';

async function main() {
  const plans = await prisma.dietPlan.findMany({
    where: { status: { in: ['GENERATED', 'REVIEWED', 'PUBLISHED', 'SENT'] } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, status: true, aiModel: true, createdAt: true, content: true },
  });

  console.log(`Znaleziono ${plans.length} planów:\n`);

  for (const p of plans) {
    try {
      const c = decryptJson(p.content) as Record<string, unknown>;
      const days = c?.days as Array<Record<string, unknown>> | undefined;
      const firstDay = days?.[0];
      const meals = firstDay?.meals as Array<Record<string, unknown>> | undefined;
      const items = meals?.[0]?.items as Array<Record<string, unknown>> | undefined;
      const firstItem = items?.[0];
      const ingredients = firstItem?.ingredients as Array<unknown> | undefined;
      const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0;
      const hasKcal = (firstItem?.kcal as number) > 0;
      const version = hasIngredients && !hasKcal ? 'V2' : hasIngredients && hasKcal ? 'V2+kcal' : 'V1';
      console.log(`  ${p.id.slice(0, 15)}  ${version.padEnd(7)}  ${(p.aiModel ?? '?').padEnd(25)}  ${p.createdAt.toISOString().slice(0, 10)}  ${p.status}`);
    } catch (e) {
      console.log(`  ${p.id.slice(0, 15)}  ERR     ${(e as Error).message.slice(0, 40)}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
