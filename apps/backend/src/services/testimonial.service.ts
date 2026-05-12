import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

export async function createTestimonial(userId: string, content: string, rating: number) {
  const existing = await prisma.testimonial.findUnique({ where: { userId } });
  if (existing) {
    throw new AppError(409, 'TESTIMONIAL_EXISTS', 'You have already submitted a testimonial');
  }

  return prisma.testimonial.create({
    data: { userId, content, rating },
  });
}

export async function getApprovedTestimonials() {
  return prisma.testimonial.findMany({
    where: { status: 'APPROVED' },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    include: {
      user: {
        select: {
          id: true,
          company: { select: { contactFirstName: true, contactLastName: true } },
        },
      },
    },
  });
}

export async function getMyTestimonial(userId: string) {
  return prisma.testimonial.findUnique({ where: { userId } });
}

export async function deleteMyTestimonial(userId: string) {
  const existing = await prisma.testimonial.findUnique({ where: { userId } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Testimonial not found');
  }
  return prisma.testimonial.delete({ where: { userId } });
}

// Admin functions

export interface ListTestimonialsOptions {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  ratingMin?: number;
  ratingMax?: number;
}

export async function listAllTestimonials({ page, limit, status, search, sortBy, sortOrder, ratingMin, ratingMax }: ListTestimonialsOptions) {
  const where: Prisma.TestimonialWhereInput = {
    ...(status ? { status: status as Prisma.EnumTestimonialStatusFilter } : {}),
    ...(search ? {
      OR: [
        { content: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ],
    } : {}),
    ...(ratingMin || ratingMax ? {
      rating: {
        ...(ratingMin ? { gte: ratingMin } : {}),
        ...(ratingMax ? { lte: ratingMax } : {}),
      },
    } : {}),
  };

  const orderField = sortBy ?? 'createdAt';
  const orderDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
  const orderBy: Prisma.TestimonialOrderByWithRelationInput =
    orderField === 'rating' ? { rating: orderDir } :
    orderField === 'reviewedAt' ? { reviewedAt: orderDir } :
    { createdAt: orderDir };

  const [testimonials, total] = await Promise.all([
    prisma.testimonial.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            company: { select: { contactFirstName: true, contactLastName: true } },
          },
        },
      },
    }),
    prisma.testimonial.count({ where }),
  ]);

  return { testimonials, total, page, limit };
}

export async function getTestimonialStats() {
  const [total, pending, approved, rejected, avgRating] = await Promise.all([
    prisma.testimonial.count(),
    prisma.testimonial.count({ where: { status: 'PENDING' } }),
    prisma.testimonial.count({ where: { status: 'APPROVED' } }),
    prisma.testimonial.count({ where: { status: 'REJECTED' } }),
    prisma.testimonial.aggregate({ _avg: { rating: true } }),
  ]);
  return { total, pending, approved, rejected, avgRating: Math.round((avgRating._avg.rating ?? 0) * 10) / 10 };
}

export async function bulkUpdateStatus(ids: string[], status: 'APPROVED' | 'REJECTED', reviewedBy: string) {
  return prisma.testimonial.updateMany({
    where: { id: { in: ids } },
    data: { status, reviewedAt: new Date(), reviewedBy },
  });
}

export async function updateMyTestimonial(userId: string, content: string, rating: number) {
  const existing = await prisma.testimonial.findUnique({ where: { userId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Testimonial not found');
  return prisma.testimonial.update({
    where: { userId },
    data: { content, rating, status: 'PENDING', reviewedAt: null, reviewedBy: null },
  });
}

export async function replyToTestimonial(id: string, reply: string) {
  const testimonial = await prisma.testimonial.findUnique({ where: { id } });
  if (!testimonial) throw new AppError(404, 'NOT_FOUND', 'Testimonial not found');
  return prisma.testimonial.update({
    where: { id },
    data: { adminReply: reply, adminReplyAt: new Date() },
  });
}

export async function togglePin(id: string) {
  const testimonial = await prisma.testimonial.findUnique({ where: { id } });
  if (!testimonial) throw new AppError(404, 'NOT_FOUND', 'Testimonial not found');

  if (!testimonial.isPinned) {
    const pinnedCount = await prisma.testimonial.count({ where: { isPinned: true } });
    if (pinnedCount >= 5) throw new AppError(400, 'PIN_LIMIT', 'Maximum 5 pinned testimonials');
  }

  return prisma.testimonial.update({
    where: { id },
    data: { isPinned: !testimonial.isPinned },
  });
}

export async function updateTestimonialStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reviewedBy: string
) {
  const testimonial = await prisma.testimonial.findUnique({ where: { id } });
  if (!testimonial) {
    throw new AppError(404, 'NOT_FOUND', 'Testimonial not found');
  }

  return prisma.testimonial.update({
    where: { id },
    data: { status, reviewedAt: new Date(), reviewedBy },
  });
}
