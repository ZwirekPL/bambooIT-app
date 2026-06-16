# PLAN_ops_core.md — Operational core: onboarding + godziny + rozliczenie + raport

> **Status:** DRAFT — czeka na gate Wirgiliusza ("ok plan ops final")
> **Autor:** Claude Code, 2026-06-16
> **Typ:** DUŻY task (schema + backend + admin UI + client UI + email/cron) — per D-049 wymaga tego planu
> **Powód:** Produktem abonamentu jest **czas**. Dziś aplikacja nie ma czym go policzyć,
> dostarczyć, rozliczyć ani pokazać. Ten moduł domyka "oferta w pełni obsługiwana".

---

## §0. Scope

Cztery moduły operacyjne dla abonamentu obsługi IT:

1. **Onboarding** — powtarzalny checklist nowego klienta (dostępy, AnyDesk, monitoring, backup, dokumentacja).
2. **Dostarczanie** — ewidencja godzin per klient/miesiąc (admin loguje robotę).
3. **Rozliczenie** — miesięczny rollup: w pakiecie + carryover − zużyte → overage; zestawienie + status rozliczenia.
4. **Raport/Retencja** — miesięczny mail do klienta ("X z Y h, co zrobiliśmy") + cron.

**Poza scope (świadomie):** hasła/dostępy klientów (→ menedżer haseł, NIE baza apki), RMM/monitoring (osobne narzędzie), ticketing (ADR-005 — nadal mail/telefon).

---

## §1. Decyzje (zablokowane 2026-06-16)

- **D-076** — Overage: **doliczamy nadgodziny** (soft cap). Praca trwa po wyczerpaniu pakietu, nadgodziny wg stawki, rozliczane miesięcznie.
- **D-077** — Rollover: **niewykorzystane godziny kumulują się** (z limitem — patrz §9 do potwierdzenia).
- **D-078** — Klient widzi swoje godziny **read-only w panelu** (wgląd, nie gating — spójne z D-071).
- **D-079** — Moduł rozliczenia budujemy **teraz** (kalkulator + zestawienie; wystawienie faktury ręczne do czasu Stripe/Fakturownia).
- **D-072** (z poprz. sesji) — Godziny/okresy/subskrypcje należą do **`Company`**, nie `User`.

---

## §2. Model danych (Migracja — nazwa: `add_ops_core`)

Wszystko spięte z `Company` (per D-072). **Decoupling od Stripe:** żeby nie blokować się odroczoną przebudową subskrypcji (S1), źródłem "jaki pakiet" jest na start ręcznie ustawiane pole `Company.servicePlan`. Gdy Stripe wejdzie, aktywna `Subscription` nadpisze to źródło.

```prisma
// Źródło prawdy dla parametrów pakietu (seed dla 3 tierów). Zastępuje
// hardcode "2h/5h/10h" z frontendu — i daje overage/SLA w jednym miejscu.
model ServicePackage {
  plan               SubscriptionPlan @id            // START | FIRMA | FIRMA_PLUS
  monthlyPriceNet    Decimal  @db.Decimal(10, 2)
  hoursIncluded      Int                              // 2 | 5 | 10
  overageRatePerHour Decimal  @db.Decimal(10, 2)      // stawka za nadgodzinę (netto)
  reactionTimeHours  Int                              // SLA czas reakcji (h roboczych)
  carryoverCapHours  Int                              // max kumulacji (per §9)
  updatedAt          DateTime @updatedAt
}

// Interim "jaki pakiet ma firma" do czasu wejścia Subscription (S1).
model Company {
  // ...existing...
  servicePlan   SubscriptionPlan?   // ręcznie ustawiane przez admina (active client)
  serviceSince  DateTime?           // od kiedy obsługa aktywna (start naliczania okresów)
}

// Pojedynczy wpis pracy (admin loguje). Minutes dla precyzji, h w UI.
model TimeEntry {
  id            String   @id @default(cuid())
  companyId     String
  periodId      String                          // do którego okresu należy (derived z date)
  date          DateTime                         // dzień wykonania pracy
  minutes       Int                              // czas w minutach
  description   String   @db.Text                // co zrobiono (idzie do raportu)
  billable      Boolean  @default(true)          // false = gest/gwarancja, nie liczy do pakietu
  createdById   String                           // admin który zalogował
  createdAt     DateTime @default(now())

  company       Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  period        ServicePeriod  @relation(fields: [periodId], references: [id], onDelete: Cascade)
  createdBy     User           @relation(fields: [createdById], references: [id])

  @@index([companyId, date])
  @@index([periodId])
}

// Miesięczny rachunek godzin per firma. Snapshot parametrów (pakiet/stawka
// mogą się zmienić w czasie) + status rozliczenia + carryover między okresami.
model ServicePeriod {
  id                 String   @id @default(cuid())
  companyId          String
  year               Int
  month              Int                          // 1-12
  plan               SubscriptionPlan             // snapshot pakietu w tym okresie
  hoursIncluded      Int                          // snapshot
  carryoverInHours   Int      @default(0)         // z poprzedniego okresu
  carryoverOutHours  Int      @default(0)         // do następnego (po capie)
  overageRatePerHour Decimal  @db.Decimal(10, 2)  // snapshot
  consumedMinutes    Int      @default(0)         // suma billable TimeEntry
  overageHours       Decimal  @db.Decimal(10, 2)  @default(0)
  overageAmountNet   Decimal  @db.Decimal(10, 2)  @default(0)
  status             ServicePeriodStatus @default(OPEN)
  settledAt          DateTime?
  reportSentAt       DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  company       Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  timeEntries   TimeEntry[]

  @@unique([companyId, year, month])
  @@index([companyId])
  @@index([status])
}

enum ServicePeriodStatus {
  OPEN        // bieżący miesiąc, godziny się naliczają
  TO_SETTLE   // miesiąc zamknięty, overage > 0, czeka na fakturę
  SETTLED     // rozliczony (faktura wystawiona/opłacona — ręcznie do czasu Stripe)
}

// Onboarding checklist 1:1 z firmą. Dyskretne kroki → raportowalne, spójne.
model CompanyOnboarding {
  companyId         String   @id
  accessCollected   DateTime?   // zebrano dostępy do systemów
  remoteToolReady   DateTime?   // AnyDesk/RustDesk zainstalowany u klienta
  monitoringSet     DateTime?   // monitoring skonfigurowany
  backupSet         DateTime?   // backup skonfigurowany
  docsCreated       DateTime?   // dokumentacja środowiska utworzona
  completedAt       DateTime?   // onboarding zakończony
  notes             String?  @db.Text
  updatedAt         DateTime @updatedAt

  company           Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
}
```

Relacje do dodania po stronie `Company`/`User`: `timeEntries`, `servicePeriods`, `onboarding`, oraz `User.loggedTimeEntries` (createdBy).

---

## §3. Logika rozliczania godzin (rollover + overage)

Dla okresu (firma, rok, miesiąc):

```
available = hoursIncluded + carryoverInHours
consumed  = sum(billable TimeEntry.minutes) / 60

if consumed <= available:
    overageHours      = 0
    carryoverOutHours = min(available - consumed, carryoverCapHours)   // cap per §9
else:
    overageHours      = consumed - available
    carryoverOutHours = 0
    overageAmountNet  = overageHours * overageRatePerHour
```

- **Tworzenie okresu:** lazy — pierwszy `TimeEntry` w danym miesiącu tworzy `ServicePeriod` (snapshot z `ServicePackage[company.servicePlan]`), pobierając `carryoverInHours` z `carryoverOutHours` poprzedniego okresu. Jeśli brak poprzedniego → 0.
- **Zamknięcie okresu:** cron 1. dnia miesiąca: poprzedni miesiąc → policz finalnie, ustaw status `TO_SETTLE` (gdy overage>0) lub `SETTLED` (gdy 0), zapisz `carryoverOutHours`, wyślij raport.
- **Snapshot** chroni historię, gdy admin zmieni pakiet/stawkę.

---

## §4. Backend — endpointy

**Admin** (`requireAuth('ADMIN')`, mount `/admin/...`):
- `POST   /admin/companies/:id/time-entries` — dodaj wpis (date, minutes, description, billable)
- `GET    /admin/companies/:id/time-entries?period=YYYY-MM` — lista
- `PATCH  /admin/time-entries/:id` / `DELETE /admin/time-entries/:id`
- `GET    /admin/companies/:id/periods` — rollup miesięcy (zużyte/available/overage/status)
- `PATCH  /admin/periods/:id/settle` — oznacz `SETTLED` (+ audit log)
- `POST   /admin/periods/:id/report` — wyślij raport ad-hoc
- `GET    /admin/companies/:id/onboarding` / `PATCH ...` — checklist
- `PATCH  /admin/companies/:id/service-plan` — ustaw `servicePlan` + `serviceSince` (aktywacja klienta)

**Klient** (`requireAuth('CLIENT')`, mount `/orders/my/...` lub nowe `/me/...`):
- `GET /me/hours?period=YYYY-MM` — read-only: available, consumed, remaining, overage, lista wpisów (description+minutes+date)

**Audit log:** nowe akcje `TIME_ENTRY_ADDED/UPDATED/DELETED`, `PERIOD_SETTLED`, `SERVICE_PLAN_SET`, `ONBOARDING_UPDATED`.

---

## §5. Admin UI (Next.js, `/admin/*`)

- **`/admin/klienci/[id]`** (lub rozbudowa istniejącej karty firmy) — zakładki:
  - **Godziny** — formularz "zaloguj czas" + tabela wpisów miesiąca + pasek "zużyto X z Y h (+ Z carryover)" + overage.
  - **Rozliczenia** — lista okresów (miesiąc / zużyte / overage zł / status) + przycisk "Oznacz rozliczone" + "Wyślij raport".
  - **Onboarding** — checklist (5 kroków, klik = data) + notatki + "zakończ onboarding".
  - **Pakiet** — ustaw `servicePlan` + `serviceSince` (aktywacja).
- **Sidebar:** nowa pozycja **"Klienci"** (lista firm z aktywnym `servicePlan`, kolumny: pakiet, zużycie bieżącego miesiąca, status onboardingu).
- **Dashboard admina:** widget "godziny w tym miesiącu" (firmy blisko/po limicie — kolor ostrzegawczy).

---

## §6. Client UI (panel)

- **`/panel/godziny`** (nowa) — read-only: duży licznik "X z Y h w tym miesiącu", carryover, ewentualny overage z kwotą, lista wykonanych prac (description + data). Link z `/panel/subskrypcja`.
- Spójne z Neo-Swiss; bez akcji (tylko wgląd).

---

## §7. Raport / retencja

- **Mail miesięczny** (Resend — już działa): "Podsumowanie [miesiąc]: wykorzystano X z Y h (w tym Z carryover). [jeśli overage: nadgodziny W h = V zł netto]. Co zrobiliśmy: <lista description>. Pozdrawiamy, Remigiusz + Wirgiliusz." Szablon w `utils/email.ts` (`emailLayout` helper).
- **Cron** (istniejąca infra job scheduler, TZ Europe/Warsaw): `0 9 1 * *` — 1. dnia o 09:00 zamknij poprzedni miesiąc + wyślij raporty. Idempotentne (sprawdza `reportSentAt`).
- Admin może wysłać raport ad-hoc (§4).

---

## §8. Decoupling od przebudowy subskrypcji (S1)

Ten moduł **nie czeka** na 1:N subscription rework ani Stripe:
- Źródło "pakiet firmy" = `Company.servicePlan` (admin ustawia ręcznie przy aktywacji klienta).
- Gdy S1/Stripe wejdą: aktywna `Subscription.plan` stanie się źródłem, a `Company.servicePlan` zostaje jako fallback/override. Migracja danych trywialna (0 klientów na starcie).

---

## §9. Decyzje do potwierdzenia (wartości — red-line)

Propozycje domyślne do akceptacji/zmiany:

| Parametr | Propozycja | Uwaga |
|---|---|---|
| **Stawka overage** | 150 zł/h netto (flat) | Wyżej niż krańcowa w pakiecie (Firma Plus = 119 zł/h) → zachęca do upgrade. Można per-tier. |
| **Cap carryover** | max = 1× godzin pakietu (np. Firma: do +5h) | Bez capu kumulacja rośnie w nieskończoność. Alternatywa: wygasanie po 1 mc. |
| **SLA czas reakcji** | Start 24h / Firma 8h / Firma Plus 4h (godz. robocze) | Dziś nie ma tego nigdzie — dodać też na `/pakiety` + do regulaminu. |
| **Dzień raportu** | 1. dnia mc, 09:00 | — |
| **Jednostka logowania** | minuty (UI: h:mm lub 1.5h) | — |

---

## §10. Fazowanie (sub-taski) + estymaty

- **OPS-1** — Schema + migracja `add_ops_core` + seed `ServicePackage` (3 tiery) + relacje. ~3h. **Gate schema.**
- **OPS-2** — Backend: time-entries CRUD + period rollup logic + service-plan/onboarding endpoints + audit. ~6h.
- **OPS-3** — Admin UI: karta klienta (godziny/rozliczenia/onboarding/pakiet) + sidebar "Klienci" + dashboard widget. ~8h.
- **OPS-4** — Client UI `/panel/godziny` (read-only). ~3h.
- **OPS-5** — Raport mail + cron miesięczny + ad-hoc. ~4h.

Razem ~24h CC + Twoje review. Każdy sub-task = osobny commit (atomic, Conventional Commits).

---

## §11. Gates

1. **GATE-1 (ten plik):** akceptacja scope + decyzji §9 → "ok plan ops final".
2. **GATE-2 (po OPS-1):** review migracji przed `migrate dev`.
3. **GATE-3 (po OPS-3):** wizualny review panelu admina (UX logowania godzin).

---

## §12. Wpływ na dokumenty

- **TODO.md** §13 — nowa faza **OPS** (po BE-4, równolegle/przed S1).
- **CLAUDE.md** §6 — dopisać modele ServicePackage/TimeEntry/ServicePeriod/CompanyOnboarding + nowy ADR (godziny jako produkt, in-app ledger — rewizja ADR-005 dla skali <50).
- **PRD** — SLA i overage do oferty.
