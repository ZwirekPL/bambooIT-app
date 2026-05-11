import { prisma } from '@db';
import { AppError } from '../utils/errors';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function createTenant(name: string, ownerId: string, slug?: string) {
  const resolvedSlug = slug ?? slugify(name);

  const slugConflict = await prisma.tenant.findUnique({ where: { slug: resolvedSlug } });
  if (slugConflict) {
    throw new AppError(409, 'SLUG_TAKEN', 'Tenant slug is already taken');
  }

  const ownerHasTenant = await prisma.tenant.findUnique({ where: { ownerId } });
  if (ownerHasTenant) {
    throw new AppError(409, 'TENANT_EXISTS', 'User already owns a tenant');
  }

  const tenant = await prisma.tenant.create({
    data: { name, slug: resolvedSlug, ownerId },
  });

  return tenant;
}

export async function getTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found');
  }
  return tenant;
}

export async function updateTenant(slug: string, data: { name?: string; slug?: string; logoUrl?: string | null }) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found');
  }

  if (data.slug && data.slug !== slug) {
    const slugConflict = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (slugConflict) {
      throw new AppError(409, 'SLUG_TAKEN', 'Tenant slug is already taken');
    }
  }

  return prisma.tenant.update({ where: { slug }, data });
}
