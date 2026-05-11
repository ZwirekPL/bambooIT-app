PRD – e-dietetyk.com (DietetykDEV) v2.0
Typ: Hybrid (Biznes + Techniczne)
Status: Produkcja — DB-first diet generation + AI fallback
Ostatnia aktualizacja: 2026-03-24

## 1. Przegląd Projektu

### 1.1 Cel Produktu

e-dietetyk.com to profesjonalna platforma SaaS dla dietetyków i pacjentów, umożliwiająca:

- zbieranie wywiadu żywieniowego online (50+ pytań, szyfrowane),
- **deterministyczne generowanie planów dietetycznych z bazy przepisów** (DB-first) z AI jako fallback,
- automatyczne dopasowanie protokołów klinicznych (85 POLICY + 16 RED_FLAG reguł),
- manualną korektę, zatwierdzanie i publikację planów przez dietetyka,
- sprzedaż planów i subskrypcji (Stripe, polskie prawa konsumenta),
- cotygodniowe check-iny pacjentów z auto-adaptacją planów,
- bezpieczne przechowywanie danych medycznych (AES-256-GCM, RODO Art. 9).

### 1.2 Problem Biznesowy

- Dietetycy tracą czas na ręczne tworzenie planów (2-4h per plan).
- W pełni automatyczne generatory AI nie gwarantują spełnienia constraintów klinicznych.
- Brak polskiej platformy łączącej bazę kliniczną, obliczenia żywieniowe i AI w jednym narzędziu.
- Brak kontroli nad danymi medycznymi pacjentów przy korzystaniu z marketplace/Excela.

### 1.3 Wartość Biznesowa

- **DB-first generation**: ~0 zł/plan (vs ~0.50 zł z AI), <2s (vs ~30s), deterministyczne i audytowalne.
- Automatyzacja: wywiad → cele → protokoły → constrainty → scoring → montaż → walidacja → review.
- Clinical Policy Engine: 101 reguł klinicznych w DB, auto-matching z wywiadu, conflict detection.
- Polska baza żywnościowa: 6600+ produktów z 50+ nutrientami, 14 EU alergenów, 20+ diet flags.
- Baza przepisów: 3000+ zweryfikowanych przepisów z retention factors i nutrition snapshots.
- Model B2C z compliance: Stripe, 14-dniowe prawo odstąpienia, RODO, szyfrowanie danych zdrowotnych.

## 2. Użytkownicy (Persony)

### 2.1 Pacjent
Wiek: 20–50 lat. Potrzeby:
- Szybki wywiad online z automatycznym planem diety.
- Dashboard: plan na dziś, lista zakupów, check-iny, postęp, zamiana posiłków.
- Bezpieczeństwo danych medycznych, PDF planu, historia planów.
- Zarządzanie subskrypcją (anulowanie, odstąpienie 14d).

### 2.2 Dietetyk
Potrzeby:
- Panel pacjentów z alertami, przegląd wywiadów i planów.
- Edycja planów (visual editor, drag & drop), zatwierdzanie, publikacja.
- Raporty (PDF, progress, mikroelementy), notatki, szablony.
- Zarządzanie przepisami i produktami.

### 2.3 ADMIN (Właściciel platformy)
Potrzeby:
- Zarządzanie użytkownikami, dietetykami, subskrypcjami.
- Panel reguł klinicznych, protokołów żywieniowych, trigger/conflict mapping.
- Zarządzanie bazą produktów i przepisów (import USDA, quality pipeline).
- Stripe admin, księgowość, koszty AI, audit log, bezpieczeństwo.
- Blog CMS, opinie, feature flags, ustawienia systemowe.

## 3. Model Biznesowy

### 3.1 Kto płaci?
Płaci pacjent. Dietetyk korzysta z platformy bezpłatnie.

### 3.2 Produkty

| Produkt | Cena | Opis |
|---------|------|------|
| FREE_7 | 0 zł (trial 7 dni) | Pierwszy plan + ograniczone funkcje |
| OPIEKA_MIESIECZNA | 129 zł/mies | Pełna opieka, plany, check-iny |
| OPIEKA_ROCZNA | 99 zł/mies | Jak miesięczna, rabat roczny |
| PLAN_2W | jednorazowo | Plan 14-dniowy |
| PLAN_4W | jednorazowo | Plan 28-dniowy |
| CONSULTATION | 399 zł | Konsultacja z dietetykiem |

Płatności: Stripe Checkout + Customer Portal. Trial fingerprinting (zapobieganie nadużyciom).

### 3.3 Izolacja danych
Pacjent→Dietetyk przez `Patient.dietitianId`. JWT z `sub/email/role/patientId`.
DIETITIAN widzi tylko swoich pacjentów (`patient.dietitianId == req.user.sub`).

## 4. Architektura generowania diet (DB-first)

### 4.1 Pipeline (aktualny stan)

```
Interview → PolicyBridge → MealDistribution → RecipeCandidate (9 filters + 7 sub-scores)
→ DbPlanAssembly (greedy + C2 rules) → RecipeScaler (5 iter, <3% dev)
→ PlanValidation (kcal ±5%, makra ±10%) → PostProcessing (rounding, shopping list)
→ AI fallback TYLKO gdy pokrycie < 80%
```

### 4.2 Tryby generowania (Feature Flag)

| Tryb | Opis |
|------|------|
| DB_ONLY | Tylko baza, bez AI fallback |
| DB_FIRST | Baza → AI fallback jeśli coverage < 80% (domyślny) |
| AB_TEST | 50/50 losowo DB vs AI (do testów jakości) |
| OFF | Tylko AI (legacy) |

### 4.3 Scoring przepisów (recipeCandidate.service)

7 sub-scores z wagami (suma = 1.0):

| Sub-score | Waga | Opis |
|-----------|------|------|
| nutritionFit | 0.40 | Odchylenie od targetu makro + kcal |
| quality | 0.15 | qualityScore przepisu z DB |
| patientRating | 0.15 | Oceny pacjenta × 20 |
| cuisine | 0.10 | Penalty za powtórzenie kuchni |
| diversity | 0.10 | Bonus za nową grupę/kategorię |
| season | 0.05 | Sezonowość (aktualny miesiąc) |
| cost | 0.05 | Budget tier bonus |

### 4.4 Zasady dietetyczne (C2 rules w assembly)

| Reguła | Penalty/Bonus | Opis |
|--------|--------------|------|
| C2.2 Weekly caps | -30 | Max 2 owsianki, 2 sałatki/tydzień |
| C2.4 Protein rotation | -20 | Nie to samo białko 2 dni z rzędu |
| C2.6 Light dinner | -15 | Kolacja ≤ 85% kcal obiadu |
| C2.7 Breakfast protein | -25 | Śniadanie ≥ 15% protein by kcal |
| C2.9 No pure-carb | -20 | Min 10% protein per posiłek |
| Same recipe/week | -80 | Unikaj powtórek |
| Similar name/day | -50 | Unikaj podobnych nazw w dniu |
| Whole grains | +5 | Pełnoziarniste |
| High fiber | +5 | Błonnik > 8g/porcja |

### 4.5 Walidacja planu

| Tolerancja | Zakres | Status |
|-----------|--------|--------|
| kcal | ±5% | VALID |
| kcal | ±20% | NEEDS_ADJUST (auto-scale) |
| kcal | >20% | NEEDS_REPAIR_AI |
| makra (P/F/C) | ±10% | VALID |
| hard floor | <1000 kcal | BLOCK (chyba że VLCD) |

### 4.6 AI jako fallback (nie jako mózg)

AI (GPT-4.1) wchodzi TYLKO gdy:
- DB coverage < 80% (za mało pasujących przepisów w bazie)
- Fallback chain: gpt-4.1 → gpt-4o → gpt-4.1-mini
- Prompt V3 (default) z few-shot, kcal table, zasady dietetyczne
- Koszt per plan AI: ~0.50 zł, tracking w AiCostLog

### 4.7 Planowane ulepszenia pipeline

| Faza | Opis | Status |
|------|------|--------|
| 72 | Per-slot reason codes (audytowalność decyzji) | Planowane |
| 73 | Nowe sub-scores: microFit, practicalFit, satietyProxy | Planowane |
| 74 | Miękkie walidacje: warzywa ≥400g, sód <2000mg, nasycone <10% | Planowane |
| 75 | Solver CP-SAT (globalnie optymalny dobór, nie greedy) | Planowane |

## 5. Clinical Policy Engine

### 5.1 Reguły kliniczne
- 85 POLICY rules + 16 RED_FLAG rules w DB (model ClinicalRule).
- Severity: CRITICAL → HIGH → MEDIUM → LOW.
- CRITICAL → MANUAL_REVIEW_REQUIRED (blokuje automatyczną publikację).
- ClinicalRuleHistory — audit trail zmian reguł.

### 5.2 Protokoły żywieniowe
- NutritionProtocol z scope GLOBAL/DIETITIAN-specific.
- ProtocolTrigger — auto-matching (interviewField=value → protocolId).
- ProtocolConflict — wykrywanie i rozwiązywanie konfliktów.
- ProtocolMerger — łączenie wielu protokołów.

### 5.3 Policy Bridge (DB-first)
Tłumaczenie reguł klinicznych na constrainty algorytmu:
- ExcludeProductsEffect → excludeAllergens, requiredDietFlags (hard filter)
- NutrientLimitEffect → nutrientLimits (walidacja post-hoc)
- MealDistributionEffect → mealDistributions (per-meal caps)
- ClinicalNoteEffect → clinicalNotes (metadata dla dietetyka)

## 6. Baza żywnościowa

### 6.1 Produkty (6600+)
- 12 kategorii polskich, hierarchiczna taksonomia (FoodCategory parent-child)
- 50+ nutrientów per 100g (makro + mikro + aminokwasy + kwasy tłuszczowe)
- 14 EU alergenów (FoodProductAllergen), 20+ diet flags
- Household measures (łyżka, szklanka, sztuka + gramatura)
- Źródła: ilewazy.pl, USDA FDC, OpenFoodFacts, manual
- Quality pipeline: DataQualityIssue + ManualReviewQueue

### 6.2 Przepisy (3000+ zweryfikowanych)
- Pełne składniki z gramaturami, instrukcje krok po kroku
- RecipeNutritionSnapshot per serving (makro + 40 mikro)
- Retention factors (utrata nutrientów przy gotowaniu)
- Allergen/diet flag computation z ingredientów
- Sezonowość, meal prep friendly, difficulty, cost estimate
- Recipe ratings (1-5, od pacjentów)
- Filtr: TYLKO source IN ('imported', 'manual') — nigdy AI-generated

## 7. Role i Uprawnienia

### 7.1 ADMIN
250+ endpoint operacji: users, dietitians, food products, recipes, clinical rules,
protocols, triggers, conflicts, Stripe, accounting, AI costs, security, audit logs,
blog, testimonials, feature flags, app settings.

### 7.2 DIETITIAN
Pacjenci, wywiady, plany diet (create/edit/approve/publish), raporty PDF,
notatki, szablony, drag & drop edytor, produkty, przepisy, protokoły.

### 7.3 PATIENT
Dashboard (plan na dziś, check-in, postęp, zakupy, subskrypcja),
wypełnienie wywiadu, przeglądanie planów, zamiana posiłków, regeneracja dnia,
oceny przepisów, profil, opinie.

## 8. Security Layer

### 8.1 Encryption at Rest (AES-256-GCM)
- Interview.answers, Interview.medicalFlags
- DietPlan.content, DietPlanRevision.contentJson
- DietTemplate.content

### 8.2 Auth & Access Control
- JWT (HS256, 7 dni), NextAuth v5 Credentials provider
- RBAC: ADMIN / DIETITIAN / PATIENT
- Rate limiting (login, auth, password reset, PDF export)
- CORS restricted

### 8.3 Anti-abuse
- Device fingerprinting (FingerprintJS)
- Trial fingerprinting (card reuse prevention)
- IP/subnet/fingerprint bans (SecurityBan)
- Security monitoring + alerts

### 8.4 GDPR / RODO
- UserConsent (health data, AI disclaimer, email, terms, privacy, cookies)
- DSAR (Data Subject Access Request) support
- Soft delete (User, Tenant) with restore
- AuditLog (login, interview view, plan gen, approval, export, delete)
- PII sanitization — never log raw medical data

## 9. Compliance (PL)

- Prawo konsumenta: 14-dniowe prawo odstąpienia od umowy
- RODO Art. 9: dane zdrowotne jako szczególna kategoria — szyfrowanie, RBAC, audit
- Eksport danych, soft delete, log dostępu, obsługa żądań usunięcia

## 10. Architektura Techniczna

### 10.1 Stack

| Warstwa | Technologia |
|---------|-------------|
| Backend | Node.js, Express.js, TypeScript 5.4 |
| ORM | Prisma 6.19, PostgreSQL 15 |
| Cache/Queues | Redis 7, BullMQ (3 kolejki: diet-generate, diet-repair, diet-partial) |
| Frontend | Next.js 15.5.12, React, Tailwind CSS, shadcn/ui |
| i18n | next-intl 3.26 (PL default, EN) |
| Auth | NextAuth v5 (BFF) + JWT HS256 (API) |
| Payments | Stripe SDK v20 |
| AI (fallback) | OpenAI API (GPT-4.1, fallback: gpt-4o, gpt-4.1-mini) |
| Email | Nodemailer |
| Validation | Zod |

### 10.2 Monorepo

```
DietetykDEV/
├── apps/
│   ├── backend/       # Express.js API — port 4000
│   └── web/           # Next.js 15 frontend — port 3000
└── packages/
    └── database/      # Prisma ORM singleton, shared
```

### 10.3 Backend architecture

```
src/routes/ → controllers/ → services/ → middleware/ → utils/ → types/
```
- 30 route files, 47 controllers, 90+ services
- Kontrolery: Zod validation + service call
- Services: business logic + Prisma (AppError)
- Encryption: AES-256-GCM for medical data

### 10.4 Produkcja
- VPS Hostinger KVM 2, IP 31.97.75.190
- Domena: e-dietetyk.com
- Deploy: `git pull && docker compose up -d --build && restart nginx`

## 11. Definition of Done (Current State)

MVP ukończone i w produkcji. Aktualny stan:

- [x] Auth (JWT + NextAuth v5 + RBAC)
- [x] Wywiad online (CORE/PRO, szyfrowane)
- [x] DB-first diet generation z AI fallback
- [x] Clinical Policy Engine (85 POLICY + 16 RED_FLAG)
- [x] Protokoły żywieniowe (auto-matching, conflicts, merger)
- [x] Baza produktów (6600+) z quality pipeline
- [x] Baza przepisów (3000+) z nutrition snapshots
- [x] Panel dietetyka (pacjenci, plany, edycja, zatwierdzanie)
- [x] Panel pacjenta (dashboard, check-in, zakupy, postęp)
- [x] Panel admina (250+ operacji)
- [x] Stripe (checkout, subskrypcje, portal, faktury, 14d odstąpienie)
- [x] PDF export (plany, zakupy, raporty)
- [x] Audit log + GDPR consent + szyfrowanie
- [x] Blog CMS (PL/EN, SEO)
- [x] Feature flags, anti-abuse, security monitoring
- [x] i18n (PL/EN)
- [x] Docker dev (PostgreSQL, Redis)
- [x] Produkcja (VPS, nginx, e-dietetyk.com)
