# PLAN_BE-2.md — Stripe Checkout + webhooks + success/cancel pages

> **Phase:** Faza 4, backend track, BE-1 ✅ → BE-2 → BE-3 (Customer Portal + auth) → BE-4 (admin/email/Fakturownia/deploy) → BE-5 (CI/CD + smoke)
> **Workflow:** D-049 "duże" → PLAN → gates → atomic commits
> **Estimated effort:** ~8–12h CC pracy + 2-3 gates Twoich
> **Commits planned:** 5–7

---

## §1. Cel

Klient na pricing CTA klika "Wybierz Firma" → trafia na Stripe Checkout → płaci → wraca na `/zamowienie/sukces` → ma aktywną subskrypcję w bazie. Anulowanie via Customer Portal w panelu.

**Out of scope BE-2:** Fakturownia integration (BE-4), email templates dla subscription events (BE-4), admin UI dla subscriptions (BE-4), automatyczne tworzenie Company po Stripe success (już jest w `handleCheckoutCompleted` — Company musi istnieć PRZED checkoutem).

---

## §2. Co już mamy (z cleanup)

✅ **Backend infrastructure (~90% gotowe):**
- `services/stripe.service.ts` — Stripe SDK init, `createCheckoutSession`, `createPortalSession`, webhook event constructor, idempotency
- `services/checkout.service.ts` — `createSession` (Order + Stripe URL), `handleOrderCheckoutCompleted`
- `services/subscription.service.ts` — `getMySubscription`, `createCheckout`, `getPortal`, 5 webhook handlers (checkout/invoice/subscription updated/deleted/payment failed)
- `controllers/webhook.controller.ts` — full Stripe webhook handler ze switch po event.type, idempotency via `markEventProcessed`, audit log
- `controllers/checkout.controller.ts` + `subscription.controller.ts` + routes mounted
- Helpers: `extractInvoiceSubscriptionId` (API 2026-02-25 compat), `planFromPriceId` (env-var-driven)

✅ **Web pages (struktura gotowa):**
- `/zamowienie/sukces` + `/zamowienie/anulowano` — pages istnieją, components `CheckoutSuccess` + `CheckoutCanceled` w `components/checkout/`
- `/zamow` — placeholder ("formularz zamówienia tymczasowo niedostępny")
- `/rejestracja`, `/zaloguj`, `/resetuj-haslo`, `/zweryfikuj-email` — auth flow
- `/admin/subskrypcje`, `/admin/platnosci` — admin pages (struktura)

❌ **Co trzeba zbudować/zaktualizować w BE-2:**
1. **Migration 12** — Company business fields (`nip, industry, employeesCount, city, address, postalCode, phone`)
2. **Rejestracja extended** — RegisterForm.tsx ma tylko firstName/lastName/email/password; potrzeba NIP, nazwa firmy, industry, employees, telefon
3. **NIP validator** — utility `lib/validators/nip.ts` (10 cyfr + checksum mod 11)
4. **Pricing CTAs wiring** — `PricingTiersSection.tsx` cards i `ComparisonTable.tsx` "Kup" buttons → `/zamow?plan=START|FIRMA|FIRMA_PLUS`
5. **`/zamow` page rebuild** — auth check → plan selector (z ?plan= query) → POST `/api/proxy/checkout/create-session` → redirect na Stripe URL
6. **`CheckoutSuccess` + `CheckoutCanceled` review** — czy mają bambooIT branding (Neo-Swiss restyle + polskie copy + linki do panelu)
7. **Drop TRIAL flow** — bambooIT nie ma free trial per pricing decision D-007 (Stripe Customer Portal handles subscription changes, trial nie pasuje do B2B abonamentu IT)
8. **Customer Portal redirect** — endpoint istnieje (`GET /subscriptions/portal`); web musi mieć "Zarządzaj subskrypcją" button w panelu klienta (location TBD — `/panel/subskrypcja` czy `/admin`?)
9. **Subscription model — review fields** — sprawdzić czy istniejące pola (`stripePriceId`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`) działają z naszym Schema; potencjalnie dodać `serviceHoursUsed`/`serviceHoursIncluded` później (BE-4 admin) — NIE w BE-2

---

## §3. Open questions do approval

### Q1: Pricing CTA strategy — `/audyt` only, `/zamow` only, czy oba?

**Aktualnie:** wszystkie pricing CTAs (Pricing cards na homepage, ComparisonTable na /pakiety, "Wybierz Start/Firma/Firma Plus") → `/audyt`.

**Per D-046 / mockup:** audit-first sales motion ("Po drugiej stronie siedzi konkretny człowiek").

**3 opcje:**
- **A. Tylko /audyt** — bez direct checkout. Każdy klient przechodzi przez R+W. Trzymamy ludzki touch, ale traci self-service. Stripe Checkout tylko via admin/panel po pierwszej rozmowie (admin "send invoice" pattern w BE-4).
- **B. Tylko /zamow** — direct checkout. CTAs → `/zamow?plan=X`. Audyt staje się alternative path (osobny CTA "Nie wiesz który pakiet? Zacznij od audytu").
- **C. Dual CTA per karta** — każda karta ma DWA buttony: "Wybierz [PAKIET]" (→ /zamow) i "Pomocy wybrać → Audyt" (link tekstowy).

**Rekomendacja: B z drobnym tweakiem** — primary CTA na pricing card = "Wybierz", secondary text-link = "Pomocy wybrać? Bezpłatny audyt →". Powód:
- D-045 mówi explicit "Stripe Checkout automatic w MVP, klient kupuje sam"
- D-046 (chat widget) to inny mechanism; pricing UI ma być self-service
- Audit-first jest fallback dla niepewnych, nie obowiązkowy

**Decyzja Twoja przed implementacją.**

### Q2: Auth wymagana przed checkoutem czy guest checkout?

**Aktualnie:** `checkout.controller.createSession` jest pod `requireAuth()`. Stripe `customer_email` przekazujemy, ale wymaga zalogowania.

**Opcje:**
- **A. Auth required** (obecne) — `/zamow?plan=X` → jeśli nie zalogowany → redirect na `/rejestracja?return=/zamow?plan=X`. Po rejestracji → checkout.
- **B. Guest checkout** — można kupić bez konta. Konto tworzymy z Stripe session metadata po webhook. Klient dostaje email "ustaw hasło".

**Rekomendacja: A (auth required)**. Powody:
- B2B subskrypcja IT to nie e-commerce 5-minutowy zakup; klient i tak musi wpisać NIP, nazwę firmy, branżę
- Konto = panel klienta = Customer Portal access = jeden flow zamiast dwóch
- Mniej edge cases (co jeśli email zajęty, jak weryfikujemy email, jak resetujemy hasło)
- D-045 nie precyzuje, ale "automatic" sugeruje **prostszy** flow, nie krótszy

### Q3: NIP validator — gdzie?

**Opcje:**
- **A. Frontend only** — `lib/validators/nip.ts` w web; backend ufa frontu (Zod min(10).max(10))
- **B. Backend only** — backend reject jeśli zły NIP, frontend brak walidacji (gorsza UX)
- **C. Both (rekomendacja)** — wspólny utility, w obu apps (skopiowany lub w packages/, krótka logika ~20 LOC nie warta pakietu)

**Rekomendacja: C, ale skopiowany** (NIE pakiet) — `apps/web/src/lib/validators/nip.ts` + `apps/backend/src/utils/nip.ts`, identyczna implementacja, mod 11 checksum. Tworzenie pakietu dla 20 LOC nie ma sensu.

### Q4: Migration 12 (Company business fields) — w BE-2 czy później?

**Opcje:**
- **A. BE-2** — full Company schema w jednej migracji teraz; rejestracja od razu kompletna
- **B. Split** — BE-2 dodaje minimum (`nip`, `industry`); BE-3/BE-4 reszta (`city`, `address`, `postalCode`, `website`)

**Rekomendacja: A (full migration 12 w BE-2)**. Powody:
- Fakturownia w BE-4 i tak będzie potrzebować `city/address/postalCode` — taniej raz teraz niż osobna migracja później
- Plan to plan — pola są w schema.prisma per TODO.md §6
- Frontend rejestracji może validować NIP + opcjonalnie zbierać adres (placeholder dla Fakturownia)

### Q5: TRIAL flow — drop czy keep?

`checkout.service.ts` ma virtual `TRIAL` type → maps na START z `trialPeriodDays: 7`. Frontend nie ma jeszcze "wypróbuj za darmo" CTA.

**Opcje:**
- **A. Drop** — usuwamy TRIAL z `CheckoutProductType`, z `checkout.service.ts`, z controller Zod enum, z `trialFingerprint.service.ts` (anti-abuse)
- **B. Keep dormant** — kod zostaje, ale frontend nie ma trigger; jeśli kiedyś chcemy promotion → re-enable
- **C. Active** — dodajemy "Bezpłatny tydzień" CTA gdzieś (np. na /pakiety FAQ)

**Rekomendacja: B (keep dormant)**. Drop oznacza ~300 LOC do usunięcia (services + anti-abuse + fingerprinting + tests). Zostawiamy zakopany; jeśli faza 5 doda promo → uruchamiamy. Marker `[VERIFY]` w CLAUDE.md że nieaktywne.

### Q6: Customer Portal — gdzie button w UI?

Backend ma `GET /subscriptions/portal` — wraca URL. Frontend musi dodać przycisk.

**Opcje:**
- **A. `/panel/subskrypcja`** — dedicated client panel page (nowa)
- **B. W `/admin/subskrypcje`** — tylko admin widzi (mało sensu — klient też ma prawo do self-service)
- **C. Na success page** — "Zarządzaj subskrypcją" po pierwszym checkout

**Rekomendacja: A + C (oba)**. Klient ma panel `/panel/subskrypcja` (auth required), success page też ma button (bo świeży klient od razu chce zobaczyć panel). `/panel` jako struktura dla przyszłych client-side features (tickets, faktury, RODO export).

### Q7: Subscription `serviceHoursIncluded`/`serviceHoursUsed` — w BE-2 czy BE-4?

Plan TODO.md nie wymaga tego pola w BE-2. ServicePackage model TODO.md §6 wspomina `hoursIncluded`, ale to inne (definicja pakietu, nie usage tracker).

**Decyzja: pomijam w BE-2.** Admin UI w BE-4 doda kolumnę `hoursUsed` jeśli będzie potrzebne dla operacyjnego trackingu.

---

## §4. Schema additions (Migration 12)

```prisma
model Company {
  // existing: id, userId, createdAt, updatedAt, contactFirstName, contactLastName

  nip             String?  @unique          // 10-digit Polish tax ID
  companyName     String?                    // legal name (różny od user.firstName/lastName)
  industry        String?                    // same enum string jak Lead.industry
  employeesCount  Int?                       // current count (max ze sizeRange w Lead, lub user-edited)
  city            String?
  address         String?                    // street + number
  postalCode      String?                    // "XX-XXX"
  phone           String?
  website         String?                    // optional

  user             User              @relation("CompanyUser", fields: [userId], references: [id], onDelete: Cascade)
  orders           Order[]

  @@index([nip])
}
```

**Migration name:** `add_company_business_fields`
**Indexes:** `nip` (unique + searchable for admin lookup)
**Default values:** all nullable (existing rows have no NIP yet — rejestracja gates fill them)

---

## §5. Backend changes

### 5.1 NIP validator (`apps/backend/src/utils/nip.ts`)
```ts
const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];
export function isValidNIP(nip: string): boolean {
  const digits = nip.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(digits)) return false;
  const checksum = WEIGHTS.reduce((sum, w, i) => sum + w * Number(digits[i]), 0) % 11;
  if (checksum === 10) return false; // invalid NIP
  return checksum === Number(digits[9]);
}
```

### 5.2 Register flow extension (`auth.service.ts` + `auth.controller.ts`)
Add NIP/companyName/industry/employeesCount/city/address/postalCode/phone do Zod schema rejestracji. Walidacja: NIP via `isValidNIP`, postalCode regex `^\d{2}-\d{3}$`. Tworzy User + Company w transakcji.

### 5.3 Checkout flow tweaks
- `checkout.service.ts:createSession` — usunąć `if (!company) throw 404`; teraz Company GWARANTOWANA bo rejestracja ją tworzy. **Defensive:** zostaw throw ale ze sensowniejszą wiadomością.
- `subscription.service.ts:createCheckout` — verify że buduje URL `/{locale}/zamowienie/sukces` (już tak robi)
- **Drop TRIAL z controller's Zod enum** — `productType: z.enum(['START', 'FIRMA', 'FIRMA_PLUS'])` (był: `['TRIAL', 'START', 'FIRMA', 'FIRMA_PLUS']`). Service nadal akceptuje (dormant per Q5).

### 5.4 Webhook handlers — review (no changes likely needed)
Wszystkie 5 handlerów istnieje i wygląda sensownie. Sprawdzam edge cases podczas implementation:
- `handleCheckoutCompleted` — upsert Subscription, OK
- `handleInvoicePaid` — update period dates, OK
- `handleSubscriptionDeleted` — set CANCELED, OK
- `handleSubscriptionUpdated` — sync cancel_at_period_end, OK
- `handleInvoicePaymentFailed` — set PAST_DUE, OK

**Potencjalne dodanie:** audit log entry per `STRIPE_CHECKOUT_COMPLETED` ma już resourceType (line 105 webhook.controller.ts), ale `STRIPE_INVOICE_PAID` może nie być w `AuditAction` type. Dodam jeśli brakuje.

---

## §6. Frontend changes

### 6.1 NIP validator (`apps/web/src/lib/validators/nip.ts`)
Identyczna implementacja jak backend (Q3 rekomendacja).

### 6.2 RegisterForm.tsx — dodatkowe pola
- `companyName` (text, required)
- `nip` (text, required, validate via `isValidNIP`)
- `industry` (select, required, 6 wartości)
- `employeesCount` (number, optional — default null)
- `city` + `address` + `postalCode` (text fields, optional w MVP — Fakturownia może uzupełnić później; albo required jeśli Q4=A)
- `phone` (tel, optional)

**Layout:** 2-kolumnowy grid (firstName+lastName / companyName+nip / industry+employeesCount / address fields).

### 6.3 `/zamow` page rebuild
```tsx
// app/[locale]/zamow/page.tsx
'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function ZamowPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const plan = params.get('plan'); // 'START' | 'FIRMA' | 'FIRMA_PLUS'

  // 1. Unauthenticated → redirect to /rejestracja?return=/zamow?plan=X
  // 2. Authenticated → POST /api/proxy/checkout/create-session { productType: plan }
  //                  → window.location.href = response.url (Stripe redirect)
  // 3. Error → display "Spróbuj ponownie" lub redirect na /pakiety
}
```

**Auth callback handling:** NextAuth `signIn(...)` redirect z `callbackUrl=/zamow?plan=START`.

### 6.4 PricingTiersSection.tsx + ComparisonTable.tsx — CTA wiring
- `PricingTiersSection.tsx:272` — `href="/audyt"` → conditional:
  - Primary CTA "Wybierz [PAKIET]" → `/zamow?plan={tier.id.toUpperCase()}`
  - Secondary text link "Pomocy wybrać? → Bezpłatny audyt" → `/audyt`
- `ComparisonTable.tsx` — analogiczny pattern

### 6.5 Success/Cancel pages — Neo-Swiss review
- `CheckoutSuccess.tsx` — verify: bambooIT branding, "Witaj w bambooIT" header, link do `/panel/subskrypcja`, polski copy, Fraunces fonts. Jeśli legacy e-dietetyk — restyle.
- `CheckoutCanceled.tsx` — analogicznie. Powinno mieć przycisk "Wróć do pakietów" i może też "Zacznij od audytu zamiast".

### 6.6 `/panel/subskrypcja` client page (nowa)
```tsx
// app/[locale]/panel/subskrypcja/page.tsx
// Server component:
// 1. requireAuth (NextAuth getServerSession)
// 2. fetch GET /subscriptions/my → display current subscription (plan, status, period end, cancel_at_period_end)
// 3. Button "Zarządzaj w Stripe" → fetch /subscriptions/portal → redirect
// 4. Cancelled subscription → "Wznów" CTA (opens portal too)
```

**Dependencies:** /panel layout (jeśli nie istnieje, create minimal layout.tsx with auth guard).

---

## §7. Commits planned

1. **`feat(db): add Company business fields + migration 12`**
   - `packages/database/prisma/schema.prisma` — extend Company
   - migrations/...add_company_business_fields/migration.sql

2. **`feat(backend): NIP validator + register flow with Company business fields`**
   - `apps/backend/src/utils/nip.ts` (NEW)
   - `apps/backend/src/services/auth.service.ts` — register signature extended
   - `apps/backend/src/controllers/auth.controller.ts` — Zod schema extended
   - test: `__tests__/utils/nip.test.ts`

3. **`feat(backend): drop TRIAL from checkout controller + audit log cleanup`**
   - `controllers/checkout.controller.ts` — Zod productType enum bez TRIAL
   - service zostaje (dormant per Q5/B)
   - dodaj missing AuditAction entries jeśli trzeba

4. **`feat(web): NIP validator + RegisterForm extended fields`**
   - `apps/web/src/lib/validators/nip.ts` (NEW)
   - `components/auth/RegisterForm.tsx` — +company fields + NIP validation
   - i18n keys (`auth.register.fields.*`)

5. **`feat(web): /zamow checkout entry — auth gate + plan dispatch`**
   - `app/[locale]/zamow/page.tsx` — rebuild
   - i18n keys (`order.*`)

6. **`feat(web): wire pricing CTAs to /zamow + secondary audit link`**
   - `PricingTiersSection.tsx` — CTA → `/zamow?plan=X` + secondary `/audyt`
   - `ComparisonTable.tsx` — analogicznie
   - i18n: `cards.${tier.id}.audit` jako secondary CTA copy

7. **`feat(web): /panel/subskrypcja client page + Customer Portal redirect`**
   - `app/[locale]/panel/layout.tsx` (NEW, auth guard)
   - `app/[locale]/panel/subskrypcja/page.tsx` (NEW)
   - `components/client-panel/SubscriptionPanel.tsx` (NEW)
   - i18n: `clientPanel.subscription.*`

8. **`feat(web): CheckoutSuccess + CheckoutCanceled Neo-Swiss restyle`**
   - `components/checkout/CheckoutSuccess.tsx`
   - `components/checkout/CheckoutCanceled.tsx`
   - bambooIT branding + linki do /panel/subskrypcja

9. **`docs(todo): mark BE-2 done`**

(Możliwe że #2+#4 łączą się w jeden "feat: register with NIP + Company business fields" — decyzja w trakcie.)

---

## §8. Sanity gates

Po każdym commits — `npm run typecheck` + tam gdzie tests `npm test -w apps/backend`.

Smoke test end-to-end (BE-5 ostateczny, ale ad-hoc w BE-2):
1. Rejestracja → user + Company w bazie
2. Login → session
3. /zamow?plan=FIRMA → Stripe redirect (mock mode jeśli brak STRIPE_SECRET_KEY w env)
4. Webhook simulation → Order + Subscription w bazie

---

## §9. Out of scope BE-2 (idzie do BE-3 / BE-4 / BE-5)

- ❌ Customer Portal funkcjonalność beyond redirect (Stripe Customer Portal robi 100%) → BE-3
- ❌ Email po pomyślnej płatności (Resend templates) → BE-4
- ❌ Fakturownia auto-create faktury → BE-4
- ❌ Admin UI dla subscriptions (lista, force-cancel, change plan) → BE-4
- ❌ Service hours tracking (`hoursUsed`/`hoursIncluded`) → BE-4
- ❌ Webhook `setup_intent.succeeded` dla trial card fingerprint (dormant TRIAL flow)
- ❌ Stripe Tax / VAT — Stripe Tax włączyć w prod konfiguracji, nie w kodzie

---

## §10. Decisions needed before implementation

| Q | Topic | Default rekomendacja | Twoja decyzja |
|---|-------|---------------------|---------------|
| Q1 | Pricing CTA strategy | B+secondary audit link | ? |
| Q2 | Auth before checkout | A (auth required) | ? |
| Q3 | NIP validator location | C (both, copied) | ? |
| Q4 | Migration 12 scope | A (full) | ? |
| Q5 | TRIAL flow | B (keep dormant) | ? |
| Q6 | Customer Portal UI | A+C (panel + success) | ? |
| Q7 | Service hours fields | Pomijam w BE-2 | ? |

**Czekam na approval planu i decyzje Q1-Q7 (albo "go z rekomendacjami") przed startem implementacji.**
