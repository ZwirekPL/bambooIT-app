import { Request, Response } from 'express';
import { constructWebhookEvent, isStripeConfigured } from '../services/stripe.service';
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from '../services/subscription.service';
import { handleOrderCheckoutCompleted } from '../services/checkout.service';
import { recordTrialFingerprint } from '../services/trialFingerprint.service';
import { logAudit } from '../services/audit.service';
import { markEventProcessed } from '../utils/idempotency';
import { retrieveSetupIntentPaymentMethod } from '../services/stripe.service';
import type Stripe from 'stripe';

// In Stripe SDK v20 (API 2026-02-25.clover) the Invoice.subscription field
// was moved to Invoice.parent.subscription_details.subscription.
// We extract it via a loose type to stay forward-compatible.
function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Try legacy path first (defensive)
  const raw = invoice as unknown as Record<string, unknown>;
  if (typeof raw.subscription === 'string') return raw.subscription;

  // New path: invoice.parent.subscription_details.subscription
  const parent = raw.parent as Record<string, unknown> | undefined;
  if (parent?.type === 'subscription_details') {
    const details = parent.subscription_details as Record<string, unknown> | undefined;
    if (typeof details?.subscription === 'string') return details.subscription;
  }
  return null;
}

export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  // In mock mode — acknowledge immediately
  if (!isStripeConfigured()) {
    res.json({ received: true, mock: true });
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: { code: 'MISSING_SIGNATURE', message: 'Missing Stripe-Signature header' } });
    return;
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(req.body as Buffer, signature);
  } catch {
    res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } });
    return;
  }

  // Deduplicate: if this event.id was already processed, ack immediately
  const isNew = await markEventProcessed('stripe', event.id);
  if (!isNew) {
    res.json({ received: true, duplicate: true });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null;

        // Handle company order checkout (has orderId in metadata)
        if (session.metadata?.orderId) {
          await handleOrderCheckoutCompleted(session.metadata.orderId);
          logAudit({
            action: 'CHECKOUT_COMPLETED',
            resourceType: 'ORDER',
            resourceId: session.metadata.orderId,
            ip: req.ip,
          });
        }

        // Record trial card fingerprint for anti-abuse (29.2.4)
        if (session.metadata?.productType === 'TRIAL' && session.metadata?.userId) {
          try {
            const pm = await retrieveSetupIntentPaymentMethod(session);
            if (pm?.card?.fingerprint) {
              await recordTrialFingerprint(
                pm.card.fingerprint,
                session.metadata.userId,
                session.id,
              );
            }
          } catch (err) {
            console.error('[webhook] Failed to record trial fingerprint:', err);
          }
        }

        // Handle dietitian subscription checkout (has subscription)
        if (subscriptionId) {
          await handleCheckoutCompleted({
            customer: typeof session.customer === 'string' ? session.customer : null,
            subscription: subscriptionId,
            customer_email: session.customer_email,
            metadata: session.metadata,
          });
          logAudit({
            action: 'STRIPE_CHECKOUT_COMPLETED',
            resourceType: 'SUBSCRIPTION',
            resourceId: subscriptionId,
            ip: req.ip,
          });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = extractInvoiceSubscriptionId(invoice);
        await handleInvoicePaid({
          subscription: subscriptionId,
          lines: invoice.lines as {
            data: Array<{ price?: { id: string } | null; period?: { start: number; end: number } }>;
          },
        });
        logAudit({
          action: 'STRIPE_INVOICE_PAID',
          resourceType: 'SUBSCRIPTION',
          resourceId: subscriptionId ?? '',
          ip: req.ip,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const updatedSub = event.data.object as Stripe.Subscription;
        // In Stripe API 2026-02-25.clover, current_period_start/end may be
        // nested or removed. Access them defensively via loose typing.
        const rawSub = updatedSub as unknown as Record<string, unknown>;
        await handleSubscriptionUpdated({
          id: updatedSub.id,
          cancel_at_period_end: updatedSub.cancel_at_period_end,
          status: updatedSub.status,
          items: updatedSub.items,
          current_period_start: typeof rawSub.current_period_start === 'number'
            ? rawSub.current_period_start
            : undefined,
          current_period_end: typeof rawSub.current_period_end === 'number'
            ? rawSub.current_period_end
            : undefined,
        });
        logAudit({
          action: 'STRIPE_SUBSCRIPTION_UPDATED',
          resourceType: 'SUBSCRIPTION',
          resourceId: updatedSub.id,
          ip: req.ip,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub.id);
        logAudit({
          action: 'STRIPE_SUBSCRIPTION_DELETED',
          resourceType: 'SUBSCRIPTION',
          resourceId: sub.id,
          ip: req.ip,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const failedSubId = extractInvoiceSubscriptionId(failedInvoice);
        await handleInvoicePaymentFailed({ subscription: failedSubId });
        logAudit({
          action: 'STRIPE_INVOICE_PAYMENT_FAILED',
          resourceType: 'SUBSCRIPTION',
          resourceId: failedSubId ?? '',
          ip: req.ip,
        });
        break;
      }

      default:
        // Unhandled event — acknowledge without processing
        break;
    }
  } catch (err) {
    console.error('[webhook] Error processing Stripe event:', err);
    res.status(500).json({ error: { code: 'WEBHOOK_ERROR', message: 'Failed to process webhook event' } });
    return;
  }

  res.json({ received: true });
}
