import { prisma, Prisma } from '@db';

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'SESSION_SUPERSEDED'
  | 'VIEW_INTERVIEW'
  | 'CREATE_INTERVIEW'
  | 'UPDATE_INTERVIEW'
  | 'REQUEST_INTERVIEW_UPDATE'
  | 'APPROVE_AI_RECIPE'
  | 'GENERATE_PLAN'
  | 'VIEW_PLAN'
  | 'DELETE_USER'
  | 'RESTORE_USER'
  | 'DELETE_TENANT'
  | 'RESTORE_TENANT'
  | 'CREATE_TENANT'
  | 'UPDATE_TENANT'
  | 'VIEW_PATIENT'
  | 'UPDATE_PATIENT'
  | 'DELETE_PATIENT'
  | 'APPROVE_PLAN'
  | 'SEND_PLAN'
  | 'CREATE_MANUAL_PLAN'
  | 'PUBLISH_PLAN'
  | 'EXPORT_PLAN'
  | 'EDIT_PLAN'
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFIED'
  | 'LOGOUT'
  | 'CHANGE_USER_ROLE'
  | 'CREATE_USER'
  | 'UPDATE_PROFILE'
  | 'LEAD_CREATED'
  | 'LEAD_STATUS_UPDATED'
  | 'LEAD_NOTE_ADDED'
  | 'LEAD_NOTE_DELETED'
  | 'LEAD_EXPORTED'
  | 'SUBSCRIPTION_CHECKOUT_STARTED'
  | 'SUBSCRIPTION_PORTAL_ACCESSED'
  | 'STRIPE_CHECKOUT_COMPLETED'
  | 'STRIPE_INVOICE_PAID'
  | 'STRIPE_SUBSCRIPTION_DELETED'
  | 'STRIPE_SUBSCRIPTION_UPDATED'
  | 'STRIPE_INVOICE_PAYMENT_FAILED'
  | 'TIME_ENTRY_ADDED'
  | 'TIME_ENTRY_UPDATED'
  | 'TIME_ENTRY_DELETED'
  | 'SERVICE_PERIOD_SETTLED'
  | 'SERVICE_PERIOD_REPORT_SENT'
  | 'SERVICE_PLAN_SET'
  | 'ONBOARDING_UPDATED'
  | 'CREATE_POST'
  | 'EDIT_POST'
  | 'DELETE_POST'
  | 'CREATE_FOOD_ITEM'
  | 'UPDATE_FOOD_ITEM'
  | 'DELETE_FOOD_ITEM'
  | 'IMPORT_FOOD_ITEMS'
  | 'CREATE_FOOD_PRODUCT'
  | 'UPDATE_FOOD_PRODUCT'
  | 'DELETE_FOOD_PRODUCT'
  | 'VERIFY_FOOD_PRODUCT'
  | 'IMPORT_FOOD_PRODUCTS'
  | 'CREATE_RECIPE'
  | 'UPDATE_RECIPE'
  | 'DELETE_RECIPE'
  | 'BULK_UPDATE_RECIPES'
  | 'MERGE_RECIPES'
  | 'UNLOCK_PATIENT_PROFILE'
  | 'UNLOCK_ACCOUNT'
  | 'CREATE_MEAL'
  | 'UPDATE_MEAL'
  | 'DELETE_MEAL'
  | 'CREATE_TEMPLATE_PLAN'
  | 'UPDATE_TEMPLATE_PLAN'
  | 'DELETE_TEMPLATE_PLAN'
  | 'N8N_WORKFLOW_TRIGGERED'
  | 'N8N_PLAN_RECEIVED'
  | 'AI_GENERATION_ENQUEUED'
  | 'AI_REPAIR_ENQUEUED'
  | 'AI_PARTIAL_REGEN_ENQUEUED'
  | 'CHECKOUT_STARTED'
  | 'CHECKOUT_COMPLETED'
  | 'RED_FLAG_TRIGGERED'
  | 'GENERATION_BLOCKED'
  | 'CREATE_CHECKIN'
  | 'CHECKIN_ADAPTATION'
  | 'SEND_WEEKLY_SUMMARY'
  | 'SEND_WEEKLY_SUMMARY_BATCH'
  | 'CREATE_FEATURE_FLAG'
  | 'UPDATE_FEATURE_FLAG'
  | 'DELETE_FEATURE_FLAG'
  | 'PASSWORD_CHANGE'
  | 'EMAIL_CHANGE'
  | 'ADMIN_VERIFY_EMAIL'
  | 'ADMIN_RESEND_VERIFICATION'
  | 'RESEND_VERIFICATION'
  | 'CREATE_TESTIMONIAL'
  | 'DELETE_TESTIMONIAL'
  | 'APPROVE_TESTIMONIAL'
  | 'REJECT_TESTIMONIAL'
  | 'UPDATE_DIET_TEMPLATE'
  | 'DELETE_DIET_TEMPLATE'
  | 'INVALIDATE_ALL_DIET_TEMPLATES'
  | 'REQUEST_MEAL_SWAP'
  | 'CONFIRM_MEAL_SWAP'
  | 'CREATE_NOTE'
  | 'REFERRAL_CODE_GENERATED'
  | 'REFERRAL_USED'
  | 'REFERRAL_DISCOUNT_APPLIED'
  | 'CREATE_CLEAN_PRODUCT'
  | 'UPDATE_CLEAN_PRODUCT'
  | 'DELETE_CLEAN_PRODUCT'
  | 'BULK_UPDATE_CLEAN_PRODUCTS'
  | 'MERGE_CLEAN_PRODUCTS'
  | 'CREATE_PROTOCOL'
  | 'UPDATE_PROTOCOL'
  | 'TOGGLE_PROTOCOL'
  | 'ASSIGN_PROTOCOL'
  | 'UNASSIGN_PROTOCOL'
  | 'PROTOCOL_AUTO_MATCHED'
  | 'PROTOCOL_CONFLICT_DETECTED'
  | 'CREATE_PROTOCOL_TRIGGER'
  | 'UPDATE_PROTOCOL_TRIGGER'
  | 'TOGGLE_PROTOCOL_TRIGGER'
  | 'DELETE_PROTOCOL_TRIGGER'
  | 'CREATE_PROTOCOL_CONFLICT'
  | 'UPDATE_PROTOCOL_CONFLICT'
  | 'TOGGLE_PROTOCOL_CONFLICT'
  | 'DELETE_PROTOCOL_CONFLICT'
  | 'REGENERATE_PARTIAL'
  | 'STRIPE_REFUND'
  | 'DELETE_OWN_ACCOUNT'
  | 'ADMIN_FORCE_PASSWORD_RESET'
  | 'BULK_USER_ACTION'
  | 'REVOKE_USER_SESSIONS'
  | 'PATIENT_DAY_REGEN_REQUESTED'
  | 'PATIENT_DAY_REGEN_UNDONE'
  | 'DATA_EXPORT_REQUESTED'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'VIEW_DIET_TOOLKIT'
  | 'INVITE_PATIENT'
  | 'BULK_RECOMPUTE_NUTRITION'
  | 'SEND_MESSAGE'
  | 'REPAIR_SLOT'
  | 'PLAN_BLOCKED'
  | 'CLINICAL_SAFETY_WARNING'
  | 'HARD_DELETE_EXPIRED_USER'
  | 'AUDIT_LOG_PURGED'
  | 'EMAIL_CAMPAIGN_CREATED'
  | 'EMAIL_CAMPAIGN_SENT'
  | 'EMAIL_CAMPAIGN_DELETED';

export type AuditResourceType =
  | 'INTERVIEW'
  | 'DIET_PLAN'
  | 'USER'
  | 'TENANT'
  | 'CLIENT'
  | 'SUBSCRIPTION'
  | 'POST'
  | 'FOOD_ITEM'
  | 'FOOD_PRODUCT'
  | 'RECIPE'
  | 'MEAL'
  | 'TEMPLATE_PLAN'
  | 'ORDER'
  | 'CHECKIN'
  | 'FEATURE_FLAG'
  | 'TESTIMONIAL'
  | 'DIET_TEMPLATE'
  | 'MEAL_SWAP'
  | 'REFERRAL'
  | 'CLEAN_PRODUCT'
  | 'NUTRITION_PROTOCOL'
  | 'PROTOCOL_TRIGGER'
  | 'PROTOCOL_CONFLICT'
  | 'CONSENT'
  | 'DATA_EXPORT'
  | 'LEAD'
  | 'MESSAGE'
  | 'EMAIL_CAMPAIGN'
  | 'COMPANY'
  | 'TIME_ENTRY'
  | 'SERVICE_PERIOD'
  | 'AUDIT_LOG';

interface LogAuditParams {
  userId?: string;
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit logger. Never throws — a logging failure must not
 * abort the originating request.
 */
export function logAudit(params: LogAuditParams): void {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    ip: params.ip,
    metadata: params.metadata as Prisma.InputJsonValue | undefined,
  };
  prisma.auditLog
    .create({ data })
    .catch((err) => console.error('[audit] Failed to write audit log:', err));
}

/**
 * Get audit logs for a specific resource, ordered newest-first.
 */
export async function getAuditLogsForResource(
  resourceType: AuditResourceType,
  resourceId: string,
  limit: number = 50
) {
  return prisma.auditLog.findMany({
    where: { resourceType, resourceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      createdAt: true,
      ip: true,
      metadata: true,
      user: {
        select: { id: true, email: true, role: true },
      },
    },
  });
}
