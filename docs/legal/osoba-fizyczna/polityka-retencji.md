# Polityka retencji danych osobowych

**Podstawa prawna:** art. 5 ust. 1 lit. e) Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO) — zasada ograniczenia przechowywania

**Administrator danych:** Wirgiliusz Ładziński
**Adres:** ul. Pod Brzozami 16/8a, 03-995 Warszawa
**E-mail kontaktowy:** kontakt@e-dietetyk.com
**Serwis:** e-dietetyk.com
**Data sporządzenia:** 23 marca 2026 r.
**Wersja:** 1.0

---

## 1. Cel i zakres

### 1.1. Cel

Niniejsza polityka określa zasady przechowywania i usuwania danych osobowych przetwarzanych w ramach serwisu e-dietetyk.com, w celu zapewnienia zgodności z zasadą ograniczenia przechowywania (art. 5 ust. 1 lit. e) RODO):

> *Dane osobowe muszą być przechowywane w formie umożliwiającej identyfikację osoby, której dane dotyczą, przez okres nie dłuższy, niż jest to niezbędne do celów, w których dane te są przetwarzane.*

### 1.2. Zakres

Polityka obejmuje wszystkie dane osobowe przetwarzane w ramach serwisu e-dietetyk.com, przechowywane w:
- Bazie danych PostgreSQL (serwer VPS Hostinger, Litwa, UE),
- Systemach podmiotów przetwarzających (Stripe, OpenAI, Resend),
- Kopiach zapasowych (backup),
- Logach systemowych i audit logach.

---

## 2. Tabela retencji danych

### 2.1. Dane konta użytkownika

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Dane identyfikacyjne i uwierzytelniające: adres e-mail, hash hasła (bcrypt), imię, rola w systemie, data rejestracji, data ostatniego logowania, preferencje konta |
| **Okres przechowywania** | Przez czas trwania umowy (aktywne konto) **+ 3 lata** od daty usunięcia konta |
| **Podstawa prawna okresu** | Art. 118 Kodeksu cywilnego — ogólny termin przedawnienia roszczeń cywilnych (3 lata dla roszczeń związanych z działalnością gospodarczą i roszczeń okresowych) |
| **Sposób usunięcia** | **Faza 1 (natychmiast po usunięciu konta):** Soft delete — ustawienie pola `deletedAt`, **anonimizacja PII** (e-mail zastąpiony hashem, imię usunięte). **Faza 2 (po upływie 3 lat):** Trwałe usunięcie rekordu z bazy danych (hard delete). |
| **Automatyczne / ręczne** | Faza 1: automatyczne (przy usunięciu konta). Faza 2: automatyczne (scheduled job — do wdrożenia) lub ręczne (przegląd kwartalny). |

### 2.2. Dane zdrowotne (wywiad dietetyczny)

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Szczególne kategorie danych (art. 9 RODO): masa ciała, wzrost, BMI, alergie, nietolerancje, schorzenia, stosowane leki (kontekst żywieniowy), cele dietetyczne, flagi medyczne. Przechowywane zaszyfrowane (AES-256-GCM). |
| **Okres przechowywania** | Przez czas trwania umowy (aktywne konto). Usuwane **niezwłocznie** na żądanie osoby (art. 17 RODO) lub **w ciągu 30 dni** po usunięciu konta. |
| **Podstawa prawna okresu** | Art. 17 RODO — prawo do usunięcia danych; art. 5 ust. 1 lit. e) RODO — minimalizacja przechowywania szczególnych kategorii danych |
| **Sposób usunięcia** | **Trwałe usunięcie** rekordów Interview z bazy danych (hard delete). Nadpisanie pól zaszyfrowanych. Usunięcie z backupów po wygaśnięciu retencji backupów (30 dni). |
| **Automatyczne / ręczne** | Na żądanie: ręczne (realizacja w ciągu 72h). Przy usunięciu konta: automatyczne (triggered by account deletion). |

### 2.3. Plany żywieniowe

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Plany żywieniowe wygenerowane przez AI i zweryfikowane przez dietetyka, zawierające dane pośrednio odnoszące się do stanu zdrowia (uwzględnione alergie, makroskładniki, ograniczenia). Przechowywane zaszyfrowane (AES-256-GCM). |
| **Okres przechowywania** | Przez czas trwania umowy **+ 30 dni** po usunięciu konta (okres na ewentualny eksport przez użytkownika przed trwałym usunięciem, jeśli konto zostało usunięte omyłkowo). |
| **Podstawa prawna okresu** | Art. 6 ust. 1 lit. b) RODO — wykonanie umowy; 30-dniowy okres po usunięciu: prawnie uzasadniony interes (możliwość cofnięcia usunięcia w przypadku błędu) |
| **Sposób usunięcia** | Trwałe usunięcie rekordów DietPlan (hard delete) po upływie 30 dni od usunięcia konta. |
| **Automatyczne / ręczne** | Automatyczne (scheduled job) lub ręczne (przegląd kwartalny). Na żądanie art. 17: ręczne w ciągu 72h. |

### 2.4. Dane transakcyjne (płatności)

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Identyfikator klienta Stripe, identyfikator subskrypcji, typ produktu, kwota, waluta, status płatności, data transakcji, historia zamówień (Order). Administrator NIE przechowuje numerów kart płatniczych. |
| **Okres przechowywania** | **5 lat** od końca roku kalendarzowego, w którym dokonano transakcji |
| **Podstawa prawna okresu** | Art. 86 § 1 Ordynacji podatkowej (obowiązek przechowywania ksiąg podatkowych i dokumentów związanych z ich prowadzeniem do czasu upływu okresu przedawnienia zobowiązania podatkowego — 5 lat od końca roku kalendarzowego); Art. 74 ustawy o rachunkowości (przechowywanie dokumentów księgowych — 5 lat) |
| **Sposób usunięcia** | Trwałe usunięcie rekordów Order po upływie okresu retencji. Dane po stronie Stripe: zgodnie z polityką retencji Stripe. |
| **Automatyczne / ręczne** | Ręczne (przegląd roczny — styczeń). Docelowo: automatyczne (scheduled job). |

### 2.5. Logi bezpieczeństwa (audit log)

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Identyfikator użytkownika, adres IP, user agent, typ zdarzenia, data i czas, identyfikator zasobu. Tabela AuditLog. |
| **Okres przechowywania** | **12 miesięcy** od daty zdarzenia |
| **Podstawa prawna okresu** | Art. 6 ust. 1 lit. f) RODO — prawnie uzasadniony interes (bezpieczeństwo systemu, rozliczalność). 12 miesięcy jest proporcjonalne do celu (wykrywanie naruszeń, analiza incydentów). |
| **Sposób usunięcia** | Trwałe usunięcie rekordów starszych niż 12 miesięcy (hard delete z tabeli AuditLog). |
| **Automatyczne / ręczne** | Automatyczne (scheduled job — cron monthly) lub ręczne (przegląd kwartalny). |

### 2.6. Dane marketingowe (newsletter)

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Adres e-mail, imię (opcjonalnie), data wyrażenia zgody, źródło zgody, preferencje komunikacyjne. |
| **Okres przechowywania** | **Do momentu cofnięcia zgody** przez osobę. Po cofnięciu: usunięcie z listy mailingowej w ciągu **72 godzin**. |
| **Podstawa prawna okresu** | Art. 6 ust. 1 lit. a) RODO — zgoda (przetwarzanie dopóki zgoda nie zostanie cofnięta); Art. 7 ust. 3 RODO — prawo do cofnięcia zgody w dowolnym momencie |
| **Sposób usunięcia** | Usunięcie z listy mailingowej (Resend). Zachowanie rejestru zgody (data wyrażenia, data cofnięcia) przez **3 lata** w celach rozliczalności (art. 5 ust. 2 RODO). |
| **Automatyczne / ręczne** | Cofnięcie zgody: automatyczne (link unsubscribe w e-mailu). Usunięcie z bazy: automatyczne (webhook/triggered). |

### 2.7. Cookies i dane sesyjne

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Pliki cookies sesyjne i funkcjonalne, tokeny JWT, preferencje językowe, zgody cookie. |
| **Okres przechowywania** | Cookies sesyjne: do zakończenia sesji przeglądarki. JWT: **7 dni** (czas ważności tokenu). Cookies preferencji: **maksymalnie 12 miesięcy**. |
| **Podstawa prawna okresu** | Art. 5 ust. 3 dyrektywy 2002/58/WE (ePrivacy) — cookies ściśle niezbędne nie wymagają zgody; cookies preferencyjne: zgoda. Okres 12 miesięcy zgodny z wytycznymi EROD (Guidelines 2/2023). |
| **Sposób usunięcia** | Automatyczne wygasanie cookies (expiry date). Użytkownik może usunąć cookies w przeglądarce w dowolnym momencie. |
| **Automatyczne / ręczne** | Automatyczne (expiry). |

### 2.8. Kopie zapasowe (backup)

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Pełna kopia bazy danych PostgreSQL (zawiera wszystkie powyższe kategorie danych, w tym dane zdrowotne zaszyfrowane AES-256-GCM). |
| **Okres przechowywania** | **30 dni** retencji rotacyjnej — najstarszy backup nadpisywany nowym. |
| **Podstawa prawna okresu** | Art. 32 RODO — zdolność do szybkiego przywrócenia dostępności danych; Art. 6 ust. 1 lit. f) RODO — prawnie uzasadniony interes (ciągłość działania, odtwarzalność po awarii). |
| **Sposób usunięcia** | Automatyczne nadpisanie (rotacja 30-dniowa). Dane zdrowotne w backupach są zaszyfrowane AES-256-GCM — nawet w przypadku wycieku backupu dane są nieczytelne bez klucza. |
| **Automatyczne / ręczne** | Automatyczne (cron + rotacja). |
| **Uwaga dot. prawa do usunięcia** | Usunięcie danych z backupów następuje naturalnie po upływie 30-dniowej retencji. W przypadku żądania usunięcia na podstawie art. 17 RODO: dane usuwane natychmiast z bazy produkcyjnej, z backupów — po rotacji (max 30 dni). Jest to akceptowalne ze względu na proporcjonalność (motyw 39 RODO, opinia EROD). |

### 2.9. Dane reklamacyjne

| Pole | Wartość |
|------|---------|
| **Kategoria danych** | Imię i nazwisko, e-mail, treść reklamacji/skargi, korespondencja, dane zamówienia, status i rozstrzygnięcie. |
| **Okres przechowywania** | **3 lata** od zakończenia sprawy (przedawnienie roszczeń, art. 118 k.c.) lub **6 lat** jeśli roszczenie stwierdzone prawomocnym orzeczeniem (art. 125 k.c.). |
| **Podstawa prawna okresu** | Art. 6 ust. 1 lit. c) RODO — obowiązek prawny (ustawa o prawach konsumenta); Art. 6 ust. 1 lit. f) RODO — obrona przed roszczeniami. |
| **Sposób usunięcia** | Trwałe usunięcie po upływie okresu retencji. Anonimizacja danych identyfikacyjnych w statystykach reklamacji (jeśli prowadzone). |
| **Automatyczne / ręczne** | Ręczne (przegląd roczny). |

---

## 3. Podsumowanie tabelaryczne

| # | Kategoria danych | Okres przechowywania | Podstawa | Sposób usunięcia |
|---|------------------|---------------------|----------|-----------------|
| 1 | Dane konta użytkownika | Umowa + 3 lata | Art. 118 k.c. | Soft delete + anonimizacja PII → hard delete |
| 2 | Dane zdrowotne (wywiad) | Umowa / na żądanie / 30 dni po usunięciu konta | Art. 17 RODO, art. 5 ust. 1 lit. e) | Hard delete + nadpisanie pól szyfrowanych |
| 3 | Plany żywieniowe | Umowa + 30 dni po usunięciu konta | Art. 6 ust. 1 lit. b), uzasadniony interes | Hard delete |
| 4 | Dane transakcyjne | 5 lat od końca roku transakcji | Art. 86 § 1 Ordynacji podatkowej | Hard delete |
| 5 | Logi bezpieczeństwa | 12 miesięcy | Art. 6 ust. 1 lit. f), art. 32 RODO | Hard delete (cron monthly) |
| 6 | Dane marketingowe | Do cofnięcia zgody | Art. 6 ust. 1 lit. a) RODO | Usunięcie z listy + zachowanie rejestru zgody 3 lata |
| 7 | Cookies / sesje | Sesyjne: sesja; JWT: 7 dni; Preferencje: max 12 mies. | ePrivacy, art. 5 ust. 1 lit. e) | Automatyczne wygasanie |
| 8 | Kopie zapasowe | 30 dni (rotacja) | Art. 32 RODO | Automatyczne nadpisanie |
| 9 | Dane reklamacyjne | 3 lata (lub 6 lat) od zakończenia sprawy | Art. 118 / 125 k.c. | Hard delete |

---

## 4. Anonimizacja vs. usunięcie

### 4.1. Kiedy anonimizacja

Anonimizacja (zamiast trwałego usunięcia) jest stosowana w następujących przypadkach:

1. **Usunięcie konta użytkownika (soft delete)** — dane identyfikacyjne (e-mail, imię) są zastępowane wartościami nieodwracalnie zanonimizowanymi:
   - E-mail: `deleted_[HASH]@anonymized.local`
   - Imię: `[USUNIĘTE]`
   - Pole `deletedAt`: ustawiane na datę usunięcia

2. **Dane statystyczne** — zagregowane, zanonimizowane dane (np. liczba użytkowników, średni BMI — bez możliwości identyfikacji osoby) mogą być przechowywane bezterminowo w celach analitycznych. Dane zanonimizowane nie stanowią danych osobowych w rozumieniu RODO.

### 4.2. Kiedy trwałe usunięcie

Trwałe usunięcie (hard delete) jest stosowane:

1. **Dane zdrowotne** — zawsze trwale usuwane (nie anonimizowane), ze względu na wrażliwy charakter,
2. **Plany żywieniowe** — trwale usuwane po upływie okresu retencji,
3. **Logi bezpieczeństwa** — trwale usuwane po 12 miesiącach,
4. **Dane konta** — hard delete po upływie 3 lat od soft delete.

### 4.3. Weryfikacja anonimizacji

Anonimizacja musi być **nieodwracalna** — nie może istnieć możliwość ponownego przypisania zanonimizowanych danych do konkretnej osoby. W szczególności:
- Hash e-maila generowany jest jako jednokierunkowy (SHA-256 + salt),
- Usunięte pola nie mogą być odtworzone z żadnego innego źródła w systemie,
- Powiązania między tabelami (foreign keys) do zanonimizowanego rekordu są zachowywane wyłącznie jeśli nie umożliwiają identyfikacji osoby.

---

## 5. Procedura okresowego przeglądu

### 5.1. Harmonogram

| Przegląd | Częstotliwość | Termin | Odpowiedzialny |
|----------|---------------|--------|----------------|
| Usunięcie przeterminowanych logów (AuditLog > 12 mies.) | Miesięcznie | 1. dzień miesiąca | Automatyczny (cron) / Administrator |
| Usunięcie przeterminowanych danych zdrowotnych (konta usunięte > 30 dni) | Kwartalnie | 15.01, 15.04, 15.07, 15.10 | Administrator |
| Przegląd danych kont soft-deleted (> 3 lata) | Rocznie | Styczeń | Administrator |
| Przegląd danych transakcyjnych (> 5 lat) | Rocznie | Styczeń | Administrator |
| Przegląd danych reklamacyjnych (> 3 lata) | Rocznie | Styczeń | Administrator |
| Przegląd polityki retencji | Rocznie | Marzec | Administrator |
| Weryfikacja retencji u podmiotów przetwarzających | Rocznie | Marzec | Administrator |

### 5.2. Dokumentowanie przeglądów

Każdy przegląd retencji powinien być udokumentowany notatką zawierającą:
- Datę przeglądu,
- Liczbę rekordów zakwalifikowanych do usunięcia/anonimizacji,
- Liczbę rekordów faktycznie usuniętych/zanonimizowanych,
- Ewentualne wyjątki (rekordy zachowane mimo upływu okresu retencji — z uzasadnieniem, np. trwające postępowanie sądowe),
- Podpis osoby przeprowadzającej przegląd.

---

## 6. Realizacja prawa do usunięcia (art. 17 RODO)

### 6.1. Procedura

1. **Otrzymanie żądania** — użytkownik zgłasza żądanie usunięcia danych przez: formularz w serwisie, e-mail na kontakt@e-dietetyk.com lub ustnie (z potwierdzeniem pisemnym).
2. **Weryfikacja tożsamości** — potwierdzenie, że żądanie pochodzi od uprawnionej osoby (zalogowanie w serwisie lub weryfikacja e-mail).
3. **Ocena żądania** — sprawdzenie czy nie zachodzą wyjątki z art. 17 ust. 3 RODO (np. obowiązek prawny przechowywania danych transakcyjnych).
4. **Realizacja** — usunięcie/anonimizacja danych w ciągu **72 godzin** (dane zdrowotne) / **30 dni** (pozostałe dane) od pozytywnej weryfikacji.
5. **Potwierdzenie** — poinformowanie osoby o realizacji żądania.
6. **Powiadomienie odbiorców** — jeśli dane były udostępnione podmiotom przetwarzającym, powiadomienie ich o usunięciu (art. 19 RODO).

### 6.2. Wyjątki od prawa do usunięcia

Dane mogą być zachowane mimo żądania usunięcia, gdy:
- Przetwarzanie jest niezbędne do wypełnienia **obowiązku prawnego** (np. dane transakcyjne — 5 lat, Ordynacja podatkowa),
- Przetwarzanie jest niezbędne do ustalenia, dochodzenia lub obrony **roszczeń** (np. dane reklamacyjne w trakcie sporu),
- Dane zostały skutecznie **zanonimizowane** i nie stanowią już danych osobowych.

### 6.3. Logi usunięcia

Fakt realizacji żądania usunięcia jest dokumentowany w audit logu (typ zdarzenia: DATA_DELETION_REQUEST) z zachowaniem informacji o: dacie żądania, dacie realizacji, zakresie usunięcia — bez treści usuwanych danych.

---

## 7. Retencja u podmiotów przetwarzających

| Podmiot | Zakres danych | Retencja | DPA |
|---------|--------------|----------|-----|
| **OpenAI, LLC** | Dane zdrowotne (prompt AI) — pseudonimizowane, bez danych identyfikujących | Zero data retention (API, opt-out z trenowania) | Tak (DPA + SCC) |
| **Stripe Technology Europe Ltd.** | Identyfikator klienta, dane transakcyjne, historia płatności | Zgodnie z polityką Stripe i obowiązkami prawnymi (PCI DSS, regulacje finansowe) | Tak (DPA Stripe) |
| **Resend, Inc.** | Adres e-mail, treść wiadomości transakcyjnych/marketingowych | Zgodnie z DPA Resend, usuwane po zakończeniu współpracy | Tak (DPA Resend) |
| **Hostinger International Ltd.** | Pełna baza danych (serwer VPS), logi serwera | Dane na serwerze kontrolowanym przez administratora, logi serwera: rotacja 30 dni | Tak (DPA Hostinger) |

---

## 8. Postanowienia końcowe

1. Niniejsza polityka wchodzi w życie z dniem podpisania.
2. Polityka podlega przeglądowi i aktualizacji **co najmniej raz w roku** lub niezwłocznie po istotnej zmianie w zakresie przetwarzania danych.
3. Wszelkie wyjątki od polityki retencji muszą być **pisemnie uzasadnione** i zatwierdzone przez administratora.
4. Osoby mające dostęp do danych osobowych (dietetycy, współpracownicy) są zobowiązane do przestrzegania niniejszej polityki.

---

## Historia zmian dokumentu

| Wersja | Data | Autor | Opis zmian |
|--------|------|-------|------------|
| 1.0 | 23.03.2026 | Wirgiliusz Ładziński | Utworzenie polityki retencji |

---

**Podpis administratora:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
Wirgiliusz Ładziński
Administrator danych — e-dietetyk.com
Data: 23 marca 2026 r.
