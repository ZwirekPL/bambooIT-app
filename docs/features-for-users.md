# Funkcje aplikacji DietetykDEV — przewodnik dla dietetyków i pacjentów

Ten dokument opisuje co **realnie działa** w aplikacji. Napisany prostym językiem — bez terminologii technicznej. Pominięte są moduły oznaczone jako [WIP] (w trakcie implementacji) — znajdziesz je na końcu dokumentu.

---

## 1. Zarządzanie pacjentami (panel dietetyka)

### 1.1. Lista pacjentów
- **Gdzie:** `/dietetyk/pacjenci`
- **Co robi:** Pokazuje wszystkich Twoich pacjentów z filtrowaniem po nazwisku i statusie planu.
- **Kiedy użyjesz:** Codziennie — punkt startowy do pracy z pacjentem.

### 1.2. Profil pacjenta
- **Gdzie:** `/dietetyk/pacjenci/[id]`
- **Co robi:** Karta pacjenta — dane osobowe, historia wywiadów, trendy pomiarów, dopasowane protokoły kliniczne, rekomendowane suplementy, notatki.
- **Kiedy użyjesz:** Przed każdą wizytą — szybki przegląd stanu pacjenta.

### 1.3. Dodawanie notatek klinicznych
- **Gdzie:** Zakładka w profilu pacjenta.
- **Co robi:** Prywatne notatki dietetyka niewidoczne dla pacjenta.
- **Kiedy użyjesz:** Po konsultacji — zapisz obserwacje, plan dalszych działań, powody decyzji klinicznych.

### 1.4. Pomiary ciała i trendy wagi
- **Gdzie:** Profil pacjenta → sekcja Pomiary oraz `/dashboard/pomiary` dla pacjenta.
- **Co robi:** Wykres zmian wagi, obwody (talia, biodra, klatka), tempo zmiany.
- **Kiedy użyjesz:** Do oceny czy pacjent idzie w dobrym kierunku (plateau >2 tyg. uruchamia automatyczną adaptację planu).

### 1.5. Wyniki laboratoryjne — upload
- **Gdzie:** Profil pacjenta → sekcja Wyniki lab.
- **Co robi:** Upload skanu wyników (przechowywane w formie zaszyfrowanej).
- **Kiedy użyjesz:** Po wizycie u pacjenta z konsultacją kliniczną (produkt `CONSULTATION` 399 zł odblokowuje tę funkcję).
- **Uwaga:** Automatyczne odczytywanie (OCR) wyników — [WIP], obecnie ręczne wprowadzanie.

### 1.6. Historia interakcji
- **Gdzie:** Profil pacjenta → dziennik zmian planów, wiadomości, pomiarów, wywiadów.
- **Co robi:** Pełny timeline aktywności pacjenta w systemie.

---

## 2. Wywiady zdrowotne

### 2.1. Formularz CORE / PRO
- **Gdzie:** Pacjent: `/dashboard/wywiad` · Dietetyk: `/dietetyk/pacjenci/[id]` sekcja Wywiad.
- **Co robi:** Pacjent wypełnia kwestionariusz (choroby, alergie, leki, preferencje). Odpowiedzi są szyfrowane.
- **Kiedy użyjesz:** Przed pierwszym planem — wywiad jest niezbędny.

### 2.2. Automatyczne alerty
- **Co robi:** System zaznacza pacjentów bez wywiadu lub z wywiadem starszym niż 90 dni.
- **Kiedy:** Co prowadzisz dłużej współpracę — proś pacjenta o aktualizację.

### 2.3. Wykrywanie red flags
- **Co robi:** Z wywiadu automatycznie wyłapuje anafilaksję, nietolerancję laktozy, celiakię, leki w konflikcie z pokarmami (np. warfaryna + brokuły).
- **Kiedy:** Wyświetla się jako alert przy generowaniu planu — pacjenci z CRITICAL red flag wymagają manualnej weryfikacji.

### 2.4. Auto-trigger protokołów klinicznych
- **Co robi:** Na podstawie odpowiedzi w wywiadzie dobiera pasujące protokoły żywieniowe (np. cukrzycowy, FODMAP, nadciśnieniowy, CKD).
- **Kiedy:** Automatycznie — pokazane jako "Matched protocols" w profilu.

---

## 3. Generowanie planów żywieniowych

### 3.1. Nowy plan — AI draft
- **Gdzie:** `/dietetyk/pacjenci/[id]/plany/nowy`
- **Co robi:** Oblicza zapotrzebowanie energetyczne (TDEE), wybiera produkty z bazy ~6600 polskich produktów, uruchamia solver OR-Tools który dobiera posiłki spełniające zasady kliniczne, a potem OpenAI GPT-4.1 dopracowuje opisy.
- **Statusy planu:** `GENERATED` → `REVIEWED` → `SENT`. Pacjent widzi dopiero po wysłaniu.
- **Kiedy użyjesz:** Domyślny sposób tworzenia planu — szybki, spełnia zasady bezpieczeństwa.

### 3.2. Parametry planu które można ustawić
Z poziomu panelu dietetyka:
- **Długość planu:** 7, 14, 21 lub 28 dni.
- **Liczba posiłków dziennie:** 3–5 slotów (śniadanie, lunch, obiad, podwieczorek, kolacja).
- **Kaloryczność celu** (automatyczna z TDEE lub ręczna).
- **Makro targety** (białko, tłuszcz, węglowodany — gram/dzień).
- **Budżet czasu gotowania** (domyślnie 90 min/dzień).
- **Meal-prep friendly** — preferuj przepisy do gotowania na zapas.
- **Slot zamrożony** — wymusza konkretny przepis na dany dzień/posiłek (np. powtórka ulubionego dania).
- **Seed** — powtarzalność generacji (ten sam seed = ten sam plan).

### 3.3. Obsługiwane diety i stany kliniczne
Automatycznie z wywiadu lub ręcznie:
- **Cukrzyca T1/T2** — kontrola indeksu glikemicznego (maks 2 posiłki wysokiego GI/tydzień, premia dla niskiego GI wieczorem).
- **Nadciśnienie** — zaostrzony limit sodu (<2000 mg/dzień, zwiększona kara).
- **CKD (choroba nerek)** — ograniczenie potasu, fosforu (przez limity nutrientów).
- **IBS / FODMAP** — filtr przed solverem (tylko przepisy LOW-FODMAP).
- **Celiakia i gluten** — wykluczenie produktów z glutenem (polityka alergenów EU).
- **Alergie EU (14 grup):** gluten, skorupiaki, jaja, ryby, orzeszki ziemne, soja, mleko, orzechy z drzew, seler, musztarda, sezam, dwutlenek siarki, łubin, mięczaki.
- **Dieta wegetariańska/wegańska** — filtr przepisów + targety mikro (B12, żelazo).
- **Hiperlipidemia, GERD, otyłość, anemia, migrena, WZW, colitis** — reguły z Policy Engine (85 policy rules + 16 red flags).

### 3.4. Alergen gradation
- **Co robi:** Rozróżnia **nietolerancję** (kara -500, praktycznie wyłącza przepis) od **preferencji** (kara -200, może się pojawić, ale rzadko).
- **Kiedy użyjesz:** Pacjent nie lubi mleka vs. pacjent nietolerancja laktozy — system traktuje to różnie.

### 3.5. Generowanie z protokołem klinicznym
- **Co robi:** Jeśli pacjent ma dopasowane protokoły, system automatycznie łączy reguły (np. cukrzyca + nadciśnienie = niski GI + niski sód).
- **Konflikty:** System wykrywa sprzeczne reguły (np. "wysokokaloryczna" + "niskotłuszczowa") i pyta dietetyka co wybrać.

---

## 4. Rotacja białek i różnorodność posiłków

### 4.1. Rotacja białek (hard constraint)
- **Co robi:** W każdym przesuwającym się oknie 3 dni **maksymalnie 2 posiłki** z tego samego źródła białka (drób, ryba, wołowina, jaja, nabiał, rośliny strączkowe).
- **Kiedy chroni pacjenta:** Zapobiega przeciążeniu jednym źródłem (ryzyko alergii, niedobór innych mikro).

### 4.2. Limit głównego składnika
- **Co robi:** Ten sam główny składnik (np. kurczak, łosoś) max 3× w jednym slocie (np. 3× w lunchu) i łącznie max 4× w całym tygodniu.
- **Kiedy:** Unikanie monotonii i wsparcie różnorodności mikroodżywczej.

### 4.3. Caps kategorii posiłków
- **Co robi:** Owsianka max 2/tydzień, makaron max 3/tydzień, zupy max 3/tydzień.
- **Kiedy:** Pacjent z nadwagą nie powinien jeść makaronu 7× w tygodniu.

### 4.4. Unikalność przepisów
- **Co robi:** Ten sam przepis nie powtarza się w tym samym slocie częściej niż raz w tygodniu (lub przy planach 14/28-dniowych — odpowiednio 2× i 3× rzadziej).
- **Korzyść:** Dietetyk nie musi ręcznie pilnować czy plan nie jest nudny.

### 4.5. Różnorodność kuchni
- **Co robi:** Premia +100 dla przepisów z wysokim "cuisine_score" — system preferuje mieszać kuchnie (polska, włoska, azjatycka).

### 4.6. Metoda gotowania
- **Co robi:** Kara -150 jeśli >2 posiłki tego samego typu (pieczone/smażone/gotowane) w jednym dniu.
- **Korzyść:** Wymusza zróżnicowane techniki — pacjent nie je wszystkiego pieczonego.

### 4.7. Sezonowość
- **Co robi:** Premia +250 dla produktów sezonowych, kara -150 dla poza-sezonowych.

---

## 5. Błonnik, makroskładniki, kaloryczność

### 5.1. Zakres kaloryczny (hard)
- **Co robi:** Dzienna suma kalorii musi mieścić się w ±40% od celu (szerokie pasmo bezpieczeństwa).
- **Tolerancja miękka:** W razie problemów solver automatycznie rozluźnia do ±15%, ±50%, lub ±70% (endpoint `/solve/relax`).

### 5.2. Błonnik (soft)
- **Co robi:** Cel 25–45 g/dzień (premia +400). Poniżej 20 g kara -200, powyżej 45 g kara -300.
- **Kiedy:** Pacjent z zaparciami, IBS-C, otyłością — wyższy błonnik = lepsze wyniki.

### 5.3. Sód (soft)
- **Co robi:** Limit WHO 2000 mg/dzień (kara -400). Dla nadciśnieniowców zaostrzony (-600).
- **Kiedy:** Pacjent z nadciśnieniem — system sam zmniejsza sód.

### 5.4. Odchylenie makr (soft)
- **Co robi:** Każde 10% odchylenia od celu białka/tłuszczu/węglowodanów = -30 punktów.
- **Kiedy:** Sportowiec potrzebuje 2 g białka/kg — system celuje w tę wartość.

### 5.5. Śniadanie bogate w białko
- **Co robi:** Premia +300 jeśli śniadanie ma ≥15% kalorii z białka.
- **Korzyść:** Dłuższe nasycenie, stabilna glikemia.

### 5.6. Lekka kolacja
- **Co robi:** Kara -300 jeśli obiad ma >85% kalorii lunchu.
- **Korzyść:** Kolacja nie cięższa niż obiad — zdrowe proporcje.

### 5.7. Pełne ziarna
- **Co robi:** Premia +200 dla przepisów oznaczonych "pełnoziarnisty".

### 5.8. Jakość węglowodanów
- **Co robi:** Formuła `(100 − GI) × 0.6 + błonnik × 4` — premia +100 dla "dobrych" węglowodanów.

### 5.9. Mikroodżywki (RDA)
- **Co robi:** Sprawdza dzienną podaż żelaza, wapnia, cynku, kwasu foliowego, B12, wit. D, magnezu, potasu, wit. A/K, omega-3, selenu, jodu, fosforu. Premia +200 za ≥80% RDA, kara -200 za <50%.
- **Kiedy użyjesz:** Pacjent wegański → system pilnuje B12 i żelaza.

### 5.10. Interakcje nutrientów
- **Co robi:** Premia za witaminę C razem z żelazem (lepsze wchłanianie), kara za wapń razem z żelazem (konkurencja).

---

## 6. Edycja i modyfikacje planów

### 6.1. Edycja planu
- **Gdzie:** `/dietetyk/pacjenci/[id]/plany/[planId]`
- **Co robi:** Ręczna zmiana pojedynczych posiłków, edycja ilości, dopisywanie notatek dla pacjenta.

### 6.2. Edytor drag & drop
- **Gdzie:** `/dietetyk/pacjenci/[id]/plany/drag-drop`
- **Co robi:** Przeciąganie posiłków między dniami/slotami.

### 6.3. Smart Swap Suggestions
- **Co robi:** Dla słabych slotów (niski score) system proaktywnie sugeruje 3 alternatywne przepisy.
- **Kiedy:** Po wygenerowaniu — zobaczysz czerwono-żółte sloty z propozycją poprawy.

### 6.4. Plan comparison A/B
- **Co robi:** Side-by-side porównanie dwóch wersji planu (np. przed/po modyfikacji) z metrykami jakościowymi.

### 6.5. Sub-scores jakości planu (12 wymiarów)
- **Co robi:** Każdy plan ma ocenę A–E w 12 wymiarach (kalorie, białko, błonnik, sód, mikroodżywki, różnorodność, sezonowość, czas gotowania, meal-prep, cena, ingredient reuse, GI quality).
- **Kiedy:** Szybka ocena czy plan jest dobry.

### 6.6. Frozen slots (inkrementalne replanowanie)
- **Co robi:** Zamraża wybrane posiłki (np. ulubione śniadanie pacjenta) i generuje na nowo tylko resztę.
- **Kiedy:** Pacjent mówi "zostaw mi owsiankę, zmień tylko obiady".

### 6.7. Plan quality check
- **Co robi:** Po generacji system automatycznie poprawia drobne błędy (nazwy placeholder, brakujące ilości) i oznacza posiłki wymagające ręcznej poprawy.

### 6.8. Meal swaps (pacjent)
- **Gdzie:** Panel pacjenta, przy każdym posiłku.
- **Co robi:** Pacjent może zamienić posiłek na 1 z 3 zaproponowanych alternatyw.
- **Limit:** Max 5 zamian/tydzień (trial) lub bez limitu (opieka roczna).

---

## 7. Raportowanie i eksport

### 7.1. PDF planu
- **Gdzie:** Panel pacjenta `/dashboard/plan` → pobierz PDF · Panel dietetyka również.
- **Co zawiera:** Plan tygodniowy z posiłkami, makrami, kaloryką, logo gabinetu.

### 7.2. Lista zakupów PDF
- **Gdzie:** `/dashboard/zakupy` (pacjent) oraz w panelu dietetyka.
- **Co robi:** Grupuje produkty po kategoriach (nabiał, warzywa, mięso), sumuje ilości (smart aggregation — podobne produkty łączone), sortuje i kompaktuje layout.

### 7.3. Raport dla pacjenta
- **Gdzie:** `/dashboard/postep`
- **Co zawiera:** Trendy wagi, adherence, kamienie milowe, porównanie z celem.

### 7.4. Raport dla dietetyka
- **Gdzie:** `/dietetyk/raport`
- **Co zawiera:** Podsumowanie pacjenta, trendy, adherence, ostatnie check-iny.

### 7.5. Analityka pacjentów
- **Gdzie:** `/dietetyk/analityka`
- **Co zawiera:** Metryki całej praktyki (retention, średni outcome, lista pacjentów z ryzykiem dropout, pacjenci z gwałtownym spadkiem wagi).

### 7.6. GI Report Widget
- **Gdzie:** Profil pacjenta diabetyka.
- **Co robi:** Podsumowanie średniego GI posiłków, rozkład GI w tygodniu.

### 7.7. Dashboard dietetyka
- **Gdzie:** `/dietetyk`
- **Co zawiera:** Alerty (red flags, zbliżające się zakończenia planów, nowe wyniki lab), action items, statystyki, lista aktywnych pacjentów.

---

## 8. Panel pacjenta

### 8.1. Dashboard
- **Gdzie:** `/dashboard`
- **Co robi:** Status planu, najbliższy posiłek, postęp wagi, wiadomości od dietetyka, przypomnienie check-in.

### 8.2. Plan dnia
- **Gdzie:** `/dashboard/plan/[id]`
- **Co robi:** Posiłki, składniki, gramatura, kaloryka, makro, przycisk "Przepis" (krok po kroku instrukcja przygotowania).

### 8.3. Check-in postępu
- **Gdzie:** `/dashboard/checkin`
- **Co robi:** Waga, samopoczucie (1–5), poziom trzymania się planu (adherence 0–100%), notatka dla dietetyka.
- **Kiedy:** Co tydzień (lub częściej wg zaleceń).

### 8.4. Historia
- **Gdzie:** `/dashboard/historia`, `/dashboard/pomiary`, `/dashboard/postep`
- **Co robi:** Timeline check-inów, trendy pomiarów, wykresy postępu.

### 8.5. Wiadomości
- **Gdzie:** `/dashboard/wiadomosci`
- **Co robi:** Chat 1:1 z dietetykiem, status read/unread, powiadomienia.

### 8.6. Suplementy
- **Gdzie:** `/dashboard/suplementy`
- **Co robi:** Rekomendowane suplementy dopasowane do diety i stanu pacjenta (np. B12 dla wegan, omega-3 dla alergii na ryby).

### 8.7. Zakupy
- **Gdzie:** `/dashboard/zakupy`
- **Co robi:** Lista zakupów z aktualnego tygodnia, eksport PDF, kategoryzacja.

### 8.8. Opinia
- **Gdzie:** `/dashboard/opinia`
- **Co robi:** Wystawienie testimoniala dla dietetyka (moderowany przez admina).

### 8.9. Subskrypcja
- **Gdzie:** `/dashboard/subskrypcja`
- **Co robi:** Status aktywnej subskrypcji, historia płatności, anulowanie, zmiana metody płatności.

---

## 9. Komunikacja

### 9.1. Chat dietetyk ↔ pacjent
- **Gdzie:** Oboje mają sekcję Wiadomości.
- **Co robi:** Synchroniczna komunikacja, odczytane/nieodczytane.

### 9.2. Kampanie email
- **Gdzie:** Admin `/admin/email-kampanie` (tylko dla adminów).
- **Co robi:** Tygodniowe podsumowanie dla pacjentów (WEEKLY_SUMMARY), podsumowanie dla dietetyków, kampanie motywacyjne (CUSTOM/MOTIVATION), trigger-based (plateau, kamień milowy, nieaktywność, koniec planu).
- **Edytor blokowy:** 5 typów bloków (tekst, nagłówek, obrazek, CTA, separator) z podglądem iframe.

### 9.3. Preferencje powiadomień
- **Gdzie:** Profil pacjenta.
- **Co robi:** Pacjent wybiera co dostaje mailem.

---

## 10. Integracje

### 10.1. Stripe (płatności)
- **Co robi:** Checkout, webhook, portal klienta, anulowanie.
- **Produkty:**
  - `TRIAL` — 7 dni za darmo (potem 129 zł/mies. automatycznie)
  - `OPIEKA_MIESIECZNA` — 129 zł/mies.
  - `OPIEKA_ROCZNA` — 1188 zł/rok (≈99 zł/mies.)
  - `PLAN_2W` — 129 zł jednorazowo
  - `PLAN_4W` — 199 zł jednorazowo
  - `CONSULTATION` — 399 zł jednorazowo (odblokowuje wyniki lab)
  - `FREE_7` — 1 plan za darmo
- **Rabaty referralowe** dynamicznie doliczane.

### 10.2. OpenAI (generowanie treści planów)
- **Model:** GPT-4.1 (domyślny), fallback GPT-4o → GPT-4.1-mini.
- **Koszt:** ~0.50 zł za plan (tracking w `AiCostLog`).

### 10.3. Sentry (monitoring błędów)
- Backend + frontend + Python solver.

### 10.4. Nodemailer (email transakcyjny)
- Potwierdzenia, resety hasła, kampanie.

### 10.5. Webhook protokołów (n8n)
- **Co robi:** Zewnętrzny system może triggerować regenerację planu po zmianie wywiadu.

---

## 11. Zarządzanie kontem dietetyka

### 11.1. Rejestracja dietetyka
- **Gdzie:** `/rejestracja` (wybór roli: dietetyk lub pacjent).

### 11.2. Onboarding dietetyka
- **Gdzie:** `/dietetyk/onboarding`
- **Co robi:** Wizard konfiguracyjny — dane profilu, specjalizacja, kod partnerski, logo gabinetu.

### 11.3. Profil dietetyka
- **Gdzie:** `/dietetyk/profil`
- **Co robi:** Edycja danych, logo do PDF, specjalizacje, bio, kod partnerski dla pacjentów.

### 11.4. Szablony planów
- **Gdzie:** `/dietetyk/szablony`
- **Co robi:** Zapisane wzory planów do szybkiego użycia u nowych pacjentów.

### 11.5. Baza przepisów
- **Gdzie:** `/dietetyk/przepisy`
- **Co robi:** Przegląd i zarządzanie bazą przepisów (własnych i globalnych), scoring dopasowania do pacjenta.

### 11.6. Baza produktów
- **Gdzie:** `/dietetyk/produkty`
- **Co robi:** ~6600 polskich produktów z pełną tabelą nutrientów + GI/FODMAP.

### 11.7. Protokoły kliniczne
- **Gdzie:** `/dietetyk/protokol`
- **Co robi:** Przegląd reguł (FODMAP, alergeny, choroby) — głównie do wglądu, edycja w panelu admin.

### 11.8. Ustawienia scoringu (wagi preferencji)
- **Gdzie:** Ustawienia dietetyka.
- **Co robi:** Każdy dietetyk może indywidualnie regulować wagi scoringu planów (np. bardziej premiować meal-prep vs. sezonowość).

---

## 12. Bezpieczeństwo i prywatność

- **Szyfrowanie:** Odpowiedzi wywiadu, flagi medyczne i treść planu zaszyfrowane AES-256-GCM.
- **Role:** ADMIN / DIETITIAN / PATIENT — izolacja danych przez `Patient.dietitianId`.
- **Soft delete:** Usunięte konta są oznaczane, nie fizycznie kasowane (30 dni recovery).
- **Logowanie bezpieczeństwa:** Failed logins, device fingerprint (wykrywanie nadużyć trial).
- **Eksport danych (GDPR/DSAR):** Pacjent może zażądać pełnego eksportu swoich danych.
- **Audit log:** Wszystkie istotne akcje (logowanie, wgląd w wywiad, generacja planu, eksport) zapisywane.

---

## Znane ograniczenia (czego aplikacja NIE robi)

Aby uniknąć frustracji — te funkcje **nie są dostępne** lub są w trakcie implementacji:

### Obecnie niedostępne
- **Automatyczne OCR wyników laboratoryjnych** — obecnie wymaga ręcznego wprowadzania wartości. Upload skanu działa, ale czytanie liczb z obrazu nie.
- **Tenant routing / white-label** — adres typu `/t/gabinet-janski/` jeszcze nie działa (struktura bazy gotowa).
- **Integracja z n8n / zewnętrzne webhooks produkcyjnie** — przygotowany endpoint, nie podłączony do działającego workflow.
- **Aplikacja mobilna** — tylko web (mobilna wersja responsywna).
- **Skanowanie kodów kreskowych produktów** — niedostępne.
- **Dzienniczek jedzenia (food log)** — pacjent nie może wpisywać co zjadł; check-in ma tylko wagę i adherence.
- **Automatyczne generowanie listy zakupów z zakupów online** — tylko PDF, brak integracji ze sklepami.

### Ograniczenia solvera
- **Maksymalna długość planu:** 28 dni.
- **Maksymalna liczba posiłków/dzień:** 5 slotów.
- **Timeout generacji:** 3–10 sekund (może zwrócić FEASIBLE zamiast OPTIMAL).
- **Bardzo rzadkie kombinacje diet** (np. wegańska + FODMAP + celiakia + alergia na orzechy + <1200 kcal) mogą zwrócić INFEASIBLE. Wtedy system próbuje rozluźnić tolerancje kaloryczne do ±70%.

### W trakcie implementacji [WIP]
- **Drug-nutrient interactions (Faza 83)** — system ma listę znanych konfliktów (warfaryna/wit. K), ale pełna biblioteka interakcji leków z pokarmami jeszcze rozbudowywana.
- **Patient Engagement (Faza 79)** — suplementacja tracking, GI check-in, pomiary dietetyk-driven, MeasurementGuide — gotowe, czeka na deploy.
- **Generowanie treści kampanii email przez AI** — szkielet gotowy, silnik treści [WIP].

### Świadome decyzje projektowe
- **Brak wieloosobowych gabinetów** — jeden dietetyk = jeden `DietitianProfile` (współdzielenie pacjentów nie obsługiwane).
- **Brak edycji planu po `SENT`** — po wysłaniu pacjentowi plan jest zamrożony, trzeba utworzyć nowy.
- **Plan nie obsługuje suplementów jako posiłków** — suplementy są w osobnej sekcji (`/dashboard/suplementy`), nie w planie dziennym.
