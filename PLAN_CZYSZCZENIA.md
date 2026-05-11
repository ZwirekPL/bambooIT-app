# PLAN_CZYSZCZENIA.md — bambooIT (przejście z DietetykDEV)

> **Status:** PROPOZYCJA do akceptacji. Nic nie usuwam dopóki nie powiesz "akceptuję".
> Inwentaryzacja na bazie aktualnego stanu `bambooIT` (HEAD `e6cec73`).

Konwencja:
- `[A]` = jeśli zatwierdzisz całość, kasujemy tym samym commitem
- `[?]` = nie jestem pewien, wymaga decyzji per item (pytania na końcu)
- Liczby modeli/plików: orientacyjne na podstawie ls + Grep

---

## 1) ZOSTAJE 1:1 (infrastruktura, cross-cutting, RODO, Stripe, Auth)

### 1a. Backend — pliki infrastrukturalne
- `apps/backend/src/server.ts` — Express bootstrap, CORS, rate limiting
- `apps/backend/src/middleware/` (cały) — error handler, auth middleware, rate limiters
- `apps/backend/src/utils/errors.ts`, `encryption.ts`, `sentry.ts`, generic helpers
- `apps/backend/src/config/` (env validation)
- `apps/backend/src/types/` (generic types, AppError itp.)

### 1b. Backend — Stripe stack
- `apps/backend/src/services/stripe.service.ts`
- `apps/backend/src/services/stripeAdmin.service.ts`
- `apps/backend/src/services/checkout.service.ts`
- `apps/backend/src/controllers/webhook.controller.ts` (Stripe webhook)
- `apps/backend/src/controllers/stripeAdmin.controller.ts`
- `apps/backend/src/routes/webhook.routes.ts`
- `apps/backend/src/services/order.service.ts` (szkielet, productType enum do przebudowy)

> Note: konkretne Price IDs i ProductType enum **zmienią się** (START/FIRMA/FIRMA_PLUS), ale architektura zostaje.

### 1c. Backend — Auth + Email (Resend)
- `apps/backend/src/services/auth.service.ts` (JWT, password hashing, email verify, reset)
- `apps/backend/src/controllers/auth.controller.ts`
- `apps/backend/src/routes/auth.routes.ts`
- SMTP integration (Resend) — w `auth.service.ts` + `admin.service.ts`

### 1d. Backend — RODO / DSAR / Audit / Anti-abuse
- `apps/backend/src/services/consent.service.ts`
- `apps/backend/src/services/dsar.service.ts` + `controllers/dsar.controller.ts`
- `apps/backend/src/services/audit.service.ts`
- `apps/backend/src/services/auditRetention.service.ts`
- `apps/backend/src/services/antiAbuse.service.ts`
- `apps/backend/src/services/deviceFingerprint.service.ts`
- `apps/backend/src/services/trialFingerprint.service.ts`
- `apps/backend/src/services/ban.service.ts`
- `apps/backend/src/services/securityMonitoring.service.ts`

### 1e. Backend — pozostałe generyczne
- `apps/backend/src/services/user.service.ts`, `userCleanup.service.ts`, `profile.service.ts`
- `apps/backend/src/services/subscription.service.ts`, `adminSubscription.service.ts`
- `apps/backend/src/services/referral.service.ts`
- `apps/backend/src/services/testimonial.service.ts`
- `apps/backend/src/services/blog.service.ts`, `blogCategory.service.ts`
- `apps/backend/src/services/accounting.service.ts` (gotowy szkielet pod Fakturownia)
- `apps/backend/src/services/appSettings.service.ts`, `dbFeatureFlag.service.ts`
- `apps/backend/src/jobs/cleanupSoftDeleted.job.ts`
- `apps/backend/src/routes/health.routes.ts`, `auth.routes.ts`, `webhook.routes.ts`,
  `referral.routes.ts`, `testimonial.routes.ts`, `subscription.routes.ts`,
  `order.routes.ts`, `blog.routes.ts`, `profile.routes.ts`, `user.routes.ts`,
  `emailCampaign.routes.ts`, `checkout.routes.ts`

### 1f. Frontend — infrastruktura i auth
- `apps/web/src/auth.ts`, `auth.config.ts` (NextAuth v5)
- `apps/web/src/app/api/auth/` (NextAuth route)
- `apps/web/src/app/api/proxy/` (proxy do backendu)
- `apps/web/src/lib/` cały: `api.ts`, `api-url.ts`, `cookie-consent.ts`, `sentry-scrub.ts`, `seo.ts`, `server-token.ts`, `utils.ts`, `download.ts`, `logout.ts`, `format-category.ts`
- `apps/web/src/i18n/` (next-intl config)
- `apps/web/src/instrumentation.ts` + `instrumentation-client.ts` (Sentry)
- `apps/web/src/app/global-error.tsx`
- `apps/web/src/types/` (przetnij diet-specific później)

### 1g. Frontend — komponenty 1:1
- `apps/web/src/components/ui/` (cały shadcn/ui — accordion, button, card, dialog, dropdown-menu, input, label, progress, select, separator, sheet, table, tabs, textarea, …)
- `apps/web/src/components/auth/` (LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, VerifyEmailView, LogoutButton, IdleLogout)
- `apps/web/src/components/legal/` (CookieBanner, CookieSettings, LegalMarkdown, LegalTabs, ManageCookiesButton)
- `apps/web/src/components/analytics/` (GoogleAnalytics, GeoTracker)
- `apps/web/src/components/layout/` (Header, Footer, LocaleSwitcher, Providers) — *Header/Footer wymagają przerobienia treści, ale szkielet 1:1*
- `apps/web/src/components/seo/BreadcrumbSchema.tsx`
- `apps/web/src/components/checkout/CheckoutCanceled.tsx`, `CheckoutSuccess.tsx`

### 1h. Frontend — strony 1:1
- `apps/web/src/app/[locale]/zaloguj/`, `rejestracja/`, `resetuj-haslo/`, `zapomnialem-hasla/`, `zweryfikuj-email/`
- `apps/web/src/app/[locale]/dokumenty-prawne/` (regulamin, polityka prywatności, cookies)
- `apps/web/src/app/[locale]/zamow/` + `zamowienie/` (Stripe checkout flow — szkielet, ceny do podmiany)

### 1i. Frontend — config + i18n szkielet
- `apps/web/messages/pl.json` + `en.json` (**częściowy clean-up — usuwamy klucze diet-specific, zostawiamy klucze common/auth/legal/checkout/billing**)
- `apps/web/tailwind.config.ts`, `next.config.ts`, `playwright.config.ts`, `vitest.config.ts`
- `apps/web/config/brand.ts` — przebuduję na bambooIT (treść), ale plik zostaje

### 1j. Database — modele 1:1
- `User` (samo User; relacja → Patient zniknie po Patient→Company rename)
- `Subscription`, `Order` (productType enum zmieniony — patrz §3)
- `AuditLog`, `UserConsent`, `TrialFingerprint`, `DeviceFingerprint`, `SecurityBan`
- `PasswordResetToken`, `EmailVerificationToken`
- `Post`, `BlogCategoryConfig`
- `Testimonial`, `ReferralCode`, `ReferralUsage`
- `NotificationPreferences`
- `EmailCampaign`, `EmailSend`
- `AppSettings`, `FeatureFlag`
- `AiCostLog`, `AiUsageLog` (do reuse pod Claude API tracking)

### 1k. Infra / repo root
- `docker-compose.yml/.prod.yml/.test.yml` (już posprzątane)
- `nginx/` (config reverse proxy)
- `.github/workflows/` (CI — będzie wymagać aktualizacji testów później)
- `.dockerignore`, `.gitattributes`, `.gitignore`
- `tsconfig.scripts.json`, root `package.json`, root `package-lock.json`

### 1l. Docs — RODO 1:1
- `docs/dpia.md`, `docs/data-breach-procedure.md`, `docs/subprocessors.md`
- `docs/sentry-pii-scrubbing.md`
- `docs/backup-recovery.md`, `docs/backup-restore.md`
- `docs/legal/` (jeśli istnieje — regulamin/polityka)

---

## 2) USUWAMY CAŁKOWICIE

### 2a. Backend — apps/solver
- **JUŻ USUNIĘTE** podczas kopiowania (cały `apps/solver/`)

### 2b. Backend — routes (diet-specific)
`apps/backend/src/routes/`:
- `[A]` `dietPlan.routes.ts`
- `[A]` `meal.routes.ts`
- `[A]` `recipe.routes.ts`
- `[A]` `foodProduct.routes.ts`
- `[A]` `cleanProduct.routes.ts`
- `[A]` `interview.routes.ts`
- `[A]` `dietitian.routes.ts`
- `[A]` `patient.routes.ts` — **wraca w §3 jako `company.routes.ts`**
- `[A]` `checkin.routes.ts`
- `[A]` `measurement.routes.ts`
- `[A]` `supplement.routes.ts`
- `[A]` `labpanel.routes.ts`
- `[A]` `rating.routes.ts`
- `[A]` `note.routes.ts`, `noteTemplate.routes.ts`
- `[A]` `template.routes.ts`
- `[A]` `onboarding.routes.ts` (diet interview onboarding — do przerobienia od zera)
- `[A]` `message.routes.ts` (chat dietetyk↔pacjent)
- `[A]` `tenant.routes.ts` (multi-tenant nie aktywne)
- `[A]` `access.routes.ts` (access window do planów)
- `[A]` `stats.routes.ts` (diet stats) — *do potwierdzenia, może być reusable*
- `[?]` `admin.routes.ts` — zostaje szkielet, ale wewnątrz dużo diet-specific endpointów → ostro przyciąć (osobny commit)

### 2c. Backend — controllers (diet-specific, ~30)
Wszystkie z `apps/backend/src/controllers/` poza:
**zostają:** `auth`, `dsar`, `featureFlag` (?), `onboarding` (rebuild), `order`, `profile`, `referral`, `stripeAdmin`, `subscription`, `testimonial`, `upload`, `user`, `webhook`, `accounting`, `blog`, `blogCategory`, `notificationPreferences`
**usuwamy `[A]`:** `aiCost`, `checkin`, `cleanProduct`, `clinicalRule`, `dietCache`, `dietPlan`, `dietToolkit`, `dietitianAlerts`, `dietitianReport`, `foodProduct`, `import` (diet import), `interview`, `labpanel`, `meal`, `mealSwap`, `micronutrient`, `n8nWebhook`, `note`, `noteTemplate`, `patient` (→ company rebuild), `planValidation`, `protocol`, `protocolTrigger`, `rating`, `recipe`, `template`, `tenant`, `admin` (cleanup wewnętrzny)

### 2d. Backend — services (~60 do usunięcia)
`[A]` wszystkie z `apps/backend/src/services/` **poza** listą §1:
`aiGeneration`, `bodyMeasurement`, `calendar`, `checkin*`, `cleanProduct`, `clinicalRule`, `clinicalSafetyCheck`, `conflictDetector`, `dayRegeneration`, `dbPipeline`, `dbPlanAssembly`, `dbPolicyBridge`, `dietCost`, `dietPlan`, `dietTemplateCache`, `dietToolkit`, `dietaryNorms`, `dietitianAlerts`, `dietitianReport`, `dietitianReportPdf`, `dietitianSettings`, `nutritionCalculator`, `openai` (rebuild → claude), `paywall` (?), `planEffectiveness`, `planPipeline`, `planPostProcessing`, `planQualityCheck`, `planValidation`, `productNameStandardization`, `productSelection`, `progress`, `promptBuilder`, `protocol*`, `recipe*`, `scoringContext`, `scraperStats`, `segmentation`, `slotRepair`, `softValidation`, `solverStats`, `supplement`, `template`, `tenant`, `weekSolver`, `weekly-summary`

### 2e. Backend — całe foldery
- `[A]` `apps/backend/src/scraper/` (kilkaset plików — scrapery jadlonomia/kwestiasmaku/aniagotuje/paleosmak/mojegotowanie + qualityGate + parsers)
- `[A]` `apps/backend/src/policies/` (clinical rules, red flags, protocol triggers, seed data)
- `[A]` `apps/backend/src/queues/` (BullMQ dietGenerate/dietPartial/dietRepair workers)
- `[A]` `apps/backend/src/workers/`
- `[A]` `apps/backend/src/pdf/` (diet plan PDF templates, meal-card, shopping-list)
- `[A]` `apps/backend/src/import/` (jeśli to import bazy spożywczej)
- `[A]` `apps/backend/src/assets/` (jeśli zawiera diet assets — sprawdzę przed kasacją)
- `[A]` `apps/backend/src/__tests__/` (większość — zostają tylko testy auth, stripe, dsar, anti-abuse, audit)

### 2f. Frontend — strony (cały panel pacjenta + dietetyka)
`apps/web/src/app/[locale]/`:
- `[A]` `dashboard/` cały (checkin, historia, opinia, plan, pomiary, postep, profil, subskrypcja, suplementy, wiadomosci, wywiad, zakupy)
- `[A]` `dietetyk/` cały (analityka, onboarding, pacjenci, produkty, profil, protokol, przepisy, raport, szablony, wiadomosci)
- `[A]` `onboarding/` (interview flow)
- `[A]` `jak-to-dziala/` (diet marketing)
- `[A]` `o-nas/`
- `[A]` `oferta/` → **rebuild jako `/pakiety` (§4)**
- `[A]` `konsultacja/`
- `[A]` `slownik/`
- `[A]` `faq/`
- `[A]` `[locale]/page.tsx` (homepage marketing — rebuild)
- `[?]` `blog/[slug]/` — szkielet stron zostaje, treść i kategorie do wymiany
- `[?]` `admin/` — częściowo: usuwamy `audit-log` (zostaje), `bezpieczenstwo` (zostaje), `blog` (zostaje), `email-kampanie` (zostaje), `konsultacje`, `konflikty-protokolow`, `koszty-ai` (rebuild pod Claude), `ksiegowosc` (zostaje), `mapowania-protokolow`, `opinie` (zostaje), `platnosci` (zostaje), `produkty`, `protokoly`, `przepisy`, `reguly-kliniczne`, `scraper-stats`, `solver-stats`, `subskrypcje` (zostaje), `tenants`, `ustawienia` (zostaje), `uzytkownicy` (zostaje)

### 2g. Frontend — komponenty (diet domain)
- `[A]` `apps/web/src/components/dashboard/` cały (~50 plików: ChatView, CheckInForm, DietPlanView, MealSwapModal, MicronutrientPanel, PatientPlanView, …)
- `[A]` `apps/web/src/components/dietitian/` cały (~40+ plików: DietPlanEditor, DragDropPlanEditor, FoodProductList, IngredientPicker, MatchedProtocolsCard, MedicationInteractionsPanel, …)
- `[A]` `apps/web/src/components/onboarding/` (InterviewStep, ProfileStep, TrialStep, TourStep)
- `[A]` `apps/web/src/components/about/`
- `[A]` `apps/web/src/components/faq/`
- `[A]` `apps/web/src/components/glossary/`
- `[A]` `apps/web/src/components/home/` (HeroSection, FeaturesSection, PricingPreviewSection… — rebuild od zera w §4)
- `[A]` `apps/web/src/components/how-ai-works/`
- `[A]` `apps/web/src/components/oferta/`
- `[A]` `apps/web/src/components/order/` (jeśli diet-specific)
- `[A]` `apps/web/src/components/shared/CleanProductDetailDialog.tsx`, `MicronutrientSections.tsx`, `RecipeDetailSheet.tsx`, `SmartCtaLink.tsx` (?)
- `[A]` `apps/web/src/components/blog/` (jeśli istnieje — diet-specific)
- `[?]` `apps/web/src/components/admin/` — diet-specific komponenty usuwamy, zostają tylko UsersTable / SubscriptionsTable / OrdersTable / Stripe-related (osobna analiza)

### 2h. Frontend — public + data
- `[A]` `apps/web/public/blog/` (istniejące posty diet)
- `[A]` `apps/web/public/images/` (diet-related assets — do przejrzenia per file)
- `[A]` `apps/web/public/logo*.png`, `obrazek_z_logo.png` (e-dietetyk branding)
- `[A]` `apps/web/src/data/blog-posts.ts`
- `[A]` `apps/web/src/tours/` (DashboardTour / DietitianTour / PatientTour wizards)

### 2i. Database — modele (~60 do usunięcia)
`packages/database/prisma/schema.prisma`:
`[A]` wszystkie modele poza listą §1j:
`DietitianProfile` (zastępujemy Company-relations), `Interview`, `IngredientRepairLog`, `DietPlan`, `MealSwap`, `LabPanel`, `FoodCategory`, `FoodProduct`, `FoodBrand`, `FoodProductNutrients`, `FoodProductAllergen`, `FoodProductDietFlag`, `FoodProductAlias`, `FoodProductSourceMeta`, `HouseholdMeasure`, `Recipe`, `RecipeIngredient`, `RecipeInstructionStep`, `RecipeNutritionSnapshot`, `RecipeAllergen`, `RecipeDietFlag`, `RecipeRating`, `ShoppingListCheck`, `FavoriteMeal`, `IngredientSubstitutionRule`, `ImportJob`, `DataQualityIssue`, `ManualReviewQueue`, `NutritionTargets`, `FrequentInput`, `Meal`, `TemplatePlan`, `TemplateMeal`, `DietPlanRevision`, `CheckIn`, `SupplementPrescription`, `DietTemplate`, `DietitianNote`, `NoteTemplate`, `ClinicalRule`, `ClinicalRuleHistory`, `CleanProduct`, `CleanProductNutrients`, `CleanProductPortion`, `CleanProductAllergen`, `CleanProductDietFlag`, `CleanProductAminoAcids`, `CleanProductBioactives`, `NutritionProtocol`, `DietitianProtocolAccess`, `ProtocolTrigger`, `ProtocolConflict`, `DayRegeneration`, `BodyMeasurement`, `Conversation`, `Message`, `Tenant` (jeśli rezygnujemy z multi-tenancy)

**Enums do usunięcia/rebuild:**
`DietPlanSource`, `DietPlanStatus`, `DayRegenReason`, `ValidationStatus`, `MealType`, `DietType`, wszystkie Food-related enums

### 2j. Docs + scripts
- `[A]` `PRD-DietetykDEV.md` (root)
- `[A]` `docs/clinical-rules.md`, `dietitian-protein-caps-spec.md`, `dietitian-tester-welcome.md`, `food-database.md`, `patient-tester-welcome.md`, `dietitian-macro-distribution-spec.md`, `recipe-categorization-audit*.md`, `test-plan.md`, `pre-deploy-checklist.md`, `deploy-roadmap.md`, `migration-dev-to-prod.md`, `vps-setup.md`, `rodo-audit.md` (?)
- `[A]` `scripts/` — ~50 skryptów diet-specific (audit-*, fix-recipe-*, import-ciqual, fetch-off-poland, generate-solver-test-plans, gpt-extract-steps, gpt-normalize-ingredients, scrape-recipe-times, backfill-recipe-tags, migrate-interview-cuisines, recompute-dietflags, reclassify-uniwersalna, validate-recipe-tags, …)
- **zostają z scripts/:** `backup-database.ts`, `backup/`, `create-admin.ts`, ewentualnie `restore-database.ts`
- `[A]` `data/` (281 MB CIQUAL + audit files — gitignore, ale fizycznie na dysku)

### 2k. Top-level — do rewrite (nie kasuję, tylko clean content)
- `CLAUDE.md` — **rewrite od zera** pod bambooIT (osobne zadanie po cleanup)
- `DEPLOY.md` — clean z solver, dietetyk references
- `RULES.md` — clean z diet-specific rules
- `apps/backend/.env.example` — przyciąć (usunąć OPENAI, SOLVER_URL, n8n, PROMPT_VERSION, ENABLE_3_TUPLE_COMPOSITION etc.)

---

## 3) PRZEMIANOWUJEMY

> Te zmiany dotykają schematu Prisma, foreign keys, route paths, nazewnictwa w kodzie. **Pojedynczy commit per rename** (osobne migracje).

| Z DietetykDEV | Na bambooIT | Scope zmian |
|---|---|---|
| `Patient` (model) | `Company` | + relacja `User.companyId` (1:1 lub 1:N — pytanie §5) |
| `User.role = PATIENT` | `User.role = CLIENT` | enum `UserRole` |
| `User.role = DIETITIAN` | **usunięte** (§5) lub `SUPPORT`/`AGENT` | enum `UserRole` |
| `DietitianProfile` | **usunięte** lub `AgentProfile` (§5) | model |
| `dietitianId` (FK na Patient/Order/etc.) | `agentId`/`ownerId` lub usunięte | wszystkie FK |
| `patientId` (FK w Order, AuditLog, …) | `companyId` | wszystkie FK |
| `Subscription.patientId` | `Subscription.companyId` | FK |
| `Order.productType` enum (FREE_7/OPIEKA_*) | `START`/`FIRMA`/`FIRMA_PLUS` (+ legacy?) | enum `ProductType` |
| `routes/patient.routes.ts` | `routes/company.routes.ts` | + nowe URL: `/api/companies/*` |
| `app/[locale]/dashboard/` (po usunięciu starych) | `app/[locale]/panel/` lub `app/[locale]/klient/` | rebuild w §4 |

> User w spec wymienił też **MealPlan → ServicePackage**, **PatientAccount → ClientAccount** — w aktualnym schemacie nie ma modeli o tych nazwach (jest `DietPlan` i nie ma `PatientAccount`). Traktuję jako **kierunek koncepcyjny** dla §4 (`ServicePackage` to nowy model).

---

## 4) BUDUJEMY OD ZERA (po cleanup)

### 4a. Marketing — strony publiczne
- `app/[locale]/page.tsx` — homepage IT (hero, USP, social proof, CTA na audyt + na pakiety)
- `app/[locale]/pakiety/page.tsx` — porównanie START/FIRMA/FIRMA_PLUS (zastąpi `oferta/`)
- `app/[locale]/pomoc-zdalna/page.tsx` — landing
- `app/[locale]/branze/[slug]/page.tsx` — dynamiczne podstrony branżowe (kancelarie, biura rachunkowe, gabinety, …) — *uzgodnić listę branż*
- `app/[locale]/audyt/page.tsx` — formularz audytu (lead-gen)
- `components/home/HeroSection.tsx`, `PackagesSection.tsx`, `IndustriesSection.tsx`, `AuditCTA.tsx`, `TrustBadges.tsx`
- `components/pakiety/PackageCard.tsx`, `ComparisonTable.tsx`

### 4b. Schema Prisma — nowe modele
- `Company` (replaces Patient) — pola: `name`, `nip`, `regon`, `address`, `contactName`, `contactEmail`, `industry`, `employeeCount`, `notes`, …
- `ServicePackage` — definicje pakietów (START/FIRMA/FIRMA_PLUS) + features per tier
- `Ticket` (?) — jeśli wbudowany helpdesk
- `Invoice` (?) — proxy do Fakturowni albo lokalna mirror tabela
- `AuditFormSubmission` — leady z formularza audytu
- enum `Industry` — branże dla podstron
- enum nowy `ProductType`: `START`, `FIRMA`, `FIRMA_PLUS` (+ ewentualnie `ONE_TIME_AUDIT`, `EXTRA_HOURS`)

### 4c. Backend — nowe routes/controllers/services
- `routes/company.routes.ts` + `services/company.service.ts`
- `routes/audit.routes.ts` (form submissions) + service
- `routes/ai.routes.ts` (Claude API chat) + `services/claude.service.ts` — *reuse `aiUsage.service.ts` / `aiCost.service.ts` szkielet*
- `routes/fakturownia.routes.ts` (webhook) + `services/fakturownia.service.ts`
- przebudowa Stripe `ProductType` mapping pod nowe Price IDs

### 4d. Frontend — panel klienta
- `app/[locale]/panel/page.tsx` — dashboard firmy (status pakietu, użyte godziny, ticket list)
- `app/[locale]/panel/zgloszenia/` — ticket inbox
- `app/[locale]/panel/faktury/` — Fakturownia integration
- `app/[locale]/panel/chat/` — Claude AI helpdesk

### 4e. i18n nowe klucze
- `messages/pl.json` / `en.json` — sekcje `home`, `pakiety`, `branze`, `audyt`, `panel`, `tickets`, `invoices`, `chat`

### 4f. Brand
- `apps/web/config/brand.ts` — bambooIT name/domain/social
- `apps/web/public/` nowe logo + OG image + favicon

### 4g. Stripe — nowe Price IDs i mapowanie
- START — **390 zł netto/mies**
- FIRMA — **690 zł netto/mies**
- FIRMA_PLUS — **1190 zł netto/mies**
- (opcjonalnie) jednorazowy AUDIT, EXTRA_HOURS

---

## 5) PYTANIA OTWARTE (do uściślenia przed akceptacją)

1. **Rola sprzedawcy/agenta:** czy bambooIT ma rolę pośrednią (jak DIETITIAN była ownerem Patienta)? Czy tylko `ADMIN` + `CLIENT`?
   - Wpływ: czy zostawiamy szkielet `DietitianProfile` jako `AgentProfile`, czy kasujemy w całości.

2. **Multi-tenant:** czy zostawiamy `Tenant` model (na przyszłość B2B SaaS), czy kasujemy?
   - W DietetykDEV pole `tenantId` było nullable i nieaktywne — bezpiecznie skasować.

3. **Blog:** zostawiamy szkielet (model `Post` + `app/blog/`) na content marketing bambooIT? **Sugeruję TAK** — to wartościowa baza pod SEO.

4. **Testimonial:** zostawiamy? **Sugeruję TAK**.

5. **Referral system:** zostawiamy `ReferralCode`/`ReferralUsage`? **Sugeruję TAK** — mogą się przydać.

6. **`stats.routes.ts` / `dietitianAlerts` analog:** są pomysły na dashboard wewnętrzny (np. liczba aktywnych firm, MRR, churn)? Jeśli tak, sensowne zostawić `services/dietitianReport.service.ts` jako szkielet i przerobić.

7. **`AiCostLog` / `AiUsageLog`:** reusable pod tracking Claude API costs — potwierdzasz że zostawiamy?

8. **Język:** czy bambooIT też ma być PL+EN (next-intl)? Czy tylko PL? Wpływa na to czy zostawiamy całą warstwę i18n.

9. **`data/` (281 MB):** kasujemy bezwarunkowo? **Sugeruję TAK.**

10. **`PRD-DietetykDEV.md`:** kasujemy czy renamujemy na `PRD-bambooIT.md` jako baza pod nowy PRD? **Sugeruję rename + przepisanie treści w osobnej sesji.**

---

## 6) PROPONOWANA KOLEJNOŚĆ COMMITÓW

1. **chore(cleanup): remove apps/solver + data + diet docs** (już częściowo zrobione)
2. **chore(cleanup): drop diet-specific backend routes + controllers + services**
3. **chore(cleanup): drop scraper + policies + queues + pdf**
4. **chore(cleanup): drop diet frontend pages + components**
5. **chore(cleanup): drop diet Prisma models** (+ migracja `_drop_diet_models`)
6. **refactor: rename Patient → Company** (+ migracja)
7. **refactor: rename UserRole PATIENT → CLIENT, drop DIETITIAN** (+ migracja)
8. **refactor: replace ProductType enum (START/FIRMA/FIRMA_PLUS)** (+ migracja)
9. **chore: rewrite CLAUDE.md / DEPLOY.md / RULES.md + brand.ts for bambooIT**
10. **feat: scaffold new schema (Company, ServicePackage, Ticket, AuditFormSubmission)**
11. **feat: scaffold marketing pages + panel klienta**
12. **feat: Claude API chat service**
13. **feat: Fakturownia integration**
14. **feat: new Stripe Price IDs mapping**

Każdy krok testowalny osobno. Po kroku 5 backend i frontend powinny się dalej budować (`npm run build`), tylko z bardzo wąską funkcjonalnością (auth/order/subscription/blog).

---

## CZEKAM NA TWOJĄ DECYZJĘ

Odpowiedz:
- **"akceptuję"** → wykonuję kolejność z §6, krok po kroku, każdy w osobnym commicie
- **"akceptuję ze zmianami: [X, Y, Z]"** → naniosę zmiany i wrócę z poprawionym planem
- **"zatrzymaj, pytania §5 najpierw"** → odpowiadasz na §5 i wracam z v2 planu
