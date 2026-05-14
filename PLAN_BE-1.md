# PLAN_BE-1.md — Lead model + leads endpoints + form submissions

> **Phase:** Faza 4, backend track, first stop after FE GATE ✅ (2026-05-14)
> **Workflow:** per D-049 "duże" task → PLAN → Twoje gates → atomic commits
> **Estimated effort:** ~6–8h CC pracy + 2 gates Twoich
> **Commits planned:** 4–5 (migration / backend / web / wiring / tests)

---

## §1. Cel

Wpiąć dwa stub-formularze (`AuditFormSection`, `ContactFormSection`) do bazy + powiadomień email. Po BE-1 lead trafia do `Lead` table + admin (hello@bambooit.pl) i klient dostają potwierdzenie.

Nie zajmujemy się Stripe / Customer Portal / Fakturownia / admin UI — to BE-2..BE-5.

---

## §2. Schema — Migration 11 `add_lead_model`

Bazuje 1:1 na TODO.md §6 Migration 11, z drobnymi rozszerzeniami które wynikły z faktycznych pól formularzy:

```prisma
enum LeadType {
  AUDIT
  CONTACT
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  CONVERTED
  REJECTED
}

model Lead {
  id              String     @id @default(cuid())
  type            LeadType
  firstName       String                                  // mapping: audit "name" (split lub trzymamy całe imię+nazwisko w firstName); contact "name"
  lastName        String?
  company         String?                                 // audit only (contact form nie ma firmy)
  nip             String?                                 // not in current form, but reserved (admin może uzupełnić)
  email           String
  phone           String?                                 // audit optional, contact optional
  industry        String?                                 // audit only — enum string: 'accounting'|'law'|'medical'|'production'|'hospitality'|'other'
  employeesCount  Int?                                    // audit "size" — parsujemy do liczby z range string ("1-3" → 3, "30+" → 30, etc.)
  sizeRange       String?                                 // audit "size" raw value ("1-3" | "4-10" | "11-30" | "30+") — zachowujemy oryginał dla admin display
  description     String     @db.Text                      // audit "message" / contact "message"
  status          LeadStatus @default(NEW)
  rodoConsent     Boolean    @default(false)              // checkbox "rodo" — wymagany na froncie, walidujemy też tutaj
  rodoConsentAt   DateTime?                                // timestamp consent (audytowo)
  source          String?                                  // 'audit-form' | 'contact-form' | przyszłość: 'chat-widget' | 'phone'
  ipAddress       String?                                  // dla audit + anti-abuse (zaszyfrowane via util? — decyzja niżej)
  userAgent       String?                                  // dla audit
  notes           Json?                                    // admin notes (array; BE-4 admin UI doda)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([status])
  @@index([createdAt])
  @@index([email])
  @@index([type, status])
}
```

**Rozszerzenia vs TODO.md §6 (uzasadnienie):**

1. **`sizeRange` (String, optional)** — formularz audit ma `<select>` z opcjami "1-3", "4-10", "11-30", "30+". `employeesCount` (Int) zachowujemy dla query/sort, ale raw range pokażemy w admin UI (różnica między "30" a "30+" ma sens biznesowy).
2. **`rodoConsent` + `rodoConsentAt`** — checkbox jest required, ale chcemy audit trail. Bez tego nie ma legal podstawy do trzymania PII.
3. **`source`** — przyszłość-proofing: chat widget (faza 5) doda 'chat-widget' bez zmiany schema.
4. **`ipAddress` + `userAgent`** — anti-abuse + GDPR-legitimate-interest. Trzymamy plain text (nie szyfrujemy — to nie kategoria szczególna PII per RODO). Retention policy: 90 dni od `createdAt` jeśli `status='REJECTED'`, inaczej do anulowania subskrypcji.
5. **`@@index([type, status])`** — admin filter pattern ("pokaż mi nowe leady z audit-form").

**RODO checklist (per CLAUDE.md §4.F):**

- ✅ Email + phone w plain text — zgodne z e-dietetyk pattern (User.email też plain); szyfrowanie tylko dla "sensitive PII" (zdrowotne, finansowe). Lead = standard contact info.
- ✅ DSAR — będzie wymagać aktualizacji `dsar.controller.ts`: dodać lookup po email również w `Lead` table (osobny commit w BE-4 admin, NIE w BE-1 — bo bez admin UI nikt nie używa DSAR jeszcze).
  - **DECYZJA do approval:** czy DSAR update wchodzi do BE-1 (compliance from day one) czy odroczone do BE-4? Rekomendacja: **BE-1**. Dwa pliki, ~30 min, nie warto odraczać.
- ✅ Retention — cleanup job dodamy w BE-4 (jobs/leadCleanup.job.ts). W BE-1 zostawiamy TODO marker.
- ✅ Audit log — każdy POST /leads/* loguje do AuditLog (action: 'lead.created').
- ✅ Cookie consent — formularz NIE jest funkcjonalnym cookie, to user-initiated submit; RODO checkbox załatwia podstawę prawną.

---

## §3. Backend — nowe pliki

```
apps/backend/src/
├── controllers/
│   └── leads.controller.ts          (NEW, ~80 LOC)
├── routes/
│   └── leads.routes.ts              (NEW, ~25 LOC)
├── services/
│   └── leads.service.ts             (NEW, ~120 LOC)
├── utils/
│   └── leadNotifications.ts         (NEW, ~80 LOC — email templates)
└── __tests__/services/
    └── leads.service.test.ts        (NEW, ~100 LOC)
```

**Zmiany w istniejących plikach:**

```
apps/backend/src/
├── server.ts                        (+1 import, +1 app.use line — register leads router)
├── middleware/rateLimiters.ts       (+1 leadLimiter export — 5 req/15min per IP)
└── controllers/dsar.controller.ts   (+1 query po Lead w exportUserData + deleteUserData)
```

### §3.1 Endpoints

| Method | Path | Auth | Rate limit | Body |
|--------|------|------|------------|------|
| POST | `/leads/audit` | none (public) | `leadLimiter` 5/15min | Zod-validated audit form payload |
| POST | `/leads/contact` | none (public) | `leadLimiter` 5/15min | Zod-validated contact form payload |

**Mount w server.ts:**
```ts
app.use('/leads', leadLimiter, leadsRouter);
```

(NIE pod `/auth` ani `/admin` — to public endpoint.)

### §3.2 Walidacja (Zod)

```ts
// Audit form schema
const auditLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(1).max(150),
  email: z.string().email().toLowerCase().max(150),
  phone: z.string().trim().max(30).optional(),
  size: z.enum(['1-3', '4-10', '11-30', '30+']),
  industry: z.enum(['accounting', 'law', 'medical', 'production', 'hospitality', 'other']),
  message: z.string().trim().max(2000).optional(),
  rodo: z.literal(true),                         // checkbox required
  // Honeypot — pole "website" musi być puste; bot je wypełni, my odrzucamy.
  website: z.string().max(0).optional(),
});

// Contact form schema
const contactLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().toLowerCase().max(150),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10).max(2000),
  rodo: z.literal(true),
  website: z.string().max(0).optional(),         // honeypot
});
```

**Anti-spam (MVP — bez reCAPTCHA):**

1. Honeypot field — `<input name="website" tabindex="-1" autocomplete="off" class="absolute -left-[9999px]">` (CSS-hidden, screen reader skip). Boty wypełnią, my rzucamy 200 z fake success (NIE 400 — boty się uczą).
2. Rate limit per IP (5 / 15min) — `leadLimiter`.
3. (Faza 5) Cloudflare Turnstile / hCaptcha — TODO marker.

### §3.3 Service `leads.service.ts`

```ts
export async function createLead(input: {
  type: LeadType;
  data: AuditLeadInput | ContactLeadInput;
  meta: { ipAddress?: string; userAgent?: string };
}): Promise<Lead> {
  // 1. Normalize fields (parse size range → employeesCount + sizeRange, split name → first/last lub całe do firstName)
  // 2. prisma.lead.create({ data: { ... rodoConsent: true, rodoConsentAt: new Date() } })
  // 3. await sendLeadNotifications(lead) — non-blocking error: log + Sentry, ale endpoint zwraca 200 jeśli DB sukces
  // 4. await auditLog({ action: 'lead.created', metadata: { leadId, type, source } })
  // 5. return lead
}
```

**Decyzja: email failure handling.**

- DB write success + email send failure → endpoint zwraca **200 OK** + Sentry warning. Lead jest zapisany, admin pyta klienta ręcznie. Inny wybór (zwrot 500) zostawi klienta z "coś poszło nie tak" mimo że lead jest w bazie.
- DB write failure → 500 + Sentry error. Klient widzi "Spróbuj ponownie".

### §3.4 Email templates (`leadNotifications.ts`)

Reuse istniejący `utils/email.ts` (nodemailer + SMTP per CLAUDE.md gotcha 9.7 i .env.example komentarz: Resend migration to BE-4). Jeśli SMTP_HOST nie skonfigurowane → log + Sentry breadcrumb, nie wywal.

**2 maile per lead:**

1. **Admin → hello@bambooit.pl** (lub `process.env.NOTIFICATIONS_TO_EMAIL` jeśli zdefiniowane)
   - Subject: `[bambooIT] Nowy lead AUDIT — Firma X` lub `[bambooIT] Nowa wiadomość kontaktowa — Imię`
   - Body: wszystkie pola lead-a + link do admin panel (`${FRONTEND_URL}/admin/leads/${leadId}` — endpoint admin LEADS jeszcze nie istnieje, link będzie 404 do BE-4, ale link w mailu nie boli).
2. **Klient → email lead-a**
   - Subject: `Dziękujemy za zgłoszenie — bambooIT` lub `Otrzymaliśmy Twoją wiadomość`
   - Body: polskie potwierdzenie + co dalej (24h response) + sygnatura R+W.

Wszystkie templates w PL, hardcoded (i18n na backendzie nie ma sensu — backend zna locale tylko z user-context, którego nie ma dla public lead).

### §3.5 Rate limiter

```ts
// middleware/rateLimiters.ts
export const leadLimiter = rateLimit({
  windowMs: 15 * 60_000,   // 15 minut
  max: 5,                   // 5 zgłoszeń per IP per okno
  message: { error: 'TOO_MANY_REQUESTS', message: 'Zbyt wiele zgłoszeń. Spróbuj ponownie za chwilę.' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

Próg 5/15min wybrany konserwatywnie — legitimate user zgłosi raz, bot/skrypt złapie po 5.

---

## §4. Frontend — wiring formularzy

### §4.1 `AuditFormSection.tsx` zmiany

Diff w skrócie:

```diff
- const [submitted, setSubmitted] = useState(false);
+ const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
+ const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
-   setSubmitted(true);
+   setState('submitting');
+   const formData = new FormData(event.currentTarget);
+   try {
+     const res = await fetch('/api/proxy/leads/audit', {
+       method: 'POST',
+       headers: { 'content-type': 'application/json' },
+       body: JSON.stringify({
+         name: formData.get('name'),
+         company: formData.get('company'),
+         email: formData.get('email'),
+         phone: formData.get('phone') || undefined,
+         size: formData.get('size'),
+         industry: formData.get('industry'),
+         message: formData.get('message') || undefined,
+         rodo: formData.get('rodo') === 'on',
+         website: formData.get('website') || '', // honeypot
+       }),
+     });
+     if (!res.ok) throw new Error(await getErrorMessage(res));
+     setState('success');
+   } catch (err) {
+     setState('error');
+     setErrorMessage(err instanceof Error ? err.message : t('errors.generic'));
+   }
  }
```

**+ honeypot field** (CSS-hidden) w formularzu.
**+ select dla industry/size** używa `value=` matched do zod enum (nie tylko `t(...)` string).
**+ error UI** — czerwony pasek pod buttonem `{errorMessage}`.
**+ disabled button + spinner** w `submitting`.

### §4.2 `ContactFormSection.tsx` zmiany

Analogiczne do audit, mniej pól. `fetch('/api/proxy/leads/contact')`.

### §4.3 i18n — nowe klucze

`messages/pl.json` — pod `home.auditForm` + `kontakt.form`:

```json
{
  "errors": {
    "generic": "Coś poszło nie tak. Spróbuj ponownie za chwilę.",
    "rateLimit": "Zbyt wiele zgłoszeń. Spróbuj ponownie za 15 minut.",
    "validation": "Sprawdź wypełnione pola i spróbuj ponownie."
  },
  "submitting": "Wysyłanie..."
}
```

(`en.json` per ADR-004 / D-023 EN-disabled — pomijamy, tylko stub key jeśli wymagany.)

### §4.4 Zmiana `industry` + `size` select values

Aktualnie select renderuje `t(...)` jako option text. Trzeba dodać `value` matched do backend enum:

```diff
- <option key={option}>{option}</option>
+ <option key={value} value={value}>{label}</option>
```

Trzymamy mapping array `[{ value: 'accounting', labelKey: 'fields.industryOptions.accounting' }, ...]`.

---

## §5. DSAR update (decyzja: BE-1 czy BE-4?)

**Rekomendacja: BE-1 (compliance from day 1).**

Plik `apps/backend/src/controllers/dsar.controller.ts` (lub `services/dsar.service.ts`):

```diff
  export async function exportUserData(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { ... } });
    if (!user) throw new AppError(404);
+   // Find leads by email (cross-system PII for same person)
+   const leads = await prisma.lead.findMany({ where: { email: user.email } });
    return {
      ...existing,
+     leads,
    };
  }

  export async function deleteUserData(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
+   await prisma.lead.deleteMany({ where: { email: user.email } });
    // ...existing deletion logic
  }
```

(Jeśli `dsar.service.ts` ma inną strukturę — refactor minimum invasive po przeczytaniu.)

---

## §6. Testy

**Scope MVP — integration tests, NIE pełne unit coverage.**

`apps/backend/src/__tests__/services/leads.service.test.ts`:

1. ✅ `createLead({ type: AUDIT, valid data })` → tworzy Lead row z poprawnymi polami
2. ✅ `createLead({ type: CONTACT, valid data })` → tworzy Lead z type=CONTACT
3. ✅ Audit: `size='30+'` → `employeesCount=30` + `sizeRange='30+'`
4. ✅ Audit: `size='4-10'` → `employeesCount=10` + `sizeRange='4-10'`
5. ✅ Email failure → DB write success + Sentry warning (mock email transport rzuca, lead jest stworzony)
6. ✅ Zod validation — `email='nieprawidłowy'` → throw ZodError

Jeśli istnieje już test infra (Jest config w backend) — używamy. Jeśli nie ma — minimum smoke test w pierwszym commicie + pełne testy w osobnym commicie.

**Frontend testy:** brak w BE-1 (Playwright E2E happy path zostawiamy do BE-5 final smoke test).

---

## §7. Commits planned (atomic per D-048)

1. **`feat(db): add Lead model + migration 11`**
   - `packages/database/prisma/schema.prisma` — model Lead + 2 enumy
   - `packages/database/prisma/migrations/202605xxxxxx_add_lead_model/migration.sql`
   - `npm run db:generate` artefakty (jeśli commitujemy generated client — sprawdzić git status pattern w repo)

2. **`feat(backend): add leads endpoints (/leads/audit + /leads/contact)`**
   - `routes/leads.routes.ts` (NEW)
   - `controllers/leads.controller.ts` (NEW)
   - `services/leads.service.ts` (NEW)
   - `utils/leadNotifications.ts` (NEW)
   - `middleware/rateLimiters.ts` (+leadLimiter)
   - `server.ts` (+app.use)
   - tests `leads.service.test.ts` (NEW)

3. **`feat(backend): include leads in DSAR export + delete`**
   - `controllers/dsar.controller.ts` (lub services/) — +lead query/delete

4. **`feat(web): wire AuditFormSection + ContactFormSection to backend`**
   - `components/marketing/AuditFormSection.tsx` — fetch + state machine + honeypot + error UI
   - `components/marketing/ContactFormSection.tsx` — analogicznie
   - `messages/pl.json` — +errors keys + submitting state

5. **`docs(todo): mark BE-1 done`**
   - `TODO.md` — `[x] BE-1` + commit refs

(Możliwe że #2 rozbije się na 2 commity — endpoints sam vs tests — decyzja w trakcie.)

---

## §8. Sanity gates per CLAUDE.md §4.B

Po każdym z commits 1–4:

```bash
npm run typecheck         # must pass
npm run build:all         # must pass (database → backend → web)
npm test -w apps/backend  # przy commitach #2 i #3
```

Commit #4 (frontend) — dodatkowo `npm run build:web` zielony.

---

## §9. Out of scope (idzie do BE-2..BE-5 albo backlog)

- ❌ Admin UI dla Leads (admin/leads/* page, AdminLeadsTable, lead detail view, note adding) → **BE-4**
- ❌ Stripe Checkout, products, webhooks → **BE-2**
- ❌ Customer Portal, NIP validator dla rejestracji firmy → **BE-3**
- ❌ Resend migration (zostajemy na nodemailer / SMTP_*) → **BE-4**
- ❌ Lead cleanup job (90-day retention dla REJECTED) → **BE-4**
- ❌ Frontend Playwright E2E (audit form happy path) → **BE-5**
- ❌ Cloudflare Turnstile / hCaptcha — faza 5
- ❌ Lead → konwersja na Company + User automatyczna (kiedy lead kupuje subskrypcję) — to dzieje się w BE-2 Stripe success flow, NIE w BE-1
- ❌ Webhook do CRM (HubSpot/Pipedrive) — nie planowane MVP

---

## §10. Open questions do approval przed implementacją

1. **DSAR update (BE-1 czy BE-4)?** — Rekomendacja: BE-1.
2. **NotificationsTo email** — `hello@bambooit.pl` hardcoded fallback czy `NOTIFICATIONS_TO_EMAIL` env var? Rekomendacja: env var, fallback `hello@bambooit.pl`.
3. **Lead `firstName` mapping** — formularz ma jedno pole "name" (imię + nazwisko razem). Trzymamy całe w `firstName`, czy splittujemy heurystycznie po pierwszej spacji? Rekomendacja: **całe w firstName**, nie splittujemy (split daje gorsze błędy na "Anna Maria Kowalska" niż "raw store"). `lastName` zostaje null aż admin nie wypełni ręcznie.
4. **Honeypot na fake-success czy 400?** — Rekomendacja: 200 fake-success (botom nie dajemy sygnału że honeypot zadziałał).
5. **Email transport jeśli SMTP nieskonfigurowane lokalnie** — log do console + Sentry breadcrumb, ale endpoint dalej zwraca 200 (lead jest w DB). Rekomendacja: tak, ale dodać w env.example wyraźny komentarz "wymagane do prod, OK puste w dev".

---

**Czekam na Twój approval albo modyfikacje przed startem implementacji.**
