import { prisma } from '@db';
import { AppError } from '../utils/errors';

export interface CreateTemplateData {
  dietitianId: string;
  title: string;
  content: string;
  category?: string;
}

export interface UpdateTemplateData {
  title?: string;
  content?: string;
  category?: string | null;
}

export async function listTemplates(dietitianUserId: string) {
  return prisma.noteTemplate.findMany({
    where: { dietitianId: dietitianUserId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createTemplate(data: CreateTemplateData) {
  return prisma.noteTemplate.create({
    data: {
      dietitianId: data.dietitianId,
      title: data.title,
      content: data.content,
      category: data.category ?? null,
    },
  });
}

export async function updateTemplate(
  id: string,
  dietitianUserId: string,
  role: string,
  data: UpdateTemplateData
) {
  const template = await prisma.noteTemplate.findUnique({ where: { id } });
  if (!template) {
    throw new AppError(404, 'NOT_FOUND', 'Template not found');
  }
  if (role === 'DIETITIAN' && template.dietitianId !== dietitianUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  return prisma.noteTemplate.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.category !== undefined && { category: data.category }),
    },
  });
}

export async function deleteTemplate(id: string, dietitianUserId: string, role: string) {
  const template = await prisma.noteTemplate.findUnique({ where: { id } });
  if (!template) {
    throw new AppError(404, 'NOT_FOUND', 'Template not found');
  }
  if (role === 'DIETITIAN' && template.dietitianId !== dietitianUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  return prisma.noteTemplate.delete({ where: { id } });
}
