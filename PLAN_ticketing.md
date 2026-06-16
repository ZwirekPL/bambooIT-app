# PLAN_ticketing.md — System zgłoszeń (ticketing)

> **Status:** DRAFT — czeka na gate ("ok plan ticketing final")
> **Autor:** Claude Code, 2026-06-16
> **Typ:** DUŻY task (schema + backend + admin UI + client UI + email + SLA) — per D-049
> **Nadpisuje:** ADR-005 (część „bez ticket systemu") → nowy ADR-011.
> **Zastępuje:** #5 „mini-ticket" z listy sugestii — robimy pełny system zamiast dziennika.

---

## §0. Po co (i dlaczego teraz nadpisujemy ADR-005)

ADR-005 odkładał ticketing („mail/telefon wystarczą do ~50 klientów"). Zmieniamy decyzję, bo:
- **Godziny są już w aplikacji** (moduł OPS) — ticketing domyka pętlę **zgłoszenie → godziny → raport → faktura**.
- **SLA czasu reakcji** obiecane na `/pakiety` (24/8/4h) nie jest dziś nigdzie pilnowane — ticket nadaje mu deadline i alerty.
- **Self-service + transparentność** klienta („po drugiej stronie konkretny człowiek") — klient widzi status swoich spraw.
- Bez tego zgłoszenia żyją w skrzynce — gubią się, nie ma historii, nie wiadomo ile czasu poszło na co.

Right-sized: **nie** budujemy enterprise PSA (kolejki, automatyzacje, makra). Budujemy zwarty system zintegrowany z istniejącymi modelami.

---

## §1. Decyzje (zablokowane 2026-06-16)

- **D-080** — Zgłoszenia zakłada **klient (panel) ORAZ admin** (np. po telefonie).
- **D-081** — **Email-to-ticket → faza 2** (TKT-6). Start: portal + ręczne zakładanie.
- **D-082** — **Godziny powiązane z ticketem** (`TimeEntry.ticketId`), ticket pokazuje sumaryczny czas, raport „co zrobiliśmy" czerpie ze zgłoszeń.
- **D-083** — **SLA z pakietu** (`ServicePackage.reactionTimeHours`) — deadline reakcji + alerty na dashboardzie.

---

## §2. Model danych (Migracja — `add_ticketing`)

```prisma
enum TicketStatus {
  NEW              // utworzone, brak reakcji
  IN_PROGRESS      // przyjęte, w toku
  WAITING_CLIENT   // czekamy na odpowiedź klienta
  RESOLVED         // rozwiązane (czeka na potwierdzenie/zamknięcie)
  CLOSED           // zamknięte
}

enum TicketPriority { LOW NORMAL HIGH URGENT }

enum TicketChannel {
  PORTAL   // założone przez klienta w panelu
  PHONE    // admin zapisał z telefonu
  EMAIL    // faza 2 — inbound
  MANUAL   // wewnętrzne
}

model Ticket {
  id              String         @id @default(cuid())
  number          Int            @unique @default(autoincrement()) // ludzki nr #1042
  companyId       String
  createdById     String
  assigneeId      String?
  title           String
  status          TicketStatus   @default(NEW)
  priority        TicketPriority @default(NORMAL)
  channel         TicketChannel  @default(PORTAL)
  category        String?
  slaDueAt        DateTime?      // deadline reakcji (createdAt + pakiet.reactionTimeHours)
  firstResponseAt DateTime?      // pierwsza reakcja admina (SLA spełnione?)
  resolvedAt      DateTime?
  closedAt        DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  company     Company         @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdBy   User            @relation("TicketCreatedBy", fields: [createdById], references: [id])
  assignee    User?           @relation("TicketAssignee", fields: [assigneeId], references: [id])
  messages    TicketMessage[]
  timeEntries TimeEntry[]

  @@index([companyId])
  @@index([status])
  @@index([assigneeId])
  @@index([slaDueAt])
}

model TicketMessage {
  id        String   @id @default(cuid())
  ticketId  String
  authorId  String
  body      String   @db.Text
  internal  Boolean  @default(false) // notatka wewnętrzna — niewidoczna dla klienta
  createdAt DateTime @default(now())

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author User   @relation(fields: [authorId], references: [id])

  @@index([ticketId])
}

// Rozszerzenie istniejącego modelu:
model TimeEntry {
  // ...existing...
  ticketId String?
  ticket   Ticket? @relation(fields: [ticketId], references: [id], onDelete: SetNull)
}
```

Treść zgłoszenia = **pierwszy `TicketMessage`** (nie osobne pole `description`) — cały wątek w jednym miejscu. Relacje do dodania na `User` (`ticketsCreated`, `ticketsAssigned`, `ticketMessages`) i `Company` (`tickets`).

---

## §3. Logika SLA

- Przy utworzeniu: `slaDueAt = createdAt + ServicePackage[company.servicePlan].reactionTimeHours`.
  - **MVP: godziny kalendarzowe.** Godziny robocze (pn-pt 8-18, pomijanie weekendów) = refinement w §9.
  - Brak `servicePlan` → brak SLA (klient bez pakietu; ticket bez deadline).
- `firstResponseAt` ustawiane przy pierwszej **niewewnętrznej** wiadomości admina LUB zmianie statusu na `IN_PROGRESS`.
- **SLA spełnione** = `firstResponseAt <= slaDueAt`. Dashboard liczy: *zbliża się* (<2h do deadline, brak reakcji), *przekroczone* (po deadline, brak reakcji).

---

## §4. Backend — endpointy

**Klient** (`requireAuth('CLIENT')`, mount `/tickets` lub `/orders/my/...`; firma z `req.user`):
- `POST /tickets/my` — utwórz (title, body, priority?) → tworzy Ticket + pierwszy message, liczy SLA
- `GET  /tickets/my` — lista własnych (filtr status)
- `GET  /tickets/my/:id` — szczegóły (tylko własne; bez wiadomości `internal`)
- `POST /tickets/my/:id/messages` — odpowiedź; jeśli status `WAITING_CLIENT` → wraca do `IN_PROGRESS`

**Admin** (`requireAuth('ADMIN')`, mount `/admin/tickets`):
- `GET   /admin/tickets` — kolejka (filtr status/priority/companyId/assigneeId/sla, sort, paginacja)
- `GET   /admin/tickets/stats` — liczniki per status + przekraczające SLA
- `GET   /admin/tickets/:id` — szczegóły (z `internal`)
- `POST  /admin/tickets` — utwórz w imieniu firmy (channel PHONE/MANUAL)
- `PATCH /admin/tickets/:id` — status / priority / assignee / category
- `POST  /admin/tickets/:id/messages` — odpowiedź (flaga `internal`)

**Audit:** `TICKET_CREATED/UPDATED/MESSAGE_ADDED/STATUS_CHANGED/ASSIGNED`.

**Integracja godzin:** admin loguje czas (istniejący `addTimeEntry`) z opcjonalnym `ticketId`; ticket sumuje czas; raport miesięczny grupuje „co zrobiliśmy" po ticketach.

---

## §5. Powiadomienia (Resend — działa)

| Zdarzenie | Do kogo |
|---|---|
| Nowy ticket (klient) | admini (`NOTIFICATIONS_TO_EMAIL`) |
| Odpowiedź admina | klient |
| Odpowiedź klienta | assignee (lub admini) |
| Status RESOLVED | klient (z prośbą o potwierdzenie) |

Szablony w `utils/email.ts` (`emailLayout`). Wszystkie z linkiem do zgłoszenia w panelu.

---

## §6. Admin UI

- **Sidebar:** „Zgłoszenia" (Ticket icon) — z licznikiem otwartych.
- **`/admin/zgloszenia`** — kolejka: nr, tytuł, klient, status (badge), priorytet, **odliczanie SLA** (kolor), assignee. Filtry + „przekraczające SLA".
- **`/admin/zgloszenia/[id]`** — wątek (wiadomości + notatki wewnętrzne), pole odpowiedzi (toggle „notatka wewnętrzna"), kontrolki status/priority/assignee/kategoria, **„Zaloguj czas"** (wpis godzin przypięty do ticketu) + suma czasu, dane klienta + skrót do karty klienta.
- **Dashboard admina:** widget „otwarte zgłoszenia" + „przekraczające SLA".

## §7. Client UI (panel)

- **`/panel/zgloszenia`** — lista moich zgłoszeń + „Nowe zgłoszenie".
- **`/panel/zgloszenia/[id]`** — wątek + odpowiedź; status widoczny; bez notatek wewnętrznych.
- **Nowe zgłoszenie** — formularz: tytuł, opis, priorytet (opcjonalnie). Po wysłaniu widać nr + SLA („odpowiemy do …").
- Link z `/panel/subskrypcja` i `/panel/godziny`.

---

## §8. Fazowanie + estymaty

- **TKT-1** — schema (Ticket, TicketMessage, TimeEntry.ticketId) + migracja + seed/SLA wiring. ~3h. **Gate schema.**
- **TKT-2** — backend (klient + admin endpointy, SLA compute, audit, integracja godzin). ~7h.
- **TKT-3** — admin UI (kolejka + szczegóły + odpowiedzi + status + log czasu). ~9h.
- **TKT-4** — client UI (panel zgłoszeń + nowe + wątek). ~5h.
- **TKT-5** — powiadomienia Resend + SLA dashboard/alerty. ~4h.
- **TKT-6** — **faza 2:** email-to-ticket (inbound provider + parsing). osobno, później.

Razem TKT-1..5 ~28h CC + Twoje review. Atomowe commity.

---

## §9. Decyzje do potwierdzenia (red-line)

| Parametr | Propozycja |
|---|---|
| Kategorie | Sprzęt · Sieć/internet · Poczta/M365 · Oprogramowanie · Bezpieczeństwo · Konto/dostępy · Inne |
| Priorytety | LOW / NORMAL / HIGH / URGENT (domyślnie NORMAL) |
| SLA liczone | godziny **kalendarzowe** w MVP (robocze pn-pt 8-18 = refinement) |
| Numeracja | autoincrement od 1000 (`#1000`) |
| Kto ustala priorytet | klient sugeruje, admin może zmienić |

---

## §10. Gates

1. **GATE-1 (ten plik):** scope + decyzje §9 → „ok plan ticketing final".
2. **GATE-2 (po TKT-1):** review migracji.
3. **GATE-3 (po TKT-3):** wizualny review kolejki + obsługi zgłoszenia.

## §11. Wpływ na dokumenty

- **CLAUDE.md** — nowy **ADR-011** (własny ticket system, nadpisuje ADR-005 w części ticketowej) + modele w §6.
- **TODO.md** — nowa faza **TKT** (§15).
- **PRD** — SLA + proces zgłoszeń.
