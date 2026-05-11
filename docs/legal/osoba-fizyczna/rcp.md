# Rejestr Czynności Przetwarzania Danych Osobowych (RCP)

**Podstawa prawna:** art. 30 ust. 1 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)

**Administrator danych:** Wirgiliusz Ładziński
**Adres:** ul. Pod Brzozami 16/8a, 03-995 Warszawa
**E-mail kontaktowy:** kontakt@e-dietetyk.com
**Serwis:** e-dietetyk.com
**Data sporządzenia:** 23 marca 2026 r.
**Wersja:** 1.1
**Ostatnia aktualizacja:** 23 marca 2026 r.

---

## Informacje ogólne o administratorze

| Pole | Wartość |
|------|---------|
| Nazwa administratora | Wirgiliusz Ładziński (osoba fizyczna) |
| Adres | ul. Pod Brzozami 16/8a, 03-995 Warszawa |
| E-mail | kontakt@e-dietetyk.com |
| Inspektor Ochrony Danych | Nie wyznaczono (uzasadnienie: odrębny dokument) |
| Współadministrator | Nie dotyczy |

---

## 1. Rejestracja użytkownika

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-01 |
| **Nazwa czynności** | Rejestracja użytkownika w serwisie e-dietetyk.com |
| **Kategorie osób** | Pacjenci (konsumenci), dietetycy (współpracownicy), administratorzy |
| **Kategorie danych** | Adres e-mail, hasło (przechowywane jako hash bcrypt), imię (opcjonalnie), data rejestracji, adres IP przy rejestracji |
| **Cel przetwarzania** | Utworzenie konta użytkownika, umożliwienie korzystania z serwisu, uwierzytelnianie |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b) RODO — niezbędność do wykonania umowy (regulamin serwisu) |
| **Odbiorcy danych** | Hostinger International Ltd. (hosting VPS — Litwa, UE) |
| **Transfer do państw trzecich** | Nie |
| **Termin usunięcia** | Czas trwania umowy (konto aktywne) + 3 lata od usunięcia konta (przedawnienie roszczeń cywilnych, art. 118 k.c.) |
| **Środki bezpieczeństwa** | Hasła hashowane (bcrypt), HTTPS/TLS 1.3, serwer w UE (Litwa), kontrola dostępu RBAC, audit logi rejestracji |

---

## 2. Prowadzenie konta użytkownika

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-02 |
| **Nazwa czynności** | Prowadzenie i obsługa konta użytkownika |
| **Kategorie osób** | Pacjenci, dietetycy, administratorzy |
| **Kategorie danych** | Dane profilowe: imię, nazwisko, e-mail, rola w systemie, data ostatniego logowania, preferencje konta, przypisanie do dietetyka (pacjenci), kod dietetyka (dietetycy) |
| **Cel przetwarzania** | Obsługa konta użytkownika, zarządzanie relacją pacjent-dietetyk, personalizacja usługi, obsługa subskrypcji |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b) RODO — niezbędność do wykonania umowy |
| **Odbiorcy danych** | Hostinger International Ltd. (hosting) |
| **Transfer do państw trzecich** | Nie |
| **Termin usunięcia** | Czas trwania umowy + 3 lata od usunięcia konta. Soft delete + anonimizacja PII przy usunięciu konta. |
| **Środki bezpieczeństwa** | RBAC (role: ADMIN, DIETITIAN, PATIENT), sesje JWT z ograniczonym czasem ważności (7 dni), HTTPS, audit logi operacji na koncie |

---

## 3. Zbieranie danych zdrowotnych (wywiad dietetyczny)

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-03 |
| **Nazwa czynności** | Zbieranie danych zdrowotnych w ramach wywiadu dietetycznego |
| **Kategorie osób** | Pacjenci |
| **Kategorie danych** | **Szczególne kategorie danych (art. 9 RODO):** masa ciała, wzrost, BMI, alergie pokarmowe, nietolerancje, schorzenia i stany chorobowe, stosowane leki (kontekst żywieniowy), cele dietetyczne, ograniczenia żywieniowe, preferencje żywieniowe, flagi medyczne (medicalFlags) |
| **Cel przetwarzania** | Zebranie danych niezbędnych do przygotowania spersonalizowanego planu żywieniowego |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b) RODO — niezbędność do wykonania umowy; Art. 9 ust. 2 lit. a) RODO — wyraźna zgoda osoby na przetwarzanie danych zdrowotnych w określonym celu |
| **Odbiorcy danych** | Hostinger International Ltd. (hosting — dane zaszyfrowane at rest) |
| **Transfer do państw trzecich** | Nie (dane przechowywane wyłącznie w bazie PostgreSQL na serwerze w Litwie, UE). Transfer do OpenAI — patrz czynność RCP-04. |
| **Termin usunięcia** | Czas trwania umowy. Usuwane na żądanie osoby (art. 17 RODO) lub po usunięciu konta. |
| **Środki bezpieczeństwa** | **Szyfrowanie AES-256-GCM** (pola: Interview.answers, Interview.medicalFlags), dostęp ograniczony do pacjenta i przypisanego dietetyka, audit logi dostępu, baza danych na serwerze w UE, brak logowania danych zdrowotnych w logach aplikacji |

---

## 4. Generowanie planów żywieniowych przez AI

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-04 |
| **Nazwa czynności** | Generowanie spersonalizowanych planów żywieniowych z wykorzystaniem sztucznej inteligencji (OpenAI GPT-4.1) |
| **Kategorie osób** | Pacjenci |
| **Kategorie danych** | **Szczególne kategorie danych (art. 9 RODO):** dane z wywiadu dietetycznego (masa ciała, wzrost, alergie, schorzenia, cele dietetyczne), obliczone cele kaloryczne i makroskładnikowe (NutritionTargets), wynik policy engine (flagi kliniczne) |
| **Cel przetwarzania** | Wygenerowanie wstępnego planu żywieniowego (AI_DRAFT) na podstawie danych zdrowotnych pacjenta, z wykorzystaniem modelu językowego |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b) RODO — niezbędność do wykonania umowy; Art. 9 ust. 2 lit. a) RODO — wyraźna zgoda; **Nie stanowi zautomatyzowanego podejmowania decyzji w rozumieniu art. 22 RODO** — każdy plan wymaga weryfikacji i zatwierdzenia przez dietetyka |
| **Odbiorcy danych** | **OpenAI, LLC** (San Francisco, USA) — podmiot przetwarzający na podstawie DPA i standardowych klauzul umownych (SCC); Hostinger (hosting wynikowego planu) |
| **Transfer do państw trzecich** | **Tak — USA (OpenAI).** Podstawa transferu: standardowe klauzule umowne (SCC) zgodnie z decyzją wykonawczą Komisji 2021/914 + DPA OpenAI. Dane przesyłane do API OpenAI w formie promptu, nie są wykorzystywane do trenowania modelu (opt-out via API). |
| **Termin usunięcia** | Wynikowy plan: czas trwania umowy + 30 dni po usunięciu konta. Dane w API OpenAI: nie przechowywane po przetworzeniu (zero data retention policy API). |
| **Środki bezpieczeństwa** | Szyfrowanie danych w tranzycie (TLS 1.2+), DPA z OpenAI, SCC, opt-out z trenowania modelu, **każdy plan weryfikowany przez dietetyka** przed udostępnieniem pacjentowi, minimalizacja danych w prompcie (tylko niezbędne dane zdrowotne, bez danych identyfikujących jak imię/e-mail), szyfrowanie planu AES-256-GCM (DietPlan.content), audit log generowania |

---

## 5. Weryfikacja planów przez dietetyka

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-05 |
| **Nazwa czynności** | Weryfikacja i zatwierdzenie planów żywieniowych wygenerowanych przez AI |
| **Kategorie osób** | Pacjenci (osoby, których plan dotyczy), dietetycy (osoby weryfikujące) |
| **Kategorie danych** | Plan żywieniowy (zawierający dane zdrowotne pacjenta — makroskładniki, kaloryczność, uwzględnione alergie/schorzenia), dane identyfikacyjne pacjenta (imię, przypisanie), notatki dietetyka |
| **Cel przetwarzania** | Zapewnienie bezpieczeństwa i poprawności merytorycznej planu żywieniowego przed jego udostępnieniem pacjentowi |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b) RODO — niezbędność do wykonania umowy; Art. 9 ust. 2 lit. h) RODO — przetwarzanie niezbędne do celów profilaktyki zdrowotnej (weryfikacja przez osobę podlegającą obowiązkowi zachowania tajemnicy zawodowej) |
| **Odbiorcy danych** | Hostinger International Ltd. (hosting) |
| **Transfer do państw trzecich** | Nie |
| **Termin usunięcia** | Jak plan żywieniowy (RCP-04) |
| **Środki bezpieczeństwa** | Dostęp ograniczony do przypisanego dietetyka (RBAC), szyfrowanie AES-256-GCM, audit log weryfikacji (kto, kiedy, jaką decyzję podjął), HTTPS |

---

## 6. Przetwarzanie płatności

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-06 |
| **Nazwa czynności** | Przetwarzanie płatności za usługi serwisu e-dietetyk.com |
| **Kategorie osób** | Pacjenci (płacący użytkownicy) |
| **Kategorie danych** | Identyfikator klienta Stripe (stripeCustomerId), identyfikator subskrypcji, typ produktu (productType), kwota, waluta, status płatności, data transakcji. **Administrator NIE przechowuje** numerów kart płatniczych ani danych uwierzytelniających płatność — te dane przetwarza wyłącznie Stripe. |
| **Cel przetwarzania** | Realizacja płatności za usługi, zarządzanie subskrypcjami, rozliczenia, obsługa zwrotów i reklamacji, spełnienie obowiązków podatkowych |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b) RODO — niezbędność do wykonania umowy; Art. 6 ust. 1 lit. c) RODO — obowiązek prawny (Ordynacja podatkowa, ustawa o rachunkowości) |
| **Odbiorcy danych** | **Stripe Technology Europe Ltd.** (Dublin, Irlandia) — podmiot przetwarzający płatności na podstawie DPA Stripe; ewentualnie biuro rachunkowe (jeśli dotyczy) |
| **Transfer do państw trzecich** | Stripe może transferować dane do USA (Stripe, Inc.) — na podstawie SCC i DPA Stripe. Administrator przechowuje jedynie identyfikatory Stripe, nie dane kart. |
| **Termin usunięcia** | **5 lat** od końca roku kalendarzowego, w którym dokonano transakcji (art. 86 § 1 Ordynacji podatkowej w zw. z art. 74 ustawy o rachunkowości) |
| **Środki bezpieczeństwa** | Stripe PCI DSS Level 1, brak przechowywania danych kart po stronie administratora, HTTPS, webhook signature verification (Stripe webhooks), audit logi transakcji |

---

## 7. Wysyłka emaili transakcyjnych

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-07 |
| **Nazwa czynności** | Wysyłka wiadomości e-mail transakcyjnych (potwierdzenia, resetowanie hasła, powiadomienia systemowe) |
| **Kategorie osób** | Pacjenci, dietetycy, administratorzy |
| **Kategorie danych** | Adres e-mail odbiorcy, imię (jeśli podane), treść wiadomości transakcyjnej (typ powiadomienia, np. potwierdzenie rejestracji, reset hasła, status planu) |
| **Cel przetwarzania** | Obsługa konta użytkownika — komunikacja transakcyjna niezbędna do świadczenia usługi |
| **Podstawa prawna** | Art. 6 ust. 1 lit. b) RODO — niezbędność do wykonania umowy (komunikacja niezbędna do świadczenia usługi) |
| **Odbiorcy danych** | **Resend, Inc.** (USA) — dostawca usługi wysyłki e-mail transakcyjnych, podmiot przetwarzający na podstawie DPA |
| **Transfer do państw trzecich** | **Tak — USA (Resend, Inc.).** Podstawa transferu: SCC + DPA Resend. Przesyłane dane ograniczone do adresu e-mail i treści wiadomości. |
| **Termin usunięcia** | Logi wysyłki: 12 miesięcy. Dane po stronie Resend: zgodnie z DPA Resend (usuwane po zakończeniu współpracy). |
| **Środki bezpieczeństwa** | TLS w tranzycie, uwierzytelnianie DKIM/SPF/DMARC, brak danych zdrowotnych w treści e-maili, DPA z Resend |

---

## 8. Logowanie i bezpieczeństwo (audit log)

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-08 |
| **Nazwa czynności** | Prowadzenie logów bezpieczeństwa i audytowych |
| **Kategorie osób** | Wszyscy użytkownicy serwisu (pacjenci, dietetycy, administratorzy) |
| **Kategorie danych** | Identyfikator użytkownika, adres IP, user agent (przeglądarka/system), typ zdarzenia (logowanie, wylogowanie, dostęp do danych, modyfikacja, usunięcie, generowanie planu, zatwierdzenie planu, eksport), data i czas zdarzenia, identyfikator zasobu |
| **Cel przetwarzania** | Zapewnienie bezpieczeństwa systemu, wykrywanie nieautoryzowanego dostępu, rozliczalność operacji na danych osobowych (w tym zdrowotnych), spełnienie wymogów RODO dot. rozliczalności (art. 5 ust. 2) |
| **Podstawa prawna** | Art. 6 ust. 1 lit. f) RODO — prawnie uzasadniony interes administratora (bezpieczeństwo systemu IT, rozliczalność); Art. 6 ust. 1 lit. c) RODO — obowiązek prawny (zapewnienie bezpieczeństwa przetwarzania, art. 32 RODO) |
| **Odbiorcy danych** | Hostinger International Ltd. (hosting) |
| **Transfer do państw trzecich** | Nie |
| **Termin usunięcia** | **12 miesięcy** od daty zdarzenia |
| **Środki bezpieczeństwa** | Logi przechowywane w bazie danych na serwerze w UE, dostęp wyłącznie dla administratora systemu, brak logowania treści danych zdrowotnych (logowane tylko identyfikatory zasobów i typ operacji), HTTPS |

---

## 9. Obsługa reklamacji

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-09 |
| **Nazwa czynności** | Obsługa reklamacji, odstąpień od umowy i skarg użytkowników |
| **Kategorie osób** | Pacjenci (konsumenci) |
| **Kategorie danych** | Imię i nazwisko, adres e-mail, treść reklamacji/skargi, data zgłoszenia, data odpowiedzi, status rozpatrzenia, dane dotyczące zamówienia/subskrypcji, ewentualna korespondencja |
| **Cel przetwarzania** | Realizacja obowiązków wynikających z prawa konsumenckiego (ustawa o prawach konsumenta, kodeks cywilny), obsługa reklamacji i odstąpień |
| **Podstawa prawna** | Art. 6 ust. 1 lit. c) RODO — obowiązek prawny (ustawa o prawach konsumenta z dnia 30 maja 2014 r., kodeks cywilny); Art. 6 ust. 1 lit. f) RODO — prawnie uzasadniony interes (obrona przed roszczeniami) |
| **Odbiorcy danych** | Hostinger (hosting), ewentualnie kancelaria prawna (w przypadku sporu) |
| **Transfer do państw trzecich** | Nie |
| **Termin usunięcia** | **3 lata** od zakończenia sprawy (przedawnienie roszczeń konsumenckich, art. 118 k.c.) lub **6 lat** w przypadku roszczeń stwierdzonych prawomocnym orzeczeniem (art. 125 k.c.) |
| **Środki bezpieczeństwa** | Dostęp ograniczony do administratora, HTTPS, korespondencja przechowywana na serwerze w UE |

---

## 10. Marketing e-mail (opcjonalny)

| Pole | Opis |
|------|------|
| **Nr czynności** | RCP-10 |
| **Nazwa czynności** | Wysyłka komunikacji marketingowej drogą elektroniczną (newsletter, oferty) |
| **Kategorie osób** | Pacjenci i potencjalni klienci, którzy wyrazili zgodę |
| **Kategorie danych** | Adres e-mail, imię (opcjonalnie), data wyrażenia zgody, źródło zgody, preferencje komunikacyjne |
| **Cel przetwarzania** | Marketing bezpośredni — informowanie o nowych funkcjonalnościach, promocjach, treściach edukacyjnych dotyczących żywienia |
| **Podstawa prawna** | Art. 6 ust. 1 lit. a) RODO — zgoda osoby, której dane dotyczą; Art. 10 ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną — zgoda na komunikację handlową; Art. 172 ustawy Prawo telekomunikacyjne — zgoda na marketing bezpośredni |
| **Odbiorcy danych** | Resend, Inc. (USA) — dostawca usługi e-mail na podstawie DPA |
| **Transfer do państw trzecich** | Tak — USA (Resend). Podstawa: SCC + DPA. |
| **Termin usunięcia** | Do momentu **cofnięcia zgody** przez osobę. Po cofnięciu zgody: niezwłocznie (dane usuwane z listy mailingowej w ciągu 72h). |
| **Środki bezpieczeństwa** | Double opt-in (potwierdzenie zgody), łatwy mechanizm rezygnacji (link w każdym e-mailu), rejestr zgód (data, źródło, treść zgody), TLS, DPA z Resend |

---

## Historia zmian rejestru

| Wersja | Data | Autor | Opis zmian |
|--------|------|-------|------------|
| 1.0 | 23.03.2026 | Wirgiliusz Ładziński | Utworzenie rejestru |
| 1.1 | 23.03.2026 | Wirgiliusz Ładziński | Uzupełnienie szczegółów transferów i środków bezpieczeństwa |

---

**Podpis administratora:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
Wirgiliusz Ładziński
Administrator danych — e-dietetyk.com
Data: 23 marca 2026 r.

---

*Rejestr podlega przeglądowi i aktualizacji co najmniej raz na kwartał lub niezwłocznie po wprowadzeniu nowej czynności przetwarzania.*
