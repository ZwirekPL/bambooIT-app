# Informacja o wykorzystaniu sztucznej inteligencji w serwisie e-dietetyk.com

**Wersja:** 1.0
**Data wejścia w życie:** 23 marca 2026 r.
**Administrator serwisu:** Wirgiliusz Ładziński, ul. Pod Brzozami 16/8a, 03-995 Warszawa
**Adres e-mail kontaktowy:** kontakt@e-dietetyk.com

---

## 1. Wykorzystanie sztucznej inteligencji w serwisie

### 1.1. Opis zastosowania AI

Serwis e-dietetyk.com wykorzystuje systemy sztucznej inteligencji (dalej: „AI") jako narzędzie wspomagające proces tworzenia indywidualnych planów żywieniowych. AI generuje wstępne propozycje planów żywieniowych na podstawie danych uzyskanych z wywiadu dietetycznego wypełnionego przez Użytkownika.

### 1.2. Wykorzystywany model AI

Serwis korzysta z modeli językowych z rodziny GPT-4 dostarczanych przez OpenAI LLC (San Francisco, USA) za pośrednictwem interfejsu programistycznego (API).

### 1.3. Rola AI a rola dietetyka

**Sztuczna inteligencja pełni wyłącznie rolę narzędzia wspomagającego** — generuje wstępną propozycję planu żywieniowego, która stanowi punkt wyjścia do dalszej pracy specjalisty.

**Dietetyk (człowiek) podejmuje decyzję końcową** — każdy plan wygenerowany przez AI jest weryfikowany, modyfikowany w razie potrzeby i zatwierdzany przez wykwalifikowanego dietetyka przed udostępnieniem Użytkownikowi. Dietetyk ponosi odpowiedzialność merytoryczną za ostateczną treść planu.

Żaden plan żywieniowy nie jest udostępniany Użytkownikowi bez uprzedniej weryfikacji i zatwierdzenia przez dietetyka.

Powyższe jest zgodne z wymogami przejrzystości określonymi w Rozporządzeniu Parlamentu Europejskiego i Rady (UE) 2024/1689 z dnia 13 czerwca 2024 r. w sprawie ustanowienia zharmonizowanych przepisów dotyczących sztucznej inteligencji (Akt o sztucznej inteligencji, AI Act), w szczególności z art. 50 dotyczącym obowiązków w zakresie przejrzystości.

---

## 2. Jakie dane są przetwarzane przez AI

### 2.1. Dane z wywiadu dietetycznego

W celu wygenerowania propozycji planu żywieniowego do systemu AI przekazywane są wyłącznie **zanonimizowane** dane z wywiadu dietetycznego, w szczególności:

- wiek, płeć, wzrost, masa ciała,
- poziom aktywności fizycznej,
- cele żywieniowe (np. redukcja masy ciała, przyrost masy mięśniowej),
- alergie i nietolerancje pokarmowe,
- preferencje żywieniowe (np. wegetarianizm, weganizm),
- choroby przewlekłe i stosowane leki (wyłącznie w zakresie istotnym dietetycznie),
- inne informacje podane przez Użytkownika w formularzu wywiadu.

**Dane identyfikujące Użytkownika (imię, nazwisko, adres e-mail, numer telefonu) NIE są przekazywane do systemu AI.** Przed wysłaniem zapytania do AI dane są anonimizowane po stronie serwera — system AI nie ma możliwości zidentyfikowania konkretnego Użytkownika.

### 2.2. Dane o produktach spożywczych

AI korzysta z polskiej bazy danych produktów spożywczych zawierającej informacje o składzie odżywczym (wartości energetyczne, makroskładniki, mikroskładniki). Baza ta nie zawiera żadnych danych osobowych.

---

## 3. Jak działa proces tworzenia planu żywieniowego z wykorzystaniem AI

Proces tworzenia planu żywieniowego z wykorzystaniem AI składa się z następujących etapów:

### Krok 1: Wypełnienie wywiadu zdrowotnego
Użytkownik wypełnia szczegółowy formularz wywiadu dietetycznego, podając informacje o swoim stanie zdrowia, preferencjach żywieniowych, alergiach, celach i stylu życia.

### Krok 2: Obliczenie celów żywieniowych
Na podstawie danych z wywiadu system automatycznie oblicza indywidualne cele żywieniowe, w tym zapotrzebowanie kaloryczne, rozkład makroskładników (białka, tłuszcze, węglowodany) oraz inne parametry dietetyczne. Obliczenia opierają się na uznanych formułach naukowych (m.in. Harris-Benedict, Mifflin-St Jeor).

### Krok 3: Generowanie propozycji planu przez AI
Zanonimizowane dane z wywiadu oraz obliczone cele żywieniowe są przekazywane do systemu AI, który generuje wstępną propozycję planu żywieniowego. Propozycja uwzględnia dostępne produkty spożywcze z polskiej bazy danych.

### Krok 4: Weryfikacja i zatwierdzenie przez dietetyka
Wykwalifikowany dietetyk dokonuje szczegółowej weryfikacji propozycji planu wygenerowanego przez AI. Dietetyk:
- sprawdza poprawność merytoryczną planu,
- weryfikuje zgodność z celami żywieniowymi i stanem zdrowia Użytkownika,
- modyfikuje plan w razie potrzeby (zmiana produktów, porcji, posiłków),
- zatwierdza ostateczną wersję planu.

### Krok 5: Udostępnienie planu Użytkownikowi
Po zatwierdzeniu przez dietetyka plan żywieniowy jest udostępniany Użytkownikowi za pośrednictwem panelu Użytkownika w serwisie.

---

## 4. Ograniczenia sztucznej inteligencji

Użytkownik powinien mieć świadomość następujących ograniczeń systemu AI:

1. **AI może popełniać błędy.** Systemy sztucznej inteligencji, w tym modele językowe, mogą generować treści nieprecyzyjne, niekompletne lub nieodpowiednie w danym kontekście klinicznym. Dlatego każdy plan jest weryfikowany przez dietetyka.

2. **Plan wygenerowany przez AI nie stanowi porady medycznej.** Plan żywieniowy — zarówno w wersji wstępnej (AI), jak i po weryfikacji przez dietetyka — nie zastępuje porady lekarskiej. W przypadku chorób, zaburzeń odżywiania lub wątpliwości zdrowotnych Użytkownik powinien skonsultować się z lekarzem.

3. **Weryfikacja przez wykwalifikowanego dietetyka.** Każdy plan wygenerowany przez AI podlega obowiązkowej weryfikacji przez dietetyka posiadającego odpowiednie kwalifikacje zawodowe. Dietetyk jest odpowiedzialny za merytoryczną poprawność ostatecznej wersji planu.

4. **AI nie uwzględnia czynników pozadietetycznych.** System AI nie ma wiedzy o pełnym kontekście medycznym Użytkownika (np. wynikach badań laboratoryjnych, interakcjach lekowych wykraczających poza informacje podane w wywiadzie).

---

## 5. Prawa Użytkownika w związku z wykorzystaniem AI

Użytkownikowi przysługują następujące prawa:

### 5.1. Prawo do informacji o wykorzystaniu AI
Użytkownik ma prawo do uzyskania zrozumiałej informacji o tym, że w procesie tworzenia planu żywieniowego wykorzystywana jest sztuczna inteligencja, w jaki sposób działa ten proces oraz jakie dane są przetwarzane przez AI. Niniejszy dokument realizuje ten obowiązek informacyjny.

### 5.2. Prawo do interwencji ludzkiej
Zgodnie z art. 22 ust. 3 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO) Użytkownik ma prawo do uzyskania interwencji ludzkiej ze strony Administratora. W serwisie e-dietetyk.com interwencja ludzka jest elementem standardowego procesu — każdy plan AI jest weryfikowany przez dietetyka.

### 5.3. Prawo do zakwestionowania decyzji AI
Użytkownik ma prawo do wyrażenia swojego stanowiska i zakwestionowania propozycji wygenerowanej przez AI. W takim przypadku Użytkownik może zgłosić uwagi do dietetyka za pośrednictwem platformy, a dietetyk uwzględni je przy weryfikacji lub modyfikacji planu.

### 5.4. Prawo do uzyskania planu bez wykorzystania AI
Użytkownik ma prawo do żądania sporządzenia planu żywieniowego bez wykorzystania sztucznej inteligencji. W takim przypadku plan zostanie przygotowany manualnie przez dietetyka. Użytkownik może zgłosić takie żądanie, kontaktując się z Administratorem na adres e-mail wskazany w niniejszym dokumencie. Realizacja planu manualnego może wiązać się z dłuższym czasem oczekiwania.

---

## 6. Bezpieczeństwo danych w kontekście AI

### 6.1. Anonimizacja danych
Dane przekazywane do systemu AI nie zawierają informacji umożliwiających identyfikację Użytkownika. Przed wysłaniem zapytania do API OpenAI system automatycznie usuwa dane identyfikujące, takie jak adres e-mail, imię i nazwisko.

### 6.2. Brak wykorzystania danych do trenowania modeli
Na podstawie Data Processing Agreement (umowy powierzenia przetwarzania danych) zawartej z OpenAI LLC, dane przesyłane za pośrednictwem API nie są wykorzystywane przez OpenAI do trenowania, ulepszania ani rozwijania modeli AI. Dane są przetwarzane wyłącznie w celu wygenerowania odpowiedzi na zapytanie i są usuwane zgodnie z polityką retencji OpenAI (maksymalnie 30 dni w celach bezpieczeństwa).

### 6.3. Transfer danych do USA
Dane są przekazywane do OpenAI LLC z siedzibą w Stanach Zjednoczonych. Transfer odbywa się na podstawie Standardowych Klauzul Umownych (Standard Contractual Clauses, SCC) zatwierdzonych decyzją Komisji Europejskiej, co zapewnia odpowiedni poziom ochrony danych osobowych zgodnie z rozdziałem V RODO.

### 6.4. Szyfrowanie danych
Dane z wywiadu dietetycznego przechowywane w bazie danych serwisu są szyfrowane algorytmem AES-256-GCM. Transmisja danych pomiędzy serwerem a API OpenAI odbywa się za pośrednictwem protokołu TLS 1.2+.

---

## 7. Kontakt w sprawie wykorzystania AI

W przypadku pytań, wątpliwości lub żądań związanych z wykorzystaniem sztucznej inteligencji w serwisie e-dietetyk.com, Użytkownik może skontaktować się z Administratorem:

**Administrator:** Wirgiliusz Ładziński
**Adres:** ul. Pod Brzozami 16/8a, 03-995 Warszawa
**E-mail:** kontakt@e-dietetyk.com
**Temat wiadomości:** „Sztuczna inteligencja — zapytanie"

Administrator zobowiązuje się do udzielenia odpowiedzi w terminie 14 dni od dnia otrzymania zgłoszenia.

---

## 8. Podstawy prawne

Niniejszy dokument został sporządzony w oparciu o:

- Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych (RODO), w szczególności art. 13, 14 i 22,
- Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2024/1689 z dnia 13 czerwca 2024 r. ustanawiające zharmonizowane przepisy dotyczące sztucznej inteligencji (AI Act), w szczególności art. 50 (obowiązki w zakresie przejrzystości),
- Ustawę z dnia 10 maja 2018 r. o ochronie danych osobowych (Dz.U. 2018 poz. 1000 ze zm.).

---

## 9. Zmiany dokumentu

Administrator zastrzega sobie prawo do zmiany niniejszej Informacji o wykorzystaniu AI. O istotnych zmianach Użytkownik zostanie poinformowany za pośrednictwem serwisu lub drogą e-mailową. Korzystanie z serwisu po wejściu w życie zmian oznacza ich akceptację.

---

*Ostatnia aktualizacja: 23 marca 2026 r.*
