# Witaj w programie testerskim e-dietetyk.com

Dzięki, że dołączasz. Budujemy narzędzie, które ma realnie skrócić Twój czas pracy — od wywiadu po gotowy, bezpieczny klinicznie plan żywieniowy — a Ty jesteś w pierwszej grupie dietetyków, która zobaczy to od środka przed publicznym launchem.

---

## 1. Co dostajesz jako tester

- **Darmowy dostęp do pełnej wersji Pro** na czas testów (bez limitu pacjentów, bez limitu planów).
- **Bezpośredni kanał do zespołu produktu** — każdy Twój bug report lub pomysł trafia do kolejki priorytetowej.
- **Early access** do funkcji, które dopiero projektujemy (suplementacja, interakcje lek–pokarm).
- **Wpływ na produkt** — Twój feedback kształtuje roadmapę kolejnych faz.

---

## 2. Szybki start (5 kroków, ~15 min)

> **Ważne:** konta dietetyków tworzymy ręcznie — **nie rejestrujesz się sam/a**. Jeśli jeszcze nie masz loginu, napisz do nas, a wyślemy Ci dane dostępowe mailem.

1. **Zaloguj się:** otwórz link z powitalnego maila → wejdź na `/zaloguj` → zaloguj się danymi, które od nas dostałaś/eś. Zalecamy zmienić hasło po pierwszym logowaniu.
2. **Uzupełnij profil (onboarding):** `/dietetyk/onboarding` → dane gabinetu, specjalizacje, **wgraj logo** (pojawi się w PDF planów), wygeneruj kod partnerski dla swoich pacjentów.
3. **Zaproś pierwszego pacjenta testowego:** `/dietetyk/pacjenci` → "Dodaj pacjenta" → wpisz email (np. swój drugi) → pacjent dostaje link rejestracyjny i sam zakłada konto. Tryb incognito pomoże Ci zobaczyć perspektywę pacjenta bez konfliktu sesji.
4. **Wywiad zdrowotny:** poproś pacjenta o wypełnienie wywiadu lub zrób to za niego z jego profilu. Wersja **CORE** wystarczy na początek.
5. **Wygeneruj pierwszy plan:** profil pacjenta → zakładka "Plany" → "Nowy plan" → ustaw 7 dni i 4 posiłki, resztę zostaw automatycznie → **Generuj**.

Po 10–30 sekundach zobaczysz gotowy plan z oceną jakości i propozycjami zamian. To jest moment, w którym zwykle pojawia się "aha".

---

## 3. TOP 9 funkcji — zacznij od nich

Wybrałem je pod kątem **największej oszczędności czasu** i **bezpieczeństwa klinicznego** — czyli tego, co dietetyk odczuje najmocniej.

### 1. Generacja planu w ~20 sekund

Aplikacja sama dobiera posiłki tak, żeby zgadzały się z Twoimi celami — kalorycznością, makro, błonnikiem, sodem i mikroelementami — a AI wypisuje składniki i proporcje. Nie musisz już ręcznie budować siatki 7×4.

### 2. Automatyczne dopasowanie protokołów klinicznych

Na podstawie wywiadu system sam rozpozna cukrzycę T2, nadciśnienie, IBS, CKD, celiakię, anemię itd. i nałoży odpowiednie reguły na plan (łącznie 85 reguł + 16 sytuacji wymagających Twojej weryfikacji).
**Wypróbuj:** dodaj pacjenta z cukrzycą T2 + nadciśnieniem — plan automatycznie będzie miał maks. 2 posiłki z wysokim indeksem glikemicznym na tydzień oraz sód poniżej 2000 mg dziennie.

### 3. Red flagi i interakcje lek–pokarm

Anafilaksja, celiakia, warfaryna + brokuły, SSRI + tyramina — w takich przypadkach system zatrzyma plan do Twojej weryfikacji, zanim trafi do pacjenta.
**Wypróbuj:** wpisz pacjentowi "warfaryna" w wywiadzie, wygeneruj plan — zobacz ostrzeżenie.

### 4. Ocena jakości planu w 12 wymiarach (skala A–E)

Zamiast patrzeć tylko na kcal i makro, widzisz 12 ocen cząstkowych: mikroskładniki, różnorodność, sezonowość, jakość węglowodanów (indeks glikemiczny), powtarzalność składników, przyjazność dla meal-prepu, szacowana cena i kilka innych. Jedno spojrzenie — decyzja.
**Wypróbuj:** wygeneruj plan dla weganina i zobacz, czy B12 oraz żelazo dostają niskie oceny (jeśli tak — system od razu sugeruje suplementację).

### 5. Inteligentne propozycje zamian (Smart Swap)

Dla każdego słabszego posiłku (oznaczonego żółto lub czerwono) system sam proponuje 3 lepsze alternatywy. Jedno kliknięcie → posiłek zamieniony.
**Wypróbuj:** w słabym slocie kliknij "Zamień" — sprawdź, czy propozycja faktycznie poprawia ocenę dnia.

### 6. Zamrażanie posiłków (częściowa regeneracja)

Pacjent uwielbia Twoją owsiankę? Zamroź ten posiłek i wygeneruj na nowo tylko resztę tygodnia. Nie tracisz tego, co już było dobre.
**Wypróbuj:** wygeneruj plan → zamroź 3 posiłki (np. wszystkie śniadania) → kliknij "Regeneruj" — zmienią się tylko pozostałe sloty.

### 7. Edycja planu i drag & drop

Przeciągnij obiad z wtorku na piątek, zmień gramaturę, dopisz notatkę dla pacjenta. Plan ma trzy statusy: **roboczy** → **zweryfikowany** → **wysłany**. Pacjent widzi plan dopiero po ostatnim kliknięciu "Wyślij".
**Wypróbuj:** zmień gramaturę jednego składnika i sprawdź, czy kcal i makro przeliczają się w locie.

### 8. Lista zakupów PDF

Składniki pogrupowane po kategoriach (nabiał, warzywa, mięso), podobne produkty połączone (np. "Jogurt naturalny 2% — 3 opakowania, razem 450 g"), gotowe do wydruku lub wysłania pacjentowi.
**Wypróbuj:** wygeneruj plan 14-dniowy → pobierz listę zakupów PDF → oceń, czy da się z nią iść do sklepu bez dodatkowego przeszukiwania.

### 9. Dashboard i analityka Twojej praktyki

`/dietetyk` — alerty (pacjenci z czerwoną flagą, plany kończące się w tym tygodniu, nowe wyniki lab do przejrzenia, pacjenci w zastoju). `/dietetyk/analityka` — retencja, pacjenci zagrożeni porzuceniem, średnie efekty.
**Wypróbuj:** dodaj kilku pacjentów testowych, zrób za nich check-iny — zobacz, czy alerty pojawiają się same.

---

## 4. Co koniecznie przetestuj (priorytetowa checklista)

Pierwsze 5 punktów to must-have przed launchem, reszta to nice-to-have.

- [ ] Pierwsze logowanie + zmiana hasła + onboarding (profil, logo)
- [ ] Dodanie pacjenta + wywiad + automatyczne dopasowanie protokołów
- [ ] Generacja planu 7-dniowego dla min. 3 profili (np. cukrzyca, sportowiec, weganin)
- [ ] Pacjent z czerwoną flagą (warfaryna / anafilaksja / celiakia) — czy system zatrzyma plan?
- [ ] Wysłanie planu do pacjenta + podgląd w jego panelu + PDF
- [ ] Edycja planu (drag & drop, zmiana gramatury, zamrażanie posiłków)
- [ ] Inteligentna zamiana słabego posiłku
- [ ] Lista zakupów PDF — spróbuj realnie iść z nią do sklepu
- [ ] Chat z pacjentem (2 wiadomości w obie strony)
- [ ] Check-in pacjenta (waga + trzymanie się planu) — czy pojawia się na Twoim dashboardzie?
- [ ] Porównanie dwóch wersji planu (A/B) — czy widać różnicę w metrykach?
- [ ] Oceny jakości planu w 12 wymiarach — czy dają Ci realną informację kliniczną?
- [ ] Analityka praktyki — czy alerty o zagrożonych pacjentach są sensowne?

---

## 5. Scenariusze "spróbuj popsuć" (mile widziane)

Testerzy-dietetycy są bezcenni, bo znacie realne przypadki, których my nie przewidzieliśmy. Świadomie spróbuj:

- **Pacjent z 4+ stanami klinicznymi** (np. cukrzyca T2 + CKD stopień 3 + celiakia + alergia na orzechy) — czy system sobie radzi, czy odmawia wygenerowania?
- **Bardzo niskokaloryczna dieta** (poniżej 1400 kcal) — czy dzienne zapotrzebowanie na mikroelementy jest spełnione? Czy system ostrzega?
- **Bardzo wysokokaloryczna** (powyżej 3500 kcal dla sportowca) — czy plan nie staje się śmieszny (np. 5× owsianka dziennie)?
- **Nietypowe preferencje** — weganin bez strączków, pescatarianin bez ryb z hodowli, keto + FODMAP, post przerywany.
- **Długi plan** — wygeneruj 28-dniowy i sprawdź, czy przepisy się nie powtarzają zbyt często.
- **Edge case pacjenta:** kobieta w ciąży, osoba 70+, dziecko 10 lat (oficjalnie nie obsługujemy dzieci — sprawdź, jak system się zachowa).

---

## 6. Czego aplikacja jeszcze NIE robi

Żebyś nie tracił/a czasu na raportowanie tego, co już wiemy, że brakuje.

### Obecnie niedostępne

- **Automatyczne odczytywanie wyników laboratoryjnych (OCR).** Upload skanu działa, ale liczby trzeba wpisać ręcznie.
- **Aplikacja mobilna.** Tylko wersja webowa (responsywna, działa na telefonie, ale nie ma osobnej aplikacji w sklepach).
- **Skanowanie kodów kreskowych produktów.** Brak.
- **Dzienniczek jedzenia pacjenta.** Pacjent wpisuje tylko wagę i poziom trzymania się planu — nie "co zjadłem na śniadanie".
- **Wieloosobowe gabinety.** Jeden dietetyk = jedno konto. Nie da się współdzielić pacjentów między dietetykami.
- **Edycja planu po wysłaniu.** Świadoma decyzja — po wysłaniu do pacjenta plan jest zamrożony, trzeba utworzyć nowy.
- **Integracja ze sklepami online.** Lista zakupów tylko jako PDF — nie ma przycisku "Dodaj do koszyka Frisco/Biedronka".
- **AI-generowane maile motywacyjne do pacjentów.** Wysyłka maili działa, treści pisane przez AI — jeszcze nie.
- **Biała etykieta / własna domena.** Adres typu `/t/twoj-gabinet/` jeszcze nie działa.
- **Integracja z kalendarzem (Google / Outlook).** Brak.
- **Płatności pacjenta za Twoje usługi przez aplikację.** Stripe jest podpięty do subskrypcji na apce, ale nie do fakturowania Twoich konsultacji.

### Ograniczenia generowania planów

- **Maksymalna długość planu:** 28 dni.
- **Maksymalna liczba posiłków dziennie:** 5 slotów (śniadanie, drugie śniadanie, obiad, podwieczorek, kolacja).
- **Czas generacji:** zwykle 3–10 sekund. Dla planów 28-dniowych z dużą liczbą ograniczeń może sięgnąć 30 s.
- **Rzadkie kombinacje diet** (np. wegańska + FODMAP + celiakia + alergia na orzechy + <1200 kcal) mogą zwrócić komunikat "brak rozwiązania". System wtedy automatycznie poluzowuje tolerancje kaloryczne i próbuje ponownie.

### Czego świadomie nie planujemy

- **Tworzenia kont dietetyków przez samodzielną rejestrację.** Weryfikujemy każdego dietetyka ręcznie — to zabezpieczenie przed nadużyciami.
- **Planów dla dzieci poniżej 12 r.ż.** — inne normy RDA, osobny produkt w przyszłości.
- **Jadłospisów sportowych na konkretne dyscypliny wyczynowe.** Obsługujemy rekreacyjne i amatorskie cele.

---

## 7. Jak zgłaszać feedback

Zależy nam na trzech rodzajach informacji zwrotnej — każda ma swoją ścieżkę:

### A) Bug (coś nie działa lub działa źle)

- **Forma:** krótki opis + zrzut ekranu (lub nagranie).
- **Podaj:** co klikałaś/eś, co się stało, co powinno się stać, przeglądarka, przybliżona godzina.
- **Gdzie:** email na [kontakt do podania].

### B) Pomysł / prośba o funkcję

- **Forma:** 2–3 zdania — **jaki problem rozwiązuje** i **w jakim scenariuszu klinicznym** byś tego użyła/użył.
- **Mile widziane:** szkic na kartce, zrzut ekranu z innego narzędzia dla inspiracji.

### C) "Co mnie zirytowało" (UX friction)

- Często najcenniejsze. Jeśli coś zajęło Ci 3 kliknięcia zamiast jednego, jeśli musiałaś/eś zgadnąć, gdzie jest funkcja, jeśli coś było mylące — **zgłoś to**, nawet jeśli "działa".

---

## 8. Dobre praktyki dla testerów

- **Nie używaj prawdziwych danych pacjentów.** System jest w fazie testów — prosimy o fikcyjne profile lub o pacjentów, którzy dali świadomą pisemną zgodę na udział w testach.
- **Testuj w trybie incognito**, jeśli chcesz zobaczyć perspektywę pacjenta — unikniesz konfliktów sesji.
- **Nie bój się wygenerować 10 planów dziennie.** Serwery są na to przygotowane, koszt AI pokrywamy my.
- **Notuj czas.** "Wygenerowanie planu zajęło mi 18 sekund, a w Excelu zajmuje 40 minut" jest dla nas cenniejsze niż "było szybko".
- **Porównaj z obecnym workflow.** Ile minut zajmuje Ci plan teraz w Excelu / Kcalmar / innym narzędziu? Ile w e-dietetyk.com? Różnica = nasz realny ROI i Twój argument do rekomendowania nas kolegom.

---

**Dziękujemy, że tu jesteś.** Bez Ciebie nie zbudujemy narzędzia, które naprawdę ma sens w codziennej pracy dietetyka. Każdy bug, każda uwaga, każde "to jest bez sensu" — to dla nas dane, nie krytyka.

Powodzenia i czekamy na pierwszy feedback!
