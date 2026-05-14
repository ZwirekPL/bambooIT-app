import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  subscription: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  lead: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  logAudit: vi.fn(),
  sendSubscriptionWelcomeEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  createPortalSession: vi.fn(),
  isStripeConfigured: vi.fn().mockReturnValue(true),
  createCheckoutSession: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    subscription: m.subscription,
    user: m.user,
    lead: m.lead,
  },
}));

vi.mock('../../services/audit.service', () => ({
  logAudit: m.logAudit,
}));

vi.mock('../../utils/email', () => ({
  sendSubscriptionWelcomeEmail: m.sendSubscriptionWelcomeEmail,
  sendPaymentFailedEmail: m.sendPaymentFailedEmail,
}));

vi.mock('../../services/stripe.service', () => ({
  createPortalSession: m.createPortalSession,
  isStripeConfigured: m.isStripeConfigured,
  createCheckoutSession: m.createCheckoutSession,
}));

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from '../../services/subscription.service';

const NOW = new Date('2026-05-14T08:00:00Z');

describe('handleCheckoutCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.subscription.upsert.mockResolvedValue({});
    m.user.findUnique.mockResolvedValue({ email: 'klient@example.pl' });
    m.lead.findMany.mockResolvedValue([]);
    m.lead.updateMany.mockResolvedValue({ count: 0 });
  });

  it('no-ops when customer or subscription is missing', async () => {
    await handleCheckoutCompleted({
      customer: null,
      subscription: 'sub_x',
      customer_email: 'a@x.pl',
      metadata: null,
    });
    expect(m.subscription.upsert).not.toHaveBeenCalled();
  });

  it('upserts subscription with plan from metadata', async () => {
    await handleCheckoutCompleted({
      customer: 'cus_1',
      subscription: 'sub_1',
      customer_email: 'klient@example.pl',
      metadata: { plan: 'FIRMA_PLUS', userId: 'u_1' },
    });

    expect(m.subscription.upsert).toHaveBeenCalledOnce();
    const args = m.subscription.upsert.mock.calls[0][0];
    expect(args.where.userId).toBe('u_1');
    expect(args.create.plan).toBe('FIRMA_PLUS');
    expect(args.create.status).toBe('ACTIVE');
  });

  it('marks matching Lead rows CONVERTED on successful checkout', async () => {
    m.lead.findMany.mockResolvedValueOnce([
      { id: 'l_1', status: 'NEW', type: 'AUDIT', source: 'audit-form' },
      { id: 'l_2', status: 'CONTACTED', type: 'CONTACT', source: 'contact-form' },
    ]);
    m.lead.updateMany.mockResolvedValueOnce({ count: 2 });

    await handleCheckoutCompleted({
      customer: 'cus_1',
      subscription: 'sub_1',
      customer_email: 'klient@example.pl',
      metadata: { plan: 'FIRMA', userId: 'u_1' },
    });

    expect(m.lead.findMany).toHaveBeenCalledWith({
      where: {
        email: 'klient@example.pl',
        status: { notIn: ['CONVERTED', 'REJECTED'] },
      },
      select: expect.any(Object),
    });
    expect(m.lead.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['l_1', 'l_2'] } },
      data: { status: 'CONVERTED' },
    });
    expect(m.logAudit).toHaveBeenCalledTimes(2);
  });

  it('does not block subscription creation when lead conversion fails', async () => {
    m.lead.findMany.mockRejectedValueOnce(new Error('DB hiccup'));

    await expect(
      handleCheckoutCompleted({
        customer: 'cus_1',
        subscription: 'sub_1',
        customer_email: 'klient@example.pl',
        metadata: { plan: 'START', userId: 'u_1' },
      }),
    ).resolves.toBeUndefined();

    expect(m.subscription.upsert).toHaveBeenCalledOnce();
  });

  it('falls back to existing subscription lookup when userId not in metadata', async () => {
    m.subscription.findUnique.mockResolvedValueOnce({ userId: 'u_existing' });

    await handleCheckoutCompleted({
      customer: 'cus_1',
      subscription: 'sub_1',
      customer_email: null,
      metadata: null,
    });

    expect(m.subscription.findUnique).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_1' },
    });
    expect(m.subscription.upsert).toHaveBeenCalledOnce();
    expect(m.subscription.upsert.mock.calls[0][0].where.userId).toBe('u_existing');
  });
});

describe('handleInvoicePaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.subscription.update.mockResolvedValue({});
    m.sendSubscriptionWelcomeEmail.mockResolvedValue(undefined);
  });

  it('no-ops when invoice has no subscription', async () => {
    await handleInvoicePaid({ subscription: null });
    expect(m.subscription.update).not.toHaveBeenCalled();
  });

  it('no-ops when subscription record not found in DB', async () => {
    m.subscription.findUnique.mockResolvedValue(null);
    await handleInvoicePaid({ subscription: 'sub_unknown' });
    expect(m.subscription.update).not.toHaveBeenCalled();
  });

  it('updates period dates and plan from price ID', async () => {
    const ORIG_PRICE_START = process.env.STRIPE_PRICE_START;
    process.env.STRIPE_PRICE_START = 'price_start_test';

    m.subscription.findUnique.mockResolvedValue({
      userId: 'u_1',
      stripeSubscriptionId: 'sub_1',
      createdAt: NOW,
    });

    const periodEnd = Math.floor(NOW.getTime() / 1000) + 30 * 24 * 60 * 60;
    const periodStart = Math.floor(NOW.getTime() / 1000);

    await handleInvoicePaid({
      subscription: 'sub_1',
      lines: {
        data: [
          {
            price: { id: 'price_start_test' },
            period: { start: periodStart, end: periodEnd },
          },
        ],
      },
    });

    expect(m.subscription.update).toHaveBeenCalledOnce();
    const data = m.subscription.update.mock.calls[0][0].data;
    expect(data.status).toBe('ACTIVE');
    expect(data.plan).toBe('START');
    expect(data.stripePriceId).toBe('price_start_test');
    expect(data.currentPeriodStart).toBeInstanceOf(Date);
    expect(data.currentPeriodEnd).toBeInstanceOf(Date);

    if (ORIG_PRICE_START === undefined) delete process.env.STRIPE_PRICE_START;
    else process.env.STRIPE_PRICE_START = ORIG_PRICE_START;
  });
});

describe('handleSubscriptionDeleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks subscription as CANCELED', async () => {
    m.subscription.findUnique.mockResolvedValue({ userId: 'u_1' });
    m.subscription.update.mockResolvedValue({});

    await handleSubscriptionDeleted('sub_1');

    expect(m.subscription.update).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_1' },
      data: { status: 'CANCELED', cancelAtPeriodEnd: false },
    });
  });

  it('no-ops when subscription missing', async () => {
    m.subscription.findUnique.mockResolvedValue(null);
    await handleSubscriptionDeleted('sub_missing');
    expect(m.subscription.update).not.toHaveBeenCalled();
  });
});

describe('handleInvoicePaymentFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.subscription.update.mockResolvedValue({});
    m.user.findUnique.mockResolvedValue({ email: 'klient@example.pl' });
    m.createPortalSession.mockResolvedValue('https://stripe.example.com/portal');
    m.sendPaymentFailedEmail.mockResolvedValue(undefined);
  });

  it('marks subscription PAST_DUE', async () => {
    m.subscription.findUnique.mockResolvedValue({
      userId: 'u_1',
      stripeCustomerId: 'cus_1',
      plan: 'FIRMA',
    });

    await handleInvoicePaymentFailed({ subscription: 'sub_1' });

    expect(m.subscription.update).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_1' },
      data: { status: 'PAST_DUE' },
    });
  });
});
