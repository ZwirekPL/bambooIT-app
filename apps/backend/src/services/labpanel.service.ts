import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptJson, decryptJson } from '../utils/encryption';

async function assertLabsAccess(patientId: string, orderId?: string) {
  // Access allowed if order is a consultation product
  const order = await prisma.order.findFirst({
    where: {
      patientId,
      status: { in: ['PAID', 'ACTIVE'] },
      ...(orderId ? { id: orderId } : {}),
      productType: 'CONSULTATION',
    },
  });

  if (!order) {
    throw new AppError(403, 'FORBIDDEN', 'Lab panel access requires consultation product');
  }

  return order;
}

interface CreateLabPanelInput {
  patientId: string;
  orderId?: string;
  data: Record<string, unknown>;
}

export async function createLabPanel({ patientId, orderId, data }: CreateLabPanelInput) {
  await assertLabsAccess(patientId, orderId);

  const panel = await prisma.labPanel.create({
    data: {
      patientId,
      orderId: orderId ?? null,
      data: encryptJson(data),
    },
  });

  return { labPanelId: panel.id };
}

export async function listLabPanels(patientId: string) {
  const panels = await prisma.labPanel.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });

  return panels.map((p) => ({
    ...p,
    data: decryptJson(p.data) as Record<string, unknown>,
  }));
}

export async function getLabPanel(id: string, patientId?: string) {
  const panel = await prisma.labPanel.findFirst({
    where: { id, ...(patientId ? { patientId } : {}) },
  });

  if (!panel) {
    throw new AppError(404, 'NOT_FOUND', 'Lab panel not found');
  }

  return {
    ...panel,
    data: decryptJson(panel.data) as Record<string, unknown>,
  };
}
