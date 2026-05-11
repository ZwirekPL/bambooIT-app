# FUTURE_TICKETS.md

Lista rzeczy do zrobienia później (out-of-scope dla aktualnego cleanupu DietetykDEV → bambooIT).

---

## Ticket: Prisma config migration to prisma.config.ts (deprecated in v6, removed in v7)

Priorytet: low

Kontekst: `packages/database/package.json` używa pola `"prisma": { "seed": "..." }`, które jest deprecated od Prisma v6 i zostanie usunięte w v7. Komunikat z `prisma generate`:

> `The configuration property package.json#prisma is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., prisma.config.ts).`

Co zrobić: utworzyć `packages/database/prisma.config.ts` i przenieść konfigurację seed (oraz inne ustawienia Prismy, jeśli pojawią się w trakcie cleanupu). Najlepiej zrobić to przy okazji rebuildu schema w fazie 4 (Company / ServicePackage / Ticket).
