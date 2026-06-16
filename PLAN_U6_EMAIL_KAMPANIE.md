# PLAN_U6_EMAIL_KAMPANIE.md — admin email campaigns module

> **Task:** U-6 (TODO.md §15). Replace the `/admin/email-kampanie` stub with a
> working campaign module. Required by §7 anti-patterns (schema change + external
> API). Authored 2026-06-16. Decision basis: D-073 (build with mock/draft mode).

## §0. Scope (MVP)

A two-person team needs to send occasional bulk emails: newsletter, satysfakcja,
renewal reminders, onboarding. MVP = compose a message, pick an audience, send.
**No** drag-and-drop builder, A/B testing, scheduling, or open/click tracking —
those are post-MVP. Resend Broadcasts API is **not** used; we fan out via the
existing `email.ts` transport (mock-safe: no-ops when no provider configured).

In scope:
- Create / edit / delete **draft** campaigns
- Pick audience segment + preview recipient count
- Send now → fan out via existing transport, record sent/failed counts
- List campaigns with status

Out of scope (documented, not built): scheduling, templates library, tracking
pixels, per-recipient personalization beyond name, unsubscribe management
(clients already manage email consent via NotificationPreferences — honored in
audience resolution), throttling/queue (fine at <30 recipients; Resend free tier
is 100/day — flagged for revisit at scale, CLAUDE.md §9.6).

## §1. Database (Migration 13 — `add_email_campaign`)

```prisma
enum EmailCampaignStatus { DRAFT  SENDING  SENT  FAILED }
enum EmailCampaignAudience { ALL_CLIENTS  LEADS  TEST }

model EmailCampaign {
  id             String                @id @default(cuid())
  subject        String
  body           String                @db.Text   // plain text; wrapped in emailLayout on send
  audience       EmailCampaignAudience
  status         EmailCampaignStatus   @default(DRAFT)
  recipientCount Int                   @default(0)
  sentCount      Int                   @default(0)
  failedCount    Int                   @default(0)
  createdById    String?
  sentAt         DateTime?
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  @@index([status])
  @@index([createdAt])
}
```

Migration is named + its own commit `chore(db): migration add_email_campaign` (RULES.md D-D).

## §2. Audience resolution (service)

- **ALL_CLIENTS** — `role=CLIENT`, `deletedAt=null`, `emailVerified != null`, and
  email notifications not opted out (NotificationPreferences). The newsletter/
  renewal/onboarding segment.
- **LEADS** — `Lead` rows with `status != REJECTED` and `rodoConsent = true`,
  de-duplicated by email. The prospect-nurture segment.
- **TEST** — only the sending admin's own email. Safe dry-run.

## §3. Backend

- `services/emailCampaign.service.ts` — list / get / create / update / delete /
  `getAudienceCounts` / `sendCampaign`. Send marks SENDING → fans out
  sequentially → SENT (or FAILED if every send threw), updating counts.
- `utils/email.ts` — add exported `sendCampaignEmail(to, subject, body)` (wraps
  `emailLayout`) + `isEmailTransportConfigured()`. Reuses the existing mock-safe
  `send()`: with no RESEND/SMTP env, sends are no-ops (counted as sent) so the UI
  works end-to-end in dev without blasting real inboxes.
- `controllers/emailCampaign.controller.ts` — zod-validated, `logAudit` on
  create/send/delete.
- Routes in `admin.routes.ts` under `/admin/email-campaigns` (already behind
  `requireAuth('ADMIN')`).

## §4. Frontend

- `types/api.ts` — EmailCampaign, EmailCampaignStatus, EmailCampaignAudience,
  AudienceCounts.
- `lib/api.ts` — `admin.emailCampaigns.*`.
- `app/[locale]/admin/email-kampanie/page.tsx` — server wrapper passes backend
  token to a client `EmailCampaignsManager`: list + composer (subject, body,
  audience with live recipient count) + send (confirm dialog showing count) +
  delete. i18n under `admin.emailCampaigns.*`.

## §5. Safety

- Send is mock-safe by default (no provider → no real email). Confirmation in UI
  shows the resolved recipient count before sending.
- A SENT/SENDING campaign is immutable (no edit/delete/resend) to avoid double
  sends.
- Real sends only happen in prod where `RESEND_API_KEY`/`SMTP_*` is set.

## §6. Verification

`npm run type-check -w apps/web` + `tsc` backend (`npm run build -w apps/backend`)
+ `npm run build -w apps/web` all exit 0. Migration applied to dev DB via
`migrate dev`.
