# PLAN_BE-4.md — Admin UI + email templates (no Fakturownia, no VPS deploy)

> **Phase:** Faza 4, backend track, BE-3 ✅ → BE-4 → BE-5
> **Scope reduction (2026-05-14):**
> - Fakturownia integration deferred (Wirgiliusz evaluating wfirma)
> - VPS deploy + CI/CD deferred to BE-5 (no terminal access right now)
> **Estimated effort:** ~6–8h CC + 2 GATE-y
> **Commits planned:** 5–7

---

## §1. Cel

1. Admin (Wirgiliusz + Remigiusz) widzi leady z `/audyt` i `/kontakt` w panelu, może zmienić status, dodać notatkę, eksportować
2. Wszystkie maile mają branding bambooIT (nie e-dietetyk) i są spójne wizualnie
3. Klient po pomyślnej płatności dostaje welcome email; przy nieudanej płatności — email z linkiem do Stripe Customer Portal

**Out of scope BE-4:**
- ❌ Fakturownia API (decyzja providera open)
- ❌ Resend migration (zostajemy na nodemailer/SMTP — Resend = osobny task po BE-5 jeśli okaże się że SMTP jest pain)
- ❌ VPS deploy / Nginx / PM2 / DEPLOY.md updates
- ❌ Admin UI dla Subscriptions beyond what already exists w `/admin/subskrypcje` (zostawiamy jak jest, no new features)
- ❌ Admin UI dla Orders beyond existing (Stripe Customer Portal handles refunds via `/admin/stripe/*`)

---

## §2. Stan obecny

✅ **Admin backend (rozbudowane z e-dietetyk cleanup):**
- `/admin/users/*` — full CRUD + role/lockout/sessions
- `/admin/audit-logs/*` — list + stats + CSV export
- `/admin/blog/*` — full
- `/admin/stripe/*` — refund + coupons + transactions
- `/admin/subscriptions` — list + stats
- `/admin/accounting/*` — revenue + churn + invoices-export (legacy, zostawiamy)
- `/admin/feature-flags`
- `/admin/security/*`
- AdminSidebar.tsx, AdminLayout, wszystkie components

❌ **Brakuje:**
- Backend: `/admin/leads/*` endpoints (list + filter + update + add note + CSV export)
- Frontend: `/admin/leady` page (lub `/admin/leads`) + LeadsTable + LeadDetailDrawer + LeadNotesPanel

✅ **Email infrastructure:**
- `utils/email.ts` — nodemailer transporter + 5 templates (password reset, order confirmation, email verification, subscription cancel, account deletion) — **wszystkie z brandingiem e-dietetyk.com**
- `utils/leadNotifications.ts` — bambooIT-branded (BE-1) ✅

❌ **Brakuje:**
- Rebrand 5 legacy email templates → bambooIT
- Email po pomyślnej płatności (subscription welcome z linkami do panelu + pomocy zdalnej)
- Email po nieudanej płatności (z CTA do Customer Portal)

---

## §3. Schema additions

**Brak.** Lead model (BE-1) ma już `notes Json?` field — admin notes można trzymać tam jako array.

Format:
```json
[
  { "id": "cuid", "text": "Zadzwoniłem, umawiamy demo 2026-05-20", "authorId": "user-cuid", "authorName": "Remigiusz", "createdAt": "2026-05-14T10:00:00Z" }
]
```

---

## §4. Backend changes

### 4.1 `/admin/leads/*` endpoints

```
GET    /admin/leads                — list with filters (status, type, source, search by email/company, dateFrom, dateTo, pagination)
GET    /admin/leads/stats          — counts per status + per type + last 7d trend
GET    /admin/leads/:id            — single lead with notes
PATCH  /admin/leads/:id/status     — update status (NEW → CONTACTED → QUALIFIED → CONVERTED|REJECTED)
POST   /admin/leads/:id/notes      — append note { text }
DELETE /admin/leads/:id/notes/:noteId — delete a note (by author or any admin)
GET    /admin/leads/export.csv     — CSV export with current filters
```

**New files:**
- `controllers/leads-admin.controller.ts` (~150 LOC)
- `services/leads-admin.service.ts` (~200 LOC — list+filter+update+notes+CSV)
- `__tests__/services/leads-admin.service.test.ts` (~120 LOC)

**Modify:**
- `routes/admin.routes.ts` — register 7 new routes
- `services/audit.service.ts` — add `LEAD_STATUS_UPDATED`, `LEAD_NOTE_ADDED`, `LEAD_NOTE_DELETED`, `LEAD_EXPORTED` to AuditAction

### 4.2 Email templates rebrand

Refactor `utils/email.ts`:
1. Extract shared layout (header logo, footer, styling) into `emailLayout(content)` helper
2. Replace all "e-dietetyk.com" mentions with "bambooit.pl"
3. Replace sage-green CSS color (#16a34a) with bambooIT bamboo (#A0B838 or whatever brand.bambooDeep is)
4. Replace contact email "kontakt@e-dietetyk.com" → "hello@bambooit.pl"
5. Subject lines: "— e-dietetyk.com" → "— bambooIT"

5 templates to rebrand:
- `sendPasswordResetEmail` ✓
- `sendOrderConfirmationEmail` ✓ (or refactor to be subscription-aware — see 4.3)
- `sendEmailVerificationEmail` ✓
- `sendSubscriptionCancelEmail` ✓
- `sendAccountDeletionEmail` ✓

### 4.3 New email flows

```ts
// utils/email.ts (new exports)
export async function sendSubscriptionWelcomeEmail(to: string, args: {
  productLabel: string;    // "Pakiet Firma"
  amountPerMonth: number;  // 690
  panelUrl: string;        // ${APP_URL}/${locale}/panel/subskrypcja
  remoteHelpUrl: string;   // ${APP_URL}/${locale}/pomoc-zdalna
}): Promise<void>

export async function sendPaymentFailedEmail(to: string, args: {
  productLabel: string;
  portalUrl: string;       // Stripe Customer Portal URL (admin generates per webhook)
  retryAt: string;         // "2026-05-21" (Stripe retries automatically in 3 days)
}): Promise<void>
```

Webhook controller wiring:
- `case 'invoice.paid'` — first paid invoice → `sendSubscriptionWelcomeEmail` (detect "first" via `Subscription.createdAt` close to now OR via `lines.data.length === 1`). Subsequent invoices → no welcome (admin can use customer portal email).
- `case 'invoice.payment_failed'` — call `sendPaymentFailedEmail`; reuse Customer Portal redirect from `subscription.service.getPortal`.

### 4.4 Audit log additions

`services/audit.service.ts` AuditAction enum:
```diff
+ | 'LEAD_STATUS_UPDATED'
+ | 'LEAD_NOTE_ADDED'
+ | 'LEAD_NOTE_DELETED'
+ | 'LEAD_EXPORTED'
```

---

## §5. Frontend changes

### 5.1 `/admin/leady` page

```
apps/web/src/app/[locale]/admin/leady/
├── page.tsx                            (NEW, server component, fetches list + stats)
└── [id]/page.tsx                       (NEW, server component, fetches single lead)

apps/web/src/components/admin/leads/
├── LeadsTable.tsx                      (NEW, client, filters + pagination)
├── LeadsStatsCards.tsx                 (NEW, server, summary cards)
├── LeadDetail.tsx                      (NEW, client, status select + notes panel)
├── LeadNotesPanel.tsx                  (NEW, client, append + delete notes)
└── LeadStatusBadge.tsx                 (NEW, server, color-coded badge)
```

**Modify:**
- `AdminSidebar.tsx` — dodaj link "Leady" przed Subscriptions
- `lib/api.ts` — admin.leads.{list, getStats, getById, updateStatus, addNote, deleteNote, exportCsv}
- `types/api.ts` — `Lead`, `LeadNote`, `LeadsStats` types
- i18n: `admin.leads.*` keys (PL only)

**Polish slug decision:** `/admin/leady` (per CLAUDE.md §8 "Polskie route paths"). Alternative `/admin/leads` — bardziej tech, ale niespójne z `/admin/subskrypcje`, `/admin/uzytkownicy`. Wybór: **`/admin/leady`**.

### 5.2 No changes to existing admin pages

Subscriptions, blog, users, security, accounting, ksiegowosc — wszystko zostaje. BE-4 dodaje jedną nową kolumnę w sidebar.

---

## §6. Commits planned

1. **`feat(backend): admin leads endpoints (list + filter + status + notes + CSV)`**
   - leads-admin.controller.ts + leads-admin.service.ts
   - admin.routes.ts registration
   - audit.service.ts +4 actions
   - tests

2. **`feat(backend): rebrand legacy email templates to bambooIT`**
   - utils/email.ts — 5 templates rebranded
   - Extract `emailLayout()` helper for consistency
   - Replace e-dietetyk.com / kontakt@e-dietetyk.com / sage-green color

3. **`feat(backend): subscription welcome + payment failed emails + webhook wiring`**
   - utils/email.ts +2 functions
   - webhook.controller.ts wire into invoice.paid (first invoice only) + invoice.payment_failed
   - tests if practical (mocked nodemailer)

4. **`feat(web): /admin/leady — list page with filters + stats cards`**
   - app/[locale]/admin/leady/page.tsx
   - components/admin/leads/{LeadsTable, LeadsStatsCards, LeadStatusBadge}.tsx
   - lib/api.ts admin.leads.list + getStats
   - i18n admin.leads.*
   - AdminSidebar entry

5. **`feat(web): /admin/leady/[id] — detail with status update + notes panel`**
   - app/[locale]/admin/leady/[id]/page.tsx
   - components/admin/leads/{LeadDetail, LeadNotesPanel}.tsx
   - api.ts admin.leads.{getById, updateStatus, addNote, deleteNote, exportCsv}

6. **`docs(todo): mark BE-4 complete`**

(Possible merge of #4 + #5 into one commit jeśli scope < 500 LOC; decision in trakcie.)

---

## §7. Sanity gates

Po każdym commits — `npm run build --workspace=backend` + `npm test --workspace=backend` (i tam gdzie są nowe testy), `npm run type-check --workspace=web`. Po final — `npm run build --workspace=web`.

---

## §8. Open questions (default rekomendacje)

1. **Polish slug "/admin/leady" vs "/admin/leads"** — rec. **leady** (spójne z innymi PL slug w admin)
2. **CSV export columns** — rec. wszystkie + notes count (NIE notes content — CSV not designed for nested JSON; jeśli trzeba notes → admin używa detail view)
3. **Email "first invoice" detection** — rec. check `lines.data[0].period.start` vs `Subscription.createdAt` (within 1h = first); jeśli edge case → admin może wysłać ręcznie z panelu
4. **Notes delete authorization** — rec. **author lub admin** (any admin może deletować dowolną notatkę — bambooIT to 2-osobowy zespół, oba ADMINY, kontrola via audit log)
5. **Email layout extraction** — rec. **tak** (`emailLayout(opts)` helper) — uniknie copy-paste, łatwiej skin
6. **Status update audit** — rec. **tak** (LEAD_STATUS_UPDATED audit entry z metadata.from/to/leadId) — kompliacyjnie sensowne, łatwo dodać

**Czekam na approval albo "go z rekomendacjami".**
