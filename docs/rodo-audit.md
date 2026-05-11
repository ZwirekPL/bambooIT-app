# Audyt RODO — e-dietetyk.com (DietetykDEV)

**Data audytu:** 2026-04-17
**Zakres:** pełna analiza kodu (apps/backend, apps/web, apps/solver, packages/database)
**Cel:** zebranie danych do sporządzenia dokumentacji RODO (RCPD, polityka prywatności, umowy DPA, DPIA)

> ⚠️ **Uwagi wstępne — rozbieżności między kodem a istniejącymi dokumentami legal:**
>
> 1. `apps/web/content/legal/pl/polityka-cookies.md:34` deklaruje **"brak Google Analytics"** — jednak w kodzie istnieje `apps/web/src/components/analytics/GoogleAnalytics.tsx` aktywujący GA gdy ustawiony `NEXT_PUBLIC_GA_ID`. **Do korekty w polityce cookies.**
> 2. `apps/web/content/legal/pl/polityka-prywatnosci.md:94` wymienia **Resend, Inc.** jako email provider — kod używa **nodemailer + SMTP** (`apps/backend/src/utils/email.ts:13`) z `SMTP_HOST` z env (w dev: `smtp.mailtrap.io`). **Przed wdrożeniem produkcji: doprecyzować kto jest realnym sub-processorem SMTP i zaktualizować polityka prywatności / podpisać DPA.**
> 3. Polityka cookies wymienia cookie `next-auth.session-token` — w kodzie używana jest nazwa NextAuth v5: `authjs.session-token` / `__Secure-authjs.session-token`.
>
> Dokument poniżej opisuje **stan faktyczny kodu**, nie stan opisany w legal — autor polityk będzie musiał zdecydować, co poprawić.

---

## 1. Mapa danych osobowych

Wszystkie modele pochodzą z `packages/database/prisma/schema.prisma`. Pola szyfrowane AES-256-GCM oznaczone **🔒 (encryptJson)** — szczegóły szyfrowania w sekcji 6.

### 1.1. Dane identyfikacyjne

| Model | Pole | Typ | Wymagane? | Źródło |
|---|---|---|---|---|
| `User` | `email` | String (unique) | ✅ wymagane | formularz rejestracji |
| `Patient` | `firstName` | String | ❌ opcjonalne | wywiad / formularz profilu |
| `Patient` | `lastName` | String | ❌ opcjonalne | wywiad / formularz profilu |
| `Patient` | `birthDate` | DateTime | ❌ opcjonalne | wywiad |
| `Patient` | `birthYear` | Int | ❌ opcjonalne | wywiad |
| `Patient` | `sex` | String | ❌ opcjonalne | wywiad |
| `DietitianProfile` | `firstName` | String | ❌ opcjonalne | panel dietetyka |
| `DietitianProfile` | `lastName` | String | ❌ opcjonalne | panel dietetyka |
| `NutritionTargets` | `ageYears` | Int | ❌ opcjonalne | wyliczane |

### 1.2. Dane kontaktowe

| Model | Pole | Typ | Wymagane? | Źródło |
|---|---|---|---|---|
| `User` | `email` | String | ✅ wymagane | rejestracja |
| `Order` | `consultationPhone` | String | ❌ opcjonalne | formularz konsultacji |
| `EmailSend` | `recipientEmail` | String | ✅ wymagane | kopia z `User.email` (snapshot wysyłki kampanii) |

**Uwaga:** `Patient` **nie** ma pola `phone` ani `address` — numer telefonu istnieje wyłącznie w `Order.consultationPhone` (płatne konsultacje).

### 1.3. Dane zdrowotne (art. 9 RODO — szczególna kategoria)

**Wszystkie poniższe pola zawierają dane szczególnej kategorii i wymagają odrębnej podstawy prawnej (wyraźna zgoda — art. 9 ust. 2 lit. a RODO).**

| Model | Pole | Szyfrowane? | Zawartość |
|---|---|---|---|
| `Interview` | `answers` | 🔒 tak | pełny wywiad: choroby przewlekłe, alergie, nietolerancje, leki, historia medyczna, aktywność, sen, stres, alkohol, problemy trawienne |
| `Interview` | `medicalFlags` | 🔒 tak | flagi red-flag / przeciwwskazania wyliczone z wywiadu |
| `Interview` | `profileSnapshot` | 🔒 tak | snapshot danych pacjenta w chwili wywiadu |
| `DietPlan` | `content` | 🔒 tak | pełny plan żywieniowy (posiłki, przepisy, makra, gramatury) |
| `DietPlan` | `rawResponse` | 🔒 tak | surowa odpowiedź OpenAI — może zawierać PHI |
| `DietPlanRevision` | `contentJson` | 🔒 tak | historia wersji planu |
| `LabPanel` | `data` | 🔒 tak | wyniki badań laboratoryjnych (cholesterol, glukoza, hormony, TSH, itp.) |
| `Message` | `content` | 🔒 tak | treść wiadomości pacjent ↔ dietetyk (może zawierać dane medyczne) |
| `DayRegeneration` | `originalDay` / `newDay` | nie (jawne JSON) | snapshoty dnia planu dla regeneracji |
| `Patient` | `heightCm`, `weightKg` | nie (jawne) | parametry antropometryczne |
| `CheckIn` | `weightKg`, `compliance`, `hunger`, `energy`, `sleep`, `activity`, `mood`, `waistCm`, `hipsCm`, `thighCm`, `chestCm`, `digestion`, `bloating`, `stoolBristol`, `supplementsTaken`, `notes` | nie (jawne) | pomiary i self-reporty pacjenta (w tym Bristol Stool Scale, tracking IBS/reflux) |
| `BodyMeasurement` | `waistCm`, `hipCm`, `chestCm`, `thighCm`, `armCm`, `bodyFatPct`, `notes` | nie (jawne) | pomiary robione przez dietetyka |
| `NutritionTargets` | `bmr`, `tdee`, `targetKcal`, `targetProteinG`, `targetFatG`, `targetCarbsG`, `activityLevel`, `goal`, `weightKg`, `heightCm` | nie (jawne) | cele dietetyczne wyliczone z wywiadu |
| `DietitianNote` | `content` | **nie** (jawne) | notatki medyczne dietetyka o pacjencie — **⚠️ PHI nieszyfrowane** |
| `SupplementPrescription` | `label`, `dose`, `unit`, `frequency`, `startDate`, `endDate`, `notes`, `nutrientKey` | nie (jawne) | przepisana suplementacja (dane medyczne) |
| `RecipeRating` | `rating`, `comment`, `recipeId` | nie (jawne) | oceny posiłków (pośrednio ujawniają preferencje żywieniowe) |
| `EmailSend` | `personalData` | nie | snapshot personalizacji kampanii (waga, trend, compliance) |
| `DietPlan` | `kcal`, `proteinG`, `fatG`, `carbsG` | nie (jawne) | makra docelowe planu |

### 1.4. Dane płatnicze

| Model | Pole | Zawartość |
|---|---|---|
| `Subscription` | `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `plan`, `status`, `currentPeriodStart/End`, `cancelAtPeriodEnd` | identyfikatory i status w Stripe |
| `Order` | `stripeInvoiceId`, `productType`, `status` | ID faktury, typ produktu |
| `TrialFingerprint` | `cardFingerprint`, `stripeSessionId` | fingerprint karty (Stripe daje hash — nie PAN) |

**PAN/CVV/data ważności — NIE są przechowywane w systemie.** Dane karty wpisuje Stripe Elements (iframe na `js.stripe.com`).

### 1.5. Dane techniczne / behawioralne

| Model | Pole | Zawartość |
|---|---|---|
| `AuditLog` | `ip`, `userId`, `action`, `resourceType`, `resourceId`, `metadata` | pełny trail aktywności + IP |
| `DeviceFingerprint` | `fingerprint`, `userAgent`, `ip`, `lastSeenAt` | FingerprintJS visitorId + IP + UA |
| `UserConsent` | `ipAddress`, `consentType`, `granted`, `documentVersion`, `acceptedAt`, `revokedAt` | zgody + IP w chwili wyrażenia |
| `PasswordResetToken` | `tokenHash`, `expiresAt`, `usedAt` | SHA-256 tokenu (surowy token tylko w mailu) |
| `EmailVerificationToken` | `tokenHash`, `expiresAt`, `usedAt` | j.w. |
| `EmailSend` | `sentAt`, `openedAt`, `clickedAt`, `variant` | tracking otwarć/kliknięć kampanii |
| `AiUsageLog`, `AiCostLog` | `patientId`, `dietPlanId`, `tokens`, `durationMs`, `cost` | telemetria AI per pacjent |
| `User` | `lastLoginAt`, `grantedAccessUntil`, `emailVerified`, `deletedAt` | stan konta |

### 1.6. Zgody (`UserConsent`) — enum `ConsentType`

Wszystkie typy z `schema.prisma`:

- `HEALTH_DATA_PROCESSING` — art. 9 ust. 2 lit. a) RODO (zgoda na dane zdrowotne)
- `AI_DISCLAIMER` — zgoda na automatyczne generowanie planu (art. 22 RODO)
- `EMAIL_NOTIFICATIONS` — zgoda marketingowa
- `TERMS_ACCEPTANCE` — akceptacja regulaminu
- `PRIVACY_POLICY` — akceptacja polityki prywatności
- `COOKIE_FUNCTIONAL` — zgoda na cookies funkcjonalne

Każda zgoda ma wersję dokumentu (`documentVersion`), datę wyrażenia (`acceptedAt`), opcjonalną datę cofnięcia (`revokedAt`) oraz IP.

### 1.7. Role / enumy relewantne dla RODO

- `UserRole` = `ADMIN | DIETITIAN | PATIENT`
- `DietPlanStatus` = `AI_DRAFT | GENERATED | REVIEWED | SENT | PUBLISHED | MANUAL_REVIEW_REQUIRED | GENERATION_FAILED`
- `ProductType` = 13 typów (trial, plan 2W/4W, opieka miesięczna/roczna, konsultacja, itd.)
- `SubscriptionPlan` = `FREE | PRO_MONTHLY | PRO_YEARLY`

---

## 2. Przepływ danych

### 2.1. Źródła wejściowe (co trafia do systemu)

| Źródło | Co wpada | Docelowy model |
|---|---|---|
| **Formularz rejestracji** (`/pl/rejestracja`) | email, hasło, zgody (terms/privacy) | `User`, `UserConsent` |
| **Formularz wywiadu** (CORE / PRO) — frontend + `POST /interviews` | wiek, płeć, waga, wzrost, choroby, alergie, leki, dieta, aktywność, cele | `Interview.answers` (🔒), `Patient.firstName/lastName/birthDate/sex/heightCm/weightKg`, `NutritionTargets` |
| **Panel dietetyka — formularz profilu pacjenta** | firstName, lastName, dane antropometryczne | `Patient`, `BodyMeasurement` |
| **Check-in pacjenta** (`POST /checkin`) | waga, compliance, samopoczucie, pomiary | `CheckIn` |
| **Stripe webhook** (`POST /webhooks/stripe`) | event payload (customer, subscription, invoice) | `Subscription`, `Order`, `TrialFingerprint` |
| **Upload wyników badań** (Lab Panel OCR — planowany) | PDF/zdjęcia → OCR → JSON | `LabPanel.data` (🔒) |
| **FingerprintJS (frontend SDK)** | visitorId | `DeviceFingerprint` + `TrialFingerprint` |
| **Chat pacjent ↔ dietetyk** | treść wiadomości | `Message.content` (🔒) |
| **Rating posiłków** | ocena + komentarz | `RecipeRating` |
| **OpenAI response** | plan dietetyczny | `DietPlan.content` + `rawResponse` (🔒) |
| **Import bazy produktów / przepisów** (skrypty w `packages/database/src/scripts/` i `apps/backend/src/scraper/`) | dane publiczne (nie osobowe) | `FoodProduct`, `Recipe`, `CleanProduct` (brak PII) |

### 2.2. Przechowywanie

- **PostgreSQL 15** — główna baza (prod: kontener w Docker, `docker-compose.prod.yml`, wolumen `postgres_data`). Lokalizacja fizyczna: VPS Hostinger KVM 2 (Wilno, Litwa — EOG wg polityki prywatności, IP `31.97.75.190`).
- **Redis 7** — BullMQ job queue (`diet-generate`, `diet-repair`, `diet-partial`), rate limit store, blacklista JWT, active session store. Payloady zawierają **anonimizowany profil pacjenta** (wiek/waga/wzrost/płeć, choroby, alergie) — nie zawierają emaila ani imienia.
- **Logi Docker** — `json-file` driver, `max-size: 10m`, `max-file: 3` (tj. ≤ 30 MB rotated) w `docker-compose.prod.yml`. Logi backendu używają `console.log` (brak winston/pino) — stream do Dockera.
- **Backup wolumen** — `./backups:/backups` zamontowany do kontenera postgres (`docker-compose.prod.yml:21`). **BRAK automatycznego skryptu backup / cron** widocznego w repo — backup jest ręczny.
- **PDF-y eksportowane** — generowane on-the-fly (pdfkit), nie zapisywane na dysku.

### 2.3. Wyjścia (gdzie dane są wysyłane)

| Kanał | Komu | Jakie dane |
|---|---|---|
| **OpenAI API** (`api.openai.com`) | OpenAI LLC, USA | zanonimizowany profil (wiek/waga/wzrost/płeć), choroby, alergie, leki, preferencje — **bez email / imię / nazwisko** (zweryfikowane w `apps/backend/src/services/openai.service.ts` + `aiGeneration.service.ts`) |
| **Stripe API** (`api.stripe.com`) | Stripe Inc., USA | email klienta, metadata z userId + orderId, kwota, produkt |
| **Stripe.js (iframe)** | Stripe | dane karty (PAN, CVV, exp.) — wpisywane bezpośrednio do iframe, backend nie widzi |
| **SMTP** (`SMTP_HOST`, prod: TBD / dev: `smtp.mailtrap.io`) | provider SMTP | email, imię pacjenta, w kampaniach: waga, trend, kcal, compliance, osiągnięcia |
| **Sentry** (`*.sentry.io`, `*.ingest.sentry.io`) | Sentry | stack trace + `setUser({id, email, role})` (backend); Session Replay (10% normal / 100% error) z frontendu — ryzyko PII w DOM |
| **Google Analytics** (`googletagmanager.com`, `analytics.google.com`) | Google, USA | page views, eventy, zanonimizowane IP (`anonymize_ip: true`) |
| **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) | Google, USA | IP + UA w request fontów (biernie, bez PII) |
| **FingerprintJS SDK** | FingerprintJS Inc. (USA) | UA, canvas/WebGL fingerprint, pluginy — do wygenerowania visitorId |
| **Email pacjent/dietetyk** | odbiorca maila | w zależności od typu: firstName, link reset, plan-ready notification, weekly summary (waga, trendy, adherencja) |
| **Eksport PDF** | pacjent/dietetyk (ręcznie pobrany) | pełny plan + email pacjenta jako watermark |
| **Eksport JSON (DSAR)** | właściciel danych | wszystko co w DB (patrz sekcja 7) |
| **Python solver** (`solver:5050`) | lokalny mikroserwis (docker-compose prod) | anonimowe ID pacjenta + kandydaci przepisów (brak PII — przepływ wewnętrzny) |

### 2.4. Integracje wewnętrzne

- `backend` ↔ `packages/database` (Prisma) — TCP do PostgreSQL
- `backend` ↔ `solver` — HTTP POST do `http://solver:5050/solve` (sieć wewnętrzna Docker)
- `backend` ↔ `Redis` — `ioredis`, kolejki BullMQ
- `web` ↔ `backend` — `apiFetch` (fetch HTTPS) + NextAuth server-side token

---

## 3. Integracje zewnętrzne (sub-processors)

Poniższa lista opisuje stan **kodu** — nie wszystkie te podmioty są wymienione w `polityka-prywatnosci.md`. Niezbędne uzupełnienie DPA przed produkcją.

| # | Sub-processor | Domena | Dane | Cel | Siedziba | EOG? |
|---|---|---|---|---|---|---|
| 1 | **OpenAI, LLC** | `api.openai.com` | zanonimizowany profil zdrowotny pacjenta (wiek, waga, wzrost, płeć, choroby, alergie, leki, preferencje) | generowanie planu dietetycznego (GPT-4.1 + fallback gpt-4o / gpt-4.1-mini) | San Francisco, USA | ❌ USA (wymaga SCC + DPA) |
| 2 | **Stripe, Inc. / Stripe Payments Europe** | `api.stripe.com`, `js.stripe.com`, `m.stripe.network`, `hooks.stripe.com` | email, userId/orderId w metadata, dane karty (trafiają bezpośrednio do Stripe), fingerprint karty | checkout, subskrypcje, webhooki, fakturowanie | San Francisco / Dublin, IE | ⚠️ USA + IE (SCC — Stripe EU entity) |
| 3 | **SMTP email provider** (`SMTP_HOST`) | zależy od env (`.env.example:17` w dev = `smtp.mailtrap.io`) | email odbiorcy, imię, treść maila (zawierać może wagę / compliance / trend / kcal w weekly summary) | transactional mail: reset hasła, weryfikacja, potwierdzenie zamówienia, powiadomienia o planach, weekly summary, reminders | **TBD w prod** — polityka prywatności deklaruje Resend (USA); `.env.prod.example` nie zawiera konkretnego hosta | ❌ jeśli Resend (USA) / zależy |
| 4 | **Sentry** | `*.ingest.sentry.io`, `*.sentry.io` (DSN z env) | stack traces, request context, `setUser({id, email, role})`, Session Replay (DOM snapshots — **potencjalne PII jeśli brak scrubbingu**) | monitoring błędów + performance | USA / EU (zależy od regionu konta) | ⚠️ TBD — doprecyzować region Sentry |
| 5 | **Google Analytics 4** | `www.googletagmanager.com`, `analytics.google.com` | pageviews, eventy, `anonymize_ip: true`, event `ai_referral` z AI sources | analityka ruchu | USA | ❌ USA (SCC) |
| 6 | **Google Fonts** | `fonts.googleapis.com`, `fonts.gstatic.com` (dozwolone w CSP `apps/web/next.config.ts:44-45`) | IP + User-Agent (bierne) | ładowanie fontów | USA | ❌ USA |
| 7 | **FingerprintJS** | `@fingerprintjs/fingerprintjs` v4.6.2 (open-source client-side, brak call-home w free tier) | UA, canvas fingerprint, WebGL | anti-abuse (max 3 konta / device) | — (biblioteka klient-side; darmowy open-source tier liczy lokalnie, bez zdalnego API) | N/A (lokalnie) — **zweryfikować czy wersja OSS czy Pro (Pro wywołuje `api.fpjs.io`)** |
| 8 | **Hostinger (UAB Hostinger)** | VPS KVM 2, IP `31.97.75.190` | całość danych aplikacji (DB + Redis + backupy + logi) | hosting serwera + bazy | Wilno, Litwa | ✅ EOG |
| 9 | **Let's Encrypt / ISRG** | issuer certyfikatu TLS (nginx prod) | CSR (public key), domena | certyfikat TLS | USA (non-profit) | N/A (nie przetwarza danych osobowych) |
| 10 | **n8n** | wg `CLAUDE.md` planowany, ale w kodzie wyłączony (`apps/backend/src/services/n8n.service.ts` legacy) | — | (nieaktywny) | N/A | N/A |
| 11 | **Redis** | `redis://redis:6379` (kontener wewnętrzny) | job payloady BullMQ (anon. profil + plan) | kolejka i rate limit | Hostinger VPS (wewnętrzny) | ✅ EOG |
| 12 | **Polskie serwisy kulinarne** (scraper — `apps/backend/src/scraper/`) | aniagotuje.pl, kwestiasmaku.com, jadlonomia.com, dietetykpowszechny.pl, paleosmak.pl | tylko HTTP GET po przepisy (publiczne HTML) — brak wysyłania danych użytkowników | budowanie bazy przepisów | Polska | ✅ EOG (one-way scraping) |

**Do uzupełnienia / weryfikacji przed wdrożeniem RODO:**
- DPA z realnym SMTP providerem (Resend / SendGrid / Postmark / własny SMTP?)
- Region Sentry (EU vs US)
- Czy FingerprintJS to OSS (brak call-home) czy Pro (api.fpjs.io)?
- DPA z OpenAI (Enterprise DPA dostępne)
- DPA z Stripe (EU entity + SCC)

---

## 4. Autoryzacja i role

### 4.1. Role

Enum `UserRole` = `ADMIN | DIETITIAN | PATIENT` (`packages/database/prisma/schema.prisma`).

**Kto widzi co:**

| Akcja / zasób | PATIENT | DIETITIAN | ADMIN |
|---|---|---|---|
| Własny profil (`/profile`) | ✅ tylko swój (ID z JWT) | ✅ swój (dietitianProfile) | ✅ |
| Lista pacjentów (`/patients`) | ❌ 403 | ✅ `Patient.dietitianId == userId` (swoi) + `dietitianId == null` (niezassignowani, tylko odczyt) | ✅ wszyscy |
| Edycja pacjenta | ❌ | ✅ tylko swoich | ✅ |
| Wywiady | ✅ tylko swój (patientId z JWT) | ✅ swoich pacjentów | ✅ |
| Plany dietetyczne (`/diet-plans`) | ✅ **tylko `status ∈ {PUBLISHED, SENT}`** (filtr w `dietPlan.service.ts`) | ✅ swoich pacjentów, wszystkie statusy | ✅ |
| Swap posiłków, regeneracja dnia | ✅ na swoim planie | ✅ | ✅ |
| Lista zakupów / shopping-list | ✅ swoje | ✅ | ✅ |
| Eksport PDF planu | ✅ swój (limit 5/tydzień — `rateLimiters.ts`) | ✅ | ✅ |
| Chat (Conversation + Message) | ✅ swoje konwersacje | ✅ swoich pacjentów | ✅ |
| Admin panel (`/admin/*`) | ❌ 403 | ❌ 403 | ✅ 32 grupy endpointów |
| Rozpoznawanie podejrzanych urządzeń | ❌ | ❌ | ✅ `GET /admin/security/devices/suspicious` |
| Audit log | ❌ | ❌ | ✅ `GET /admin/audit-logs` |

Enforcement w middleware `apps/backend/src/middleware/auth.ts:23-111` + per-endpoint: `requireAuth('ADMIN')`, `requireAuth('ADMIN', 'DIETITIAN')`, `requireAuth('PATIENT')`.

Dodatkowa warstwa: service-level checks (np. `patient.service.ts:129-157` — DIETITIAN nie może czytać cudzego pacjenta nawet gdy zna ID).

### 4.2. Logowanie

- **Backend:** `POST /auth/login` (`apps/backend/src/services/auth.service.ts`):
  - `bcryptjs.compare(password, passwordHash)` — hash **bcrypt**, rounds = **12** (linia `services/auth.service.ts:145` dla rejestracji; `:40` dla verify)
  - blokada nieverified email (`emailVerified == null` → 403)
  - wystawienie JWT **HS256**, `expiresIn: '7d'`, secret = `JWT_SECRET` (min 32 znaki, walidowane w `server.ts:77-80`)
  - payload: `{ sub, email, role, patientId }`
  - rejestracja aktywnej sesji w Redis: `session:active:${userId}` z `tokenHash` — **single-active-session** (login na nowym urządzeniu wyrzuca poprzedni token → `SESSION_SUPERSEDED` w audit)
  - `recordFingerprint(deviceFingerprint, userId, UA, IP)` (FingerprintJS)
- **Frontend:** NextAuth v5 `Credentials` provider (`apps/web/src/auth.ts`):
  - wywołuje backend `/auth/login`, zapisuje `backendToken` w zaszyfrowanym JWT cookie
  - session strategy: JWT, `maxAge: 7d`, `updateAge: 24h`
  - cookie: `__Secure-authjs.session-token` (prod, Secure+HttpOnly+SameSite=lax) / `authjs.session-token` (dev)
- **OAuth zewnętrzne:** **BRAK** (Google/Facebook/Apple — nie skonfigurowane)

### 4.3. 2FA / MFA

**BRAK.** Nie ma modelu TOTP ani endpointów 2FA. Rekomendacja: dodać TOTP dla roli DIETITIAN (dostęp do danych medycznych wielu pacjentów).

### 4.4. Reset hasła

- `POST /auth/forgot-password` → generuje `crypto.randomBytes(32).toString('hex')` (256-bit), zapisuje **SHA-256(token)** w `PasswordResetToken.tokenHash`, TTL = **1h** (`auth.service.ts:227-229`)
- link wysyłany mailem: `${APP_URL}/pl/resetuj-haslo?token=${rawToken}`
- **ochrona przed enumeration:** endpoint zawsze zwraca `{ ok: true, message: 'If email exists, reset link was sent' }` — niezależnie od tego czy email istnieje (`auth.service.ts:218-219`)
- rate limit: **3 req / 15 min / IP** (`rateLimiters.ts:40-47`)
- `POST /auth/reset-password` z `rawToken` + nowe hasło: rate limit 5 req/min/IP

### 4.5. Weryfikacja email

- token 32 bajty → SHA-256 w `EmailVerificationToken.tokenHash`, TTL **48h**
- resend: `POST /auth/resend-verification`, rate limit 1 req/60s/IP
- login zablokowany dopóki `User.emailVerified == null`

### 4.6. Sesje

- JWT 7 dni; rewokowalny przez blacklistę Redis: `blacklist:jwt:${tokenHash}` (TTL = pozostały czas JWT)
- `blacklist:user:${userId}` — wyrzuca wszystkie sesje użytkownika (akcja admin: `POST /admin/users/:id/revoke-sessions`)
- single-active-session enforcement (nowy login unieważnia stary token)
- **idle logout** frontend: 5 min bezczynności → auto-logout (`apps/web/src/components/auth/IdleLogout.tsx:8`) + warning po 4 min
- cookie `idle_last_activity` (niehttponly) trzyma timestamp ostatniej aktywności
- `apps/web/src/auth.config.ts:18-41` — callback `authorized()` wymusza idle timeout dla `/dashboard*`, `/dietetyk*`, `/admin*`

### 4.7. Ochrona przed brute force

`apps/backend/src/services/antiAbuse.service.ts:86-212`:
- 5 nieudanych prób → lock 15 min
- 10 prób → lock 1h
- 20 prób → **permanent lock** (wymaga `POST /admin/users/:id/unlock`)
- licznik w Redis: `login-attempts:${email}`

Dodatkowo:
- blokada email disposable (temp-mail, guerrillamail, itd.) — `antiAbuse.service.ts:14-32`
- max 5 rejestracji / /24 subnet / 30 dni (IP clustering)
- max 3 konta / device fingerprint

---

## 5. Retencja i usuwanie

### 5.1. Self-service usunięcie konta

✅ **Istnieje:** `DELETE /profile/account` (`apps/backend/src/routes/profile.routes.ts:23`) + UI: `apps/web/src/components/dashboard/DeleteAccountSection.tsx`.

**Flow** (`apps/backend/src/services/profile.service.ts:148-211`, komentarz: *"RODO Art. 17 — delete own account"*):
1. Weryfikacja hasłem (`bcrypt.compare`)
2. Cancel subskrypcji w Stripe (`stripe.subscriptions.cancel`) — jeśli istnieje
3. Anonimizacja `User`:
   - `deletedAt = now()`
   - `email` → `deleted_${randomHex}@removed.local`
   - `passwordHash = null`
4. Anonimizacja `Patient`: `firstName = null`, `lastName = null`
5. Hard delete: `PasswordResetToken`, `EmailVerificationToken`, `DeviceFingerprint`
6. Audit log: `DELETE_OWN_ACCOUNT`
7. Email potwierdzający na oryginalny adres

**⚠️ Uwaga:** Usunięcie **zachowuje** `Interview`, `DietPlan`, `CheckIn`, `Message`, `BodyMeasurement`, `SupplementPrescription`, `RecipeRating`, `Order`, `Subscription` (tylko `User.email` i `Patient.firstName/lastName` są anonimizowane). Kaskadowe usuwanie zależy od `onDelete` w Prismie — przy soft-delete nie dotyczy, dane pozostają w DB.

**Rozbieżność z polityką prywatności** (pkt 9.3): polityka deklaruje *"anonimizację danych osobowych (soft delete + usunięcie PII)"* — w praktyce anonimizuje się tylko email+imię+nazwisko; pozostałe dane medyczne zostają w DB bez bezpośredniej identyfikacji (w `Patient.id` → ale bez imion/email się nie powiąże). Zweryfikować czy akceptowalne dla RODO.

### 5.2. Soft delete

`User.deletedAt` filtrowane w ~20 miejscach kodu (`auth.service.ts:33`, `admin.service.ts:47`, itd.). **Brak automatycznego czyszczenia** soft-deleted po N dniach — polityka prywatności deklaruje 30 dni, ale w kodzie nie ma cron jobu / scheduler który by to realizował. **Do dodania.**

### 5.3. Kaskady onDelete

Hard-delete `User` (gdyby się zdarzył) kaskadowo usuwa (z `schema.prisma`):
- `Patient` (Cascade) → `Interview`, `DietPlan`, `CheckIn`, `Message`, itd. (Cascade)
- `UserConsent` (Cascade)
- `Subscription` (Cascade)
- `AuditLog.userId` — **optional FK, brak Cascade** → log pozostaje z nullem (dobre dla compliance/rozliczalności)

Jednak w `profile.service.ts:deleteAccount` nie ma `prisma.user.delete` — jedynie soft delete. Hard delete możliwy tylko ręcznie z DB.

### 5.4. Backupy

- `docker-compose.prod.yml:21` montuje `./backups:/backups` do postgresa
- **BRAK widocznego skryptu `pg_dump` / cron** w repo
- Retencja backupów: **nieokreślona w kodzie** (zależy od hostingu / ręcznego zarządzania)
- Do zdefiniowania w polityce bezpieczeństwa: ile dni wstecz, czy szyfrowane w spoczynku

### 5.5. Logi

- Logi aplikacji: `console.log` → Docker json-file (max 30MB rotated per kontener)
- AuditLog (tabela DB): wszystkie akcje krytyczne (LOGIN, LOGOUT, PASSWORD_CHANGE, EMAIL_CHANGE, GENERATE_PLAN, VIEW_PLAN, APPROVE_PLAN, EXPORT_PLAN, DATA_EXPORT_REQUESTED, DELETE_OWN_ACCOUNT, SOFT_DELETE_USER, SESSION_SUPERSEDED, itd.)
- Retencja AuditLog: **brak automatycznego czyszczenia** — logi rosną w nieskończoność; polityka deklaruje 5 lat, kod nie egzekwuje
- IP trzymane w `AuditLog.ip`, `UserConsent.ipAddress`, `DeviceFingerprint.ip`

---

## 6. Mechanizmy bezpieczeństwa

### 6.1. Szyfrowanie

**W tranzycie (TLS):**
- `nginx/prod.conf` wymusza HTTPS (redirect HTTP → HTTPS)
- TLS 1.2 + 1.3, cipher suites: ECDHE-ECDSA/RSA-AES128/256-GCM-SHA256/384
- HSTS `max-age=31536000; includeSubDomains` (1 rok)
- session tickets: OFF
- certyfikat: Let's Encrypt (auto-renew)

**W spoczynku (application-level encryption):**
- Moduł: `apps/backend/src/utils/encryption.ts` — **AES-256-GCM**, IV 12 bajtów
- Klucz: `ENCRYPTION_KEY` z env (64 hex = 32 bajty), walidowany przy starcie (`server.ts:52-70`)
- Format string: `v1:iv:tag:data` / JSON: `{v:1, iv, tag, data}`
- Funkcje: `encryptJson() / decryptJson()`, `encryptString() / decryptString()` (tolerują legacy plaintext)
- **Pola szyfrowane** (zweryfikowane w kodzie, nie tylko schema):
  - `Interview.answers`, `Interview.medicalFlags`, `Interview.profileSnapshot`
  - `DietPlan.content`, `DietPlan.rawResponse`
  - `DietPlanRevision.contentJson`
  - `LabPanel.data`
  - `Message.content`
  - `SpecialRequest.content`
- **Pola NIE szyfrowane** (ale zawierają dane medyczne):
  - `Patient.weightKg, heightCm, sex, birthDate`
  - `CheckIn.*`, `BodyMeasurement.*`, `NutritionTargets.*`
  - `DietitianNote.content` — ⚠️ notatki medyczne dietetyka jawne
  - `SupplementPrescription.*`
  - `DietPlan.kcal, proteinG, fatG, carbsG` (makra docelowe)
- **Brak szyfrowania at-rest dla całej bazy** (nie disk encryption via PostgreSQL `pgcrypto` / TDE) — zależy od szyfrowania dysku VPS Hostinger

### 6.2. Hashowanie haseł

- **bcryptjs** v3.0.3
- Rounds: **12** (`bcrypt.hash(password, 12)` w `auth.service.ts:145, 254`)
- Verify: `bcrypt.compare(password, passwordHash)`

### 6.3. Rate limiting

Biblioteka: `express-rate-limit` + `rate-limit-redis` (RedisStore).

| Zakres | Limit | Okno | Klucz | Plik |
|---|---|---|---|---|
| Globalny | 300 req (prod) / 1000 (dev) | 15 min | IP | `rateLimiters.ts` (`globalLimiter`) |
| Per-user | 200 req | 15 min | userID | `userLimiter` |
| `/auth/*` | 10 req (prod) / 100 (dev) | 15 min | IP | `authLimiter` |
| `/auth/forgot-password` | 3 req | 15 min | IP | |
| `/auth/reset-password` | 5 req | 1 min | IP | |
| `/auth/resend-verification` | 1 req | 60s | IP | |
| PDF export | 5 req | 1h | userID | `dietPlan.controller.ts:215-225` |

### 6.4. Nagłówki bezpieczeństwa

Backend (Helmet w `server.ts:88-105`) + nginx (`nginx/prod.conf:32-36`):
- CSP: `default-src 'self'`; `script-src 'self' https://js.stripe.com https://m.stripe.network https://www.googletagmanager.com`; `frame-src https://js.stripe.com https://hooks.stripe.com`; `connect-src 'self' https://api.stripe.com https://*.sentry.io ...`
- HSTS: `max-age=31536000; includeSubDomains`
- X-Frame-Options: `SAMEORIGIN`
- X-Content-Type-Options: `nosniff`
- X-XSS-Protection: `1; mode=block`
- Referrer-Policy: `strict-origin-when-cross-origin`

### 6.5. CORS

`server.ts:110-150`:
- whitelist z `CORS_ORIGIN` (domyślnie `http://localhost:3000`)
- dev: allow LAN (192.168/10/172.16-31)
- `credentials: true`

### 6.6. CSRF

- NextAuth wbudowane — cookie `authjs.csrf-token`
- Backend `apps/backend/src/middleware/csrf.ts` — dodatkowa walidacja Origin/Referer na state-changing requests

### 6.7. Input validation

- **Zod** na ~80% endpointów (estymacja, grep pokazał ~47 controllerów z `z.object`)
- URL params walidowane z `z.string().cuid()`

### 6.8. SQL injection

- Prisma ORM (bezpieczne by default)
- `$queryRaw` / `$queryRawUnsafe` — 9 wystąpień, wszystkie z parametryzacją / whitelistą (głównie admin stats)

### 6.9. XSS

- `dangerouslySetInnerHTML` — 13 wystąpień, wszystkie to JSON-LD structured data (`JSON.stringify(obj)`) — brak user input

### 6.10. Audit log

Model `AuditLog` (`userId?`, `action`, `resourceType?`, `resourceId?`, `ip?`, `metadata?`, `createdAt`). Loguje ~30+ akcji krytycznych. Dostęp: `GET /admin/audit-logs`. **Brak retention policy** (patrz 5.5).

### 6.11. Anti-abuse

- Disposable email blacklist (`antiAbuse.service.ts:14-32`)
- IP clustering: max 5 rejestracji / /24 / 30 dni
- Device fingerprint: max 3 konta / device
- Progressive login lockout (patrz 4.7)
- `POST /admin/security/devices/suspicious` — review dla admina

### 6.12. Secrets

- Wszystkie secrety w env (`DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`, `AUTH_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `SMTP_*`, `REDIS_URL`, `SENTRY_DSN`)
- Walidacja minimum długości / formatu przy starcie serwera (`server.ts:52-80`)
- `.env.example` zatwierdzony w repo; `.env`, `.env.local`, `.env.prod` w `.gitignore`

---

## 7. Eksporty danych

### 7.1. PDF

Biblioteka: **pdfkit** v0.17.2. Moduły w `apps/backend/src/pdf/`:
- `diet-plan-template.ts` — pełny plan
- `shopping-list.ts` — lista zakupów
- `meal-card.ts` — karty posiłków
- `micronutrients.ts` — analiza mikro
- `recipes.ts` — przepisy

| Endpoint | Kto może pobrać | Zawartość | Limit |
|---|---|---|---|
| `GET /diet-plans/:id/pdf` | PATIENT (własny) / DIETITIAN / ADMIN | pełny plan, makra, mikroelementy, **email pacjenta jako watermark** (`dietPlan.controller.ts:246`), imię pacjenta w headerze | 5 / tydzień / userID |
| `GET /diet-plans/:id/shopping-list/pdf` | PATIENT / DIETITIAN / ADMIN | kategorie produktów, gramatury, daty planu | — |
| `GET /diet-plans/:id/export` (ICS) | PATIENT / DIETITIAN / ADMIN | posiłki jako wydarzenia kalendarza | — |

### 7.2. JSON (DSAR — art. 15/20 RODO)

`GET /profile/data-export` (`apps/backend/src/controllers/dsar.controller.ts:17-38` + `dsar.service.ts`):

Zwraca JSON zawierający:
- `User` metadata (email, role, createdAt, lastLoginAt, emailVerified)
- `Patient` profile (firstName, lastName, sex, birthYear, heightCm, weightKg)
- `UserConsent[]` wszystkie (z `acceptedAt`, `revokedAt`)
- `Interview[]` z **odszyfrowanymi** `answers` + `medicalFlags` (`dsar.service.ts:196-204`)
- `DietPlan[]` z **odszyfrowaną** `content`
- `Order[]` (productType, status, dates)
- `Subscription` (status, plan, Stripe IDs)
- Audit logs (ostatnie 1000 wpisów — `dsar.service.ts:90`)

Audit: `DATA_EXPORT_REQUESTED` (`dsar.controller.ts:29`).

### 7.3. CSV / XLSX

**BRAK.** Nie ma żadnego eksportu CSV ani XLSX w kodzie (pełny grep negatywny).

### 7.4. Załączniki mailowe

**BRAK PDF-ów w załączniku.** Żaden `sendMail()` w `apps/backend/src/utils/email.ts` nie ma pola `attachments`. Pacjent musi pobrać PDF ręcznie z platformy.

---

## 8. Cookies i tracking

### 8.1. Cookies ustawiane przez aplikację

| Cookie | Typ | HttpOnly | Secure | SameSite | TTL | Cel |
|---|---|---|---|---|---|---|
| `__Secure-authjs.session-token` (prod) / `authjs.session-token` (dev) | Sesja | ✅ | ✅ (prod) | lax | 7 dni | NextAuth v5 session |
| `authjs.csrf-token` | CSRF | ✅ | ✅ | lax | sesyjne | CSRF protection |
| `authjs.callback-url` | Nawigacja | ✅ | ✅ | lax | sesyjne | redirect po loginie |
| `idle_last_activity` | Idle tracking | ❌ (czytane z JS) | ✅ | lax | 5 min | auto-logout |
| `NEXT_LOCALE` | Preferencja | ❌ | — | — | 1 rok | język PL/EN (next-intl) |
| `cookie-consent` | Zgoda | ❌ | — | — | 1 rok | stan bannera cookies |

### 8.2. Cookie banner

- **Deklarowany** w polityce (`polityka-cookies.md:86-93`) — opcje: accept all / only necessary / change preferences
- **Brak komponentu** widocznego w grep — `CookieBanner.tsx` / `CookieConsent.tsx` nie znaleziono w repo. **Do implementacji / weryfikacji.**

### 8.3. Analytics / tracking w kodzie

| Narzędzie | Status | Plik |
|---|---|---|
| **Google Analytics 4** | ✅ zaimplementowane (gdy `NEXT_PUBLIC_GA_ID` ustawiony) | `apps/web/src/components/analytics/GoogleAnalytics.tsx` |
| **AI Referral tracking** (custom event) | ✅ aktywne | `apps/web/src/components/analytics/GeoTracker.tsx:40` — event `ai_referral` z detekcją ChatGPT / Claude / Perplexity / Gemini / Bing Copilot |
| PostHog, Mixpanel, Plausible, Hotjar, Microsoft Clarity, Facebook Pixel, GTM (poza gtag.js), LinkedIn Insight | ❌ BRAK | — |

**GA config:** `anonymize_ip: true` (linia 17), `afterInteractive` strategy. Script: `googletagmanager.com/gtag/js`.

**⚠️ Rozbieżność:** `polityka-cookies.md:34, 57-62` deklaruje wprost brak GA — sprzeczność z kodem.

### 8.4. Zewnętrzne skrypty w `<head>` / `layout.tsx`

- Google Analytics (GTM gtag script) — jeśli GA_ID ustawiony
- Stripe.js — ładowane lazy przez `@stripe/stripe-js` dopiero w checkout
- Google Fonts CSS (`next/font` — optymalizowany, ale dla niektórych fontów ładowany z `fonts.googleapis.com`)

### 8.5. Frontend instrumentation / Sentry

- `apps/web/instrumentation-client.ts` — Sentry client SDK
- `apps/web/sentry.server.config.ts`, `sentry.edge.config.ts` — serwerowy i edge Sentry
- Session Replay: **10% sesji / 100% na error** (z SDK defaults) — **⚠️ brak jawnej konfiguracji scrubbing PII** (domyślnie Sentry maskuje `input[type=password]` ale nie inne pola)

---

## Załącznik A — Sekcje kodu do pokrycia w dokumentacji RODO

| Dokument RODO | Sekcja / plik do pokazania |
|---|---|
| **Rejestr czynności przetwarzania (RCPD)** | schema.prisma + sekcja 1 tego audytu |
| **DPIA** (dla AI generującego plany + dane zdrowotne) | `aiGeneration.service.ts`, `openai.service.ts`, `polityka-prywatnosci.md` pkt 5 |
| **Umowy powierzenia (DPA)** | sekcja 3 — OpenAI, Stripe, SMTP provider, Sentry, Hostinger, Google (GA + Fonts), FingerprintJS (jeśli Pro) |
| **Procedura realizacji praw** | `dsar.controller.ts`, `profile.service.ts:deleteAccount`, `profile.routes.ts` |
| **Procedura naruszeń** | `AuditLog` + Sentry alerty — **do udokumentowania** |
| **Polityka haseł** | `auth.service.ts` (bcrypt 12 rounds), `antiAbuse.service.ts` (lockout tiery) |
| **Polityka retencji** | **do dodania** — cron czyszczący soft-deleted po 30 dniach + audit logów po 5 latach |
| **Rejestr zgód** | `UserConsent` (z wersjonowaniem dokumentów + IP) |

## Załącznik B — Lista luk / rekomendacje

1. **Cookie banner** — istnieje tylko w polityce, brak komponentu w kodzie (weryfikacja pilna).
2. **GA w polityce cookies** — polityka kłamie, że nie używamy GA; kod używa gdy ID ustawione.
3. **Email provider w prod** — niezgodność `Resend` (polityka) vs `nodemailer/SMTP` (kod). Wymaga decyzji + DPA.
4. **Sentry Session Replay PII scrubbing** — skonfigurować `maskAllText: true` / `blockAllMedia: true` lub jawnie jakie pola maskować.
5. **Cron do czyszczenia soft-deleted User** (30 dni, polityka deklaruje) — brak.
6. **Cron do czyszczenia AuditLog** starszego niż 5 lat — brak.
7. **DietitianNote.content** — notatki medyczne jawne, nie szyfrowane. Rozważyć `encryptString`.
8. **Brak 2FA/MFA** — rekomendacja dla roli DIETITIAN.
9. **Brak automatycznego backup `pg_dump`** — tylko zamontowany wolumen.
10. **Region Sentry** — potwierdzić EU vs US przed produkcją.
11. **FingerprintJS** — potwierdzić czy OSS (lokalnie) czy Pro (call-home do `api.fpjs.io`).
12. **Hard-delete konta po X dniach** od soft-delete — obecnie dane zostają w DB wiecznie (po anonimizacji email/imion).
13. **Dane niezaszyfrowane wrażliwe:** `Patient.weightKg, heightCm, sex, birthDate`, `CheckIn.*`, `BodyMeasurement.*`, `SupplementPrescription.*` — rozważyć szyfrowanie.

---

*Koniec audytu. Dokument wygenerowany na podstawie analizy kodu; nie zastępuje opinii prawnej ani DPIA.*
