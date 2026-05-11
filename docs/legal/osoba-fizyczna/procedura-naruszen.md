# Procedura reagowania na naruszenia ochrony danych osobowych

**Podstawa prawna:** art. 33–34 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)

**Administrator danych:** Wirgiliusz Ładziński
**Adres:** ul. Pod Brzozami 16/8a, 03-995 Warszawa
**E-mail kontaktowy:** kontakt@e-dietetyk.com
**Serwis:** e-dietetyk.com
**Data sporządzenia:** 23 marca 2026 r.
**Wersja:** 1.0

---

## Spis treści

1. [Cel i zakres procedury](#1-cel-i-zakres-procedury)
2. [Definicje](#2-definicje)
3. [Wykrywanie naruszeń](#3-wykrywanie-naruszeń)
4. [Ocena naruszenia](#4-ocena-naruszenia)
5. [Powiadomienie UODO](#5-powiadomienie-uodo)
6. [Powiadomienie osób, których dane dotyczą](#6-powiadomienie-osób-których-dane-dotyczą)
7. [Dokumentowanie naruszeń](#7-dokumentowanie-naruszeń)
8. [Działania naprawcze](#8-działania-naprawcze)
9. [Role i odpowiedzialności](#9-role-i-odpowiedzialności)
10. [Szablon zgłoszenia naruszenia do UODO](#10-szablon-zgłoszenia-naruszenia-do-uodo)
11. [Szablon powiadomienia osób](#11-szablon-powiadomienia-osób)

---

## 1. Cel i zakres procedury

### 1.1. Cel

Niniejsza procedura określa zasady postępowania w przypadku stwierdzenia naruszenia ochrony danych osobowych w serwisie e-dietetyk.com, w tym:
- Sposób wykrywania i identyfikowania naruszeń,
- Proces oceny ryzyka naruszenia,
- Zasady i terminy powiadamiania organu nadzorczego (UODO) i osób, których dane dotyczą,
- Dokumentowanie naruszeń i działań naprawczych.

### 1.2. Zakres

Procedura obejmuje wszelkie naruszenia ochrony danych osobowych przetwarzanych w ramach serwisu e-dietetyk.com, w tym w szczególności naruszenia dotyczące:
- Danych zdrowotnych pacjentów (szczególna kategoria danych — art. 9 RODO),
- Danych kont użytkowników (pacjenci, dietetycy, administratorzy),
- Danych transakcyjnych (płatności Stripe),
- Danych przetwarzanych przez podmioty przetwarzające (OpenAI, Stripe, Resend, Hostinger).

### 1.3. Obowiązek stosowania

Procedura obowiązuje administratora danych oraz wszystkie osoby mające dostęp do danych osobowych w ramach serwisu (dietetycy współpracujący, ewentualni pracownicy/współpracownicy techniczni).

---

## 2. Definicje

| Termin | Definicja |
|--------|-----------|
| **Naruszenie ochrony danych osobowych** | Naruszenie bezpieczeństwa prowadzące do przypadkowego lub niezgodnego z prawem zniszczenia, utracenia, zmodyfikowania, nieuprawnionego ujawnienia lub nieuprawnionego dostępu do danych osobowych przesyłanych, przechowywanych lub w inny sposób przetwarzanych (art. 4 pkt 12 RODO). |
| **Naruszenie poufności** | Nieuprawnione lub przypadkowe ujawnienie danych osobowych lub dostęp do nich (np. wyciek bazy danych, nieautoryzowany dostęp do konta). |
| **Naruszenie integralności** | Nieuprawniona lub przypadkowa zmiana danych osobowych (np. modyfikacja danych zdrowotnych pacjenta przez osobę nieuprawnioną). |
| **Naruszenie dostępności** | Przypadkowa lub nieuprawniona utrata dostępu do danych osobowych lub ich zniszczenie (np. awaria serwera bez backupu, ransomware, nieodwracalne usunięcie danych). |
| **Organ nadzorczy** | Prezes Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa. |
| **Osoba, której dane dotyczą** | Pacjent, dietetyk lub inny użytkownik serwisu, którego dane osobowe zostały naruszone. |

---

## 3. Wykrywanie naruszeń

### 3.1. Źródła wykrywania

| # | Źródło | Opis | Sposób monitorowania |
|---|--------|------|---------------------|
| 1 | **Audit logi systemu** | Logi operacji na danych osobowych (logowanie, dostęp do danych zdrowotnych, modyfikacja, usunięcie, eksport) | Przegląd miesięczny + alerty na anomalie |
| 2 | **Logi serwera** | Logi dostępu do serwera VPS, logi nginx, logi bazy danych | Przegląd miesięczny |
| 3 | **Monitoring dostępności** | Monitoring uptime serwisu, bazy danych, usług zależnych | Automatyczny (uptime monitoring) |
| 4 | **Zgłoszenia użytkowników** | Zgłoszenia od pacjentów lub dietetyków o podejrzanych aktywnościach na koncie | Formularz kontaktowy, e-mail |
| 5 | **Zgłoszenia podmiotów przetwarzających** | Powiadomienia od OpenAI, Stripe, Resend, Hostinger o naruszeniach po ich stronie | E-mail, dashboardy dostawców |
| 6 | **Zewnętrzne źródła** | Informacje z CERT Polska, media, raporty o podatnościach | Bieżący monitoring |
| 7 | **Testy bezpieczeństwa** | Wyniki audytów bezpieczeństwa, penetration testów (jeśli przeprowadzane) | Po każdym teście |

### 3.2. Obowiązek zgłoszenia wewnętrznego

Każda osoba mająca dostęp do danych osobowych w ramach serwisu (dietetyk, współpracownik techniczny) jest zobowiązana do **niezwłocznego** zgłoszenia administratorowi podejrzenia naruszenia ochrony danych osobowych na adres: **kontakt@e-dietetyk.com** lub telefonicznie.

Zgłoszenie powinno zawierać:
- Datę i godzinę stwierdzenia/podejrzenia naruszenia,
- Opis zdarzenia (co się stało lub mogło się stać),
- Kategorie danych, których dotyczy zdarzenie,
- Podjęte natychmiastowe działania (jeśli jakieś).

---

## 4. Ocena naruszenia

### 4.1. Termin oceny

Administrator dokonuje wstępnej oceny naruszenia **niezwłocznie, nie później niż w ciągu 12 godzin** od powzięcia informacji o podejrzeniu naruszenia.

### 4.2. Matryca severity

| Poziom | Nazwa | Kryteria | Przykłady w kontekście e-dietetyk.com | Wymagane działania |
|--------|-------|----------|---------------------------------------|-------------------|
| **1** | **Niskie** | Naruszenie nie dotyczy danych szczególnych kategorii, dotyczy małej liczby osób, niskie ryzyko dla praw i wolności | Przypadkowe ujawnienie adresu e-mail jednego użytkownika; nieautoryzowane logowanie na konto bez dostępu do danych zdrowotnych (konto bez wywiadu) | Wpis w rejestrze naruszeń. **Brak obowiązku** powiadomienia UODO (art. 33 ust. 1 — naruszenie mało prawdopodobne, by skutkowało ryzykiem). |
| **2** | **Średnie** | Naruszenie dotyczy danych osobowych (nie szczególnych kategorii) większej grupy osób lub danych jednej osoby umożliwiających identyfikację | Wyciek listy adresów e-mail użytkowników; nieautoryzowany dostęp do danych profilowych (bez danych zdrowotnych) wielu kont | Wpis w rejestrze naruszeń. **Powiadomienie UODO w ciągu 72h.** Ocena konieczności powiadomienia osób. |
| **3** | **Wysokie** | Naruszenie dotyczy danych szczególnych kategorii (zdrowotnych) lub danych umożliwiających kradzież tożsamości | Nieautoryzowany dostęp do danych zdrowotnych pacjenta (wywiadu dietetycznego, planu żywieniowego); wyciek nieszyfrowanych danych zdrowotnych | Wpis w rejestrze naruszeń. **Powiadomienie UODO w ciągu 72h.** **Powiadomienie osób, których dane dotyczą.** Natychmiastowe działania naprawcze. |
| **4** | **Krytyczne** | Masowy wyciek danych zdrowotnych, kompromitacja klucza szyfrowania, ransomware z utratą danych, naruszenie dotyczące dużej liczby pacjentów | Wyciek bazy danych z odszyfrowanymi danymi zdrowotnymi; kompromitacja ENCRYPTION_KEY; ransomware na serwerze produkcyjnym; masowe ujawnienie wywiadów dietetycznych | Wpis w rejestrze naruszeń. **Natychmiastowe powiadomienie UODO** (bez czekania na pełną analizę — uzupełnienie w ciągu 72h). **Niezwłoczne powiadomienie osób.** Eskalacja — rozważenie konsultacji prawnej. |

### 4.3. Kryteria oceny

Przy ocenie naruszenia uwzględnia się:

1. **Charakter naruszenia** — poufność, integralność, dostępność,
2. **Kategorie danych** — czy dotyczą danych zdrowotnych (art. 9 RODO),
3. **Liczba osób, których dane dotyczą**,
4. **Czy dane były zaszyfrowane** — jeśli dane zdrowotne były zaszyfrowane AES-256-GCM i klucz nie został skompromitowany, ryzyko jest znacząco niższe,
5. **Czy nastąpiło faktyczne ujawnienie** — czy dane zostały pobrane/odczytane, czy jedynie istniało techniczne ryzyko dostępu,
6. **Odwracalność** — czy dane można odzyskać (np. z backupu),
7. **Konsekwencje dla osób** — potencjalna dyskryminacja, stygmatyzacja, zagrożenie zdrowia.

### 4.4. Specjalna uwaga — dane zdrowotne

Ze względu na przetwarzanie danych zdrowotnych (art. 9 RODO), **każde naruszenie dotyczące danych zdrowotnych jest domyślnie klasyfikowane jako co najmniej WYSOKIE (3)**, chyba że analiza wykaże, że dane były skutecznie zaszyfrowane i klucz nie został skompromitowany.

---

## 5. Powiadomienie UODO

### 5.1. Kiedy wymagane

Zgodnie z art. 33 ust. 1 RODO, administrator zgłasza naruszenie Prezesowi UODO **bez zbędnej zwłoki, w miarę możliwości nie później niż w terminie 72 godzin** po stwierdzeniu naruszenia — **chyba że jest mało prawdopodobne, by naruszenie to skutkowało ryzykiem naruszenia praw lub wolności osób fizycznych**.

Powiadomienie UODO jest wymagane dla naruszeń o severity **Średnie (2)** i wyższym.

### 5.2. Termin i forma

| Aspekt | Szczegóły |
|--------|-----------|
| **Termin** | 72 godziny od stwierdzenia naruszenia. Jeśli zgłoszenie następuje po 72h — dołączyć wyjaśnienie opóźnienia. |
| **Forma** | Elektronicznie za pośrednictwem portalu UODO: **https://uodo.gov.pl/pl/134/233** (ePUAP / profil zaufany) lub pisemnie na adres UODO |
| **Uzupełnienie** | Jeśli w ciągu 72h nie jest możliwe podanie pełnych informacji — zgłoszenie etapowe (art. 33 ust. 4 RODO): wstępne zgłoszenie + uzupełnienie |

### 5.3. Dane kontaktowe UODO

| Pole | Wartość |
|------|---------|
| **Nazwa** | Urząd Ochrony Danych Osobowych |
| **Adres** | ul. Stawki 2, 00-193 Warszawa |
| **Telefon** | (22) 531 03 00 |
| **Fax** | (22) 531 03 01 |
| **E-mail** | kancelaria@uodo.gov.pl |
| **ePUAP** | /UODO/SkrytkaESP |
| **Formularz online** | https://uodo.gov.pl/pl/134/233 |
| **Infolinia** | 606-950-000 (pon-pt 10:00-13:00) |

### 5.4. Treść zgłoszenia

Zgłoszenie musi zawierać co najmniej (art. 33 ust. 3 RODO):
1. Opis charakteru naruszenia, w tym — w miarę możliwości — kategorie i przybliżoną liczbę osób, których dane dotyczą, oraz kategorie i przybliżoną liczbę wpisów danych osobowych, których dotyczy naruszenie,
2. Imię i nazwisko oraz dane kontaktowe administratora (lub IOD, jeśli wyznaczony),
3. Opis możliwych konsekwencji naruszenia,
4. Opis środków zastosowanych lub proponowanych w celu zaradzenia naruszeniu, w tym — w stosownych przypadkach — środków w celu zminimalizowania jego ewentualnych negatywnych skutków.

---

## 6. Powiadomienie osób, których dane dotyczą

### 6.1. Kiedy wymagane

Zgodnie z art. 34 ust. 1 RODO, administrator **bez zbędnej zwłoki** zawiadamia osobę, której dane dotyczą, o naruszeniu, **jeżeli naruszenie może powodować WYSOKIE RYZYKO** naruszenia praw lub wolności tej osoby.

Powiadomienie osób jest wymagane dla naruszeń o severity **Wysokie (3)** i **Krytyczne (4)**.

### 6.2. Wyjątki (art. 34 ust. 3 RODO)

Powiadomienie osób **nie jest wymagane**, jeżeli:
1. Administrator wdrożył odpowiednie środki ochrony (np. szyfrowanie), które uniemożliwiają odczyt danych osobom nieuprawnionym — **dotyczy danych zaszyfrowanych AES-256-GCM, gdy klucz szyfrowania nie został skompromitowany**,
2. Administrator zastosował środki eliminujące prawdopodobieństwo wysokiego ryzyka,
3. Powiadomienie wymagałoby niewspółmiernie dużego wysiłku — wówczas publiczny komunikat.

### 6.3. Treść powiadomienia

Powiadomienie musi zawierać (art. 34 ust. 2 RODO):
1. Opis charakteru naruszenia **prostym i zrozumiałym językiem**,
2. Imię i nazwisko oraz dane kontaktowe administratora,
3. Opis możliwych konsekwencji naruszenia,
4. Opis środków zastosowanych lub proponowanych w celu zaradzenia naruszeniu, w tym zalecenia dla osoby.

### 6.4. Forma i kanał powiadomienia

| Priorytet | Kanał | Kiedy |
|-----------|-------|-------|
| 1 | **E-mail** na adres zarejestrowany w serwisie | Domyślny kanał powiadomienia |
| 2 | **Powiadomienie w serwisie** (banner/modal po zalogowaniu) | Uzupełniająco lub gdy e-mail niedostępny |
| 3 | **Komunikat publiczny** na stronie e-dietetyk.com | Gdy indywidualne powiadomienie wymaga niewspółmiernego wysiłku |

---

## 7. Dokumentowanie naruszeń

### 7.1. Rejestr naruszeń

Zgodnie z art. 33 ust. 5 RODO, administrator prowadzi **rejestr wszelkich naruszeń** ochrony danych osobowych, niezależnie od tego, czy naruszenie podlega zgłoszeniu do UODO.

### 7.2. Struktura rejestru

Dla każdego naruszenia rejestruje się:

| Pole | Opis |
|------|------|
| Numer naruszenia | Kolejny numer (NR-YYYY-NNN) |
| Data i godzina stwierdzenia | Kiedy administrator dowiedział się o naruszeniu |
| Data i godzina wystąpienia | Kiedy naruszenie faktycznie wystąpiło (jeśli różne od stwierdzenia) |
| Źródło wykrycia | Audit log, zgłoszenie użytkownika, podmiot przetwarzający, inne |
| Opis naruszenia | Szczegółowy opis zdarzenia |
| Charakter naruszenia | Poufność / integralność / dostępność |
| Kategorie danych | Jakie dane zostały naruszone |
| Czy dane zdrowotne | Tak / Nie |
| Czy dane były zaszyfrowane | Tak / Nie, jakim algorytmem |
| Czy klucz szyfrowania skompromitowany | Tak / Nie / Nieznane |
| Liczba osób dotkniętych | Dokładna lub przybliżona |
| Severity | Niskie / Średnie / Wysokie / Krytyczne |
| Konsekwencje | Opis możliwych skutków dla osób |
| Czy zgłoszono do UODO | Tak / Nie + uzasadnienie |
| Data zgłoszenia do UODO | Data |
| Numer sprawy UODO | Jeśli nadany |
| Czy powiadomiono osoby | Tak / Nie + uzasadnienie |
| Data powiadomienia osób | Data |
| Sposób powiadomienia | E-mail / w serwisie / komunikat publiczny |
| Działania naprawcze | Lista podjętych działań |
| Status | Otwarty / W trakcie / Zamknięty |
| Data zamknięcia | Data |
| Wnioski | Lessons learned |

### 7.3. Przechowywanie rejestru

Rejestr naruszeń przechowywany jest przez **5 lat** od daty zamknięcia naruszenia. Rejestr jest prowadzony w formie elektronicznej i zabezpieczony przed nieautoryzowanym dostępem.

---

## 8. Działania naprawcze

### 8.1. Natychmiastowe (do 24h)

1. **Powstrzymanie naruszenia** — zablokowanie nieautoryzowanego dostępu, odcięcie wektora ataku,
2. **Zabezpieczenie dowodów** — zachowanie logów, zrzutów ekranu, stanu systemu,
3. **Zmiana credentials** — jeśli skompromitowane: hasła, klucze API, tokeny,
4. **Rotacja klucza szyfrowania** — jeśli ENCRYPTION_KEY mógł zostać skompromitowany,
5. **Wymuszenie wylogowania** — unieważnienie aktywnych sesji JWT (jeśli dotyczy).

### 8.2. Krótkoterminowe (do 7 dni)

1. **Analiza root cause** — ustalenie przyczyny naruszenia,
2. **Łatanie podatności** — usunięcie exploitowanej luki,
3. **Przegląd logów** — pełna analiza audit logów w celu ustalenia zakresu naruszenia,
4. **Weryfikacja integralności danych** — sprawdzenie czy dane nie zostały zmodyfikowane,
5. **Odtworzenie z backupu** — jeśli dane zostały utracone/zniszczone.

### 8.3. Długoterminowe (do 30 dni)

1. **Wzmocnienie zabezpieczeń** — wdrożenie dodatkowych środków zapobiegających powtórzeniu,
2. **Aktualizacja DPIA** — przegląd oceny skutków w świetle naruszenia,
3. **Aktualizacja procedur** — jeśli naruszenie ujawniło luki w procedurach,
4. **Szkolenie** — jeśli naruszenie wynikało z błędu ludzkiego,
5. **Raport końcowy** — lessons learned, zamknięcie naruszenia w rejestrze.

---

## 9. Role i odpowiedzialności

| Rola | Osoba | Odpowiedzialności |
|------|-------|-------------------|
| **Administrator danych** | Wirgiliusz Ładziński | Decyzja o zgłoszeniu do UODO i powiadomieniu osób, koordynacja działań naprawczych, prowadzenie rejestru naruszeń, kontakt z UODO |
| **Administrator techniczny** | Wirgiliusz Ładziński (obecnie pełni obie role) | Wykrywanie naruszeń technicznych, analiza logów, powstrzymanie naruszenia, łatanie podatności, odtworzenie z backupu |
| **Dietetycy współpracujący** | Dietetycy zarejestrowani w serwisie | Zgłaszanie podejrzeń naruszeń, przestrzeganie zasad bezpieczeństwa, współpraca przy ustalaniu zakresu naruszenia |
| **IOD** | Nie wyznaczony (w przyszłości — punkt kontaktowy dla UODO i osób) | — |

---

## 10. Szablon zgłoszenia naruszenia do UODO

---

**ZGŁOSZENIE NARUSZENIA OCHRONY DANYCH OSOBOWYCH**
*(art. 33 Rozporządzenia (UE) 2016/679 — RODO)*

**Do:** Prezes Urzędu Ochrony Danych Osobowych
ul. Stawki 2, 00-193 Warszawa

**Data zgłoszenia:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Zgłoszenie:** ☐ Wstępne ☐ Uzupełniające (do zgłoszenia nr \_\_\_\_\_\_\_\_)

---

### I. Dane administratora

| Pole | Wartość |
|------|---------|
| Nazwa / imię i nazwisko | Wirgiliusz Ładziński |
| Adres | ul. Pod Brzozami 16/8a, 03-995 Warszawa |
| E-mail | kontakt@e-dietetyk.com |
| Telefon | \_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| IOD (jeśli wyznaczony) | Nie wyznaczono |

### II. Opis naruszenia

**Data i godzina stwierdzenia naruszenia:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Data i godzina wystąpienia naruszenia (jeśli inna):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Jeśli zgłoszenie po upływie 72h — uzasadnienie opóźnienia:**
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Charakter naruszenia:**
☐ Naruszenie poufności (nieuprawniony dostęp/ujawnienie)
☐ Naruszenie integralności (nieuprawniona zmiana)
☐ Naruszenie dostępności (utrata dostępu/zniszczenie)

**Opis zdarzenia:**
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### III. Kategorie i liczba osób / danych

| Pole | Wartość |
|------|---------|
| Kategorie osób, których dane dotyczą | ☐ Pacjenci ☐ Dietetycy ☐ Administratorzy |
| Przybliżona liczba osób | \_\_\_\_\_\_\_\_ |
| Kategorie danych | ☐ Dane identyfikacyjne (imię, e-mail) ☐ Dane zdrowotne (art. 9 RODO) ☐ Dane transakcyjne ☐ Dane logowania (IP, user agent) |
| Przybliżona liczba wpisów danych | \_\_\_\_\_\_\_\_ |
| Czy dane były zaszyfrowane | ☐ Tak (AES-256-GCM) ☐ Nie ☐ Częściowo |
| Czy klucz szyfrowania skompromitowany | ☐ Tak ☐ Nie ☐ Nieznane |

### IV. Możliwe konsekwencje naruszenia

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### V. Zastosowane środki naprawcze

**Środki już podjęte:**
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Środki proponowane:**
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### VI. Powiadomienie osób

☐ Osoby zostały powiadomione (data: \_\_\_\_\_\_\_\_)
☐ Osoby zostaną powiadomione (planowana data: \_\_\_\_\_\_\_\_)
☐ Powiadomienie nie jest wymagane — uzasadnienie: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

**Podpis administratora:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
Wirgiliusz Ładziński

---

## 11. Szablon powiadomienia osób

---

**Temat e-mail:** Ważne powiadomienie dotyczące bezpieczeństwa Twoich danych — e-dietetyk.com

---

Szanowna Pani / Szanowny Panie,

Informujemy, że w dniu **[DATA NARUSZENIA]** doszło do naruszenia ochrony danych osobowych w serwisie e-dietetyk.com.

### Co się wydarzyło?

[OPIS NARUSZENIA PROSTYM JĘZYKIEM — np. „Wykryliśmy nieautoryzowany dostęp do naszego systemu, w wyniku którego mogło dojść do ujawnienia części danych użytkowników."]

### Jakie dane mogły zostać naruszone?

[LISTA KATEGORII DANYCH — np. „adres e-mail, dane dotyczące Twojego wywiadu dietetycznego (informacje o zdrowiu, alergiach, masie ciała)"]

### Jakie mogą być konsekwencje?

[OPIS MOŻLIWYCH KONSEKWENCJI — np. „Istnieje ryzyko, że osoby nieuprawnione mogły uzyskać dostęp do informacji o Twoim stanie zdrowia."]

### Co robimy, aby rozwiązać problem?

[OPIS PODJĘTYCH DZIAŁAŃ — np.
- „Niezwłocznie zablokowaliśmy źródło naruszenia"
- „Wzmocniliśmy zabezpieczenia systemu"
- „Zgłosiliśmy naruszenie do Prezesa Urzędu Ochrony Danych Osobowych"]

### Co możesz zrobić?

Zalecamy podjęcie następujących kroków:
1. **Zmień hasło** do swojego konta w serwisie e-dietetyk.com,
2. Jeśli używasz tego samego hasła w innych serwisach — **zmień je również tam**,
3. Zwracaj uwagę na **podejrzane wiadomości e-mail** lub próby kontaktu powołujące się na Twoje dane zdrowotne,
4. W razie jakichkolwiek wątpliwości — skontaktuj się z nami.

### Kontakt

Jeśli masz pytania dotyczące tego naruszenia, skontaktuj się z nami:
- **E-mail:** kontakt@e-dietetyk.com
- **Telefon:** [NUMER TELEFONU]

Masz również prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych:
- **Adres:** ul. Stawki 2, 00-193 Warszawa
- **Strona:** https://uodo.gov.pl
- **Infolinia:** 606-950-000

Przepraszamy za zaistniałą sytuację i zapewniamy, że podejmujemy wszelkie niezbędne kroki w celu ochrony Twoich danych.

Z poważaniem,
Wirgiliusz Ładziński
Administrator serwisu e-dietetyk.com

---

## Historia zmian dokumentu

| Wersja | Data | Autor | Opis zmian |
|--------|------|-------|------------|
| 1.0 | 23.03.2026 | Wirgiliusz Ładziński | Utworzenie procedury |

---

**Podpis administratora:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
Wirgiliusz Ładziński
Administrator danych — e-dietetyk.com
Data: 23 marca 2026 r.
