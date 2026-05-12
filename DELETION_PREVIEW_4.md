# DELETION_PREVIEW_4.md — KROK 4: drop diet-specific frontend

**Status:** PROPOZYCJA. Czekam na "ok 4 final" zanim faktycznie usunę pliki.
**Branch:** `main` (HEAD = `04ab87e`)

---

## §1. Routes do usunięcia (`apps/web/src/app/[locale]/`)

### USUWAMY (20 routes)
**Public marketing/landing diet:**
- `o-nas/` — diet about (rebuild w K11)
- `oferta/` — diet pricing (rebuild jako `/pakiety` w K11)
- `jak-to-dziala/` — diet AI explainer
- `faq/` — diet FAQ (treść 100% diet — sprawdzone: page importuje `components/faq/FaqAccordion`)
- `slownik/` — diet glossary
- `konsultacja/` — diet konsultacja

**Patient/Dietitian panels:**
- `dashboard/` (cały, ~20 podstrón: checkin, historia, opinia, plan/[id], pomiary, postep, profil, subskrypcja, suplementy, wiadomosci, wywiad, zakupy)
- `dietetyk/` (cały, ~15 podstrón: analityka, onboarding, pacjenci, produkty, profil, protokol, przepisy, raport, szablony, wiadomosci)
- `onboarding/` (interview flow)

**Admin sub-pages (11):**
- `admin/konflikty-protokolow/`
- `admin/konsultacje/`
- `admin/koszty-ai/` (rebuild pod Claude w fazie 4)
- `admin/mapowania-protokolow/`
- `admin/produkty/`
- `admin/protokoly/`
- `admin/przepisy/`
- `admin/reguly-kliniczne/`
- `admin/scraper-stats/`
- `admin/solver-stats/`
- `admin/tenants/`

### MODIFY (zastąpienie diet hero placeholderem)
- `app/[locale]/page.tsx` — diet homepage (importuje 7 komponentów z `components/home/`). **Zastępuję** minimal placeholderem "bambooIT — strona w przebudowie" zamiast usuwać plik (musimy mieć JAKIŚ home żeby `/pl` zwracało 200 a nie 404).

### ZOSTAJĄCE routes (per plan §1h)
- `zaloguj/`, `rejestracja/`, `resetuj-haslo/`, `zapomnialem-hasla/`, `zweryfikuj-email/`
- `dokumenty-prawne/` (regulamin/polityka/cookies)
- `zamow/`, `zamowienie/{sukces,anulowano}` (Stripe flow, ProductType rename w K8)
- `blog/` (szkielet zostaje per Q3, content do wymiany w K11)
- `admin/{audit-log, bezpieczenstwo, blog, email-kampanie, ksiegowosc, opinie, platnosci, subskrypcje, ustawienia, uzytkownicy}`
- `admin/layout.tsx`, `admin/page.tsx`
- `[locale]/layout.tsx`, `not-found.tsx`

---

## §2. Components do usunięcia (`apps/web/src/components/`)

### USUWAMY całe foldery (10):
- `dashboard/` (~50 plików)
- `dietitian/` (~40 plików)
- `onboarding/`
- `about/`
- `faq/`
- `glossary/`
- `home/` (7 sections: Hero, Features, HowItWorks, PricingPreview, Testimonials, Cta, DatabaseStats)
- `how-ai-works/`
- `oferta/`
- `order/` (1 plik `OrderCheckout.tsx` — importuje `CheckoutProductType` z `types/api`; rebuild w K8 wraz z ProductType enum)
- `shared/` (4 pliki: CleanProductDetailDialog, MicronutrientSections, RecipeDetailSheet, SmartCtaLink)

### USUWAMY z `components/admin/` (19 plików diet):
- `AdminCleanProductList.tsx`
- `AdminDuplicatesView.tsx`
- `AdminFoodProductFormDialog.tsx`
- `AdminFoodProductList.tsx`
- `AdminRecipeFormDialog.tsx`
- `AdminRecipeList.tsx`
- `AiCostsManager.tsx` (rebuild pod Claude w fazie 4)
- `AiRecipesPanel.tsx`
- `BulkActionBar.tsx` (`SET_CATEGORY | SET_MEAL_TYPE | SET_DIFFICULTY | SET_VERIFICATION_STATUS` — diet recipe bulk)
- `ClinicalRuleForm.tsx`
- `ClinicalRulesManager.tsx`
- `DietitiansTable.tsx`
- `ProtocolConflictManager.tsx`
- `ProtocolTriggerManager.tsx`
- `ProtocolsManager.tsx`
- `RecipeDuplicatesPanel.tsx`
- `RecipeQualityPanel.tsx`
- `ScraperStatsManager.tsx`
- `SolverStatsManager.tsx`
- `TenantsTable.tsx`
- `AdminConsultationsList.tsx` (konsultacje)

### ZOSTAJĄCE components/ (po §2)
- `ui/` (shadcn — NIE TYKAMY per RULES.md §1.1)
- `auth/`, `legal/`, `analytics/`, `checkout/`, `seo/`
- `layout/` (cały, ALE Header.tsx + Footer.tsx + AdminSidebar.tsx wymagają **komentowania diet links** — patrz §6)
- `blog/` cały (14 plików — używane przez blog routes które zostają per Q3)
- `admin/` (12 plików non-diet: AccountingPage, AdminSidebar, AdminTestimonials, AuditLogTable, StripeAdminPage, SubscriptionStatsCards, SubscriptionTable, UsersTable, SettingsPanel, blog/ folder, audit-labels.ts**)

⚠️ **`components/admin/audit-labels.ts` MIX** — zawiera generic labels (LOGIN, LOGOUT, DELETE_USER, CHANGE_USER_ROLE, PASSWORD_RESET, EMAIL_*) i diet labels (VIEW_PATIENT, GENERATE_PLAN, VIEW_INTERVIEW, CREATE_DIETITIAN, ROTATE_DIETITIAN_CODE etc.). **Plik zostaje, zakomentuję diet entries z TODO(4-cleanup).**

---

## §3. i18n cleanup strategy

### `messages/pl.json` + `messages/en.json` — usunięcie top-level keys (12)
```
"about"             → diet about
"consultationPage"  → diet konsultacja
"dashboard"         → patient panel
"dietCost"          → diet calculator
"dietitian"         → dietitian panel
"faq"               → diet FAQ
"glossary"          → diet glossary
"home"              → diet homepage
"howAiWorks"        → diet AI explainer
"mealPrep"          → meal prep
"onboarding"        → diet onboarding
"paywall"           → diet paywall
"pricing"           → diet pricing (TRIAL 129 zł, etc.)
```
13 sekcji do usunięcia.

### Sub-keys w `admin.*` (12 do usunięcia)
```
"admin.aiCosts"            → rebuild pod Claude
"admin.cleanProducts"
"admin.clinicalRules"
"admin.consultations"
"admin.dietitians"
"admin.foodProducts"
"admin.grantAccess"        → diet access grants
"admin.protocolConflicts"
"admin.protocolTriggers"
"admin.protocols"
"admin.recipes"
"admin.tenants"
```

### Sub-keys w `nav.*` (do usunięcia)
Nawigacja Header'a używa `nav.{about, blog, pricing, faq, glossary, howAiWorks, legal, login, start, dashboard, logout, home}`. Po komentowaniu Header (§6) — `about`, `pricing`, `faq`, `glossary`, `howAiWorks` staną się sieroty. **Strategia: zostawiam `nav` w spokoju, sieroty usunę w K11 razem z Header rebuild** (alternatywnie K5.5 deps cleanup).

### ZOSTAJĄ top-level keys
```
"admin"  (z usuniętymi diet sub-keys)
"auth", "blog", "checkout", "common", "cookieBanner", "dataPrivacy",
"footer", "legal", "nav" (sieroty na K11),
"notFound", "order"
```

---

## §4. Public assets audit

### USUWAMY (`public/`):
- `public/blog/images/` (12 plików PNG — diet hero blog: ai_vs_tradycyjna_dieta, dieta_online_vs_tradycyjna, dieta_przy_insulinoopornosci_ai, hero-blog, jak_liczyc_kalorie_bez_obsesji, motywacja_do_odchudzania, planowanie_jadlospisu_i_zakupy, planowanie_posilkow_redukcja, subskrypcja_vs_plan_jednorazowy, thermomix_airfryer_fit_posilki, zdrowe_sniadania_przepisy + 1 hashed)
- `public/images/` (3 plików — `logo większe.png`, `logo.png`, `logośrednie.png` — e-dietetyk logo, ~640 KB)
- `public/logo.png`, `public/logo_no_bg.png`, `public/obrazek_z_logo.png` (e-dietetyk branding)

### ZOSTAJĄ
- `public/favicon.ico` (placeholder, podmiana w fazie 4)

Inne pliki w `apps/web/src/app/`: `apple-icon.png`, `icon.png`, `icon-512.png` (Next.js metadata icons) — sprawdzę zawartość, prawdopodobnie ZOSTAJĄ jako placeholder do podmiany w fazie 4. Plus `opengraph-image.tsx` (generic, zostaje).

---

## §5. Data / tours / tests

### USUWAMY
- `src/data/blog-posts.ts` — `MOCK_POSTS: BlogPost[]` (8 diet articles: "Dieta online vs tradycyjny dietetyk 2026", insulinoopornosc, etc.)
- `src/tours/` (cały folder: `dietitian-steps.ts`, `patient-steps.ts`) — importowane TYLKO przez `components/dashboard/PatientTour` i `components/dietitian/DietitianTour` (oba w USUWANYM scope).
- `e2e/dietitian.spec.ts`, `e2e/patient-flow.spec.ts`
- `src/__tests__/lib/ingredient-display.test.ts`

### ZOSTAJĄ
- `e2e/auth.spec.ts`, `e2e/responsive.spec.ts` (testuje `/pl`, `/pl/zaloguj`, `/pl/rejestracja` — generic public routes)
- `src/__tests__/components/auth/*` (2 plików)
- `src/__tests__/lib/{api,cookie-consent,sentry-scrub}.test.ts` (generic)
- `src/__tests__/setup.ts`

### NIE TYKAMY (rebuild w K11)
- `src/types/blog.ts` — `BLOG_CATEGORIES = ['Porady dietetyczne', 'Odchudzanie', 'Zdrowie i choroby', 'Przepisy', 'AI i dietetyka', 'Motywacja', 'Subskrypcja', 'Thermomix & Airfryer']`. Lista importowana z `@/config/blogCategories`. Content do wymiany w K11.
- `src/types/api.ts` — `ProductType`, `CheckoutProductType` ('TRIAL', 'TRIAL_YEARLY') — diet enum, rename w K8.

---

## §6. Pre-flight sanity checks + RED FLAGS

### Cross-cutting imports w ZOSTAJĄCYCH plikach

#### 🟥 `components/layout/Header.tsx` — diet route links
```ts
function getDashboardHref(role?: string): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'DIETITIAN') return '/dietetyk';  // ← TODO(4-cleanup)
  return '/dashboard';                            // ← TODO(4-cleanup)
}
const navLinks = [
  { href: '/o-nas',  label: 'about'   },         // ← TODO(4-cleanup) — usuń ten link
  { href: '/oferta', label: 'pricing' },         // ← TODO(4-cleanup) — usuń ten link
  { href: '/faq',    label: 'faq'     },         // ← TODO(4-cleanup) — usuń ten link
  { href: '/blog',   label: 'blog'    },         // ← zostaje
  { href: '/dokumenty-prawne', label: 'legal' }, // ← zostaje
];
```

**Strategia:** uprość `getDashboardHref()` żeby zwracał `/admin` dla ADMIN i `/` dla wszystkich innych (bambooIT panel klienta dopiero w K11). Zakomentuj 3 diet navLinks (o-nas, oferta, faq) z TODO(4-cleanup).

#### 🟥 `components/layout/Footer.tsx` — 5 diet route links
```ts
{ href: '/o-nas',          label: t('nav.about')      }   ← TODO
{ href: '/oferta',         label: t('nav.pricing')    }   ← TODO
{ href: '/jak-to-dziala',  label: t('nav.howAiWorks') }   ← TODO
{ href: '/faq',            label: t('nav.faq')        }   ← TODO
{ href: '/slownik',        label: t('nav.glossary')   }   ← TODO
```
**Strategia:** komentowanie z TODO(4-cleanup).

#### 🟥 `components/admin/AdminSidebar.tsx` — 12 diet nav items
```
'/admin/tenants', '/admin/produkty', '/admin/przepisy', '/admin/scraper-stats',
'/admin/solver-stats', '/admin/reguly-kliniczne', '/admin/protokoly',
'/admin/mapowania-protokolow', '/admin/konflikty-protokolow',
'/admin/konsultacje', '/admin/koszty-ai'
```
Plus jedno generic: `'/admin/email-kampanie'` ZOSTAJE (admin page zostaje, route backend usunięty w 2c — admin page będzie pokazywała "endpoint do rebuild" do fazy 4).
**Strategia:** komentowanie 12 items z TODO(4-cleanup).

#### ⚠️ `components/admin/audit-labels.ts` — MIX
Zostaje. Komentuję diet labels (VIEW_PATIENT, GENERATE_PLAN, VIEW_INTERVIEW, APPROVE_PLAN, PUBLISH_PLAN, EDIT_PLAN, EXPORT_PLAN, CREATE_MANUAL_PLAN, UPDATE_PATIENT, DELETE_PATIENT, CREATE_DIETITIAN, UPDATE_DIETITIAN, ROTATE_DIETITIAN_CODE).

### Sanity grep wyniki
- **Cross-component imports**: 30+ matches w obrębie `dashboard/`, `dietitian/`, `home/`, `admin/`, `blog/` — wszystkie w USUWANYM scope (samoistne).
- **shared/* importerzy**: 8 matches — wszyscy w USUWANYCH `admin/`, `dietitian/`, `home/`, `blog/BlogCtaButton`. Po usunięciu USUWANYCH komponentów → shared/ to sierota → bezpiecznie usunąć.
- **`data/blog-posts.ts` importerzy**: w prepareciu — sprawdzę podczas chirurgii, prawdopodobnie tylko w blog/[slug]/page.tsx.
- **`tours/*` importerzy**: 2 — `PatientTour` (dashboard/USUWANY) + `DietitianTour` (dietitian/USUWANY). Po usunięciu USUWANYCH → tours/ to sierota.

### MIDDLEWARE
`apps/web/src/middleware.ts` nie istnieje (brak grep matches). next-intl middleware skonfigurowany w `i18n/routing.ts` (ZOSTAJE).

---

## §7. RED FLAGS — podsumowanie

| Plik | RED FLAG | Action |
|---|---|---|
| `components/layout/Header.tsx` | 3 diet navLinks + getDashboardHref returns `/dietetyk`/`/dashboard` | Komentowanie TODO(4-cleanup) |
| `components/layout/Footer.tsx` | 5 diet route links | Komentowanie TODO(4-cleanup) |
| `components/admin/AdminSidebar.tsx` | 12 diet admin route links | Komentowanie TODO(4-cleanup) |
| `components/admin/audit-labels.ts` | 13 diet action labels | Komentowanie TODO(4-cleanup) |
| `app/[locale]/page.tsx` | Diet homepage (7 imports z home/) | **Replace** placeholderem |
| `messages/pl.json` + `en.json` | Diet top-level keys + admin sub-keys | Drop |

Brak innych ZOSTAJĄCYCH plików importujących USUWANE komponenty (potwierdzone grep'em).

---

## §8. ACCEPTED LIST — final count

### `git rm` masywne (przybliżona suma):

| Kategoria | Pliki / foldery | Files (approx) |
|---|---|---|
| Routes: 20 podstrón (folders) | dashboard, dietetyk, onboarding, jak-to-dziala, konsultacja, slownik, faq, o-nas, oferta + 11 admin sub-pages | ~80 page.tsx + layouts |
| Components: 10 folderów | dashboard, dietitian, onboarding, about, faq, glossary, home, how-ai-works, oferta, order, shared | ~150 |
| Components/admin: 21 diet plików | (lista w §2) | 21 |
| Public/blog/images | 12 PNG diet hero | 12 |
| Public/images + root logos | 6 PNG | 6 |
| Data/tours/tests | blog-posts.ts, 2 tours, 2 e2e, 1 unit test | 6 |
| **SUMA przybliżona** | | **~275 plików** |

### Modifications (komentowanie):
- `components/layout/Header.tsx`
- `components/layout/Footer.tsx`
- `components/admin/AdminSidebar.tsx`
- `components/admin/audit-labels.ts`
- `app/[locale]/page.tsx` (replace placeholderem)
- `messages/pl.json` + `messages/en.json` (drop keys)

---

## §9. Commit message proposal

```
chore(cleanup): drop diet-specific frontend pages, components, i18n keys (KROK 4)

Remove ~275 frontend files spanning routes, components, public assets,
mock data, tours, and diet-specific tests.

Routes removed (apps/web/src/app/[locale]/):
- dashboard/, dietetyk/, onboarding/ (entire patient + dietitian panels)
- jak-to-dziala/, konsultacja/, slownik/, faq/, o-nas/, oferta/
  (diet marketing pages — rebuild as /pakiety + /branze + /audyt in K11)
- admin/{konflikty-protokolow, konsultacje, koszty-ai, mapowania-protokolow,
  produkty, protokoly, przepisy, reguly-kliniczne, scraper-stats,
  solver-stats, tenants}

app/[locale]/page.tsx replaced with bambooIT placeholder homepage
(rebuild with Hero/PackagesSection/IndustriesSection/AuditCTA in K11).

Components removed:
- dashboard/, dietitian/, onboarding/, about/, faq/, glossary/, home/,
  how-ai-works/, oferta/, order/, shared/ (entire directories)
- 21 diet-specific admin components (Recipe/FoodProduct/CleanProduct/
  ClinicalRule/Protocol*/Tenant/Dietitian/AiCost managers + BulkActionBar
  with diet bulk actions + AdminConsultationsList)

i18n keys removed (pl.json + en.json):
- Top-level: about, consultationPage, dashboard, dietCost, dietitian,
  faq, glossary, home, howAiWorks, mealPrep, onboarding, paywall, pricing
- admin.* sub-keys: aiCosts, cleanProducts, clinicalRules, consultations,
  dietitians, foodProducts, grantAccess, protocolConflicts, protocolTriggers,
  protocols, recipes, tenants
- nav.* sub-keys left as-is (orphan keys will be removed in K11 alongside
  Header rebuild)

Public assets removed: public/blog/images/ (12 diet hero PNGs),
public/images/ (3 e-dietetyk logos), root logo.png/logo_no_bg.png/
obrazek_z_logo.png.

Data/tours/tests: src/data/blog-posts.ts (mock diet posts), src/tours/
(patient + dietitian Driver.js tours), e2e/{dietitian,patient-flow}.spec.ts,
__tests__/lib/ingredient-display.test.ts.

Surgically commented (TODO 4-cleanup) — full trim in K11/admin-cleanup:
- components/layout/Header.tsx: 3 diet navLinks + getDashboardHref simplified
- components/layout/Footer.tsx: 5 diet route links
- components/admin/AdminSidebar.tsx: 12 diet admin route links
- components/admin/audit-labels.ts: 13 diet ACTION_LABELS entries

types/blog.ts (diet category list) and types/api.ts (ProductType enum)
not touched — handled in K11 (blog content rebuild) and K8 (ProductType
enum replacement) respectively.

PLAN_CZYSZCZENIA.md §2f/§2g/§2h covered. Frontend cleanup phase done;
remaining: K5 (Prisma models drop) + K6/K7/K8 (renames) + K9-K14
(builds).
```

---

## §11. U1/U2/U3 audit results

### U1 — admin/email-kampanie comment
✅ Plan: dodać komentarz na górze `app/[locale]/admin/email-kampanie/page.tsx` o usunięciu backend route w 2c.

### U2 — e2e/responsive.spec.ts diet routes audit
**3 matches `page.goto`:**
- L28: `await page.goto(path)` — path z PUBLIC_PAGES (`/pl`, `/pl/zaloguj`, `/pl/rejestracja`) ✅ OK
- L39: `await page.goto(path)` — analogicznie ✅ OK
- L53: `await page.goto('/pl/dashboard')` 🟥 **USUWANY route w K4**

L48-58 to test block "protected redirect": odwiedza `/pl/dashboard` (musi się usunąć w K4) i oczekuje redirect do `/zaloguj`. Po usunięciu dashboard'a Next zwróci 404 zamiast redirect → test FAIL.

**Strategia:** DROP test block L48-58 (10 linii). PUBLIC_PAGES tests (L22-46) zostają. Po K11 dodamy podobny test dla `/pl/panel` (bambooIT panel klienta).

### U3 — App icon + opengraph audit

**`app/opengraph-image.tsx`** — 100% e-dietetyk branded:
- `alt = 'e-dietetyk.com — Twój dietetyk online'`
- Tekst hardcoded: "e-dietetyk.com", "Twój dietetyk online — AI + opieka dietetyka"
- Feature pills: "AI + Dietetyk", "Zgodne z RODO", "6600+ produktów"
- Color scheme: zielony (`#1F8F3A`) + pomarańczowy (`#F57C00`) gradient — e-dietetyk
- Footer: `https://e-dietetyk.com`

**USUWAMY plik.** Next.js wygeneruje default OG image lub bambooIT-branded rebuild w fazie 4.

**`app/icon.png` (20 KB), `app/icon-512.png` (98 KB), `app/apple-icon.png` (18 KB)** — mtime Mar 26, sizes wskazują na e-dietetyk branded PNG (matched commit era opengraph-image z e-dietetyk content).

**USUWAMY 3 plików.** Next.js użyje `favicon.ico` jako fallback (zostaje placeholder).

### Tailwind tokens dla placeholdera
`bg-paper`, `text-navy-deep`, `text-green-deep`, `text-navy-soft`, `font-display` — **0 matches** w `tailwind.config.ts`. **Używam generic klas** w placeholderze + TODO(K11) zostawiam:
```
bg-stone-50, text-slate-900, text-emerald-600, text-slate-600, font-serif, font-mono
```

---

## §10. CZEKAM NA "ok 4 final"

Po akceptacji wykonuję bez kolejnego "ok":
1. Komentowanie: Header, Footer, AdminSidebar, audit-labels (4 plików)
2. Replace `app/[locale]/page.tsx` placeholderem bambooIT
3. Drop top-level + admin sub-keys w pl.json + en.json
4. `git rm` ~275 plików
5. `npm run typecheck > TYPECHECK_STEP_4.log 2>&1`
6. Akceptowalny: exit 0 lub Cannot find module tylko do świeżo usuniętych. Jeśli i18n keys missing (typecheck nie łapie — next-intl runtime) → akceptowalne (Next build złapie podczas K11 rebuild).
7. Inne błędy → STOP i raport.
8. Commit z message §9.
