import { prisma } from '@db';
import { AppError } from '../utils/errors';

export interface BlogCategoryInput {
  name: string;
  slug: string;
  isActive?: boolean;
}

/** Default slugs — these categories cannot be fully deleted (only deactivated). */
const DEFAULT_SLUGS = new Set([
  'obsluga-it',
  'cyberbezpieczenstwo',
  'backup',
  'microsoft-365',
  'sprzet-i-sieci',
  'automatyzacje',
  'strony-i-aplikacje',
  'branze',
]);

export function isDefaultCategory(slug: string): boolean {
  return DEFAULT_SLUGS.has(slug);
}

export async function listActiveCategories() {
  return prisma.blogCategoryConfig.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function listAllCategories() {
  return prisma.blogCategoryConfig.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(data: BlogCategoryInput) {
  const existing = await prisma.blogCategoryConfig.findUnique({
    where: { slug: data.slug },
  });
  if (existing) {
    throw new AppError(409, 'SLUG_TAKEN', 'Category with this slug already exists');
  }
  return prisma.blogCategoryConfig.create({ data });
}

export async function updateCategory(
  id: string,
  data: Partial<BlogCategoryInput>
) {
  const cat = await prisma.blogCategoryConfig.findUnique({ where: { id } });
  if (!cat) throw new AppError(404, 'NOT_FOUND', 'Category not found');

  if (data.slug && data.slug !== cat.slug) {
    const conflict = await prisma.blogCategoryConfig.findUnique({
      where: { slug: data.slug },
    });
    if (conflict) {
      throw new AppError(409, 'SLUG_TAKEN', 'Category with this slug already exists');
    }
  }

  return prisma.blogCategoryConfig.update({ where: { id }, data });
}

export async function deactivateCategory(id: string) {
  const cat = await prisma.blogCategoryConfig.findUnique({ where: { id } });
  if (!cat) throw new AppError(404, 'NOT_FOUND', 'Category not found');

  // Default categories are soft-deactivated, custom ones are hard-deleted
  if (isDefaultCategory(cat.slug)) {
    return prisma.blogCategoryConfig.update({
      where: { id },
      data: { isActive: false },
    });
  }
  return prisma.blogCategoryConfig.delete({ where: { id } });
}
