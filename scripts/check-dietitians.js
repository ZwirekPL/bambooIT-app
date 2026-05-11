const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({ where: { role: 'DIETITIAN' }, select: { id: true, email: true, role: true } });
  console.log('DIETITIAN users:', JSON.stringify(users, null, 2));
  const profiles = await p.dietitianProfile.findMany({ select: { userId: true, code: true } });
  console.log('DietitianProfiles:', JSON.stringify(profiles, null, 2));
  await p.$disconnect();
})();
