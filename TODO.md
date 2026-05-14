# TODO.md — bambooIT operating manual + faza 4 build roadmap

> **Status:** Active operating manual for Wirgiliusz + Claude Code collaboration
> **Phase:** Faza 4 (build phase) — post-cleanup, pre-launch
> **Authored:** 2026-05-13 (after CLEANUP_COMPLETE.md commit `6a07e68`)
> **Target MVP launch:** 5-7 tygodni od start (target 6, realistic 7)
> **Pierwszy klient:** outreach via Remigiusz + SEO foundation organic
> **Updated:** żywy dokument, edytujemy w trakcie pracy

---

## §1. North Star — co budujemy i dla kogo

**Cel:** Działająca platforma bambooIT która:
1. **Reklamuje usługi** — marketing site, SEO foundation, blog content
2. **Obsługuje klientów** — od pierwszego kontaktu (audit form) przez płatność (Stripe Checkout) do dostarczenia usługi (subscription management)

**Target klient:**
- Polskie SMB 1-30 osób
- Sektory priorytetowe: biura rachunkowe, kancelarie prawne, gabinety lekarskie/medyczne, salony usługowe, małe produkcje
- Geo: Wrocław + Polska zdalnie
- Pain point: za małe na agencję IT (zbyt drogie), za duże na "kuzyn IT" (zbyt nieprofesjonalne)

**Value proposition (z PRD):**
> "Po drugiej stronie siedzi konkretny człowiek. Nie infolinia, nie korporacja."

**Pricing (per D-007):**
- START: 390 zł netto/mies — do 3 stanowisk, 2h wsparcia
- FIRMA: 690 zł netto/mies — do 7 stanowisk, 5h wsparcia (flagship)
- FIRMA_PLUS: 1190 zł netto/mies — 8-15 stanowisk, 10h wsparcia
- Enterprise: indywidualnie poza ProductType enum

**Cross-sell (faza 5):** strony internetowe, aplikacje na zamówienie, automatyzacje — quote-on-demand, manual Fakturownia.

---

## §2. Decyzje strategiczne — sesja TODO.md (D-041 → D-068)

28 nowych decyzji wynikających z dzisiejszej sesji planning. Zaznaczam główne — pełna lista w `DECISION_LOG.md` (Claude Code dorzuci po commit tego pliku).

### Top-level decisions

- **D-041** — MVP deadline: **6 tygodni (target) / 7 tygodni (realistic)** od start fazy 4
- **D-042** — Lead-gen mix: outreach Remigiusza (primary) + SEO foundation (secondary) + ads później (faza 5)
- **D-043** — Marketing site scope MVP: **full** — homepage + /pakiety + /audyt + /kontakt + /pomoc-zdalna + /o-nas + /branze/* + blog
- **D-044** — Lead forms: **dual mechanism** — audit form (szczegółowy) + contact form (quick)
- **D-045** — Stripe Checkout: **automatic w MVP**, klient kupuje sam bez ręcznej interwencji
- **D-046** — ChatWidget: **fake button w MVP** ("Zostaw wiadomość" → opens contact form), real AI w faza 5
- **D-047** — CC autonomy: **maksymalna** — sam dla wszystkiego w PRD/CLAUDE.md scope, pyta tylko spoza
- **D-048** — Atomic commits per task (faza 4 zachowuje cleanup philosophy)
- **D-049** — Process per task type:
  - drobne (< 100 LOC, 1 plik) → CC działa od razu
  - średnie (1 feature, < 500 LOC, multi-file) → plan w wiadomości, Ty approve, CC implementuje
  - duże (architecture/schema/external API) → `PLAN_*.md`, Ty review przez gates, CC implementuje
- **D-050** — Quality gates: każdy commit ma typecheck + build + tests exit 0
- **D-051** — Konta external: ja zakładam Stripe + Fakturownia + Resend + Sentry w tygodniu 1, CC integruje w tygodniach 2-4 parallel
- **D-052** — Domena bambooit.pl zarejestrowana i moja
- **D-053** — VPS: e-dietetyk.com VPS + dodanie bambooit obok (Nginx reverse proxy, separate DB/port)
- **D-054** — Mockup styl: Neo-Swiss zachowany (paleta navy + green + paper, fonty Fraunces/Archivo/JetBrains Mono)
- **D-055** — Mockup files: HTML lokalnie u Wirgiliusza, wkleję do CC w tygodniu 1 (sekcja §5 tego pliku — Mockup integration)
- **D-056** — UI components: shadcn/ui (already in stack) + custom hero/sections gdzie shadcn nie wystarcza
- **D-057** — Responsive: mobile-first od początku, każda strona testowana 320-1920px równolegle
- **D-058** — Polish copy: CC pisze drafty (na podstawie PRD/CLAUDE.md), Ty review/edit
- **D-059** — Blog content MVP: **10 artykułów foundation** + Twoje review (fallback do 5-7 jeśli scope creep tygodni 3-4 — ALE D-068 mówi scope rigid)
- **D-060** — SEO foundation MVP: full — meta tags + OG tags + JSON-LD structured data + sitemap.xml + robots.txt
- **D-061** — Legal docs: generyczne stuby w MVP, prawnik przed pierwszym klientem (osobne ticket post-launch)
- **D-062** — Testing strategy: critical paths only e2e (checkout flow + audit submit), unit tests opcjonalne
- **D-063** — Monitoring: Sentry od dnia 1 deploy (GA4 nie w MVP, faza 5)
- **D-064** — Deploy strategy: **production live od dnia 1 deploy** (bez staging environment)
- **D-065** — CI/CD: GitHub Actions auto-deploy main → prod (po pierwszym manual deploy verification)
- **D-066** — Tempo: 4-6h dziennie Wirgiliusz, ~30-40h/tydzień, full focus
- **D-067** — Remigiusz w fazie 4: sales-only (outreach, blog review, post-launch IT support), zero technical
- **D-068** — Scope vs deadline: **scope rigid, deadline elastic** — jeśli scope nie wyrobi się w 6 tygodni, deadline się przesuwa do 7-8
- **D-069** — **Frontend-first gate (2026-05-13):** CC nie zaczyna żadnego backendu (Lead model, Stripe, Fakturownia, admin, email, deploy) zanim cały frontend marketing-site nie jest gotowy z animacjami. Re-ordering W2–W6 → FE-N/BE-N phases (§4.0). Powód: animacje "wow" są częścią product identity, nie polish'em. Lista 14 efektów do reimplementacji w §5a Animations backlog.
- **D-070** — **Blog: zatrzymujemy DB-driven CMS, override ADR-008 (MDX) (2026-05-13):** Po K9 cleanup pełna blog infra DietetykDEV (Post + BlogCategoryConfig modele, backend CRUD endpoints, admin UI z PostForm 580 LOC: markdown editor + image upload + scheduled publishing + per-post FAQ + view counter + PL/EN side-by-side) — ~1000 LOC działającego kodu. ADR-008 zakładał MDX w git, ale D-067 mówi Remigiusz non-technical → nie napisze MDX + git commit. Trzymamy admin UI bo: (a) Remigiusz może dodawać posty samodzielnie przez UI, (b) zero LOC do dropu/rebuildu, (c) admin UI ma feature'y których MDX nie ma (scheduled publishing, view counter, FAQ JSON, image upload, PL/EN preview). FE-6 zmienia scope: zamiast "5 MDX articles" → restyle do Neo-Swiss + rebrand categories + seed 5-10 mock posts (lorem ipsum) + `docs/blog/CONTENT_SPEC.md` jako brief dla pisarza (Remigiusz/inna osoba). FE-8 (blog 6-10) — drop, content będzie dodawany przez admin UI w produkcji przez Remigiusza, nie przez CC w preprod.

---

## §3. K10 — cleanup follow-up (przed faza 4 start)

K10 to **pre-faza-4 sweep** — kończymy outstanding cleanup tasks z CLEANUP_COMPLETE.md §7. Robimy **jeden commit** po wszystkim (lub kilka jeśli scope większy niż się wydaje).

**Czas estymowany:** 2-3h CC + 1-2 Twoich gates = ~3-4h kalendarzowo.

**Workflow:** PLAN_K10.md (analogicznie do DELETION_PREVIEW_*.md) → gates → atomic commit.

### K10 tasks

- [ ] **K10.1** — Audit + drop `apps/backend/scripts/` legacy directory (40 .ts/.js files + `scripts/data/` + `scripts/scraper/`, ~5161 LOC). Verify zero consumers per script, drop wholesale.
- [ ] **K10.2** — Rewrite `apps/web/src/app/llms.txt/route.ts` + `llms-full.txt/route.ts` z bambooIT IT-services context (zamiast diet platform). CC pisze drafty, Wirgiliusz review.
- [ ] **K10.3** — EN locale reduction (D-023 alignment): drop `'en'` z `routing.ts`, reduce `en.json` do minimal stub (~50 LOC zamiast 614), verify `Link` components działają.
- [ ] **K10.4** — Legal MDX content rewrite stub: `apps/web/content/legal/{pl,en}/{polityka-prywatnosci, regulamin, polityka-cookies, informacja-ai}.md`. CC pisze **stuby** (~100-200 LOC każdy, RODO-compliant placeholder), Wirgiliusz później do prawnika.
- [ ] **K10.5** — Cosmetic: drop `types/api.ts` section dividers (linie 200, 257), update `webhook.controller.ts:96` outdated comment, rename `dietitianOverride` w `appSettings.service.ts:89-99`.
- [ ] **K10.6** — Drop `RegisterForm.tsx` placeholder (~25 LOC, zostało w K7 z minimalną formą — faza 4 build C odbuduje z NIP/industry).

**Pattern do commit:** `chore(cleanup): K10 follow-up — legacy scripts + llms.txt + EN stub + legal placeholders`

---

## §4. Faza 4 build — 6-tygodniowy roadmap

**Każdy tydzień = kilka atomic commits.** CC trzyma się per-task-type process (D-049). Tygodnie są **wzajemnie powiązane** — niektóre tasks mogą się przesuwać.

---

### §4.0 Frontend-first gate (decyzja 2026-05-13)

**HARD RULE — D-069:** CC NIE zaczyna żadnego punktu poza frontendem (backend endpoints, Stripe Checkout, Fakturownia, admin panel, email templates, CI/CD, deploy) zanim **cały frontend marketing-site nie jest gotowy** — łącznie z animacjami.

**Powód:** Wirgiliusz chce mieć "wow" wizualne pre-launch. Animacje są częścią product identity, nie polish'em. Pominięcie ich = brzydki MVP. Re-ordering W2–W6: frontend pages (static) → animations pass (unified) → DOPIERO POTEM backend integrations.

**Nowa kolejność wykonania (override domyślnej kolejności W2→W6):**

| Faza | Co | Status |
|---|---|---|
| **FE-1** | W1.CC.* — foundation (tokens, fonts, header, footer, BRAND, SEO, homepage hero) | ✅ done |
| **FE-2** | W2.CC.1 — homepage **full static stack** (marquee + offer grid + manifesto + numbers + horizontal services + pricing tiers + process + industries + audit form UI + FAQ + final CTA) | next |
| **FE-3** | W2.CC.2-4 — `/pakiety` + `/audyt` + `/kontakt` — static pages, form UI **bez submission backend** | |
| **FE-4** | W3.CC.4 — `/pomoc-zdalna` — static | |
| **FE-5** | W3.CC.5 — `/o-nas` — static, full conversion z `mockups/o-nas.html` | |
| **FE-6** | Blog: restyle public pages + admin UI defaults rebrand do bambooIT (per D-070, keep DB-driven CMS) + seed 5-10 mock posts (lorem ipsum) + `docs/blog/CONTENT_SPEC.md` brief dla pisarza | |
| **FE-7** | W4.CC.1-5 — `/branze/biura-rachunkowe` + 4 industry pages — static | |
| ~~**FE-8**~~ | ~~W4.CC.6 — blog articles 6-10~~ — dropped per D-070, content w produkcji przez admin UI | drop |
| **FE-9** | W6.CC.5 — error pages (`not-found.tsx`, `error.tsx`, `global-error.tsx`) — static | |
| **FE-10** | **ANIMATIONS PASS** — unified library pick (Framer Motion / GSAP / CSS+IntersectionObserver) + zaimplementowanie wszystkich 14 efektów z mockupa (lista w §4a niżej). Polish review każdej strony. | |
| **FE-11** | W6.CC.3 — Lighthouse audit z aktywnymi animacjami (target 90+) | |
| **FE-12** | W6.CC.6 — cookie banner restyle do Neo-Swiss | |
| **GATE** | Wirgiliusz visual approval całości frontendu | |
| **BE-1** | W2.CC.7-8 — Lead model (Prisma migration 11) + backend leads endpoints + audit form/contact form submission wiring | |
| **BE-2** | W3.CC.1-3 — Stripe Checkout integration + webhooks + success/cancel pages wired | |
| **BE-3** | W4.CC.7-9 — Customer Portal redirect + auth flow polish + NIP validator | |
| **BE-4** | W5.CC.* — Admin panel + email templates + Fakturownia integration + VPS deploy infra | |
| **BE-5** | W6.CC.1-2,4,7 — CI/CD GitHub Actions + Sentry finalization + E2E tests + final smoke test | |
| **LAUNCH** | bambooit.pl live | |

Konsekwencje:
- Cały W2.CC.7-8 (Lead model + endpoints) **przesunięty** do BE-1, AFTER frontend done
- Stripe Checkout (W3) przesunięty do BE-2
- Fakturownia/admin/email (W5) przesunięty do BE-4
- Twoje external accounts (Stripe, Fakturownia, Resend, Sentry per §10) — nadal zakładasz tygodnia 1 jak planowano, czekają w `.env` aż BE phase ich potrzebuje
- W1.8 (VPS prep) — może zostać przesunięte na BE-4 jeśli wygodniej; deploy nie potrzebny do końca FE work
- Deadline 6-7 tygodni z D-041 może się rozszerzyć — pre-rozmowa: jeśli FE z animacjami zajmie 4 tygodnie, BE jeszcze 3-4 = total 7-8 tygodni. Akceptowalne per D-068 (scope rigid, deadline elastic).

---

### Tydzień 1 — Foundation setup (parallel: Ty + CC)

**Twoje (Wirgiliusz, ~10h):**

- [ ] **W1.1** — Założenie Stripe account: organization + 3 produkty (START 390 zł netto/mies, FIRMA 690 zł, FIRMA_PLUS 1190 zł), wszystkie z `subscription_data.trial_period_days = 0` (no trial w MVP, można dodać później). Save Price IDs (`price_xxxxx`) — wklejam do CC.
- [ ] **W1.2** — Założenie Fakturownia account (lub klient bez konta, wystawianie z konta Wirgiliusz/Remigiusz). Sprawdzić API access — token + endpoint. Skonfigurować szablon faktury VAT.
- [ ] **W1.3** — Założenie Resend account + verify domena bambooit.pl (DKIM + SPF + DMARC records w DNS). Save API key.
- [ ] **W1.4** — Założenie Sentry projects (`bambooit-backend`, `bambooit-web`). Save DSN keys.
- [ ] **W1.5** — Założenie Anthropic API key (na faza 5 ChatWidget, ale better mieć teraz żeby env varki były gotowe).
- [ ] **W1.6** — DNS pointing dla bambooit.pl: A record do VPS IP, www CNAME, MX records dla Resend.
- [ ] **W1.7** — Mockup HTML files wkleić Wirgiliusz → CC w sesji repo (utworzyć folder `mockups/` w repo, save `bambooit-netguru-v3.html` + `o-nas.html`).
- [ ] **W1.8** — VPS preparation: Postgres + Redis instance dla bambooit (separate DB `bambooit_db`, port 5433 / Redis 6380), Nginx reverse proxy stub config, Docker compose dla apps/backend (jeszcze nie deploy, tylko config).

**Claude Code (~10-15h):**

- [ ] **W1.CC.1** — K10 cleanup follow-up (per §3 wyżej) — pełen sweep przed faza 4 real work.
- [ ] **W1.CC.2** — Tailwind config update per D-054: paleta navy + green + paper, fonty Fraunces (display) + Archivo (sans) + JetBrains Mono. Globals.css z CSS vars dla shadcn theme override.
- [ ] **W1.CC.3** — Layout shell (Header + Footer + main wrapper) z navigation per Neo-Swiss mockup. Mobile-first responsive.
- [ ] **W1.CC.4** — `app/[locale]/page.tsx` — homepage stub z hero section converted z `mockups/bambooit-netguru-v3.html`. SHADCN button + custom hero section.
- [ ] **W1.CC.5** — i18n bundle structure dla nowych stron (PL pełne, EN minimal stub per K10.3).
- [ ] **W1.CC.6** — `.env.example` rebuild z wszystkimi nowymi placeholderami (STRIPE_*, FAKTUROWNIA_*, RESEND_*, SENTRY_*, NEXT_PUBLIC_GA4_ID etc.).
- [ ] **W1.CC.7** — SEO infrastructure: `app/layout.tsx` z generateMetadata + OpenGraph defaults, `sitemap.ts` (Next.js sitemap.xml route), `robots.txt`.

**End of week 1:** Foundation ready, Ty masz wszystkie API keys, CC ma mockup w repo + Tailwind theme + layout shell + SEO infra + homepage stub działa lokalnie.

**Sanity check end of W1:**
```bash
npm run dev  # → bambooit homepage lokalnie wygląda jak mockup (hero section)
npm run typecheck  # exit 0
npm run build  # exit 0
```

---

### Tydzień 2 — Marketing site core (homepage + /pakiety + /audyt + /kontakt)

**Twoje (Wirgiliusz, ~5h):**

- [ ] **W2.1** — Stripe Price IDs wkleić do `.env` na VPS staging (jeszcze nie prod). CC integruje w W2.CC.7.
- [ ] **W2.2** — Fakturownia API token wkleić do `.env`.
- [ ] **W2.3** — Review CC drafts copy dla /pakiety + /audyt + /kontakt (każdy ~30 min Twojej pracy).

**Claude Code (~30h):**

- [ ] **W2.CC.1** — Homepage `app/[locale]/page.tsx` — full conversion z `mockups/bambooit-netguru-v3.html`. Sekcje: hero, value prop ("Po drugiej stronie konkretny człowiek"), 3 pakiety preview (Card per START/FIRMA/FIRMA_PLUS z CTA do /pakiety), services preview (4 pillars), industry mentions, CTA do /audyt, footer. **Mobile-first responsive 320-1920px.**
- [ ] **W2.CC.2** — `app/[locale]/pakiety/page.tsx` — full pricing page. 3 tier cards z features list + "wybierz pakiet" CTA → Stripe Checkout. FAQ section ("Co jeśli przekroczę godziny?", "Czy mogę zmienić pakiet?", "Czy mam okres próbny?"). Comparison table. Mobile-first.
- [ ] **W2.CC.3** — `app/[locale]/audyt/page.tsx` — landing page dla **szczegółowego** audit form. Sekcje: nagłówek ("Bezpłatny audyt IT — sprawdzimy stan Twojej infrastruktury"), benefits (3-4 punkty), form section, FAQ. CTA prominent.
- [ ] **W2.CC.4** — `app/[locale]/kontakt/page.tsx` — landing page dla **quick contact form**. Mniej "salesy" niż /audyt — sekcja "Napisz do nas" + form (4-5 pól) + email/phone fallback w stopce.
- [ ] **W2.CC.5** — Audit form component — fields: imię/nazwisko, firma, NIP (opcjonalne), email, telefon, branża (select: biuro rachunkowe / kancelaria / gabinet / salon / produkcja / inne), liczba stanowisk (number input), opis problemu (textarea 500 znaków), zgoda RODO (checkbox). Validation react-hook-form + zod.
- [ ] **W2.CC.6** — Contact form component — fields: imię, email, telefon, krótki opis (textarea 250 znaków), zgoda RODO. Validation analogicznie.
- [ ] **W2.CC.7** — Backend endpoints: `POST /api/leads/audit` + `POST /api/leads/contact` — saves do nowego modelu `Lead` (faza 4 schema add — sekcja §6) + sends email do `hello@bambooit.pl` przez Resend.
- [ ] **W2.CC.8** — Schema add: `Lead` model w Prisma (id, type: LeadType enum {AUDIT, CONTACT}, firstName, lastName, company?, nip?, email, phone, industry?, employeesCount?, description, status: LeadStatus enum {NEW, CONTACTED, QUALIFIED, CONVERTED, REJECTED}, createdAt, updatedAt). Migration 11. **TO JEST DUŻY TASK — wymaga PLAN_W2_LEAD_MODEL.md** (per D-049).
- [ ] **W2.CC.9** — Polish copy draft dla wszystkich 4 stron — CC pisze, Wirgiliusz review w W2.3.
- [ ] **W2.CC.10** — SEO meta tags + OG tags + JSON-LD structured data dla 4 nowych stron (Organization schema, LocalBusiness schema dla homepage).

**Sanity check end of W2:**
```bash
npm run dev  # → 4 strony działają lokalnie, mobile-first responsive verified
npm run typecheck && npm run build && npm run test  # all exit 0
```
Audit form submit → email do `hello@bambooit.pl` (Resend test env), Lead saved w DB.

---

### Tydzień 3 — Stripe Checkout + sekcje pomocnicze

**Twoje (Wirgiliusz, ~5h):**

- [ ] **W3.1** — Stripe webhook signing secret wkleić do `.env`.
- [ ] **W3.2** — Test Stripe Checkout end-to-end z testową kartą `4242 4242 4242 4242` (Stripe test mode).
- [ ] **W3.3** — Review CC drafts: /pomoc-zdalna + /o-nas + 5 pierwszych blog articles.

**Claude Code (~30h):**

- [ ] **W3.CC.1** — Stripe Checkout integration: `POST /api/checkout/create-session` endpoint, redirect do Stripe Checkout, success_url + cancel_url. **DUŻY TASK — PLAN_W3_STRIPE.md** (per D-049).
- [ ] **W3.CC.2** — Stripe webhooks endpoint: `POST /api/webhooks/stripe` — handle `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`. Update Subscription model accordingly. **E2E test** dla checkout flow per D-062.
- [ ] **W3.CC.3** — `app/[locale]/checkout/success/page.tsx` + `checkout/cancel/page.tsx` — pages po Stripe redirect. Success: confirmation + "kliknij aby zalogować" link. Cancel: "anuluj/spróbuj ponownie" CTA.
- [ ] **W3.CC.4** — `app/[locale]/pomoc-zdalna/page.tsx` — AnyDesk / RustDesk download page. Sekcje: "Pobierz AnyDesk Windows/Mac/Linux", "Pobierz RustDesk (open-source alternative)", krótka instrukcja "podaj nam ID + hasło sesji", security note.
- [ ] **W3.CC.5** — `app/[locale]/o-nas/page.tsx` — full conversion z `mockups/o-nas.html`. Sekcje: nasza historia, Remigiusz portret + bio, Wirgiliusz portret + bio, wartości (3-4 wartości firmy), photo gallery (placeholder na razie).
- [ ] **W3.CC.6** — Blog infrastructure: `app/[locale]/blog/page.tsx` (list view) + `app/[locale]/blog/[slug]/page.tsx` (post view) + MDX rendering setup (next-mdx-remote). Reuse istniejący `Post` model z schemy.
- [ ] **W3.CC.7** — Blog drafts 1-5 (z 10 total): CC pisze drafty dla foundation articles. Target keywords:
  1. "Outsourcing IT Wrocław — kiedy się opłaca?" (~1500 słów)
  2. "Obsługa IT biura rachunkowego — checklist" (~1500 słów)
  3. "AnyDesk vs TeamViewer vs RustDesk — porównanie" (~1200 słów)
  4. "RODO w małej firmie — IT-checklist" (~1500 słów)
  5. "Backup w SMB — strategia 3-2-1" (~1200 słów)
  
  Każdy artykuł: meta tags + OG tags + JSON-LD Article schema + internal links + CTA do /audyt.

**Sanity check end of W3:**
- Stripe Checkout działa test mode end-to-end (klikam /pakiety → wybieram FIRMA → Stripe form → płacę testową kartą → redirect na success → Subscription w DB)
- 3 nowe strony działają (/pomoc-zdalna, /o-nas, /blog)
- 5 blog articles w MDX
- E2E test checkout flow passing

---

### Tydzień 4 — Branże + blog 6-10 + Customer Portal

**Twoje (Wirgiliusz, ~5h):**

- [ ] **W4.1** — Review CC drafts: 5 industry landing pages + blog 6-10.
- [ ] **W4.2** — Test Stripe Customer Portal jako klient (po success).

**Claude Code (~30h):**

- [ ] **W4.CC.1** — `app/[locale]/branze/biura-rachunkowe/page.tsx` — industry-specific landing. Sekcje: nagłówek ("IT dla biur rachunkowych"), pain points (specific dla branży: bezpieczeństwo danych klientów, dostępność systemów księgowych, RODO), value prop, case study placeholder, CTA do /audyt. **Mobile-first.**
- [ ] **W4.CC.2** — `branze/kancelarie/page.tsx` — analogicznie dla kancelarii prawnych.
- [ ] **W4.CC.3** — `branze/gabinety/page.tsx` — dla gabinetów medycznych/lekarskich.
- [ ] **W4.CC.4** — `branze/salony/page.tsx` — dla salonów usługowych (fryzjerzy, kosmetyka, etc.).
- [ ] **W4.CC.5** — `branze/produkcja/page.tsx` — dla małych produkcji.
- [ ] **W4.CC.6** — Blog drafts 6-10:
  6. "Cyberbezpieczeństwo SMB — top 10 błędów" (~1500 słów)
  7. "Office 365 vs Google Workspace dla SMB" (~1200 słów)
  8. "VPN w małej firmie — czy potrzebny?" (~1000 słów)
  9. "Antywirus enterprise vs konsumencki w firmie" (~1200 słów)
  10. "Hasła w firmie — manager haseł czy Excel?" (~1200 słów)
- [ ] **W4.CC.7** — Stripe Customer Portal redirect: `app/[locale]/panel/page.tsx` — minimal panel z linkiem "Zarządzaj subskrypcją w Stripe Portal" + lista CompanyInvoice (cache z Stripe). Reuse `lib/api.ts:165` CompanyInvoice endpoint.
- [ ] **W4.CC.8** — Auth flow polish: bambooIT signup form (NIP validation + industry select + employeesCount), update RegisterForm.tsx. Reuse istniejący auth.service.ts (Company create per K6a).
- [ ] **W4.CC.9** — NIP validator utility: `apps/web/src/lib/validators/nip.ts` — Polish 10-digit + checksum algorithm.

**Sanity check end of W4:**
- 5 industry pages działają
- 10 blog articles total w MDX
- Customer Portal redirect działa
- Signup z NIP validation działa

---

### Tydzień 5 — Admin panel + email templates + Fakturownia

**Twoje (Wirgiliusz, ~5h):**

- [ ] **W5.1** — Pierwszy manual deploy do VPS (CC pomaga z Nginx config + Docker compose). Test bambooit.pl z prawdziwego internetu.
- [ ] **W5.2** — Test email templates (welcome, invoice, audit lead notification) jako klient.

**Claude Code (~30h):**

- [ ] **W5.CC.1** — Admin dashboard `app/[locale]/admin/page.tsx` — leady widget (count NEW/CONTACTED/QUALIFIED + lista ostatnich 10), subscriptions widget (count ACTIVE per tier), revenue widget (this month MRR estimate).
- [ ] **W5.CC.2** — `app/[locale]/admin/leady/page.tsx` — lead pipeline table (filterable po status, sortowane po createdAt). Actions: change status, add note, mark contacted.
- [ ] **W5.CC.3** — Admin endpoints: `GET /api/admin/leads`, `PATCH /api/admin/leads/:id`, `POST /api/admin/leads/:id/note`.
- [ ] **W5.CC.4** — Email templates (React Email lub plain HTML):
  - `welcome.tsx` — po signup, z linkiem do AnyDesk download
  - `audit-lead-notification.tsx` — do `hello@bambooit.pl` gdy nowy lead z /audyt
  - `contact-lead-notification.tsx` — analogicznie dla /kontakt
  - `invoice-notification.tsx` — do klienta po Fakturownia invoice generated
  - `subscription-canceled.tsx` — po Stripe subscription canceled
- [ ] **W5.CC.5** — Fakturownia API integration: `apps/backend/src/services/fakturownia.service.ts` — po Stripe `invoice.payment_succeeded` webhook, create invoice w Fakturownia, save invoice URL do bazy, send email do klienta z linkiem do faktury. **DUŻY TASK — PLAN_W5_FAKTUROWNIA.md** (per D-049).
- [ ] **W5.CC.6** — VPS deploy infrastructure: Nginx reverse proxy config dla bambooit.pl, Docker compose dla apps/backend + apps/web, systemd unit dla auto-restart, log rotation. **Wirgiliusz manually executes first deploy.**

**Sanity check end of W5:**
- bambooit.pl live na prod VPS
- Admin panel działa, widzę leady
- Email templates wysyłane przez Resend
- Fakturownia integration: testowa płatność → invoice w Fakturownia ✅

---

### Tydzień 6 — CI/CD + monitoring + final polish + production launch

**Twoje (Wirgiliusz, ~10h):**

- [ ] **W6.1** — Final review WSZYSTKICH stron (copy + responsive + performance) jako klient. Iteracja z CC nad bugami.
- [ ] **W6.2** — Stripe LIVE mode switch — z test mode na production. Aktualizacja Price IDs (live) w `.env`.
- [ ] **W6.3** — Production launch — public announcement (LinkedIn post Remigiusz?), pierwszy outreach kampania.

**Claude Code (~25h):**

- [ ] **W6.CC.1** — GitHub Actions workflow `.github/workflows/deploy.yml` — auto-deploy main → VPS via SSH (ssh-action). Steps: checkout, install deps, run typecheck/build/tests, rsync do VPS, restart containers.
- [ ] **W6.CC.2** — Sentry integration finalization: `@sentry/nextjs` w apps/web, `@sentry/node` w apps/backend. Source maps upload w build pipeline. Test capture errors.
- [ ] **W6.CC.3** — Performance optimization audit: Lighthouse scores per stronę (target 90+ all metrics), image optimization (Next.js `<Image>`), font loading (next/font), CSS minimal critical extraction.
- [ ] **W6.CC.4** — E2E test suite: Playwright/Vitest dla critical paths (per D-062):
  - Audit form submit → email + Lead created
  - Checkout flow START → success → Subscription created
  - Customer Portal redirect works
  - Admin panel: zmiana lead status działa
- [ ] **W6.CC.5** — Error pages: `app/not-found.tsx` + `app/error.tsx` + `app/global-error.tsx` z Neo-Swiss style.
- [ ] **W6.CC.6** — Cookie banner (RODO compliant — accept/reject/preferences). Reuse istniejący jeśli był w e-dietetyk, otherwise build minimal.
- [ ] **W6.CC.7** — Final smoke test post-deploy: wszystkie strony loadują, formy działają, Stripe live mode test (Wirgiliusz płaci 1zł test).

**Sanity check end of W6 — LAUNCH READY:**
- bambooit.pl prod live
- Stripe live mode aktywny
- Sentry capturuje errors
- CI/CD auto-deploy działa
- E2E tests passing
- Lighthouse 90+
- Cookie banner + legal stubs aktywne
- All forms work end-to-end

---

## §5. Mockup integration workflow (tydzień 1)

Mockup HTML masz lokalnie. Workflow:

1. **Wirgiliusz:** Stwórz folder `mockups/` w root repo, save `bambooit-netguru-v3.html` + `o-nas.html` + ewentualne assets (fonts, images).
2. **Wirgiliusz:** `git add mockups/ && git commit -m "docs: add mockup HTML reference for faza 4 build"`
3. **CC:** W tygodniu 1 czyta `mockups/bambooit-netguru-v3.html`, ekstraktuje:
   - CSS variables (kolory, fonty, spacing) → Tailwind config
   - Layout struktura → Next.js komponenty
   - Animations (jeśli są) → Framer Motion lub vanilla CSS transitions
   - Sekcje hero/features/CTAs → React components
4. **Reference w trakcie pracy:** CC może w każdej chwili otworzyć mockup do verify "wygląda tak samo".

**Mockup NIE jest kopiowany 1:1** — jest **wizualnym brief'em**. CC implementuje **lepszą wersję** (responsive, accessible, semantic HTML, performance optimized) zachowując wizualną tożsamość.

---

## §5a. Animations backlog (FE-10 — unified pass)

Wszystkie efekty z `mockups/bambooit-netguru-v3.html` świadomie odłożone do jednego unified pass'u po zbudowaniu statycznych sekcji. Per D-069 frontend nie jest "gotowy" bez animacji.

**Library decision (do podjęcia w FE-10 przed implementacją):**

| Option | Plus | Minus |
|---|---|---|
| **Framer Motion** | Idiomatic React, deklaratywne `whileInView`, dobra DX, gesture support, SSR-friendly | Bundle ~50KB gzip, complex scroll choreography wymaga `useScroll` hook'ów |
| **GSAP + ScrollTrigger + Lenis** | Mockup 1:1 fidelity (mockup już jest w GSAP), najbardziej zaawansowane scroll choreography, performance | Imperative, paid license dla SplitText plugin, ~70KB gzip, mniej idiomatic React |
| **CSS + IntersectionObserver + vanilla JS** | Najlżejszy (0KB lib), browser-native, no React hydration overhead | Pinned scroll trudniejszy, więcej manual code, mniej polish na complex sequences |

**Rekomendacja default:** Framer Motion dla 80% efektów (entrance, hover, simple parallax) + GSAP only dla pinned-scroll/3D-pricing/horizontal-services (3-4 sekcje gdzie naprawdę potrzebne). Hybrid pragmatic. Decyzja w FE-10 kickoff.

### Lista 14 efektów do reimplementacji

Każdy z numerem sekcji + krótki opis + estymowany effort. Wszystkie istnieją w `mockups/bambooit-netguru-v3.html` jako referencja.

| # | Sekcja | Efekt | Effort |
|---|---|---|---|
| **A1** | Loader screen | Full-screen bambooIT mark + green bar fill 1.2s, fade-out po 1.8s. **Decyzja: SKIP w MVP** (UX anti-pattern dla marketingowego site, zwiększa TTI). Lub zastąpić Next.js `<Suspense>` boundaries. | — (skip) |
| **A2** | Hero entrance | Split-text chars stagger (yPercent 110→0, opacity 0→1, rotation 8→0, stagger 0.025s) + eyebrow fade-up + heroBottom fade-up | 2h |
| **A3** | Panda SVG entrance | `stroke-dashoffset` line-draw (1.6s ease-in-out, stagger 0.04s) + panda-fill fade-in (0.5s) + panda-leaf scale-in stagger random (back.out(2)) + eyes fade | 2h |
| **A4** | Hero parallax | Panda yPercent 30 + grid yPercent -20 + title yPercent -15 + opacity 1→0.3 — scrub na scroll | 1h |
| **A5** | Marquee | Infinite horizontal scroll (x: -marqueeWidth, duration 30s, ease none, repeat -1) | 30 min |
| **A6** | Narrative pinned-scroll (×4) | ScrollTrigger pin 100vh + word-by-word reveal (0→0.4 fade in, 0.4→0.6 hold, 0.6→1 fade out) z bg radial gradient parallax | 3h |
| **A7** | Manifesto char-by-char | Char-level color reveal scrubbed by ScrollTrigger (grey → navy, em-marked → green-deep). 200+ chars. | 2h |
| **A8** | Numbers counter | 0 → target (98%, 15min, 40+) duration 1.8s ease-out, trigger 80% viewport | 1h |
| **A9** | Horizontal services pinned scroll | 6 cards horizontal, ScrollTrigger pin viewport, x:-distance scrub, active card detection (closest to viewport center) z scale 0.85→1 + green shadow + progress bar + counter | 4h |
| **A10** | Pricing 3D stack assembly | 3 tiery z różnych pozycji 3D (left -300/-30deg, center y400/30deg, right 300/30deg) → ease-out do center w 0-60% scroll, featured tier rises -20px w 60-100% | 4h |
| **A11** | Process line draw | SVG `stroke-dashoffset` 1000→0 scrubbed by ScrollTrigger + steps `.active` toggle progressively + step-num rotate/scale entrance per step | 2h |
| **A12** | Industries morphing bg | 6 background classes (`morph-1`...`morph-6`) z różnymi green hue/lightness, scrubbed by scroll OR hover-triggered | 2h |
| **A13** | FAQ accordion open | Smooth max-height transition (0.5s cubic-bezier) + plus icon rotate 45deg + bg-green/border-green on open | 1h |
| **A14** | Final CTA word stagger | H2 word-level split + y80→0 stagger 0.06s, ease power3.out | 1h |

**Total estimate FE-10:** 24-30h CC pracy + Twoje review/iteration. Plus library research + decision (~2h).

**Polish review po FE-10:** Wirgiliusz robi visual walkthrough każdej strony, flag'uje co jeszcze nie "wow". CC iteruje. Cel: każda sekcja ma jakiś moment delight'u, nie tylko fade-in-up.

**Constraint:** wszystkie animacje muszą respektować `prefers-reduced-motion: reduce` — mockup ma to w CSS, w React port musi być wired przez `useReducedMotion()` (Framer Motion built-in) lub manual media query check.

---

## §6. Schema additions (faza 4 — new migrations)

Po cleanup phase mamy 19 user tables + 10 migracji. Faza 4 doda:

### Migration 11 — `add_lead_model` (W2.CC.8)

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
  firstName       String
  lastName        String?
  company         String?
  nip             String?
  email           String
  phone           String
  industry        String?    // 'accounting' | 'law' | 'medical' | 'services' | 'production' | 'other'
  employeesCount  Int?
  description     String     @db.Text
  status          LeadStatus @default(NEW)
  notes           Json?      // admin notes array [{ id, text, createdAt, authorId }]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([status])
  @@index([createdAt])
  @@index([email])
}
```

### Migration 12 — `add_company_business_fields` (W4.CC.8)

```prisma
model Company {
  // existing fields...
  nip             String?  @unique
  industry        String?  // same enum as Lead.industry
  employeesCount  Int?
  city            String?
  address         String?
  postalCode      String?
  website         String?
  phone           String?
}
```

### Migration 13 — `add_company_invoice_cache` (W4.CC.7)

```prisma
model CompanyInvoice {
  id                String   @id @default(cuid())
  companyId         String
  fakturowniaId     String?  @unique  // Fakturownia invoice ID
  stripeInvoiceId   String?  @unique
  number            String   // np. "FV/2026/001"
  amount            Decimal  @db.Decimal(10, 2)
  vat               Decimal  @db.Decimal(10, 2)
  status            String   // 'pending' | 'paid' | 'overdue' | 'canceled'
  issuedAt          DateTime
  paidAt            DateTime?
  pdfUrl            String?
  createdAt         DateTime @default(now())

  company           Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([fakturowniaId])
}
```

Wszystkie 3 migracje wymagają **PLAN_*.md** (per D-049, schema changes = duże tasks).

---

## §7. Anti-patterns — co CC NIE robi sam

CC ma maksymalną autonomię (D-047), ale **NIE WOLNO**:

- ❌ **Schema changes bez PLAN_*.md** — każda Prisma migration wymaga preview file + Twojej akceptacji
- ❌ **External API integrations bez PLAN_*.md** — Stripe webhook handlers, Fakturownia API calls, Resend send, Anthropic API — wszystko ma plan
- ❌ **New dependencies w package.json bez Twojej zgody** — npm install X wymaga "ok install X"
- ❌ **Change pricing tiers bez Twojej zgody** — D-007 (390/690/1190) jest święty
- ❌ **Change UserRole enum** — D-024 ADMIN+CLIENT jest święty, no AGENT/MANAGER w MVP
- ❌ **Change paleta kolorów / fonty** — D-054 Neo-Swiss jest święty, jakakolwiek zmiana wymaga dyskusji
- ❌ **Force-push do main** — never, even dla rebase
- ❌ **Drop migracje** — never, każdy schema rollback wymaga manual SQL + backup
- ❌ **Commit z failing typecheck/build/tests** — D-050 absolute
- ❌ **Publish do prod bez Sentry monitoring** — D-063 absolute
- ❌ **Send real emails do real users z dev env** — używaj Resend test mode lub send-to-self only
- ❌ **Commit secrets / API keys / .env files** — never
- ❌ **Rewrite legal docs** — D-061 mówi prawnik przed launch, CC pisze tylko **stuby**

---

## §8. Reference docs hierarchy — co CC czyta kiedy

CC ma 4 główne reference docs. Hierarchia ważności (najwyższe = override niższe):

1. **DECISION_LOG.md** (highest) — 40+ decyzji architektonicznych. Override CLAUDE.md/PRD.md jeśli sprzeczne. Update z każdą nową decyzją (D-041 → D-068+).
2. **RULES.md** — code style, naming conventions, file organization. CC trzyma się zawsze.
3. **CLAUDE.md** — operating manual dla CC: jak commitować, jak strukturować PR, jak pisać tests. Project contract.
4. **PRD.md** — business document: target market, pricing, value props, features scope.

**Plus reference docs:**

5. **TODO.md** (this file) — operational roadmap faza 4 + 5
6. **CLEANUP_COMPLETE.md** — historical, audit trail cleanupu
7. **DELETION_PREVIEW_*.md** — historical, per K-step audit
8. **PLAN_*.md** — current/future, per-task gates (np. PLAN_W2_LEAD_MODEL.md, PLAN_W3_STRIPE.md)

**Workflow gdy CC napotka konflikt:**

- Sprzeczność DECISION_LOG vs CLAUDE.md → DECISION_LOG wins, ale update CLAUDE.md w tym samym commicie
- Brak info w PRD.md → zapytaj Wirgiliusz przed implementacją
- Brak info w CLAUDE.md → propose dodanie sekcji + zapytaj

---

## §9. Task workflow templates (per D-049)

### Drobny task (< 100 LOC, 1 plik)

CC działa od razu:
1. Implement
2. typecheck/build/tests
3. Commit z Conventional Commits message
4. Move to next task

**Przykłady:**
- Fix typo w copy
- Add icon do button
- Update meta tag dla pojedynczej strony
- Add validation rule do form field

### Średni task (1 feature, < 500 LOC, multi-file)

CC pisze plan w wiadomości (3-5 punktów), czeka na "ok", implementuje:

```
Plan dla /pakiety page (W2.CC.2):

1. Scope: 3 tier cards + comparison table + FAQ section + CTA do Stripe Checkout
2. Files affected:
   - app/[locale]/pakiety/page.tsx (new, ~200 LOC)
   - components/pricing/TierCard.tsx (new, ~80 LOC)
   - components/pricing/ComparisonTable.tsx (new, ~120 LOC)
   - components/pricing/PricingFAQ.tsx (new, ~60 LOC)
   - messages/pl.json + en.json — add pricing.* keys (~25 keys per file)
3. Dependencies: shadcn Card + Button (already in stack)
4. Tests: snapshot test dla TierCard (defer optional)
5. Estimated time: 3-4h

OK?
```

Wirgiliusz: "ok" → CC implementuje + commituje.

### Duży task (architecture / schema / external API)

CC pisze `PLAN_*.md` w repo, commituje (chore: PLAN ...), czeka na "ok plan X final", implementuje:

```
PLAN_W3_STRIPE.md — Stripe Checkout integration

§0. Scope
   - POST /api/checkout/create-session
   - Stripe Checkout redirect flow
   - Webhook handler dla 5 events
   - Subscription create/update logic

§1. Database changes
   - Subscription model już istnieje (cleanup K7)
   - No schema changes needed

§2. API endpoints (3 new + 1 webhook)
   ...

§3. Files affected (~12 files)
   ...

§4. Tests (E2E + integration)
   ...

§5. Decisions needed
   - D-XXX: Webhook signature verification — use raw body middleware?
   - D-XXX: Subscription idempotency — Stripe event ID dedup?

§6. Rollback plan

§7. 3 GATES
```

Wirgiliusz review → "ok plan W3 final" → CC implementuje per plan.

---

## §10. External accounts checklist (tydzień 1)

### Stripe (~30 min Twojego czasu)

- [ ] Sign up na stripe.com
- [ ] Activate account (NIP + KRS dla bambooIT entity)
- [ ] Create 3 products:
  - "Pakiet START" — Price 390 zł netto, monthly recurring, currency PLN, VAT 23%
  - "Pakiet FIRMA" — Price 690 zł netto, monthly recurring
  - "Pakiet FIRMA PLUS" — Price 1190 zł netto, monthly recurring
- [ ] Save Price IDs: `price_xxxxx_START`, `price_xxxxx_FIRMA`, `price_xxxxx_FIRMA_PLUS`
- [ ] Get webhook signing secret (Developers → Webhooks → Add endpoint → save signing_secret)
- [ ] Test mode keys: `pk_test_xxx`, `sk_test_xxx`
- [ ] LIVE mode keys (do W6.2): `pk_live_xxx`, `sk_live_xxx`

### Fakturownia (~30 min)

- [ ] Sign up na fakturownia.pl (free trial / paid plan dla VAT invoicing)
- [ ] Add company details (bambooIT dane: NIP, address, REGON)
- [ ] Get API key (Account → API)
- [ ] Configure invoice template (numbering format `FV/{YEAR}/{NUMBER}`)
- [ ] Test API: `curl https://bambooit.fakturownia.pl/api/...`

### Resend (~15 min)

- [ ] Sign up na resend.com
- [ ] Add domain bambooit.pl
- [ ] Verify DNS records (DKIM TXT, SPF TXT, MX) — propagacja ~1h
- [ ] Get API key (Settings → API Keys)
- [ ] Test send: `curl -X POST https://api.resend.com/emails ...`

### Sentry (~15 min)

- [ ] Sign up na sentry.io
- [ ] Create organization "bambooIT"
- [ ] Create 2 projects: `bambooit-web` (Next.js) + `bambooit-backend` (Node.js)
- [ ] Save DSN per project
- [ ] Generate auth token dla source maps upload (Account → Auth Tokens, scope: org:read + project:releases)

### Anthropic API (~5 min, dla faza 5 ChatWidget)

- [ ] Sign up na console.anthropic.com
- [ ] Save API key — for now placeholder w `.env`, używany w faza 5

### GA4 (NOT in MVP per D-063)

Skip — faza 5.

---

## §11. Production deployment runbook

Per CLEANUP_COMPLETE.md §6 — 3 TODO(*-deploy) markers waiting. **Wszystkie 3 są moot** bo dev DB ma 0 users w momencie pierwszego deploy. Ale dokumentujemy dla kompletności:

### Pre-deployment (W6, przed prod live)

1. **Stripe live mode** — switch from test to live, update Price IDs w `.env`
2. **DNS verify** — bambooit.pl resolves do VPS, SSL cert via Let's Encrypt active
3. **Database migration** — `npx prisma migrate deploy` na prod DB (10 cleanup migrations + faza 4 new migrations 11-13+)
4. **Sentry projects** active i capturuje errors z production
5. **Webhook secrets** wkleić do prod `.env` (Stripe webhook, etc.)
6. **First admin user** — Wirgiliusz tworzy account jako ADMIN przez seed script lub admin API
7. **Smoke test** — wszystkie strony loadują z prod URL, formy działają

### TODO(*-deploy) markers — currently moot

- **TODO(K6a-deploy)** w `middleware/auth.ts` — JWT claim `patientId → companyId`. **Moot:** zero users do migracji.
- **TODO(K7-deploy)** w `middleware/auth.ts` — UserRole reform PATIENT → CLIENT, drop DIETITIAN. **Moot:** zero users.
- **TODO(K8-deploy)** w `subscription.service.ts` — SubscriptionPlan reform. **Moot:** zero subscriptions.

Po pierwszym prod deploy z bambooIT users — te markers stają się **historyczne**. Można je drop'nąć w faza 5 cleanup.

---

## §12. Faza 5 — post-MVP backlog (po launch)

Po pierwszym płacącym kliencie, faza 5 dodaje:

### High priority (1-3 miesiące post-launch)

- [ ] **ChatWidget Claude AI** — Anthropic Haiku 4.5 chat z function calling (submit_lead, recommend_package, submit_audit_request). Replace fake button z W2.
- [ ] **Referral program UI** — istniejący ReferralCode model już w DB, dodać UI w panelu klienta + landing page `/polec`
- [ ] **GA4 integration** — analytics tracking (page views, form submits, checkout funnel)
- [ ] **Legal docs review** — prawnik finalizuje stuby polityki prywatności + regulaminu (D-061 follow-up)
- [ ] **Admin enhancements** — lead pipeline z drag-drop status, audit submissions analytics, conversion funnel
- [ ] **Email automation** — drip campaigns (3-day follow-up po audit submit, 7-day welcome series, monthly newsletter)

### Medium priority (3-6 miesięcy)

- [ ] **/strony-internetowe, /aplikacje, /automatyzacje** — cross-sell landing pages
- [ ] **Blog growth** — 20+ articles total, SEO optimization iteracje
- [ ] **Case studies** — pierwsze 3-5 klientów jako case study na stronie
- [ ] **Microsoft Clarity / Hotjar** — heatmaps + session recordings dla UX iteracji
- [ ] **A/B testing infrastructure** — feature flags dla copy/CTA tests
- [ ] **Drobne K10 follow-ups** — drop K6a/K7/K8-deploy markers (już moot po launch), drop archeology comments

### Low priority (6+ miesięcy)

- [ ] **EN locale aktywacja** — full EN translation, drop "EN stub" decision
- [ ] **Mobile app** (jeśli sensownie) — React Native lub PWA
- [ ] **Multi-region expansion** — Niemcy, Czechy?
- [ ] **Team scaling** — 3-osobowy team, role AGENT?

---

## §13. Status tracking (live)

Ta sekcja **żyje** — Ty + CC updateujemy w trakcie.

### Faza 4 progress

Per D-069 (§4.0 frontend-first gate) execution shifted from week-numbered to FE-N/BE-N phases. Original week tracking kept below for reference but execution follows §4.0 ordering.

**Frontend track:**
- [x] **FE-1** — W1.CC.* foundation (tokens, fonts, header, footer, BRAND, SEO, homepage hero) — 7 commits in session 2026-05-13 (`0cfcb8a` → `7d27f08`)
- [x] **FE-2** — homepage full static stack — 15 sections in 4 commits (`c43dfd9` → `0cdb865`): Marquee, OfferGrid+TeamLine, 4× NarrativeSection, Manifesto+Numbers, HorizontalServices (6 cards), PricingTiers (3 cards per D-007), Process (4 steps), Industries (6 — mockup version not TODO.md FE-7 list), AuditForm (client, UI-only stub), FAQ (client accordion), FinalCTA
- [x] **FE-3** — `/pakiety` + `/audyt` + `/kontakt` static — 3 commits (`a54df73` → `5e7cad3`). PageHeader shared component + ComparisonTable + PricingFAQ + AuditBenefits + AuditFAQ + ContactFormSection (client UI-only stub). Sitemap updated for all 3 routes.
- [x] **FE-4** — `/pomoc-zdalna` static — commit `1c5b680`. RemoteSupportDownloads (AnyDesk 3 platforms + RustDesk) + RemoteSupportFlow (3 steps) + RemoteSupportSecurity (3 guarantees). JSON-quoting fix mid-flight (unescaped ASCII `"` inside Polish typographic quotes broke build).
- [x] **FE-5** — `/o-nas` static — commit `8a61201`. Full mockup o-nas.html port: AboutHero (Fraunces 900) + AboutStats (4-stat strip, brand-promise not aspirational numbers) + AboutStory (origin narrative) + AboutTeam (R + W cards with gradient-circle avatar placeholders) + AboutValues (4 brand rules) + FinalCTA reuse.
- [x] **FE-6** — blog restyle Neo-Swiss + admin defaults bambooIT + 8 mock lorem ipsum posts + writer brief — 4 commits (`102071c` → `2ac7f3e`). Categories rebrand (Obsługa IT / Cyberbezpieczeństwo / Backup / M365 / Sprzęt i sieci / Automatyzacje / Strony i aplikacje / Branże), 12 blog components restyled (BlogHero z grid bg + bamboo CTA → /audyt, BlogCard z paper-to-bamboo gradient, etc.), `seed-bamboo-blog-mock.ts` (8 posts × 1 per category, lorem ipsum + Polish titles, FAQ entries, idempotent upsert), `docs/blog/CONTENT_SPEC.md` (361-line writer brief covering: persona, voice, structure, SEO, 60 topic ideas across 8 categories, admin UI walkthrough, images, FAQ, common mistakes, review workflow).
- [x] **FE-7** — `/branze/*` 5 industry pages — 2 commits (`fe196cb` + `27f7b24`). Final 5 per Wirgiliusz option B: biura-rachunkowe + kancelarie + gabinety + produkcja + hotele (dropped architektura + salony). Shared `IndustryLanding.tsx` template (PageHeader → painPoints 4 cards → valueProp 4 items dark + bamboo border → caseStudy placeholder → FinalCTA reuse) — adding industry #6 later is just an i18n bundle + 22-line page.tsx wrapper. Industry-specific real content (not lorem ipsum): pain points + value props grounded in actual industry needs (RODO Art. 9 for medical, OT/IT segmentation for produkcja, channel manager sync for hotele, etc.).
- ~~**FE-8**~~ — dropped per D-070 (content via admin UI in production)
- [x] **FE-9** — error pages — commit `1cfefe8`. Neo-Swiss restyle not-found.tsx (404 z Fraunces black bamboo-deep) + new locale-scoped error.tsx (z Sentry capture + error.digest dla bug report) + global-error.tsx (inline-style fallback, OUTSIDE next-intl provider, Polish hardcoded).
- [x] **FE-10** — animations unified pass (§5a backlog, 14 efektów) — 9 commits (`3784c6a` → `25bc46e`). Library hybrid per D-069 decision: Framer Motion 80% (deps installed: framer-motion ^12.38, gsap ^3.15, @gsap/react ^2.1). All 14 effects shipped: A1 BambooLoader / A2 hero char stagger / A3 panda SVG draw / A4 hero parallax / A5 marquee infinite / A6 4× narrative pinned-scroll word reveal / A7 manifesto char color reveal / A8 numbers counter / A9 horizontal services pinned + active card / A10 pricing 3D assembly / A11 process line draw + dots / A12 industries morph bg / A13 FAQ stagger + cubic-bezier / A14 final CTA word stagger. Every effect has `prefers-reduced-motion` fallback path.
- [x] **FE-11** — Lighthouse audit (code-level pass) — commit `d9eb389`. Code-level optimisations: drop unused gsap + @gsap/react deps (Framer Motion handled all 14 effects), wire Sentry `onRouterTransitionStart` hook for App Router perf tracing. Build verified clean. Actual browser Lighthouse run requires Wirgiliusz's Chrome — bundle sizes documented: 220 kB shared / 303 kB homepage (heaviest, has all animations) / 267 kB branze pages / 239 kB audyt. Targets 90+ should be hit but real measurement is Wirgiliusz post-visual-verify.
- [x] **FE-12** — cookie banner Neo-Swiss — commit `2800540`. CookieBanner.tsx + CookieSettings.tsx restyled (bamboo pills, navy-deep backdrop, paper modal frame, no shadcn Button variant dependencies).
- [x] **GATE** — Wirgiliusz visual approval (2026-05-14, after pricing tier mobile/tablet review). Backend track unblocked.

**Backend track (blocked until GATE):**
- [x] **BE-1** — Lead model + leads endpoints + form submissions — 4 commits (`c42e285` → `ebc49d8`). Migration 11 (Lead + LeadType/LeadStatus enums, 4 indexes, RODO fields), backend POST `/leads/audit` + `/leads/contact` (Zod + honeypot + leadLimiter 5req/15min), `leads.service.ts` + `leadNotifications.ts` (dual email: admin → hello@bambooit.pl reply-to lead.email, klient → lead.email; SMTP-not-configured fallback = log + Sentry warning + endpoint still 200), DSAR `exportUserData` + `hardDeleteUser` cover Lead-by-email match (RODO Art. 15/17), frontend AuditFormSection + ContactFormSection rewritten with state machine idle/submitting/success/error + honeypot + disabled button + error banner. Size enum aligned UI↔backend at `1-5/6-15/16-30/30+`. 9 lead-related unit tests added (72/72 backend tests green). Per PLAN_BE-1.md §10 defaults: DSAR in BE-1, env var `NOTIFICATIONS_TO_EMAIL` with `hello@bambooit.pl` fallback, whole "name" stored in firstName (no auto-split), honeypot=200 fake-success.
- [x] **BE-2** — Stripe Checkout + webhooks + success/cancel — 8 commits (`30d96b9` → `bb3d615`). Migration 12 (Company business fields: nip/companyName/industry/employeesCount/city/address/postalCode/phone/website, unique index on nip). NIP validator (mod-11) w `apps/backend/src/utils/nip.ts` + identyczny twin w `apps/web/src/lib/validators/nip.ts`. Register flow rozszerzony — `auth.service.ts` register(email, pw, companyFields, ...) tworzy Company z pełnymi business fields; NIP_TAKEN (409) early throw przed P2002. TRIAL zdropowany z `checkout.controller.ts` Zod enum (service zostaje dormant per PLAN_BE-2.md Q5/B). `RegisterForm.tsx` rozszerzony o phone/companyName/nip/industry/employeesCount/website + frontend isValidNIP validation + ApiError exposing `code` field dla NIP_TAKEN vs EMAIL_TAKEN. `/zamow` page rebuilt jako OrderRedirect — auth gate (status check + signIn redirect z callbackUrl) → POST /checkout/create-session → window.location na Stripe URL. Pricing CTAs w `PricingTiersSection.tsx` przepięte na `/zamow?plan=START|FIRMA|FIRMA_PLUS` + secondary "Pomocy wybrać? Audyt →" link. `/panel/subskrypcja` (nowa) — layout.tsx auth guard + SubscriptionPanel.tsx z state machine loading/empty/ready/error + Customer Portal redirect button. CheckoutSuccess + CheckoutCanceled Neo-Swiss restyle (sage→paper/bamboo, /oferta→/pakiety fix, success CTAs do /panel/subskrypcja + /pomoc-zdalna, canceled CTAs do /pakiety + /audyt). 86/86 backend tests + 44/44 web tests zielone. ApiError class extended with `code` property. **Per PLAN_BE-2.md §10 defaults: Q1 B+secondary, Q2 auth-required, Q3 NIP twin (copied), Q4 full migration 12, Q5 TRIAL dormant, Q6 panel+success.**
- [x] **BE-3** — Customer Portal + auth polish + NIP validator — Customer Portal redirect i NIP validator zrobione w BE-2; BE-3 zredukowane do **auth flow polish** — 1 commit (`3093e60`). LoginForm + RegisterForm czytają i sanityzują `?callbackUrl=` (reject protocol-relative + absolute URLs przeciw open-redirect); /dashboard route (legacy e-dietetyk) zastąpiony `/panel/subskrypcja` w trzech miejscach (LoginForm fallback, admin/layout non-admin redirect, LoginForm test). Flow `/zamow → /zaloguj?callbackUrl=X → login → X` działa, RegisterForm "loginLink" zachowuje callback przez verify-email roundtrip. 44/44 web tests zielone.
- [x] **BE-4** — Admin + email (Fakturownia + VPS deploy **odroczone** 2026-05-14) — 5 commits (`af2b778` → `3b5357c`). Backend: `/admin/leads/*` endpointy (list+filter+stats+detail+status+notes+CSV, 16 unit tests, 4 nowe audit actions LEAD_STATUS_UPDATED/NOTE_ADDED/NOTE_DELETED/EXPORTED). Email rebrand — pełne przepisanie `utils/email.ts` z bambooIT brandingiem + nowy `emailLayout()` helper z 4 wariantami callout (info/warning/success/danger). 5 starych emaili rebrandowanych (passwordReset, orderConfirm, emailVerify, subscriptionCancel, accountDeletion). 2 nowe maile: `sendSubscriptionWelcomeEmail` (z linkiem do panelu + pomocy zdalnej) + `sendPaymentFailedEmail` (z linkiem do Stripe Customer Portal generowanym on-the-fly). Webhook wiring: `handleInvoicePaid` fires welcome przy pierwszej fakturze (heurystyka: period.start vs Subscription.createdAt < 1h), `handleInvoicePaymentFailed` fires payment-failed; oba w try/catch + Sentry (nie blokują DB update). Frontend: `/admin/leady` (list page z filtrami status/type/search + paginacja + CSV export button + 5 stats cards) i `/admin/leady/[id]` (header z type+status badge + inline status select + contact grid + message + anti-abuse meta + notes panel z confirm-delete + 2000 char counter). Sidebar entry "Leady" z Inbox icon przed Users. 102/102 backend + 44/44 web tests zielone.
- [ ] **Inwoicing** — Fakturownia vs wfirma decyzja open (memory: project-invoicing-deferred). Integracja w osobnej fazie po wyborze providera.
- [ ] **BE-5** — CI/CD + Sentry + E2E + smoke test + **VPS deploy** (deploy przeniesione z BE-4 2026-05-14 — czekamy aż Wirgiliusz ma dostęp do terminala VPS; memory: project-deploy-deferred)
- [ ] **LAUNCH**

**Twoje (Wirgiliusz) — niezależne, robi się równolegle:**
- [ ] W1.1-W1.6 external accounts (Stripe, Fakturownia, Resend, Sentry, Anthropic, DNS)
- [ ] W1.7 mockups — ✅ done (zrobione za Ciebie 2026-05-13)
- [ ] W1.8 VPS prep — może czekać do BE-4

**Original week-based tracking (deprecated, kept for context):**
- ~~Tydzień 1-6 sequence~~ — zastąpione FE/BE phases per D-069

### Blockers (live update)

*(empty — żaden blocker na start)*

### Decisions pending (live)

*(empty — wszystkie decyzje D-041 → D-069 zalockowane)*

### Open questions (live)

*(empty na start, dorzucamy w trakcie pracy)*

---

## §14. Final note

Ten dokument to **żywy operating manual.** Nie jest skończony — będziemy go update'ować w trakcie fazy 4 build:

- Po każdym ukończonym tygodniu — mark `[x]` + dodać retrospective note jeśli warto
- Po każdej nowej decyzji — update §2 (D-NNN) + DECISION_LOG.md
- Po każdym blockerze — sekcja §13 Blockers
- Po launch — przejście do faza 5 backlog

**Cel TODO.md:** Claude Code może w każdej chwili otworzyć ten plik i wiedzieć:
- Co robić teraz (current week)
- Jak to robić (per task type process)
- Co NIE wolno (anti-patterns)
- Gdzie szukać context (reference docs hierarchy)

— Wirgiliusz Ładziński + Claude Code, 2026-05-13
End of TODO.md.
