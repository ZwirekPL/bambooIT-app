import { prisma, Prisma } from '@db';
import { redis } from '../utils/redis';

const BAN_IP_PREFIX = 'banned:ip:';
const BAN_FP_PREFIX = 'banned:fp:';

export async function createBan(data: {
  type: string;
  value: string;
  reason: string;
  createdById?: string;
  expiresAt?: Date | null;
}) {
  const ban = await prisma.securityBan.create({ data });

  // Cache in Redis for O(1) lookup
  const prefix = data.type === 'FINGERPRINT' ? BAN_FP_PREFIX : BAN_IP_PREFIX;
  const key = `${prefix}${data.value}`;
  if (data.expiresAt) {
    const ttl = Math.max(1, Math.floor((data.expiresAt.getTime() - Date.now()) / 1000));
    await redis.set(key, '1', 'EX', ttl).catch(() => {});
  } else {
    await redis.set(key, '1').catch(() => {});
  }

  return ban;
}

export async function removeBan(id: string) {
  const ban = await prisma.securityBan.findUnique({ where: { id } });
  if (!ban) return null;

  await prisma.securityBan.update({ where: { id }, data: { active: false } });

  const prefix = ban.type === 'FINGERPRINT' ? BAN_FP_PREFIX : BAN_IP_PREFIX;
  await redis.del(`${prefix}${ban.value}`).catch(() => {});

  return ban;
}

export async function isIpBanned(ip: string): Promise<boolean> {
  const cached = await redis.get(`${BAN_IP_PREFIX}${ip}`).catch(() => null);
  return cached === '1';
}

export async function isFingerprintBanned(fingerprint: string): Promise<boolean> {
  const cached = await redis.get(`${BAN_FP_PREFIX}${fingerprint}`).catch(() => null);
  return cached === '1';
}

export async function getActiveBans(opts: { type?: string; page: number; limit: number }) {
  const where: Prisma.SecurityBanWhereInput = { active: true };
  if (opts.type) where.type = opts.type;

  // Filter out expired bans
  where.OR = [
    { expiresAt: null },
    { expiresAt: { gt: new Date() } },
  ];

  const [bans, total] = await Promise.all([
    prisma.securityBan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.securityBan.count({ where }),
  ]);

  return { bans, total, page: opts.page, limit: opts.limit };
}
