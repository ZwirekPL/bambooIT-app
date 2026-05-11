import { prisma } from '@db';
import { AppError } from '../utils/errors';

export async function softDeleteUser(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
