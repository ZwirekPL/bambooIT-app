const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const p = new PrismaClient();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

(async () => {
  // Find all DIETITIAN users without a DietitianProfile
  const dietitians = await p.user.findMany({
    where: {
      role: 'DIETITIAN',
      dietitianProfile: null,
    },
    select: { id: true, email: true },
  });

  if (dietitians.length === 0) {
    console.log('All DIETITIAN users already have profiles.');
    await p.$disconnect();
    return;
  }

  console.log(`Found ${dietitians.length} DIETITIAN user(s) without profile:`);
  for (const d of dietitians) {
    const code = generateCode();
    const profile = await p.dietitianProfile.create({
      data: { userId: d.id, code },
    });
    console.log(`  Created DietitianProfile for ${d.email} with code: ${profile.code}`);
  }

  await p.$disconnect();
})();
