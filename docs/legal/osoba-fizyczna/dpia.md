# Ocena Skutków dla Ochrony Danych (DPIA)

**Podstawa prawna:** art. 35 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)

**Administrator danych:** Wirgiliusz Ładziński
**Adres:** ul. Pod Brzozami 16/8a, 03-995 Warszawa
**Serwis:** e-dietetyk.com
**Data sporządzenia:** 23 marca 2026 r.
**Wersja:** 1.0
**Autor:** Wirgiliusz Ładziński (administrator danych)
**Status:** Zatwierdzony

---

## Spis treści

1. [Wprowadzenie i uzasadnienie przeprowadzenia DPIA](#1-wprowadzenie-i-uzasadnienie-przeprowadzenia-dpia)
2. [Systematyczny opis operacji przetwarzania](#2-systematyczny-opis-operacji-przetwarzania)
3. [Ocena konieczności i proporcjonalności](#3-ocena-konieczności-i-proporcjonalności)
4. [Identyfikacja i ocena ryzyk](#4-identyfikacja-i-ocena-ryzyk)
5. [Środki minimalizujące ryzyko](#5-środki-minimalizujące-ryzyko)
6. [Ocena ryzyka rezydualnego](#6-ocena-ryzyka-rezydualnego)
7. [Decyzja](#7-decyzja)
8. [Monitoring i przeglądy](#8-monitoring-i-przeglądy)

---

## 1. Wprowadzenie i uzasadnienie przeprowadzenia DPIA

### 1.1. Obowiązek przeprowadzenia DPIA

Zgodnie z art. 35 ust. 1 RODO, jeżeli dany rodzaj przetwarzania — w szczególności z użyciem nowych technologii — ze względu na swój charakter, zakres, kontekst i cele z dużym prawdopodobieństwem może powodować wysokie ryzyko naruszenia praw lub wolności osób fizycznych, administrator przed rozpoczęciem przetwarzania dokonuje oceny skutków planowanych operacji przetwarzania dla ochrony danych osobowych.

Serwis e-dietetyk.com spełnia kryteria wymagające przeprowadzenia DPIA:

- **Przetwarzanie szczególnych kategorii danych** (art. 9 RODO) — dane dotyczące zdrowia,
- **Wykorzystanie nowych technologii** — generowanie planów żywieniowych przez sztuczną inteligencję (OpenAI GPT-4.1),
- **Transfer danych do państwa trzeciego** — przekazywanie danych zdrowotnych do OpenAI (USA),
- Czynność wymieniona w **wykazie Prezesa UODO** (pkt 5 Komunikatu Prezesa UODO z dnia 17 czerwca 2019 r.) — przetwarzanie danych szczególnych kategorii z wykorzystaniem innowacyjnych rozwiązań technologicznych.

### 1.2. Zakres DPIA

Niniejsza ocena obejmuje **cały cykl życia danych zdrowotnych** w serwisie e-dietetyk.com:
1. Zbieranie danych zdrowotnych (wywiad dietetyczny),
2. Przechowywanie danych zdrowotnych (baza PostgreSQL, szyfrowanie AES-256-GCM),
3. Przetwarzanie danych przez AI (OpenAI GPT-4.1),
4. Weryfikacja planów przez dietetyka,
5. Udostępnianie planów pacjentowi,
6. Usuwanie/anonimizacja danych.

---

## 2. Systematyczny opis operacji przetwarzania

### 2.1. Charakter przetwarzania

| Aspekt | Opis |
|--------|------|
| **Rodzaj danych** | Szczególne kategorie danych osobowych (art. 9 RODO): dane dotyczące zdrowia — masa ciała, wzrost, BMI, alergie pokarmowe, nietolerancje, schorzenia, stosowane leki (kontekst żywieniowy), cele dietetyczne |
| **Kategorie osób** | Pacjenci (konsumenci) — osoby korzystające z usługi generowania planów żywieniowych |
| **Operacje przetwarzania** | Zbieranie, utrwalanie, przechowywanie (szyfrowane), organizowanie, przeglądanie, wykorzystywanie (generowanie AI), ujawnianie (transfer do OpenAI), udostępnianie (dietetykowi i pacjentowi), usuwanie/anonimizacja |
| **Technologie** | PostgreSQL 15 (baza danych), AES-256-GCM (szyfrowanie at rest), OpenAI GPT-4.1 (generowanie AI), BullMQ (kolejki zadań), Node.js/Express.js (backend), Next.js 15 (frontend) |
| **Skala** | Faza startupowa — aktualnie poniżej 500 użytkowników, prognoza do 5 000 w ciągu 12 miesięcy |

### 2.2. Cel przetwarzania

Głównym celem przetwarzania danych zdrowotnych jest **świadczenie usługi generowania spersonalizowanych planów żywieniowych** opartych na indywidualnych potrzebach zdrowotnych pacjenta, z wykorzystaniem sztucznej inteligencji, pod nadzorem wykwalifikowanego dietetyka.

Cele szczegółowe:
1. Ocena stanu zdrowia i potrzeb żywieniowych pacjenta (wywiad dietetyczny),
2. Obliczenie celów kalorycznych i makroskładnikowych (NutritionTargets),
3. Identyfikacja przeciwwskazań i flag klinicznych (Policy Engine — 85 reguł),
4. Wygenerowanie planu żywieniowego (AI — GPT-4.1),
5. Weryfikacja merytoryczna przez dietetyka,
6. Udostępnienie zatwierdzonego planu pacjentowi.

### 2.3. Prawnie uzasadnione interesy

- **Interes pacjenta:** uzyskanie profesjonalnego, spersonalizowanego planu żywieniowego uwzględniającego stan zdrowia,
- **Interes administratora:** świadczenie usługi stanowiącej przedmiot działalności gospodarczej,
- **Interes publiczny (pośredni):** promowanie zdrowego odżywiania i profilaktyka chorób dietozależnych.

### 2.4. Przepływ danych

```
Pacjent → [Formularz wywiadu] → Backend (szyfrowanie AES-256-GCM) → PostgreSQL (Litwa, UE)
                                                    ↓
                                        [Policy Engine — 85 reguł klinicznych]
                                                    ↓
                                        [BullMQ — kolejka generowania]
                                                    ↓
                                        [OpenAI API (USA) — GPT-4.1]
                                        (tylko dane zdrowotne, BEZ danych identyfikujących)
                                                    ↓
                                        [Wynik AI → szyfrowanie → PostgreSQL]
                                                    ↓
                                        [Dietetyk — weryfikacja i zatwierdzenie]
                                                    ↓
                                        [Pacjent — dostęp do zatwierdzonego planu]
```

---

## 3. Ocena konieczności i proporcjonalności

### 3.1. Konieczność przetwarzania

| Kryterium | Ocena |
|-----------|-------|
| **Czy przetwarzanie danych zdrowotnych jest niezbędne do realizacji celu?** | **Tak.** Bez danych o masie ciała, wzroście, alergiach i schorzeniach nie jest możliwe przygotowanie bezpiecznego i skutecznego planu żywieniowego. Pominięcie np. alergii mogłoby stanowić zagrożenie zdrowia. |
| **Czy cel można osiągnąć bez przetwarzania szczególnych kategorii danych?** | **Nie.** Plan żywieniowy z definicji musi uwzględniać stan zdrowia — jest to istota usługi. |
| **Czy wykorzystanie AI jest konieczne?** | AI umożliwia generowanie planów w skali niedostępnej dla pojedynczego dietetyka, przy jednoczesnym zachowaniu weryfikacji ludzkiej. Jest to narzędzie wspomagające, nie zastępujące dietetyka. |

### 3.2. Proporcjonalność

| Kryterium | Ocena |
|-----------|-------|
| **Minimalizacja danych** | Do OpenAI przesyłane są wyłącznie dane zdrowotne niezbędne do generowania planu. **Nie są przesyłane dane identyfikujące** (imię, nazwisko, e-mail, adres IP). Prompt zawiera jedynie parametry zdrowotne i cele żywieniowe. |
| **Ograniczenie przechowywania** | Dane zdrowotne przechowywane przez czas trwania umowy, usuwane na żądanie lub po usunięciu konta. |
| **Szyfrowanie** | Wszystkie dane zdrowotne zaszyfrowane AES-256-GCM at rest. Transfer do OpenAI przez TLS 1.2+. |
| **Nadzór ludzki** | Każdy plan wygenerowany przez AI wymaga weryfikacji i zatwierdzenia przez dietetyka przed udostępnieniem pacjentowi. Plan AI nigdy nie trafia do pacjenta bez przeglądu człowieka. |
| **Prawa osób** | Zapewniono realizację praw: dostęp, sprostowanie, usunięcie, przenoszenie, cofnięcie zgody, ograniczenie przetwarzania. |

### 3.3. Podstawy prawne przetwarzania

| Podstawa | Zastosowanie |
|----------|-------------|
| Art. 6 ust. 1 lit. b) RODO | Wykonanie umowy o świadczenie usługi |
| Art. 9 ust. 2 lit. a) RODO | Wyraźna zgoda na przetwarzanie danych zdrowotnych |
| Art. 9 ust. 2 lit. h) RODO | Przetwarzanie niezbędne do profilaktyki zdrowotnej (uzupełniająco — weryfikacja przez dietetyka) |

---

## 4. Identyfikacja i ocena ryzyk

### Matryca oceny ryzyka

Prawdopodobieństwo: **Niskie (1)** / **Średnie (2)** / **Wysokie (3)** / **Bardzo wysokie (4)**
Wpływ: **Niski (1)** / **Średni (2)** / **Wysoki (3)** / **Bardzo wysoki (4)**
Ryzyko = Prawdopodobieństwo × Wpływ

| Poziom ryzyka | Zakres punktowy | Wymagane działanie |
|---------------|-----------------|-------------------|
| Niskie | 1–4 | Monitoring |
| Średnie | 5–8 | Środki minimalizujące |
| Wysokie | 9–12 | Priorytetowe środki minimalizujące |
| Krytyczne | 13–16 | Niedopuszczalne bez dodatkowych środków / konsultacja UODO |

---

### Ryzyko 1: Wyciek danych zdrowotnych

| Aspekt | Opis |
|--------|------|
| **Opis ryzyka** | Nieautoryzowany dostęp do bazy danych zawierającej zaszyfrowane dane zdrowotne (wywiad dietetyczny, plany żywieniowe) wskutek ataku na serwer, SQL injection, wycieku credentials lub podatności oprogramowania. |
| **Zagrożenie dla osób** | Ujawnienie informacji o stanie zdrowia (alergie, schorzenia, waga) — naruszenie prywatności, potencjalna dyskryminacja, stygmatyzacja, szkoda psychiczna. |
| **Prawdopodobieństwo (przed środkami)** | Średnie (2) — popularna technologia, ale stosunkowo mała skala. |
| **Wpływ** | Bardzo wysoki (4) — dane szczególnych kategorii, poważne konsekwencje dla osób. |
| **Ryzyko surowe** | **8 — Średnie** |

---

### Ryzyko 2: Nieprawidłowe rekomendacje AI (zagrożenie zdrowia)

| Aspekt | Opis |
|--------|------|
| **Opis ryzyka** | Model AI generuje plan żywieniowy zawierający składniki, na które pacjent jest uczulony, lub ignorujący przeciwwskazania zdrowotne (np. dieta wysokosodowa dla pacjenta z nadciśnieniem). Jeśli plan zostanie zatwierdzony bez należytej weryfikacji, może stanowić bezpośrednie zagrożenie zdrowia. |
| **Zagrożenie dla osób** | Zagrożenie zdrowia lub życia (reakcja alergiczna, zaostrzenie choroby). |
| **Prawdopodobieństwo (przed środkami)** | Średnie (2) — model AI może popełniać błędy, zwłaszcza w złożonych przypadkach klinicznych. |
| **Wpływ** | Bardzo wysoki (4) — bezpośrednie zagrożenie zdrowia osoby fizycznej. |
| **Ryzyko surowe** | **8 — Średnie** |

---

### Ryzyko 3: Nieautoryzowany dostęp do konta

| Aspekt | Opis |
|--------|------|
| **Opis ryzyka** | Przejęcie konta użytkownika (pacjenta lub dietetyka) wskutek: kradzieży hasła (phishing, credential stuffing), sesji (XSS, session hijacking), lub braku wystarczającego uwierzytelnienia. Dostęp do danych zdrowotnych pacjenta przez osobę nieuprawnioną. |
| **Zagrożenie dla osób** | Ujawnienie danych zdrowotnych, możliwość modyfikacji danych zdrowotnych, naruszenie prywatności. |
| **Prawdopodobieństwo (przed środkami)** | Średnie (2) — powszechny wektor ataku. |
| **Wpływ** | Wysoki (3) — dostęp do danych zdrowotnych, ale ograniczony do jednego konta. |
| **Ryzyko surowe** | **6 — Średnie** |

---

### Ryzyko 4: Transfer danych do USA (OpenAI)

| Aspekt | Opis |
|--------|------|
| **Opis ryzyka** | Dane zdrowotne pacjentów są przekazywane do OpenAI, LLC (USA) w ramach generowania planów żywieniowych. Pomimo SCC i DPA, ryzyko związane z: (a) możliwym dostępem agencji rządowych USA (FISA 702, EO 12333), (b) zmianą polityki OpenAI dot. wykorzystania danych, (c) naruszeniem bezpieczeństwa po stronie OpenAI. |
| **Zagrożenie dla osób** | Ujawnienie danych zdrowotnych w jurysdykcji o niższym poziomie ochrony danych. |
| **Prawdopodobieństwo (przed środkami)** | Niskie (1) — dane pseudonimizowane (bez danych identyfikujących), zero data retention policy OpenAI API, DPA i SCC. |
| **Wpływ** | Wysoki (3) — dane szczególnych kategorii w jurysdykcji USA. |
| **Ryzyko surowe** | **3 — Niskie** |

---

### Ryzyko 5: Naruszenie zasady minimalizacji danych

| Aspekt | Opis |
|--------|------|
| **Opis ryzyka** | Zbieranie większej ilości danych zdrowotnych niż jest to niezbędne do realizacji celu (generowanie planu żywieniowego), przechowywanie danych dłużej niż jest to konieczne, lub przekazywanie do AI szerszego zakresu danych niż wymagany. |
| **Zagrożenie dla osób** | Zwiększona ekspozycja danych osobowych, nieproporcjonalne przetwarzanie. |
| **Prawdopodobieństwo (przed środkami)** | Niskie (1) — formularz wywiadu zbiera ściśle określony zestaw danych, prompt AI zawiera jedynie parametry zdrowotne. |
| **Wpływ** | Średni (2) — zwiększona ekspozycja, ale ograniczone konsekwencje przy zachowaniu szyfrowania. |
| **Ryzyko surowe** | **2 — Niskie** |

---

## 5. Środki minimalizujące ryzyko

### Ryzyko 1: Wyciek danych zdrowotnych

| # | Środek | Status | Skuteczność |
|---|--------|--------|-------------|
| 1.1 | **Szyfrowanie AES-256-GCM** wszystkich danych zdrowotnych at rest (Interview.answers, Interview.medicalFlags, DietPlan.content) | Wdrożony | Wysoka — nawet w przypadku wycieku bazy, dane są nieczytelne bez klucza szyfrowania |
| 1.2 | **Klucz szyfrowania** przechowywany w zmiennej środowiskowej, oddzielnie od bazy danych | Wdrożony | Wysoka |
| 1.3 | **HTTPS/TLS 1.3** dla całej komunikacji | Wdrożony | Wysoka |
| 1.4 | **Parametryzowane zapytania** (Prisma ORM) — ochrona przed SQL injection | Wdrożony | Wysoka |
| 1.5 | **Rate limiting** na endpoints API | Wdrożony | Średnia |
| 1.6 | **Audit logi** wszystkich operacji na danych zdrowotnych | Wdrożony | Średnia (detekcja, nie prewencja) |
| 1.7 | **Brak logowania** treści danych zdrowotnych w logach aplikacji | Wdrożony | Wysoka |
| 1.8 | Serwer w **UE (Litwa)** — Hostinger VPS | Wdrożony | Średnia |
| 1.9 | Regularne **aktualizacje** zależności i systemu operacyjnego | Częściowo wdrożony | Średnia |
| 1.10 | **Backup** bazy danych z retencją 30 dni | Wdrożony | Średnia (odtwarzalność) |

### Ryzyko 2: Nieprawidłowe rekomendacje AI

| # | Środek | Status | Skuteczność |
|---|--------|--------|-------------|
| 2.1 | **Obligatoryjna weryfikacja** każdego planu AI przez dietetyka przed udostępnieniem pacjentowi | Wdrożony | Bardzo wysoka — fundamentalny środek bezpieczeństwa |
| 2.2 | **Policy Engine** — 85 reguł klinicznych + 16 flag RED_FLAG weryfikowanych przed generowaniem | Wdrożony | Wysoka |
| 2.3 | **Status planu**: AI_DRAFT → REVIEWED → SENT — plan nigdy nie trafia do pacjenta jako AI_DRAFT | Wdrożony | Bardzo wysoka |
| 2.4 | Reguły CRITICAL wymuszają **MANUAL_REVIEW_REQUIRED** | Wdrożony | Wysoka |
| 2.5 | **Prompt V3** z zasadami dietetycznymi, tabelą kaloryczności i few-shot examples | Wdrożony | Średnia |
| 2.6 | **Fallback chain** modeli AI (gpt-4.1 → gpt-4o → gpt-4.1-mini) | Wdrożony | Średnia |
| 2.7 | **Walidacja** wyniku AI przed zapisem (Zod schema, sprawdzenie kompletności) | Wdrożony | Średnia |
| 2.8 | **Disclaimer** w serwisie: plan żywieniowy nie zastępuje porady lekarskiej | Wdrożony | Niska (prawna, nie techniczna) |

### Ryzyko 3: Nieautoryzowany dostęp do konta

| # | Środek | Status | Skuteczność |
|---|--------|--------|-------------|
| 3.1 | **Hashowanie haseł** algorytmem bcrypt | Wdrożony | Wysoka |
| 3.2 | **JWT** z ograniczonym czasem ważności (7 dni) | Wdrożony | Średnia |
| 3.3 | **RBAC** — role: ADMIN, DIETITIAN, PATIENT z ograniczeniami dostępu | Wdrożony | Wysoka |
| 3.4 | **Izolacja danych** — pacjent widzi tylko swoje dane, dietetyk widzi tylko swoich pacjentów (Patient.dietitianId) | Wdrożony | Wysoka |
| 3.5 | **Rate limiting** prób logowania | Wdrożony | Średnia |
| 3.6 | **Audit log** logowań (IP, user agent, data) | Wdrożony | Średnia (detekcja) |
| 3.7 | **CORS** — ograniczenie do dozwolonych domen | Wdrożony | Średnia |
| 3.8 | **HTTPS only** — secure cookies | Wdrożony | Średnia |

### Ryzyko 4: Transfer danych do USA (OpenAI)

| # | Środek | Status | Skuteczność |
|---|--------|--------|-------------|
| 4.1 | **Pseudonimizacja** — do OpenAI przesyłane są wyłącznie dane zdrowotne, **bez danych identyfikujących** (brak imienia, e-maila, adresu IP, identyfikatora klienta) | Wdrożony | Bardzo wysoka |
| 4.2 | **DPA (Data Processing Agreement)** z OpenAI | Wdrożony | Wysoka (prawna) |
| 4.3 | **SCC (Standard Contractual Clauses)** — standardowe klauzule umowne | Wdrożony | Wysoka (prawna) |
| 4.4 | **Zero data retention** — API OpenAI nie przechowuje danych po przetworzeniu (opt-out z trenowania) | Wdrożony | Wysoka |
| 4.5 | **TLS 1.2+** w komunikacji z API OpenAI | Wdrożony | Wysoka |
| 4.6 | **Inteligentne filtrowanie** — do promptu trafia ~150-200 produktów z bazy 6602, minimalizacja kontekstu | Wdrożony | Średnia |
| 4.7 | Monitorowanie **zmian polityki** OpenAI i aktualizacji DPA/SCC | W trakcie | Średnia |

### Ryzyko 5: Naruszenie zasady minimalizacji danych

| # | Środek | Status | Skuteczność |
|---|--------|--------|-------------|
| 5.1 | **Formularz wywiadu** zbiera ściśle określony, minimalny zestaw danych zdrowotnych | Wdrożony | Wysoka |
| 5.2 | **Polityka retencji** — dane usuwane po zakończeniu umowy lub na żądanie | Wdrożony | Wysoka |
| 5.3 | **Soft delete + anonimizacja PII** przy usunięciu konta | Wdrożony | Wysoka |
| 5.4 | **Prompt AI** nie zawiera danych identyfikujących — tylko parametry zdrowotne | Wdrożony | Wysoka |
| 5.5 | Regularne **przeglądy** zakresu zbieranych danych | Planowany (kwartalnie) | Średnia |

---

## 6. Ocena ryzyka rezydualnego

Po wdrożeniu środków minimalizujących:

| Ryzyko | Ryzyko surowe | Środki | Prawdopodobieństwo (po) | Wpływ (po) | Ryzyko rezydualne | Poziom |
|--------|:---:|--------|:---:|:---:|:---:|--------|
| **R1: Wyciek danych zdrowotnych** | 8 | AES-256-GCM, izolacja klucza, ORM, rate limiting, audit log | 1 (Niskie) | 3 (Wysoki) | **3** | **Niskie** |
| **R2: Nieprawidłowe rekomendacje AI** | 8 | Weryfikacja dietetyka, Policy Engine 85 reguł, status REVIEWED, disclaimer | 1 (Niskie) | 3 (Wysoki) | **3** | **Niskie** |
| **R3: Nieautoryzowany dostęp do konta** | 6 | bcrypt, JWT, RBAC, izolacja danych, rate limiting, audit log | 1 (Niskie) | 2 (Średni) | **2** | **Niskie** |
| **R4: Transfer danych do USA** | 3 | Pseudonimizacja, DPA, SCC, zero retention, TLS | 1 (Niskie) | 2 (Średni) | **2** | **Niskie** |
| **R5: Naruszenie minimalizacji** | 2 | Minimalny formularz, retencja, anonimizacja, przeglądy | 1 (Niskie) | 1 (Niski) | **1** | **Niskie** |

### Matryca ryzyka rezydualnego

```
Wpływ ↑
  4 │         │         │         │ KRYTYCZNE
  3 │ R1, R2  │         │         │
  2 │ R3, R4  │         │         │
  1 │ R5      │         │         │
    └─────────┴─────────┴─────────┴──────────→
      1 Niskie  2 Średnie 3 Wysokie 4 B.wysokie
                  Prawdopodobieństwo
```

**Wszystkie ryzyka rezydualne mieszczą się w zakresie 1–3 (NISKIE).** Żadne ryzyko nie wymaga konsultacji z UODO na podstawie art. 36 RODO.

---

## 7. Decyzja

### 7.1. Ocena końcowa

Na podstawie przeprowadzonej analizy:

1. **Ryzyka surowe** zidentyfikowane w punkcie 4 mieściły się w zakresie 2–8 (Niskie do Średnie).
2. **Wdrożone środki minimalizujące** skutecznie obniżyły wszystkie ryzyka do poziomu **Niskie** (1–3).
3. **Kluczowym środkiem bezpieczeństwa** jest obligatoryjna weryfikacja każdego planu AI przez wykwalifikowanego dietetyka, co eliminuje ryzyko bezpośredniego wpływu błędu AI na zdrowie pacjenta.
4. **Szyfrowanie AES-256-GCM** danych zdrowotnych at rest zapewnia ochronę nawet w przypadku naruszenia bezpieczeństwa bazy danych.
5. **Pseudonimizacja** danych przesyłanych do OpenAI minimalizuje ryzyko związane z transferem do USA.

### 7.2. Decyzja

**Administrator podejmuje decyzję o AKCEPTACJI ryzyka rezydualnego** i kontynuowaniu przetwarzania danych zdrowotnych w ramach serwisu e-dietetyk.com na opisanych zasadach.

**Konsultacja z UODO (art. 36 RODO) nie jest wymagana**, gdyż ryzyko rezydualne po zastosowaniu środków minimalizujących nie jest wysokie.

### 7.3. Warunki akceptacji

Akceptacja ryzyka rezydualnego jest warunkowa i obowiązuje pod warunkiem:
1. Utrzymania **wszystkich wdrożonych środków** bezpieczeństwa opisanych w punkcie 5,
2. Przeprowadzania **regularnych przeglądów** zgodnie z punktem 8,
3. **Niezwłocznego reagowania** na naruszenia zgodnie z procedurą naruszeń (odrębny dokument),
4. Utrzymania ważności **DPA i SCC** z OpenAI i innymi podmiotami przetwarzającymi.

---

## 8. Monitoring i przeglądy

### 8.1. Harmonogram przeglądów

| Przegląd | Częstotliwość | Odpowiedzialny | Kolejny termin |
|----------|---------------|----------------|----------------|
| Przegląd DPIA | Co 12 miesięcy lub po istotnej zmianie | Administrator | Marzec 2027 |
| Przegląd środków bezpieczeństwa | Co 6 miesięcy | Administrator | Wrzesień 2026 |
| Przegląd DPA/SCC podmiotów przetwarzających | Co 12 miesięcy lub po zmianie warunków | Administrator | Marzec 2027 |
| Przegląd zakresu zbieranych danych | Co kwartał | Administrator | Lipiec 2026 |
| Analiza audit logów (anomalie) | Co miesiąc | Administrator | Kwiecień 2026 |

### 8.2. Zdarzenia wyzwalające nadzwyczajny przegląd DPIA

Przegląd DPIA należy przeprowadzić niezwłocznie w przypadku:

1. **Zmiany zakresu danych** — rozszerzenie wywiadu dietetycznego o nowe kategorie danych zdrowotnych,
2. **Zmiany technologii AI** — zmiana dostawcy AI (np. z OpenAI na innego), zmiana modelu na istotnie inny,
3. **Zmiany skali** — przekroczenie 5 000 pacjentów z danymi zdrowotnymi,
4. **Naruszenia danych** — po każdym incydencie bezpieczeństwa,
5. **Zmiany przepisów** — nowe wytyczne UODO, EROD, orzecznictwo TSUE dot. transferów do USA,
6. **Zmiany warunków podmiotów przetwarzających** — zmiana DPA/SCC OpenAI, Stripe, Resend,
7. **Wprowadzenia automatycznego podejmowania decyzji** — jeśli plany AI miałyby trafiać do pacjenta bez weryfikacji dietetyka (co nie jest planowane),
8. **Zmiany lokalizacji serwera** — przeniesienie poza UE/EOG.

### 8.3. Dokumentowanie przeglądów

Każdy przegląd zostanie udokumentowany w formie notatki zawierającej:
- Datę przeglądu,
- Zakres przeglądu,
- Stwierdzone zmiany od ostatniego przeglądu,
- Aktualną ocenę ryzyk,
- Podjęte decyzje i działania,
- Termin następnego przeglądu.

---

## Historia zmian dokumentu

| Wersja | Data | Autor | Opis zmian |
|--------|------|-------|------------|
| 1.0 | 23.03.2026 | Wirgiliusz Ładziński | Utworzenie dokumentu DPIA |

---

**Podpis administratora:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
Wirgiliusz Ładziński
Administrator danych — e-dietetyk.com
Data: 23 marca 2026 r.
