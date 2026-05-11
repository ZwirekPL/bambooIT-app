# Ocena skutków dla ochrony danych (DPIA) — e-dietetyk.com

**Wersja:** 0.1 DRAFT — szkielet do uzupełnienia z prawnikiem / IOD
**Data utworzenia:** 17 kwietnia 2026 r.
**Administrator danych:** Wirgiliusz Ładziński (JDG)

**Podstawa prawna obowiązku DPIA:**
- RODO Art. 35 ust. 1 i 3 (systematyczne przetwarzanie na dużą skalę danych
  szczególnych kategorii — art. 9)
- Wytyczne Grupy Roboczej Art. 29 (WP248)
- UODO — wykaz przetwarzań wymagających DPIA (monit. 19.07.2018)
- AI Act (EU 2024/1689) — high-risk AI system w kontekście zdrowia

**Szablon:** https://uodo.gov.pl/pl/138/1054

---

## ⚠️ NOTATKA OPERACYJNA

Ten dokument to **szkielet wypełniany etapami**:
1. **Techniczną część (sekcje 1-5, 7-9)** — administrator (autor projektu).
   Można uzupełnić bez prawnika.
2. **Sekcje ryzyka i środków (6, 10)** — wymagają konsultacji prawnej. W
   pierwszej wersji można oszacować samodzielnie, ale **przed launchem
   komercyjnym** finalna DPIA powinna być zweryfikowana przez radcę
   prawnego / IOD.

Kara za brak DPIA przy obowiązku prowadzenia: do 10 mln EUR lub 2% obrotu
(Art. 83 ust. 4 RODO).

---

## 1. Opis przetwarzania

### 1.1. Nazwa procesu
Automatyczne generowanie spersonalizowanych planów dietetycznych z
wykorzystaniem modeli AI (GPT-4.1), na podstawie danych z wywiadu
żywieniowego i danych zdrowotnych pacjenta.

### 1.2. Cel przetwarzania
Udostępnienie pacjentom spersonalizowanych planów żywieniowych oraz
umożliwienie dietetykowi prowadzenia opieki żywieniowej z wykorzystaniem
platformy elektronicznej.

### 1.3. Zakres przetwarzania

**Kategorie osób, których dane są przetwarzane:**
- Pacjenci (osoby fizyczne korzystające z planów dietetycznych)
- Dietetycy (osoby fizyczne świadczące usługi)
- Admin (Wirgiliusz Ładziński)

**Przewidywana skala:**
- Faza beta (2026 Q2): 20 dietetyków + ~200 pacjentów
- Launch komercyjny (2026 Q3+): skalowanie według popytu, docelowo 500-5000 pacjentów

**Kategorie danych osobowych:**

**Identyfikujące:**
- Imię, nazwisko
- Email
- Telefon (opcjonalnie)

**Dane logowania:**
- Hasło (przechowywane jako hash bcrypt, niedszyfrowalne)
- JWT session token (ważny 7 dni)

**Dane demograficzne:**
- Wiek, płeć, waga, wzrost

**Dane zdrowotne (art. 9 RODO — szczególne kategorie):**
- Choroby przewlekłe (diabetes, IBS, hypertension, etc.)
- Alergie pokarmowe
- Nietolerancje
- Leki
- Problemy trawienne
- Hormony (np. niedoczynność tarczycy, insulinooporność)
- Ciąża / laktacja
- Wyniki badań (lab panel — opcjonalnie, w Fazie 1+)

**Dane behawioralne:**
- Odpowiedzi z wywiadu żywieniowego
- Check-iny (waga, samopoczucie, compliance)
- Preferencje kulinarne
- Ulubione / nielubiane produkty

**Dane finansowe:**
- Transakcje Stripe (zamówienia, subskrypcje)

**Dane techniczne:**
- Adres IP (w AuditLog)
- Device fingerprint (w ograniczeniach trial)
- User agent

### 1.4. Podstawa prawna (Art. 6 + 9 RODO)

| Kategoria danych | Podstawa prawna |
|---|---|
| Dane identyfikujące + konto | Art. 6 ust. 1 lit. b (wykonanie umowy — rejestracja) |
| Dane zdrowotne z wywiadu | Art. 9 ust. 2 lit. a (wyraźna zgoda) + Art. 9 ust. 2 lit. h (zdrowie, przez dietetyka) |
| Dane transakcyjne | Art. 6 ust. 1 lit. b + obowiązek prawny (księgowość) |
| Cookies analityczne | Art. 6 ust. 1 lit. a (zgoda) + art. 5 ust. 3 ePrivacy |
| Logi / AuditLog | Art. 6 ust. 1 lit. f (uzasadniony interes — bezpieczeństwo) |

### 1.5. Odbiorcy danych

Zobacz `docs/subprocessors.md` — aktualny rejestr podprocesorów.
Najważniejsi: OpenAI (USA), Stripe (USA/EU), UAB Hostinger (Litwa, EU),
Resend (USA), Sentry (USA), Google GA4 (EU→USA).

### 1.6. Okres przechowywania

| Kategoria | Okres |
|---|---|
| Aktywne konto | Przez czas trwania umowy |
| Konto po `deletedAt` (soft delete) | 30 dni, potem hard delete (cron job — Faza 2.1) |
| AuditLog | 5 lat (cron job — Faza 2.2) |
| Backup | 30 dni lokalnie |
| Dane faktur / księgowości | 5 lat (obowiązek podatkowy) |
| Dane zdrowotne po usunięciu konta | Usuwane kaskadowo z User; zostaje tylko AuditLog bez wskazania konkretnej osoby |

---

## 2. Analiza proporcjonalności i konieczności

### 2.1. Czy przetwarzanie jest konieczne do osiągnięcia celu?

**TAK.** Cel: spersonalizowany plan żywieniowy. Personalizacja wymaga
znajomości:
- Celu (redukcja, utrzymanie, budowa masy)
- Stanu zdrowia (choroby wykluczające pewne produkty)
- Alergii i nietolerancji (bezpieczeństwo pacjenta)
- Parametrów biometrycznych (obliczenie zapotrzebowania kalorycznego)

Brak tych danych = brak personalizacji = produkt bezużyteczny.

### 2.2. Czy są mniej inwazyjne metody?

Rozpatrzone alternatywy:
- **Plany ogólne (bez danych zdrowotnych):** nie spełniają celu
  spersonalizowanej opieki dietetycznej
- **Anonimizacja przed wysłaniem do AI:** **WDROŻONA** — OpenAI dostaje
  zanonimizowany zbiór danych (bez imienia, maila, nazwy pacjenta)
- **Przetwarzanie na urządzeniu użytkownika (client-side AI):** nierealne
  — GPT-4.1 wymaga ~10 GB VRAM
- **Ograniczenie zakresu danych:** zakres już minimalizowany
  — zbieramy tylko to co jest używane w algorytmie (nie np. dochód, wyznanie)

### 2.3. Minimalizacja danych

- Pola "preferencje kulinarne", "aktywność" — pobierane ale nie są
  wymagane (user może pominąć)
- Phone number — opcjonalny
- OpenAI dostaje **tylko** zanonimizowany fragment wywiadu potrzebny do
  generacji — nigdy cały profil użytkownika

---

## 3. Konsultacja z zainteresowanymi stronami

### 3.1. Osoby fizyczne (pacjenci)

- **Informacja przed zebraniem danych:** polityka prywatności (w formularzu
  rejestracji + w przypinanym banerze), wyraźne zgody na kategorie
- **Prawo dostępu / wycofania zgody:** panel użytkownika + endpoint
  `/profile/data-export` (DSAR)
- **Feedback w trakcie testów beta:** dedykowana ankieta po 30 dniach
  (TODO, pre-launch)

### 3.2. Dietetycy

- **Umowa powierzenia danych (UPDO)** — każdy dietetyk podpisuje umowę
  regulującą zasady dostępu do danych pacjentów (TODO, pre-launch)
- **Szkolenie z bezpieczeństwa** — krótka informacja w onboardingu
  (TODO)

### 3.3. IOD / prawnik

- **Status:** IOD nie wyznaczony (nieobowiązkowy dla JDG o tej skali)
- **Konsultacja prawna:** **rekomendowana przed launchem komercyjnym** —
  weryfikacja sekcji 6 i 10 tego dokumentu.

---

## 4. Środki zabezpieczające — już wdrożone

### 4.1. Techniczne

| Środek | Status | Dokumentacja |
|---|---|---|
| Szyfrowanie haseł bcrypt | ✅ | `auth.service.ts` |
| Szyfrowanie danych zdrowotnych AES-256-GCM | ✅ | `encryption.ts` — Interview, DietPlan, Note, Message |
| Połączenia HTTPS/TLS (Let's Encrypt) | ✅ | nginx + certbot |
| JWT z 7-dniowym expiry | ✅ | `auth.ts` |
| Rate limiting | ✅ | `rateLimiters.ts` |
| CSRF protection | ✅ | `middleware/csrf.ts` |
| Content Security Policy | ✅ | `next.config.ts` |
| HTTP Strict Transport Security | ✅ | nginx + next.config.ts |
| Zod validation on every endpoint | ✅ | controllers |
| Sentry PII scrubbing | ✅ | `docs/sentry-pii-scrubbing.md` |
| Cookie banner z kategoriami + consent-gated GA4 | ✅ | RODO Faza 1.1 |
| Szyfrowany backup GPG AES-256 | ✅ | `docs/backup-recovery.md` |
| Cron hard-delete soft-deleted User po 30d | ✅ | RODO Faza 2.1 |
| Cron AuditLog retention 5 lat | ✅ | RODO Faza 2.2 |

### 4.2. Organizacyjne

| Środek | Status |
|---|---|
| Polityka prywatności (PL + EN) | ✅ `apps/web/content/legal/*/polityka-prywatnosci.md` |
| Polityka cookies (PL + EN) | ✅ `apps/web/content/legal/*/polityka-cookies.md` |
| Polityka retencji | ✅ `docs/legal/osoba-fizyczna/polityka-retencji.md` |
| Rejestr podprocesorów | ✅ `docs/subprocessors.md` |
| Procedura naruszeń | ✅ `docs/data-breach-procedure.md` |
| Checklist DPA | ✅ `docs/legal/checklist-dpa-podprocesorow.md` |
| UPDO z dietetykami | ⚠️ TODO przed launchem |
| Szkolenie bezpieczeństwa dietetyków | ⚠️ TODO |
| Test-restore backupu raz na miesiąc | ⚠️ Procedura w docs, wdrożenie manualne |

### 4.3. OpenAI (szczególne środki dla transferu do USA)

- **Anonimizacja** — OpenAI dostaje wywiad bez imienia/maila/telefonu
- **SCC** — standardowe klauzule umowne podpisane automatycznie przez DPA OpenAI
- **Zero retention API mode** — **WERYFIKACJA** w konsoli OpenAI
  → Settings → Data Controls → API data retention = 0

---

## 5. Analiza ryzyka dla praw i wolności osób

Metodologia: prawdopodobieństwo × skala skutku = ryzyko (niskie/średnie/wysokie).

### 5.1. Ryzyko: wyciek bazy danych

| Parametr | Ocena |
|---|---|
| Prawdopodobieństwo | ŚREDNIE (typowy wektor ataku) |
| Skala (ilu osób) | Wysoka (wszystkie konta) |
| Charakter | Dane zdrowotne + identyfikujące |
| Skutek dla osób | WYSOKI — dane art. 9, możliwa kradzież tożsamości, dyskryminacja |
| **Ryzyko szczątkowe po środkach** | **ŚREDNIE** (dane zdrowotne zaszyfrowane, ale imiona/emaile jawne — łatwa korelacja) |

**Środki redukcji:**
- Backup szyfrowany GPG ✅
- Hostinger firewall, brak publicznego dostępu do PG (port 5432 tylko wewnętrznie) ✅
- Rate limiting na endpointy eksportu ✅
- Rozważyć szyfrowanie imion (`docs/encryption-roadmap.md`) ⚠️ decyzja

### 5.2. Ryzyko: błąd AI (halucynacja planu)

| Parametr | Ocena |
|---|---|
| Prawdopodobieństwo | ŚREDNIE (GPT-4.1 halucynuje w 3-5% przypadków) |
| Skala | Indywidualna (jeden plan dotknięty) |
| Skutek | ŚREDNI-WYSOKI — niewłaściwa dieta może szkodzić (np. ukryty alergen) |

**Środki redukcji:**
- **Policy Engine** — 85 reguł POLICY + 16 RED_FLAG blokuje niebezpieczne
  kombinacje PRZED wysłaniem do AI ✅
- **Clinical Safety** warnings + hard-stops ✅
- **Dietetyk jako człowiek w pętli** — plan wymaga zatwierdzenia przez
  profesjonalistę przed wysłaniem do pacjenta ✅
- **Zanonimizowany prompt** — AI nie zna kontekstu osoby, zmniejsza
  bias ✅

### 5.3. Ryzyko: zhackowane konto ADMIN

| Parametr | Ocena |
|---|---|
| Prawdopodobieństwo | NISKIE-ŚREDNIE |
| Skala | KATASTROFALNA (dostęp do wszystkich pacjentów) |
| Skutek | WYSOKI — pełen dostęp, możliwy wyciek + modyfikacja |

**Środki redukcji:**
- Silne hasło + menedżer haseł ⚠️ (organizacyjnie, do weryfikacji)
- 2FA dla ADMIN — **do wdrożenia** (RODO Faza 2.4, odłożone przez użytkownika)
- AuditLog każdej akcji admin ✅
- Sentry alerty na podejrzane akcje ⚠️ do skonfigurowania

**Ryzyko szczątkowe: WYSOKIE** do czasu wdrożenia 2FA. Akceptowalne dla
bety (zamknięta, 20 dietetyków) — **NIE akceptowalne dla launchu
komercyjnego**.

### 5.4. Ryzyko: nieuprawniony dostęp do danych pacjenta przez dietetyka

| Parametr | Ocena |
|---|---|
| Prawdopodobieństwo | NISKIE |
| Skala | Indywidualna (1 pacjent / 1 incydent) |
| Skutek | ŚREDNI |

**Środki redukcji:**
- Dietetyk widzi TYLKO swoich pacjentów (filter `WHERE dietitianId = req.user.sub`) ✅
- AuditLog `VIEW_PATIENT` ✅
- UPDO z dietetykami (kar za nadużycia) ⚠️ TODO

### 5.5. Ryzyko: transfer do USA (OpenAI / Stripe / Resend / Sentry / Google)

| Parametr | Ocena |
|---|---|
| Prawdopodobieństwo egzekwowania CLOUD Act | NISKIE (aplikacja niszowa, nie w sferze interesów USA) |
| Skala | ZALEŻNA od podprocesora — OpenAI widzi tylko zanonimizowane dane |
| Skutek | ŚREDNI |

**Środki redukcji:**
- SCC ze wszystkimi podprocesorami w USA ✅
- Dane medyczne do OpenAI — **zanonimizowane** ✅
- Resend / Sentry — filtrowane (żadnych danych medycznych) ✅
- Google GA4 — tylko po zgodzie użytkownika + anonimizowany IP ✅

### 5.6. Ryzyko: niewłaściwe przetwarzanie AI (dyskryminacja, uprzedzenia)

Model GPT-4.1 może powielać uprzedzenia obecne w danych treningowych.
Np. automatyczne zaniżanie kaloryczności dla kobiet, ignorowanie
kulturowych preferencji żywieniowych.

| Parametr | Ocena |
|---|---|
| Prawdopodobieństwo | NISKIE-ŚREDNIE |
| Skala | Systematyczna (jeśli wystąpi, dotyka całej klasy userów) |
| Skutek | ŚREDNI |

**Środki redukcji:**
- Policy Engine z regułami (85 POLICY) bazującymi na wytycznych NFZ i
  standardach dietetycznych — stanowi deterministyczną warstwę poza AI ✅
- **Dietetyk jako gatekeeper** — finalna walidacja przez człowieka ✅
- **Policy metadata + trace** — każdy plan ma zapisany log dlaczego
  takie rekomendacje (`DietPlan.policyMetadata`) → audytowalność ✅
- Ocena planów (pacient rating + scoring system) → feedback loop ✅

---

## 6. Środki ograniczające ryzyko szczątkowe

**Do zrealizowania przed launchem komercyjnym:**

- [ ] 2FA dla ADMIN (RODO Faza 2.4 odłożone)
- [ ] Off-site backup (RODO Faza 2.3 follow-up)
- [ ] UPDO z każdym dietetykiem (wzór umowy)
- [ ] Szkolenie bezpieczeństwa dla dietetyków
- [ ] Weryfikacja OpenAI zero-retention w konsoli API
- [ ] Konsultacja z prawnikiem / IOD sekcji 5 i tej DPIA
- [ ] Regularne test-restore backupu (1x/mc)
- [ ] Monitoring anomalii w AuditLog (np. dietetyk pobiera 100 pacjentów w 1h)

**Do rozważenia długoterminowo:**

- [ ] Szyfrowanie `Patient.firstName/lastName` (`docs/encryption-roadmap.md`)
- [ ] Migracja Sentry na EU region (obecnie US)
- [ ] Wyznaczenie IOD gdy skala przekroczy 1000 pacjentów

---

## 7. Wynik DPIA

**Ocena końcowa: AKCEPTOWALNE RYZYKO DLA TESTÓW BETA**

Uzasadnienie:
- Najistotniejsze techniczne środki (szyfrowanie, Policy Engine, AuditLog,
  consent management, backup) są wdrożone.
- Ryzyka szczątkowe (brak 2FA admin, brak off-site backup) są znane i
  planowane do uzupełnienia przed launchem komercyjnym.
- Skala bety (20 dietetyków + ~200 pacjentów) proporcjonalna do
  przyjętych środków.

**DLA LAUNCHU KOMERCYJNEGO:** **wymagane uzupełnienie** punktów z sekcji 6
oraz konsultacja prawna całej DPIA.

**Konsultacja z organem nadzorczym (Art. 36 RODO):** nie jest wymagana,
ponieważ identyfikowane ryzyka szczątkowe są kontrolowane znanym zestawem
środków.

---

## 8. Decyzja administratora

**[DO PODPISU]**

Jako administrator danych, na podstawie powyższej oceny, wyrażam zgodę /
zalecam modyfikacje / wstrzymuję przetwarzanie danych w projekcie
e-dietetyk.com w zakresie opisanym w sekcji 1.

Podpis: ______________________________
Data:   ______________________________

---

## 9. Historia weryfikacji DPIA

| Data | Osoba | Zakres | Wniosek |
|---|---|---|---|
| 2026-04-17 | Wirgiliusz Ładziński | Pierwsze utworzenie DPIA | Akceptowalne dla testów beta; weryfikacja prawna przed launchem |

Cykliczna weryfikacja: **co 12 miesięcy** lub przy każdej znaczącej zmianie
przetwarzania (nowy podprocesor, nowa kategoria danych, zmiana celu).

---

## 10. Załączniki — powiązane dokumenty

- [Polityka prywatności PL](../apps/web/content/legal/pl/polityka-prywatnosci.md)
- [Rejestr podprocesorów](./subprocessors.md)
- [Procedura naruszeń](./data-breach-procedure.md)
- [Checklist DPA](./legal/checklist-dpa-podprocesorow.md)
- [Polityka retencji](./legal/osoba-fizyczna/polityka-retencji.md)
- [Encryption roadmap](./encryption-roadmap.md)
- [Sentry PII scrubbing](./sentry-pii-scrubbing.md)
- [Backup i odzyskiwanie](./backup-recovery.md)
- [Audyt RODO](./rodo-audit.md)

---

## ❗ TO-DO — co uzupełnić przed konsultacją prawną

Lista pól wymagających uzupełnienia lub weryfikacji przed pokazaniem DPIA
prawnikowi:

- [ ] NIP administratora + pełny adres korespondencyjny
- [ ] Weryfikacja OpenAI "zero retention" (screenshot z konsoli)
- [ ] Liczba aktywnych użytkowników na moment analizy (statystyka z admin panel)
- [ ] Daty pobranych DPA podprocesorów (OpenAI, Stripe, Hostinger, Resend, Sentry, Google)
- [ ] Ankieta feedbackowa od pacjentów beta (przed launchem)
- [ ] Wzór UPDO z dietetykiem (do podłączenia)
- [ ] Raport z pierwszego test-restore backupu

---

*DPIA w wersji DRAFT. Przed podpisem przez administratora i przed launchem
komercyjnym **wymagana konsultacja prawna**.*
