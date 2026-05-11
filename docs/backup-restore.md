# Backup & Restore — instrukcja

Dwa tryby pracy:

| Tryb | Kiedy używać | Skrypty |
|------|-------------|---------|
| **Pełny backup** | Przed deployem, cotygodniowy backup, migracja serwera | `db:backup` / `db:restore` |
| **Częściowy export/import** | Synchronizacja przepisów i produktów dev→prod | `db:export:*` / `db:import:*` |

---

## Pełny backup (`backup-database.ts`)

Eksportuje: przepisy, produkty, reguły kliniczne, protokoły żywieniowe, feature flagi, posty blogowe.  
**Nie eksportuje:** danych medycznych pacjentów (zaszyfrowane), haseł, tokenów, logów audytu.

### Tworzenie backupu

```bash
npm run db:backup
# → scripts/data/backup-2026-04-13/
#     recipes.json
#     clean-products.json
#     clinical-rules.json
#     nutrition-protocols.json
#     feature-flags.json
#     blog-posts.json
#     manifest.json
```

Folder backupu zawiera `manifest.json` z datą, liczbą rekordów i wersją schematu.

### Restore z backupu

```bash
# Dry run — podgląd bez zapisu
npm run db:restore -- scripts/data/backup-2026-04-13 --dry-run

# Właściwy restore
npm run db:restore -- scripts/data/backup-2026-04-13
```

Restore importuje w prawidłowej kolejności FK:
1. clean-products
2. recipes
3. clinical-rules
4. nutrition-protocols
5. feature-flags
6. blog-posts

Istniejące rekordy (po slug/key/name) są **pomijane** — restore nie nadpisuje danych.  
Wynik: tabela `imported / skipped / errors` dla każdej kategorii.

### Przeniesienie backupu na serwer produkcyjny

```bash
# Spakuj folder
tar -czf backup-2026-04-13.tar.gz scripts/data/backup-2026-04-13/

# Wyślij na serwer
scp backup-2026-04-13.tar.gz user@31.97.75.190:/app/scripts/data/

# Na serwerze: rozpakuj i przywróć
ssh user@31.97.75.190
cd /app
tar -xzf scripts/data/backup-2026-04-13.tar.gz -C scripts/data/
npm run db:restore -- scripts/data/backup-2026-04-13 --dry-run
npm run db:restore -- scripts/data/backup-2026-04-13
```

---

## Częściowy export/import (przepisy i produkty)

Używaj gdy chcesz zsynchronizować tylko bazę przepisów/produktów, z obsługą **upsert** (aktualizuje istniejące).

### Export

```bash
# Oba naraz (produkty najpierw)
npm run db:export:all

# Lub osobno
npm run db:export:products   # → scripts/data/clean-products-export.json (~15-25 MB)
npm run db:export:recipes    # → scripts/data/recipes-export.json (~5-15 MB)

# Z przepisami AI (domyślnie eksportuje tylko zatwierdzone)
npm run db:export:recipes -- --include-ai
```

### Import

```bash
# Dry run
npm run db:import:products -- --dry-run
npm run db:import:recipes  -- --dry-run

# Właściwy import (KOLEJNOŚĆ: produkty przed przepisami!)
npm run db:import:all

# Lub osobno
npm run db:import:products
npm run db:import:recipes
```

**Upsert po slug** — ponowne uruchomienie aktualizuje istniejące rekordy zamiast duplikować.  
Progress bar w terminalu; przy błędzie wypisuje slug i komunikat, ale kontynuuje.

### Przeniesienie plików na serwer

```bash
scp scripts/data/clean-products-export.json user@31.97.75.190:/app/scripts/data/
scp scripts/data/recipes-export.json        user@31.97.75.190:/app/scripts/data/
```

---

## Dane serwera produkcyjnego

| | |
|---|---|
| IP | `31.97.75.190` |
| Domena | `e-dietetyk.com` |
| Ścieżka aplikacji | `/app` |

---

## Pliki i gitignore

| Plik/folder | Opis |
|-------------|------|
| `scripts/backup-database.ts` | Pełny backup (6 kategorii) |
| `scripts/restore-database.ts` | Restore z folderu backupu |
| `scripts/export-recipes.ts` | Export przepisów |
| `scripts/import-recipes.ts` | Import/upsert przepisów |
| `scripts/export-clean-products.ts` | Export produktów |
| `scripts/import-clean-products.ts` | Import/upsert produktów |
| `scripts/data/backup-*/` | Foldery backupów — **gitignored** |
| `scripts/data/*.json` | Pliki exportów — **gitignored** |

---

## Troubleshooting

**`File not found: scripts/data/...`**  
→ Uruchom najpierw export lub skopiuj plik z innej maszyny.

**`Foreign key constraint failed` przy imporcie przepisów**  
→ Produkt czysty nie istnieje na docelowej bazie. Uruchom `db:import:products` przed `db:import:recipes`.

**Import jest wolny**  
→ Normalne dla dużych zbiorów (6 600+ produktów): produkty ~3-5 min, przepisy ~2-4 min.  
→ Nie przerywaj w trakcie — rekordy są commitowane po jednym.

**`ERROR on <slug>: Unique constraint failed`**  
→ Rekord już istnieje z innym ID (nie po slug). Sprawdź duplikaty w DB.

**Restore pomija rekordy**  
→ Celowe — restore nie nadpisuje istniejących danych. Użyj `db:import:*` (upsert) jeśli chcesz aktualizować.
