# Encryption roadmap — co jest zaszyfrowane, co nie i dlaczego

**Wersja:** 1.0
**Data:** 17 kwietnia 2026 r.
**Dokument decyzyjny:** analiza kosztów/korzyści dalszego szyfrowania. **Nie
implementacja** — tylko rekomendacja, żeby świadomie zdecydować co zostaje
na później.

---

## TL;DR

- **Teraz zaszyfrowane (AES-256-GCM):**
  `Interview.answers`, `Interview.medicalFlags`, `DietPlan.content`,
  `DietitianNote.content`, `Message.content`
- **Teraz jawne (plaintext w DB):**
  `User.email`, `Patient.firstName`, `Patient.lastName`, `Patient.phone`,
  `Patient.weightKg`, `Patient.heightCm`, `Patient.sex`, `Patient.birthYear`,
  `CheckIn.*`, `BodyMeasurement.*`, `NutritionTargets.*`, `SupplementPrescription.*`
- **Rekomendacja na beta:** zostaw jak jest. Dodaj szyfrowanie dopiero
  **po** testach beta, gdy będziesz wiedział które pola rzeczywiście są
  potrzebne dla queries (filtrowanie, wyszukiwanie).

---

## 1. Co już jest zaszyfrowane

Szyfrowanie na poziomie aplikacji (`apps/backend/src/utils/encryption.ts`):
- **Algorytm:** AES-256-GCM
- **Klucz:** env `ENCRYPTION_KEY` (32 bajty hex)
- **IV:** losowe 12 bajtów per zapis
- **Format JSON:** `{v, iv, tag, data}`
- **Format string:** `v1:iv:tag:data`
- **Graceful legacy:** funkcje `decryptString`/`decryptJson` zwracają
  plaintext jeśli nie wykryją nagłówka — pozwala na gradual migration.

Fakt że dane są zaszyfrowane w DB oznacza że:
- **Wyciek bazy / dump** (bez klucza) → dane nieczytelne
- **Wyszukiwanie SQL** po szyfrowanym polu **niemożliwe**
  (np. `WHERE answers::text LIKE '%diabetes%'` — szukanie w DB **nie działa**,
  trzeba najpierw pobrać i odszyfrować w aplikacji)

Zaszyfrowane pola:

| Pole | Kategoria RODO | Dlaczego zaszyfrowane |
|---|---|---|
| `Interview.answers` | art. 9 — zdrowotne | Szczegóły wywiadu (choroby, leki, alergie) |
| `Interview.medicalFlags` | art. 9 — zdrowotne | Flagi medyczne (RED_FLAG wykryte przez policy) |
| `DietPlan.content` | art. 9 — zdrowotne (JSONB diety dla pacjenta) | Treść planu jest osobista + wynika z danych medycznych |
| `DietitianNote.content` | art. 9 — zdrowotne | Notatki dietetyka o pacjencie |
| `Message.content` | personal data | Korespondencja 1:1 |

---

## 2. Co jest jawne — i dlaczego

### 2.1. `User.email` — **jawne**

**Dlaczego jawne:** login. Query `WHERE email = ?` odpala się przy każdym
logowaniu. Encrypted email by wymagał zaszyfrowania również zapytania (AES
nie jest deterministyczne → każde szyfrowanie tego samego maila daje inną
wartość → `WHERE email = encrypt(?)` nigdy nie trafi).

**Ryzyko:** email to quasi-identyfikator — ujawnia kontakt + sam w sobie
nie jest art. 9.

**Alternatywa (gdyby była potrzebna):** hashing deterministyczny (HMAC-SHA256
z sekretem) dla lookup + encrypted dla odczytu. Podwaja komplikację, zero
realnych korzyści dla serwisu z 20-500 userów.

**Rekomendacja:** zostawić jawnie.

---

### 2.2. `Patient.firstName`, `Patient.lastName` — **jawne**

**To co sugeruje audit RODO.** Rzeczywiście w kontekście `Interview.answers`
(zdrowotnych, nawet zaszyfrowanych) łatwo zidentyfikowalne.

**Koszt zaszyfrowania:**
- Wyszukiwarka pacjentów w panelu dietetyka (`/dietetyk/pacjenci?search=Jan`)
  przestaje działać po stronie DB. Musiałaby pobierać **wszystkich pacjentów
  dietetyka** i filtrować w aplikacji. Dla dietetyka z 50 pacjentami — OK
  (50 rekordów, fetch <100ms). Dla 500+ — wolne, wymaga indexu po czymś innym.
- Sortowanie alfabetyczne — przestaje działać po DB, trzeba po aplikacji.
- Export PDF planu — zawiera imię pacjenta, musi być rozszyfrowane przed
  wstawieniem do template. Dodatkowy krok w pipeline.

**Korzyść:**
- Wyciek bazy → napastnik widzi "v1:abc..." zamiast "Magdalena Nowicka"
- Połączone z już zaszyfrowanym wywiadem → brak korelacji "kto ma jaką chorobę"

**Ryzyko residualne:** nadal można korelować przez `email` (jawny) → łatwe
dopasowanie osoby do wywiadu. Zaszyfrowanie samego `firstName/lastName` bez
`email` **nie likwiduje identyfikacji**, tylko obniża "wygodę" napastnika.

**Rekomendacja:**
- **Beta (<100 pacjentów):** zostaw jak jest. Realnie największe ryzyko
  wycieku to nie SQL dump, tylko wyciek Sentry/logów → już zaadresowane.
- **Launch komercyjny (>500 pacjentów):** rozważ wdrożenie razem z
  migracją `User.email` na hash+encrypt (punkt 2.1).

---

### 2.3. `Patient.phone` — **jawne**

Tak samo jak email — numer telefonu jest wyszukiwalny i łatwy do weryfikacji
(np. "ktoś tu zadzwonił"). Najlepiej **wcale nie zbierać** jeśli niepotrzebny.

**Audyt:** w kodzie `Patient.phone` jest opcjonalne. Sprawdź w formularzu
rejestracji/profilu czy jest wymagane — jeśli NIE, to dobrze, minimalizujemy.

**Rekomendacja:** nie szyfrować, ale **nie zbierać bez potrzeby**.

---

### 2.4. `Patient.weightKg`, `heightCm`, `sex`, `birthYear` — **jawne**

Dane biometryczne + demograficzne. Same w sobie **nie identyfikują** (wiele
osób ma 70 kg / 170 cm / K / 1985) ALE w kombinacji z imieniem/mailem są
identyfikowalne pośrednio.

**Koszt zaszyfrowania:**
- Filter/sort w panelu dietetyka (np. "pokaż pacjentów BMI > 30") przestaje
  działać po DB
- Obliczenia NutritionTargets (BMR, TDEE) muszą się dziać po odszyfrowaniu
  → każde generowanie planu = N odszyfrowań
- Agregaty statystyczne (średni BMI klientów dietetyka) → N fetchów +
  odszyfrowań

**Korzyść:** marginalna — BMI i waga bez kontekstu nie są "danymi medycznymi"
w rozumieniu art. 9 (to raczej general personal data).

**Rekomendacja:** zostaw jak jest.

---

### 2.5. `CheckIn.*` (waga po 7 dniach, samopoczucie, compliance) — **jawne**

Check-in to regularna ankieta od pacjenta (waga, samopoczucie 1-5, energia,
głód, uwagi).

**Argumenty za szyfrowaniem:**
- "Pacjent czuje się fatalnie, nie mogę zasnąć, mam depresję" w polu `notes`
- "Samopoczucie 2/5" + "nastrój 1/5" w serii to de facto obraz stanu
  psychicznego
- Te dane są pod Art. 9 (zdrowie)

**Argumenty przeciw:**
- Adaptacyjny algorytm planu diety musi je widzieć → pobieranie + decrypt
  per-iteration
- Wykres trendu wagi → pobieranie + decrypt N rekordów per-render

**Rekomendacja:** **zaszyfruj pole `notes` + `mood` + `energyLevel`** (tekst/narrative).
Zostaw jawne `weightKg`, `compliance` (liczby potrzebne do wykresów i analizy
bez kontekstu).

Priorytet: ŚREDNI, docelowo przed launchem komercyjnym.

---

### 2.6. `BodyMeasurement.*` (obwód talii, klatki, bioder, procent tkanki) — **jawne**

Detailed pomiary ciała zbierane przez dietetyka.

**Rekomendacja:** jak 2.4 — zostaw jawne, niska realna korelacja z
identyfikacją.

---

### 2.7. `NutritionTargets.*` (kaloryczność, makro, goal) — **jawne**

Cele dietetyczne + BMR/TDEE. Obliczone z danych pacjenta, nie są
bezpośrednio "danymi medycznymi" (to zalecenia).

**Rekomendacja:** zostaw jawne.

---

### 2.8. `SupplementPrescription.*` — **częściowo jawne**

Model zawiera `supplementName`, `dosage`, `frequency`, `notes`.
**`notes`** może zawierać wskazania medyczne (np. "niedobór żelaza potwierdzony
badaniem Fe").

**Rekomendacja:** **zaszyfruj `notes`**. Reszta zostaje.

Priorytet: ŚREDNI.

---

## 3. Fazowany plan wdrożenia (jeśli zdecydujesz)

### Faza A — przed launchem komercyjnym (nie blokuje bety)

| Pole | Zaszyfrować? | Migracja |
|---|---|---|
| `CheckIn.notes`, `CheckIn.mood`, `CheckIn.energyLevel` | TAK | `scripts/migrate-encrypt-checkins.ts` |
| `SupplementPrescription.notes` | TAK | `scripts/migrate-encrypt-supplements.ts` |

Wzorzec: skopiować `scripts/migrate-encrypt-dietitian-notes.ts`, dostosować.

Koszt: ~2h pracy + okno serwisowe na prodzie.

### Faza B — przy większej skali (>500 pacjentów)

| Pole | Zaszyfrować? | Komplikacja |
|---|---|---|
| `Patient.firstName`, `Patient.lastName` | TAK | Search po aplikacji zamiast DB. Wymaga paginacji. |
| `User.email` | Tylko jeśli wymagane | Hash+encrypt pattern. **Duża zmiana** — dotyka auth flow. |
| `Patient.phone` | Rozważ | Jeśli zbierasz. |

Koszt: ~8-16h pracy + testowanie całego flow auth/search + migracja.

### Faza C — nie wdrażaj (koszt > korzyść)

- `Patient.weightKg`, `heightCm`, `sex`, `birthYear`
- `NutritionTargets.*`
- `CheckIn.weightKg`, `CheckIn.compliance`
- `BodyMeasurement.*`

---

## 4. Alternatywy do "szyfrowanie pole-po-polu"

### 4.1. Pseudonimizacja

Zamiast szyfrować imiona, zastąp je pseudonimami (`PAT-xyz-123`) w głównej
bazie. Mapping imię ↔ pseudonim trzymaj w **osobnej bazie** do której
aplikacja sięga tylko dla operacji wymagających PII (email, powiadomienia).

Zaleta: queries na głównej bazie działają normalnie. Zwykły SQL dump bez
dostępu do mapping-db = bezużyteczny.

Wada: komplikacja architektury (2 DB, 2 backupy, więcej kodu).

Realnie — **za duża inwestycja** dla aplikacji tej wielkości.

### 4.2. Szyfrowanie na poziomie storage (Postgres TDE)

Hostinger nie oferuje natywnego Postgres TDE. Można by migrować na AWS RDS z
TDE albo samodzielnie skonfigurować filesystem-level encryption (LUKS). Ale
to chroni tylko przed fizyczną kradzieżą dysku — a dostęp SQL (właśnie jest
najbardziej prawdopodobny wektor) nadal nieograniczony.

Nie rekomenduję.

### 4.3. Szyfrowanie per-user key (envelope encryption)

Każdy user ma osobny klucz szyfrujący, szyfrowany master-keyem. Na poziomie
dietetyk/pacjent — dużo kluczy, dużo zarządzania, high complexity.

Dla enterprise health records (setki tysięcy pacjentów) — sens. Dla Twojej
skali — overkill.

---

## 5. Środki kompensujące (zamiast szyfrowania)

Jeśli nie szyfrujesz wszystkiego, **zamień na bezpieczeństwo operacyjne**:

### ✅ Już wdrożone (FAZA 1)
- **Sentry PII scrubbing** — żadne dane pacjentów nie wyciekają w logi błędów
- **Dane medyczne (Interview/DietPlan/Note) już szyfrowane** — realne "klejnoty koronne"
- **Backup szyfrowany GPG** — wyciek backupu bez hasła bezużyteczny

### ⚠️ Do wdrożenia w Fazie 2+
- **2FA dla ADMIN** — RODO rekomenduje MFA dla dostępu do danych art. 9.
  User odłożył na później, OK dla bety.
- **Rate limiting na endpoints zwracających wiele pacjentów** — już jest,
  warto zweryfikować limity (czy user nie pobierze całej bazy w 1000 requestów)
- **AuditLog na `VIEW_PATIENT`** — sprawdzić czy każde wejście na profil
  pacjenta jest logowane (tak, `auditLogs` → `VIEW_PATIENT`). Anomaly detection
  na bazie tego = "dietetyk pobrał 500 pacjentów w 1h" → alert.
- **Bezpieczne hasła ADMIN** — długie, menedżer haseł, rotacja raz na rok.

---

## 6. Decyzja do podjęcia

**Do użytkownika (Wirgiliusza):** przed launchem komercyjnym **zdecyduj** czy:

- [ ] **Opcja MINIMUM:** zaszyfruj `CheckIn.notes/mood/energy` +
  `SupplementPrescription.notes` (Faza A). Pozostawić imiona/emaile jawnie.
- [ ] **Opcja ŚREDNIA:** Faza A + zaszyfrowanie `Patient.firstName/lastName`
  (Faza B częściowo). Wymaga przepisania search/sort w panelu dietetyka.
- [ ] **Opcja MAKSIMUM:** Faza A + Faza B pełna (imiona + email hash).
  Wymaga dużej refaktoryzacji auth flow.

**Moja rekomendacja: Opcja MINIMUM dla launchu komercyjnego, Opcja ŚREDNIA
przy >200 pacjentów.**

---

## Historia zmian

| Data | Zmiana |
|---|---|
| 2026-04-17 | Utworzenie dokumentu (analiza decyzyjna, bez implementacji) |
