# CLAUDE.md — bambooIT

> **Ten plik czyta Claude Code automatycznie przy każdej sesji.** Zawiera kontekst projektu, konwencje, decyzje architektoniczne i ścieżki krytyczne. Aktualizuj go gdy zmienia się coś fundamentalnego.

**Ostatnia aktualizacja:** 2026-05-14
**Status projektu:** Faza 4 build w toku — BE-1 → BE-4 zamknięte, BE-5 (deploy + CI/CD)
czeka aż Wirgiliusz ma terminal VPS. Marketing site + admin UI + email transport gotowe.

---

## 0. Czym jest bambooIT

**Bambooit** to mały zespół IT (2 osoby) sprzedający usługi technologiczne dla małych i średnich firm w Polsce.

**Cztery filary usług:**

1. **Obsługa IT** — abonamentowe pakiety wsparcia (Start / Firma / Firma Plus)
2. **Strony internetowe** — wycena indywidualna
3. **Aplikacje na zamówienie** — wycena indywidualna
4. **Automatyzacje procesów** — pakiety + indywidualne

Główny produkt sprzedażowy w fazie MVP: **abonament obsługi IT**. Pozostałe trzy usługi to cross-sell i osobne podstrony.

**Zespół:**
- **Remigiusz** — Obsługa IT (abonamenty, helpdesk)
- **Wirgiliusz** — Strony, aplikacje, automatyzacje + odpowiedzialny za kod tego projektu

**Klient docelowy:** firmy 1-30 osób (biura księgowe, kancelarie, gabinety, salony usługowe, małe firmy produkcyjne).

**Pozycjonowanie:** *"Nie infolinia, nie korporacja. Dwie osoby, które znają Twoją firmę po imieniu."*

Szczegółowy biznesplan: zobacz `PRD.md`.

---

## 1. Stack techniczny

### Frontend (`apps/web`)
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Auth:** NextAuth (Auth.js) v5
- **i18n:** next-intl (PL aktywne, EN jako stub na przyszłość, wyłączone w `i18n/config.ts`)
- **Payments UI:** Stripe Checkout (redirect mode) + Stripe Customer Portal
- **Forms:** react-hook-form + Zod
- **Monitoring:** Sentry (z PII scrubbing)

### Backend (`apps/backend`)
- **Framework:** Express + TypeScript
- **Auth:** JWT (access + refresh) + bcrypt
- **Payments:** Stripe SDK (Subscriptions, Customer Portal, Webhooks)
- **Email:** Resend
- **Invoicing:** Fakturownia API
- **AI Chat:** Anthropic SDK (Claude Haiku 4.5)
- **Monitoring:** Sentry

### Database (`packages/database`)
- **DB:** PostgreSQL 16+
- **ORM:** Prisma
- **Migracje:** Prisma Migrate

### Infra
- **Package manager:** npm (workspaces, NIE pnpm)
- **Node version:** 22 (per `.github/workflows/ci.yml`). Brak pin file `.nvmrc` / `engines.node`
  — dodać przed BE-5 deploy żeby PM2 / Vercel używał zgodnej wersji.
- **Hosting docelowy:** VPS współdzielony z e-dietetyk (osobny port, baza, user systemowy)
- **Reverse proxy:** Nginx
- **Process manager:** PM2 lub Coolify [TBD — zdecydować podczas deployu]
- **Domena docelowa:** `bambooit.pl` [TBD — zweryfikuj dostępność]

### Repo
- **GitHub:** [TBD — Twirgiliusz/bambooit (private?)]
- **Główna gałąź:** `main`
- **Convention:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)

---

## 2. Struktura repo (monorepo)

```
bambooIT/
├── apps/
│   ├── backend/          # Express API
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── utils/
│   │   │   ├── config/
│   │   │   └── server.ts
│   │   ├── __tests__/
│   │   └── package.json
│   └── web/              # Next.js frontend
│       ├── src/
│       │   ├── app/[locale]/
│       │   ├── components/
│       │   ├── lib/
│       │   ├── i18n/
│       │   └── types/
│       ├── public/
│       ├── messages/      # pl.json, en.json
│       └── package.json
├── packages/
│   └── database/         # Prisma schema + migrations
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       └── package.json
├── docs/                 # Dokumentacja RODO, deployment, etc.
├── scripts/              # Skrypty deploy, backup
├── nginx/                # Konfiguracja reverse proxy
├── .github/workflows/    # CI/CD
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json          # Root z workspaces
├── CLAUDE.md             # ← ten plik
├── PRD.md                # Product Requirements Document
├── DEPLOY.md             # Deployment instructions
├── RULES.md              # Reguły kodu
└── README.md
```

**Krytyczna zasada monorepo:** `packages/database` MUSI być zbudowany przed `apps/backend` i `apps/web` (oba zależą od typów `@bambooit/database`).

---

## 3. Komendy które MASZ używać

### Setup po świeżym clone
```bash
npm install
npm run db:generate          # Prisma generate
npm run build:db             # Build pakietu database
cp apps/backend/.env.example apps/backend/.env  # uzupełnij sekrety
cp apps/web/.env.example apps/web/.env.local
```

### Daily development
```bash
npm run dev                  # [VERIFY: czy ten skrypt istnieje w root]
# lub per-workspace:
npm run dev -w apps/web
npm run dev -w apps/backend
```

### Sanity checks (uruchamiaj po każdej istotnej zmianie)
```bash
npm run typecheck            # Pełny typecheck monorepo
npm run build:all            # Pełny build (database → backend → web)
```

### Per-workspace skróty
```bash
npm run build:db             # Tylko database
npm run build:backend        # Tylko backend
npm run build:web            # Tylko web
npm run db:generate          # Prisma generate
```

### Prisma
```bash
npm run prisma -- migrate dev -w packages/database     # Nowa migracja w dev
npm run prisma -- migrate deploy -w packages/database  # Deploy migracji na prod
npm run prisma -- studio -w packages/database          # Prisma Studio (GUI)
```

### Testy
```bash
npm test                     # [VERIFY: czy istnieje root test script]
npm test -w apps/backend     # Jest
npm test -w apps/web         # Vitest + Playwright
```

---

## 4. Zasady pracy (HARD RULES)

### A. Każda zmiana = osobny commit z Conventional Commits

```
feat: add audit form submission endpoint
fix: handle Stripe webhook idempotency
chore: bump dependencies
refactor: extract package validation to service
docs: update CLAUDE.md with new model fields
```

**NIGDY** nie commituj "WIP", "fix stuff", "update".

### B. Sanity check po każdej zmianie

Po zmianie w schemacie Prisma, w backendzie albo we frontendzie — uruchom `npm run typecheck`. Jeśli się sypie i NIE jest to oczywiste, STOP i raportuj zanim brniesz dalej.

### C. NIGDY nie commituj sekretów

`.env`, `.env.local`, `.env.development`, klucze SSH, certyfikaty, dumpy bazy. Pre-commit hook (husky + lint-staged) powinien to łapać. Jeśli nie łapie — popraw `.gitignore` i hook.

Jeśli zauważysz że sekret trafił do gita, **STOP** i raportuj. Trzeba zrobić `git filter-branch` lub `BFG Repo-Cleaner` i ROTACJA wszystkich wycieklych kluczy.

### D. Migracje Prisma — zawsze nazwane, zawsze osobne commity

```bash
npm run prisma -- migrate dev -w packages/database --name add_company_industry_field
```

Nigdy `--name init` ani `--name updates`. Nazwa powinna mówić CO zmienia.

Każda migracja = osobny commit `chore(db): migration {nazwa}`.

### E. Brak hardcodowanych wartości biznesowych w kodzie

Ceny pakietów, Stripe Price IDs, adres SMTP, klucze API — wszystko w `.env` lub w bazie (`AppSettings`).

```ts
// ŹLE
const STRIPE_PRICE_START = "price_1ABC123";

// DOBRZE
const stripePriceStart = process.env.STRIPE_PRICE_START;
if (!stripePriceStart) throw new Error("STRIPE_PRICE_START not configured");
```

### F. RODO/GDPR is non-negotiable

- Wszystkie pola PII są zaszyfrowane w bazie (`encryption.ts` utility z e-dietetyk)
- Logi NIE zawierają PII (`sentry-scrub.ts` filtry — sprawdź przed każdym deployem)
- DSAR endpoints działają (`controllers/dsar.controller.ts`)
- Polityka retencji aktywna (cleanup jobs)
- Cookie banner aktywny (`components/legal/CookieBanner.tsx`)

Każda nowa kolumna z danymi osobowymi przechodzi przegląd:
1. Czy musi być w plain text? Jeśli nie — szyfruj.
2. Czy jest w DSAR export?
3. Czy jest objęta polityką retencji?

### G. Mówimy po polsku w UI, po angielsku w kodzie

```ts
// Komentarze, nazwy zmiennych, error messages — EN
const auditFormSubmissions = await db.auditFormSubmission.findMany();

// Treści dla użytkownika — PL (przez i18n)
{t('audit.form.success')}
```

### H. Bez magic numbers

Limit godzin pakietu, czas reakcji, max wielkość uploadu — to są **wartości biznesowe** i powinny być w stałych z opisem albo w bazie.

```ts
// ŹLE
if (file.size > 5242880) throw new Error("Too big");

// DOBRZE
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB — limit dla ticket attachments
if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large");
```

---

## 5. Decyzje architektoniczne (ADR)

### ADR-001: Express backend zamiast Next.js API routes
**Powód:** Reuse z e-dietetyk. Niezależne skalowanie. Jaśniejszy podział odpowiedzialności.

### ADR-002: npm workspaces zamiast pnpm/Turborepo
**Powód:** Zgodność z e-dietetyk. Mniejsza złożoność dla zespołu 2-osobowego.

### ADR-003: PostgreSQL współdzielony z e-dietetyk (osobna baza)
**Powód:** Niższe koszty VPS. Wystarczająca izolacja przy osobnym user/db.
**Konfiguracja:** baza `bambooit_prod` / user `bambooit_user` z dostępem TYLKO do swojej bazy.

### ADR-004: i18n PL + EN stub (EN wyłączone)
**Powód:** Klient docelowy PL-only, ale infrastruktura i18n raz dodana zostaje. Włączenie EN to jedna linia w `i18n/config.ts`.

### ADR-005: Bez własnego ticket systemu w MVP
**Powód:** Skala 10-30 klientów obsługiwana mailem/telefonem. Liczenie godzin po stronie operatora (arkusz/CRM), nie w panelu klienta.
**Reevaluacja:** przy ~50 aktywnych klientach.

### ADR-006: Stripe Customer Portal zamiast własnego UI subskrypcji
**Powód:** Stripe robi to lepiej, taniej, bezpieczniej. Customer portal jest wbudowany w Stripe i obsługuje anulowanie, zmianę karty, zmianę pakietu, faktury.

### ADR-007: Fakturownia jako jedyne źródło faktur
**Powód:** Polski VAT, JPK, integracja z księgową klienta. Tańsze niż własne generowanie PDF + zgodność z polskimi wymogami.

### ADR-008: MDX dla bloga (NIE headless CMS)
**Powód:** Pisarzami są członkowie zespołu (2 osoby). Sanity/Payload to overkill na ten etap. Git jako CMS = wersjonowanie za darmo.

### ADR-009: Brak roli "AGENT" — tylko ADMIN + CLIENT
**Powód:** Zespół 2-osobowy, oboje to admini. Nie ma sensu komplikować uprawnień. Dodać AGENT gdy zespół urośnie.

### ADR-010: Brak multi-tenancy
**Powód:** Bambooit to klasyczny B2B z firmami-klientami. `Company` to nie tenant — to klient. Multi-tenancy zostawiamy na zupełnie inny produkt.

---

## 6. Model danych (wysoki poziom)

> **Status:** Sekcja zsynchronizowana ze schema.prisma po BE-1 (Lead) + BE-2 (Company business
> fields). Aktualne modele to także: Order, Subscription, AuditLog, Post, BlogCategoryConfig,
> Testimonial, ReferralCode, ReferralUsage, UserConsent, AppSettings, FeatureFlag, oraz
> anti-abuse modele (TrialFingerprint, DeviceFingerprint, SecurityBan).

### Modele core
- **User** — konto użytkownika (rola: ADMIN | CLIENT)
- **Company** — firma klienta (NIP, adres, branża, liczba pracowników) — relacja 1:N z User (jedna firma może mieć wielu użytkowników)
- **ServicePackage** — definicja pakietu (START / FIRMA / FIRMA_PLUS) z polami: name, monthlyPriceNet, hoursIncluded, stripeProductId, stripePriceId, features (JSON)
- **Subscription** — aktywna subskrypcja firmy (Company → ServicePackage)
- **Order** — pojedyncze zamówienie (proxy do Stripe)

### Modele lead-gen
- **AuditFormSubmission** — leady z formularza bezpłatnego audytu
- **ContactMessage** — wiadomości z kontaktu

### Modele compliance
- **AuditLog** — audytowy log wszystkich istotnych akcji (auth, payment, data access)
- **UserConsent** — zgody RODO
- **TrialFingerprint**, **DeviceFingerprint** — anti-abuse
- **SecurityBan** — banowanie nadużyć

### Modele content
- **Post**, **BlogCategoryConfig** — blog
- **Testimonial** — opinie klientów (display gdy pojawią się referencje)

### Modele auth
- **PasswordResetToken**, **EmailVerificationToken**
- **NotificationPreferences** — preferencje powiadomień

### Modele finansowe
- **Invoice** — mirror faktur z Fakturowni (cache lokalny, źródło prawdy = Fakturownia)

### Modele AI tracking
- **AiUsageLog**, **AiCostLog** — tracking użycia i kosztów Claude API (reuse z e-dietetyk)

### Modele referrals (opcjonalne)
- **ReferralCode**, **ReferralUsage** — kody polecające

---

## 7. Kluczowe przepływy

### 7.1 Zakup subskrypcji
1. Klient na `/pakiety` wybiera pakiet, klika "Kup"
2. Wymagane logowanie/rejestracja (NextAuth → backend `/api/auth/*`)
3. Tworzymy `Order` (status PENDING) → wywołujemy Stripe Checkout Session
4. Stripe redirect → klient płaci → webhook `customer.subscription.created`
5. Webhook (`controllers/webhook.controller.ts`) — tworzy `Subscription`, zmienia `Order.status = COMPLETED`
6. Webhook `invoice.payment_succeeded` → wywołuje Fakturownia API → tworzy fakturę → zapisuje `Invoice`
7. Resend wysyła email powitalny z linkami (do panelu, do pobrania AnyDesk)

### 7.2 Anulowanie subskrypcji
- Klient w panelu klika "Zarządzaj subskrypcją" → redirect do Stripe Customer Portal
- Klient anuluje → Stripe wysyła webhook `customer.subscription.deleted`
- Webhook ustawia `Subscription.status = CANCELED` + `cancelAt = currentPeriodEnd`
- Resend wysyła email potwierdzający

### 7.3 Formularz audytu
- Klient na `/audyt` wypełnia formularz
- POST `/api/audit-form` → walidacja Zod → zapis do bazy (`AuditFormSubmission`)
- Resend wysyła:
  - Mail do `hello@bambooit.pl` (Remigiusz + Wirgiliusz) z lead info
  - Mail do klienta z potwierdzeniem
- W panelu admina (jeśli istnieje) lead pojawia się w liście do kontaktu

### 7.4 Chat AI
- Widget w prawym dolnym rogu (komponent `components/chat/ChatWidget.tsx`)
- POST `/api/chat` z historią konwersacji
- Backend: `services/claude.service.ts` woła Anthropic API (Claude Haiku 4.5)
- System prompt z kontekstem bambooit (pakiety, kompetencje, ograniczenia)
- Function calling: `submit_lead`, `recommend_package`, `submit_audit_request`
- Streaming odpowiedzi (Server-Sent Events lub WebSocket — [TBD podczas implementacji])

---

## 8. Konwencje nazewnictwa

### Pliki i foldery
- React komponenty: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Services: `kebab-case.service.ts`
- Routes: `kebab-case.routes.ts`
- Controllers: `kebab-case.controller.ts`
- Pages (Next.js): foldery snake-case albo polskie (`pakiety`, `pomoc-zdalna`)
- Tests: `*.test.ts` lub `*.spec.ts`

### Polskie route paths (slug w URL)
- `/pakiety` (nie `/packages`)
- `/pomoc-zdalna`
- `/audyt`
- `/o-nas`
- `/blog`
- `/strony-internetowe`
- `/aplikacje`
- `/automatyzacje`
- `/branze/[slug]` np. `/branze/biura-rachunkowe`

### TypeScript
- Interfaces: `PascalCase` (np. `CompanyDto`, `ServicePackageInput`)
- Type aliases: `PascalCase`
- Enums: `PascalCase` z wartościami `SCREAMING_SNAKE_CASE`

```ts
enum ProductType {
  START = "START",
  FIRMA = "FIRMA",
  FIRMA_PLUS = "FIRMA_PLUS"
}
```

### Prisma
- Modele: `PascalCase` (singular: `Company`, nie `Companies`)
- Pola: `camelCase`
- Relacje: nazwa modelu w camelCase (`company`, `companyId`)

---

## 9. Gotchas i pułapki (które wgryzą Cię w plecy)

### 9.1 Kolejność builda w monorepo
Zawsze `packages/database` → `apps/backend` → `apps/web`.
Jeśli widzisz błąd "Cannot find module '@bambooit/database'" — najpierw uruchom `npm run build:db`.

### 9.2 Prisma migrate w monorepo
Migracje uruchamia się **z root**, ale wskazując workspace:
```bash
npm run prisma -- migrate dev -w packages/database --name xxx
```
NIE wchodź do `packages/database` i nie uruchamiaj tam — sypią się ścieżki.

### 9.3 Stripe webhook secret RÓŻNI się dev/prod
W `.env`:
- `STRIPE_WEBHOOK_SECRET` — produkcja
- `STRIPE_WEBHOOK_SECRET_LOCAL` — lokalny test z Stripe CLI

Webhook handler musi sprawdzić oba (najpierw prod, fallback na local) ALBO załadować odpowiedni na podstawie `NODE_ENV`.

### 9.4 Next-intl + App Router — `[locale]` segment
Wszystkie strony są pod `app/[locale]/`. Jeśli zapomnisz, dostajesz 404.

Link do strony PL:
```tsx
import { Link } from '@/i18n/routing';
<Link href="/pakiety">Pakiety</Link>
// Nie <Link href="/pl/pakiety">
```

### 9.5 NextAuth v5 — session callback
Domyślnie session NIE zawiera `userId`. Trzeba w `auth.config.ts` dodać callback:
```ts
callbacks: {
  session: ({ session, token }) => ({
    ...session,
    user: { ...session.user, id: token.sub }
  })
}
```

### 9.6 Resend rate limits
Free tier: 100 maili/dzień. Paid: 50,000/miesiąc.
Implementuj queue/throttle dla bulk emaili (np. powiadomienia o płatnościach).

### 9.7 Anthropic API koszty
Claude Haiku 4.5 jest tani, ale **CACHING SYSTEM PROMPTU** to różnica między 5 zł/dzień a 50 zł/dzień. Używaj prompt caching dla system prompta.

### 9.8 Fakturownia daty
Fakturownia oczekuje dat w formacie `YYYY-MM-DD`, NIE ISO 8601 z czasem.
```ts
const issuedDate = new Date().toISOString().split('T')[0]; // "2026-05-11"
```

### 9.9 Polish NIP validation
Polski NIP ma 10 cyfr + checksum. Używaj walidatora (nie regex `\d{10}`):
```ts
import { isValidNIP } from '@/lib/validators/nip';
```
Walidator NIP — utility w `lib/validators/`. Jeśli nie istnieje, zbuduj.

### 9.10 PostgreSQL + Prisma + Decimal
Ceny trzymaj jako `Decimal` w Prisma (NIE `Float`!). Float = bugi zaokrąglania.
```prisma
monthlyPriceNet Decimal @db.Decimal(10, 2)
```

W TypeScript używaj `decimal.js` lub `Prisma.Decimal` do arytmetyki.

---

## 10. Zewnętrzne konta i sekrety

> **[TBD — do uzupełnienia gdy zostaną założone]**

| Service | Status | Account | Notes |
|---------|--------|---------|-------|
| Stripe | [TODO Wirgiliusz] | — | Osobne products (3 Price IDs) + webhook secret. Code gotowy, mock mode dopóki brak `STRIPE_SECRET_KEY`. |
| Fakturownia / wfirma | [DECISION PENDING] | — | Decyzja providera open (2026-05-14, memory: project-invoicing-deferred). Integracja w osobnej fazie. |
| Resend | [READY TO FLIP] | — | Code gotowy (utils/email.ts dispatch). Wpisz `RESEND_API_KEY` + `RESEND_FROM_EMAIL` w .env → automatyczny switch z SMTP. |
| SMTP (Mailtrap dev / prod fallback) | [TODO Wirgiliusz] | — | Alternatywa dla Resend. Dev: Mailtrap free tier wystarcza. |
| Anthropic API | [FUTURE — faza 5] | — | Chat AI widget — faza 5; obecnie nieaktywny. |
| Sentry | [TODO Wirgiliusz] | — | Osobny project: `bambooit-backend`, `bambooit-web`. SENTRY_DSN w .env. |
| Google Analytics 4 | [FUTURE — faza 5] | — | D-063 — nie w MVP. Cookie consent infrastructure gotowa (BE-4 backend wiring TBD). |
| Meta Pixel | [FUTURE — faza 5] | — | Po pierwszej fali outreachu Remigiusza, kiedy zaczynamy testować płatne kanały. |
| GitHub | [TODO Wirgiliusz] | — | Private repo `bambooIT`. Po remote — CI workflow ruszy (ci.yml już skonfigurowany). |
| VPS | [SHARED] | e-dietetyk VPS | Współdzielony z e-dietetyk (ADR-003), osobny user `bambooit_user` + baza `bambooit_prod`, port 4001 backend + 3001 web. |
| Domena | [TODO Wirgiliusz] | bambooit.pl | Sprawdź dostępność + zarejestruj. DNS A record → IP VPS. |
| AnyDesk/RustDesk | [LEFT TO CLIENT] | — | Klient pobiera za darmo. Per-session pomoc zdalna, nie wymaga naszego konta. |

---

## 11. Workflow dla Claude Code

### Gdy zaczynasz nową sesję

1. Przeczytaj ten plik (`CLAUDE.md`)
2. Przeczytaj `TODO.md` żeby wiedzieć w którym jesteśmy miejscu fazy implementacji
3. Sprawdź `git log --oneline -20` żeby zobaczyć ostatnie zmiany
4. Sprawdź `git status` i `git diff` jeśli są niezapisane zmiany

### Gdy dostajesz zadanie

1. **Przeczytaj wymagania** — w `TODO.md` lub od użytkownika
2. **Zaproponuj plan** — opisz CO zrobisz w 3-7 punktach ZANIM zaczniesz kodować
3. **Czekaj na "ok"** — szczególnie przy zmianach w schemacie Prisma, struktury API, lub `package.json`
4. **Implementuj** — jedno zadanie = jeden commit (lub seria zwartych commitów)
5. **Sanity check** — `npm run typecheck` (i `npm run build:all` przy większych zmianach)
6. **Raport** — co zrobione, co dalej, czy są blockery

### Gdy coś idzie nie tak

1. **NIE forsuj** — jeśli nie wiesz co robić, ZATRZYMAJ i zapytaj
2. **Pokaż błąd** — pełny output, nie streszczenie
3. **Zaproponuj 2-3 opcje** rozwiązania zamiast wybierać samemu
4. **Nigdy nie maskuj błędów** — żaden `@ts-ignore`, `any` na siłę, ani `try/catch` połykający exception bez logu

### Czego NIE rób bez explicit zgody

- Nie modyfikuj `package.json` (dependencies, scripts) bez zapytania
- Nie zmieniaj struktur folderów
- Nie usuwaj plików (nawet `node_modules/` lub `.next/` — używaj `gitignored` tylko gdy ktoś poprosi)
- Nie pushuj do `main`
- Nie commituj jeśli typecheck się sypie
- Nie zmieniaj `CLAUDE.md` bez wyraźnej zgody (jeśli widzisz coś co warto dodać, zaproponuj zmianę osobno)

---

## 12. Sekcje do uzupełnienia (live)

Status na 2026-05-14 (po BE-1..BE-4 + K10 sweep + A/B/C/D batch):

- [x] **§1 Stack** — zweryfikowane (Node 22, Next.js 15, Prisma 6.19, NextAuth v5)
- [x] **§2 Struktura repo** — zaktualizowane po K7-K10 cleanup (legacy scripts dropped, EN reduced)
- [x] **§3 Komendy** — root composite `typecheck` ma npm 11 quirk (per-workspace działa zawsze)
- [x] **§6 Model danych** — synchronized z BE-1 (Lead) + BE-2 (Company business fields)
- [ ] **§7 Przepływy** — chat AI dalej w faza 5; panel klienta /panel/subskrypcja + /panel/profil opisać
- [x] **§10 Zewnętrzne konta** — status każdego provider'a zaktualizowany (decyzja Fakturownia/wfirma open)

Markery `[TODO Wirgiliusz]`, `[READY TO FLIP]`, `[DECISION PENDING]`, `[FUTURE]` zastąpiły
stare `[TBD]` / `[VERIFY]`.

---

## 13. Pliki referencyjne

- `PRD.md` — biznesowy kontekst, target user, lejek sprzedażowy, cenniki
- `DEPLOY.md` — instrukcja deploya na VPS
- `RULES.md` — szczegółowe reguły kodu i recenzji
- `PLAN_CZYSZCZENIA.md` — historyczny plan migracji z e-dietetyk
- `docs/dpia.md` — Data Protection Impact Assessment
- `docs/subprocessors.md` — lista sub-procesorów RODO
- `docs/data-breach-procedure.md` — procedura w razie wycieku

---

**Pytania, niejasności, propozycje zmian w tym pliku — najpierw pytaj, potem zmieniaj.**
