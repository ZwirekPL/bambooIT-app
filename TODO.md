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

- [ ] **Tydzień 1** — Foundation setup
- [ ] **Tydzień 2** — Marketing site core
- [ ] **Tydzień 3** — Stripe + sekcje pomocnicze
- [ ] **Tydzień 4** — Branże + blog + Customer Portal
- [ ] **Tydzień 5** — Admin panel + email + Fakturownia
- [ ] **Tydzień 6** — CI/CD + monitoring + LAUNCH

### Blockers (live update)

*(empty — żaden blocker na start)*

### Decisions pending (live)

*(empty — wszystkie 28 decyzji z TODO.md session zalockowane jako D-041 → D-068)*

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
