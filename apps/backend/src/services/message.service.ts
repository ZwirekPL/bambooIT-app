/**
 * Message Service (79.1)
 *
 * Async chat between patient and dietitian.
 * Messages are encrypted with AES-256-GCM.
 */

import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptString, decryptString } from '../utils/encryption';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SendMessageInput {
  conversationId?: string; // if null, auto-create from patientId + dietitianId
  patientId?: string;
  dietitianId?: string;
  senderId: string;
  senderRole: 'PATIENT' | 'DIETITIAN';
  content: string;
}

// ─── Get or create conversation ──────────────────────────────────────────────

export async function getOrCreateConversation(
  patientId: string,
  dietitianId: string,
): Promise<string> {
  const existing = await prisma.conversation.findUnique({
    where: { patientId_dietitianId: { patientId, dietitianId } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const conv = await prisma.conversation.create({
    data: { patientId, dietitianId },
  });
  return conv.id;
}

// ─── Send message ────────────────────────────────────────────────────────────

export async function sendMessage(input: SendMessageInput) {
  let conversationId = input.conversationId;

  // Auto-create conversation if needed
  if (!conversationId) {
    if (!input.patientId || !input.dietitianId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Either conversationId or patientId+dietitianId required');
    }
    conversationId = await getOrCreateConversation(input.patientId, input.dietitianId);
  }

  // Verify conversation exists and sender is participant
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, patientId: true, dietitianId: true },
  });
  if (!conv) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
  if (input.senderId !== conv.patientId && input.senderId !== conv.dietitianId) {
    throw new AppError(403, 'FORBIDDEN', 'Not a participant of this conversation');
  }

  // Encrypt content
  const encrypted = encryptString(input.content);

  // Create message + update conversation counters
  const isFromPatient = input.senderRole === 'PATIENT';

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: input.senderId,
      senderRole: input.senderRole,
      content: encrypted,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      ...(isFromPatient
        ? { unreadCountDietitian: { increment: 1 } }
        : { unreadCountPatient: { increment: 1 } }),
    },
  });

  return {
    id: message.id,
    conversationId,
    senderId: message.senderId,
    senderRole: message.senderRole,
    content: input.content, // return plain text (not encrypted)
    createdAt: message.createdAt,
  };
}

// ─── List messages in conversation ───────────────────────────────────────────

export async function listMessages(
  conversationId: string,
  userId: string,
  page = 1,
  limit = 50,
) {
  // Verify participant
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { patientId: true, dietitianId: true },
  });
  if (!conv) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
  if (userId !== conv.patientId && userId !== conv.dietitianId) {
    throw new AppError(403, 'FORBIDDEN', 'Not a participant');
  }

  const skip = (page - 1) * limit;

  const [messages, total] = await prisma.$transaction([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        senderId: true,
        senderRole: true,
        content: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  // Decrypt messages
  const decrypted = messages.map((m) => ({
    ...m,
    content: decryptString(m.content),
  }));

  return { messages: decrypted.reverse(), total, page, limit };
}

// ─── Mark messages as read ───────────────────────────────────────────────────

export async function markAsRead(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { patientId: true, dietitianId: true },
  });
  if (!conv) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');

  const isPatient = userId === conv.patientId;
  const isDietitian = userId === conv.dietitianId;
  if (!isPatient && !isDietitian) {
    throw new AppError(403, 'FORBIDDEN', 'Not a participant');
  }

  // Mark all unread messages from the OTHER person as read
  const otherRole = isPatient ? 'DIETITIAN' : 'PATIENT';
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderRole: otherRole,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  // Reset unread counter
  await prisma.conversation.update({
    where: { id: conversationId },
    data: isPatient
      ? { unreadCountPatient: 0 }
      : { unreadCountDietitian: 0 },
  });

  return { ok: true };
}

// ─── List conversations ──────────────────────────────────────────────────────

export async function listConversations(userId: string, role: string) {
  const where = role === 'PATIENT'
    ? { patientId: userId }
    : { dietitianId: userId };

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    select: {
      id: true,
      patientId: true,
      dietitianId: true,
      lastMessageAt: true,
      unreadCountPatient: true,
      unreadCountDietitian: true,
      patient: { select: { id: true, email: true, patient: { select: { firstName: true, lastName: true } } } },
      dietitian: { select: { id: true, email: true, dietitianProfile: { select: { firstName: true, lastName: true } } } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, senderRole: true, createdAt: true },
      },
    },
  });

  return conversations.map((c) => ({
    id: c.id,
    patientId: c.patientId,
    dietitianId: c.dietitianId,
    lastMessageAt: c.lastMessageAt,
    unreadCount: role === 'PATIENT' ? c.unreadCountPatient : c.unreadCountDietitian,
    otherName: role === 'PATIENT'
      ? [c.dietitian.dietitianProfile?.firstName, c.dietitian.dietitianProfile?.lastName].filter(Boolean).join(' ') || c.dietitian.email
      : [c.patient.patient?.firstName, c.patient.patient?.lastName].filter(Boolean).join(' ') || c.patient.email,
    lastMessage: c.messages[0]
      ? {
          preview: decryptString(c.messages[0].content).slice(0, 100),
          senderRole: c.messages[0].senderRole,
          createdAt: c.messages[0].createdAt,
        }
      : null,
  }));
}

// ─── Get unread count for user ───────────────────────────────────────────────

export async function getUnreadCount(userId: string, role: string): Promise<number> {
  if (role === 'PATIENT') {
    const result = await prisma.conversation.aggregate({
      where: { patientId: userId },
      _sum: { unreadCountPatient: true },
    });
    return result._sum.unreadCountPatient ?? 0;
  }
  const result = await prisma.conversation.aggregate({
    where: { dietitianId: userId },
    _sum: { unreadCountDietitian: true },
  });
  return result._sum.unreadCountDietitian ?? 0;
}
