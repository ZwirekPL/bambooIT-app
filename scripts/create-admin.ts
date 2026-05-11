/**
 * Create the first ADMIN user on a fresh production database.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@e-dietetyk.com ADMIN_PASSWORD=SuperSecure123 \
 *     npx ts-node -r tsconfig-paths/register ../../scripts/create-admin.ts
 *
 * Run from apps/backend/ directory (needs @db alias).
 */
import { prisma } from '@db';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx ts-node -r tsconfig-paths/register ../../scripts/create-admin.ts');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('Password must be at least 12 characters');
    process.exit(1);
  }

  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    console.error('Password must contain at least 1 letter and 1 digit');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists (role: ${existing.role})`);
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
      console.log(`Updated role to ADMIN`);
    }
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'DietetykAI',
      emailVerified: new Date(),
    },
  });

  console.log(`Admin user created: ${user.email} (id: ${user.id})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
