# Plan testów UAT — DietetykDEV

**Skala:** 20 dietetyków + ich pacjenci (szacunkowo 40–80 pacjentów testowych).
**Cel:** Weryfikacja realnych ścieżek klinicznych przed pełnym roll-outem.
**Priorytety:** **P0** (krytyczny — blokuje launch) · **P1** (ważny — musi działać, ale nieblokujący) · **P2** (nice-to-have).

---

## 1. Scenariusze testowe dla dietetyków

### S1 [P0] — Pierwsza rejestracja i onboarding dietetyka
**Profil:** Nowy dietetyk (brak konta).

**Kroki:**
1. Wejdź na `/rejestracja`. Wybierz rolę "Dietetyk".
2. Podaj email, hasło, imię/nazwisko. Zatwierdź.
3. Potwierdź email (jeśli wymagane).
4. Zaloguj się na `/zaloguj`.
5. Przejdź onboarding na `/dietetyk/onboarding`: dane profilu, logo, specjalizacje, kod partnerski.
6. Wejdź na `/dietetyk` — sprawdź dashboard.

**Oczekiwany wynik:**
- Konto utworzone, rola `DIETITIAN`, `DietitianProfile` z unikalnym `code`.
- Dashboard pokazuje "0 pacjentów", bez błędów.

**Obserwuj:**
- Czy walidacja hasła jest zrozumiała.
- Czy email przychodzi szybko (<1 min).
- Czy logo dobrze się przycina / skaluje w PDF (sprawdzisz później w S4).

---

### S2 [P0] — Dodanie pierwszego pacjenta (cukrzyca T2 + nadciśnienie)
**Profil pacjenta:** Kobieta, 52 lata, 82 kg, 165 cm. Cukrzyca typu 2 (metformina), nadciśnienie tętnicze (indapamid), hipercholesterolemia. BMI 30.1 — otyłość I stopnia. Cel: redukcja 10 kg w 6 miesięcy.

**Kroki:**
1. `/dietetyk/pacjenci` → przycisk "Dodaj pacjenta".
2. Wpisz email pacjenta, imię, nazwisko, dane antropometryczne.
3. Wyślij zaproszenie (pacjent dostaje link rejestracyjny).
4. Poczekaj na rejestrację pacjenta (scenariusz P1 — zrób to na drugim koncie/przeglądarce prywatnej).
5. Wypełnij wywiad CORE w imieniu pacjenta (lub poproś pacjenta).
6. Sprawdź zakładkę "Matched protocols" w profilu pacjenta.

**Oczekiwany wynik:**
- Pacjent widoczny na liście, przypisany do dietetyka (`patient.dietitianId`).
- Po wywiadzie: wykryte protokoły `DIABETES_T2`, `HYPERTENSION`, ew. `HYPERLIPIDEMIA`.
- Żadne red flags `CRITICAL` (bo nie ma np. anafilaksji).
- Rekomendowane suplementy: np. omega-3, wit. D.

**Obserwuj:**
- Czy tabela wywiadu nie traci danych przy scrollowaniu.
- Czy "Matched protocols" pokazują się od razu, bez refreshu.
- Czy interakcje leków (indapamid ↔ potas?) są zgłoszone jako ostrzeżenie.

---

### S3 [P0] — Generacja planu 7-dniowego dla cukrzyka + hypertension
**Profil:** Kontynuacja S2.

**Kroki:**
1. W profilu pacjenta → "Plany" → "Nowy plan".
2. Ustaw: 7 dni, 4 posiłki, TDEE automatyczny, makro automatyczne, flagi `diabetes=true` i `hypertension=true`.
3. Kliknij "Generuj".
4. Poczekaj na zakończenie (obserwuj czas, zapisz).
5. Po wygenerowaniu: sprawdź plan — kaloryczność dzienna, średnie GI, sód/dzień, błonnik/dzień.
6. Otwórz 3 losowe posiłki — sprawdź czy mają przepis (kroki przygotowania).
7. Sprawdź Plan Quality Score (A–E) — wszystkie 12 sub-scores.
8. Sprawdź Smart Swap Suggestions — czy są propozycje dla słabych slotów.

**Oczekiwany wynik:**
- Plan w statusie `GENERATED` lub `REVIEWED`, widoczny w panelu dietetyka.
- Kcal w zakresie ±15% od celu (po rozluźnieniu ±40%).
- Średni dzienny sód <2000 mg (z zaostrzonym limitem 1500 dla hypertension).
- Max 2 posiłki wysokiego GI/tydzień.
- Rotacja białka: żadnego źródła >2× w 3 kolejnych dniach.
- Żadnej owsianki częściej niż 2×/tydzień.
- Wszystkie posiłki mają przepis (nie powinno być placeholderów).

**Obserwuj:**
- Czas generacji (zanotuj: powinien być <30 s dla planu 7-dniowego).
- Jeśli INFEASIBLE — czy system pokazuje zrozumiałe uzasadnienie (`infeasibility_reasons`).
- Czy opis posiłków brzmi naturalnie po polsku (AI GPT-4.1).
- Czy makra/kcal w karcie posiłku = suma gramatur × nutrienty (spójność).

---

### S4 [P0] — Publikacja planu i wysyłka PDF
**Profil:** Kontynuacja S3.

**Kroki:**
1. Przy wygenerowanym planie kliknij "Przejrzyj" (status → `REVIEWED`).
2. Edytuj jeden posiłek ręcznie (zmień gramaturę składnika lub zamień cały posiłek).
3. Zapisz. Sprawdź że Plan Quality Score się zaktualizował.
4. Kliknij "Wyślij do pacjenta" (status → `SENT`).
5. Pobierz PDF planu.
6. Pobierz PDF listy zakupów.
7. Zaloguj się jako pacjent — sprawdź widoczność planu w `/dashboard/plan`.

**Oczekiwany wynik:**
- Plan niemodyfikowalny po `SENT`.
- PDF planu zawiera logo dietetyka, makra, kaloryczność dzienną, listę posiłków z przepisami.
- PDF zakupów: smart aggregation (mąka ×3 przepisy = jedna pozycja), sortowanie DESC, kategoryzacja (nabiał, mięso, warzywa...).
- Pacjent widzi plan w swoim panelu, może otworzyć każdy posiłek.

**Obserwuj:**
- Czy przycisk "Przepis" działa dla każdego posiłku (bug naprawiony 2026-04-17 — weryfikacja regresji).
- Czy jednostki w liście zakupów są sensowne (nie "0.33 l mleka" ale "1 l").
- Layout PDF na ekranie mobilnym.

---

### S5 [P0] — Pacjent z celiakią i alergią na orzechy
**Profil pacjenta:** Mężczyzna, 35 lat, 78 kg, 180 cm. Celiakia (wykluczenie glutenu — gluten jest `INTOLERANCE`), alergia na orzechy ziemne i drzew (preferencja `INTOLERANCE` — kara -500). Cel: utrzymanie wagi.

**Kroki:**
1. Dodaj pacjenta (S2 adaptacja).
2. W wywiadzie zaznacz alergie: `gluten` (celiakia), `peanuts`, `tree_nuts`.
3. Generuj plan 14-dniowy, 3 posiłki/dzień, TDEE automatyczny.
4. Po generacji sprawdź **wszystkie** składniki wszystkich posiłków.
5. Użyj CTRL+F / grep w eksportowanym PDF: "pszenica", "żyto", "jęczmień", "orzech".

**Oczekiwany wynik:**
- Zero wystąpień glutenu (nawet w sosach / zupach).
- Zero orzechów ziemnych i drzew.
- Plan 14-dniowy — unikalność przepisu per slot max 2× (rolling horizon).
- Suplementy rekomendowane: wit. D, B12 (często niedobór przy celiakii).

**Obserwuj:**
- Szczególnie sosy, panierki, wypieki (gluten ukryty).
- Czy zasób produktów po filtrze jest nadal wystarczający (>30/slot) — jeśli <10, to solver może zwrócić INFEASIBLE lub słaby score.

---

### S6 [P0] — Pacjent wegański + niedobór żelaza
**Profil pacjenta:** Kobieta, 28 lat, 62 kg, 170 cm. Dieta wegańska od 3 lat. Niedawna diagnoza: niedokrwistość z niedoboru żelaza (ferrytyna 8 ng/ml). Cel: wzrost zapasów żelaza.

**Kroki:**
1. Dodaj pacjenta. W wywiadzie: dieta wegańska, alergeny: brak, leki: żelazo doustne (suplementacja).
2. W danych klinicznych zaznacz `anemia_iron_deficiency`.
3. Wejdź w profilu pacjenta → Wyniki lab → wpisz ferrytynę 8 ng/ml.
4. Generuj plan 14-dniowy.
5. Sprawdź: podaż żelaza dzienną, kombinacje (żelazo + wit. C w tym samym posiłku), czy są rośliny strączkowe/amarantus/quinoa.
6. Sprawdź rekomendowane suplementy.

**Oczekiwany wynik:**
- Zero produktów odzwierzęcych.
- Dzienne żelazo ≥80% RDA (18 mg dla kobiet w wieku rozrodczym).
- Premia za kombinacje Fe + witamina C (SC20 nutrient interactions).
- Kara za kombinacje Fe + Ca (unikanie nabiału przy posiłku z żelazem).
- Rekomendowane suplementy: B12 (obowiązkowe dla wegan), omega-3, wit. D.

**Obserwuj:**
- Czy białko pochodzi z różnych źródeł (rotacja: strączki / tofu / tempeh / seitan [uwaga na gluten jeśli wykluczony]).
- Czy plan nie jest monotonny (np. codziennie soczewica).

---

### S7 [P1] — Sportowiec (hipertroficzny cel, wysoka kaloryka)
**Profil pacjenta:** Mężczyzna, 24 lata, 85 kg, 182 cm. Trening siłowy 5×/tydz. Cel: +5 kg masy mięśniowej. TDEE 3400 kcal. Bez chorób, bez alergii.

**Kroki:**
1. Dodaj pacjenta, wypełnij wywiad (aktywność PAL 1.8).
2. Wymuś w "Nutrition Targets": 3400 kcal, 200 g białka (2.35 g/kg), 100 g tłuszczu, 420 g węgli.
3. Generuj plan 7-dniowy, 5 posiłków/dzień (śniadanie + lunch + obiad + podwieczorek + kolacja).
4. Preferencje: meal-prep friendly = true.
5. Budżet czasu gotowania: 60 min/dzień.

**Oczekiwany wynik:**
- Dzienna suma kalorii bliska 3400 (±15%).
- Białko bliskie 200 g.
- Brak "lekkiej kolacji" penalty dla dużych kolacji (to sportowiec, potrzebuje węgli wieczorem — ale i tak soft constraint, plan powinien być OK).
- Premia meal-prep: powinno być 2–3 przepisów powtórzonych przez batch prep.
- Łączny czas gotowania <60 min/dzień.

**Obserwuj:**
- Czy pułap kaloryczny (max 4500) nie blokuje planu (jeśli pacjent byłby mocniejszy — siłowiec 120 kg).
- Czy 5 slotów w 1 dniu = 35 posiłków/tydzień rozwiązuje się w rozsądnym czasie (<30 s).

---

### S8 [P1] — Dziecko 10 lat (diabetyk T1) i niższa kaloryka
**Profil pacjenta:** Chłopiec, 10 lat, 32 kg, 138 cm. Cukrzyca typu 1 (insulina CSII). Cel: utrzymanie wagi + stabilna glikemia.

**Kroki:**
1. Dodaj pacjenta (rodzic jako opiekun prawny — uwaga: sprawdź czy UI obsługuje nieletnich, może nie).
2. Wywiad z pomocą rodzica.
3. Ustaw TDEE 1800 kcal.
4. Flaga `diabetes=true`.
5. Generuj plan 7-dniowy, 5 posiłków (dzieci potrzebują częstych posiłków).

**Oczekiwany wynik:**
- Plan smaczny dla dziecka (sprawdź czy nie są to dania "dorosłe" typu sałatka z quinoa).
- Niski GI, max 2 wysokiego GI/tydzień.
- Śniadanie bogate w białko (+300 bonus).

**Obserwuj:**
- Czy UI pozwala na wiek 10 lat (walidacja mogła być ustawiona na 18+).
- Realistyczność porcji (dziecko nie zje 300 g mięsa).
- Uwaga: obecnie brak osobnego trybu "dziecko" — zgłoś jako feature request jeśli słabo działa.

---

### S9 [P1] — Edycja planu drag & drop + porównanie A/B
**Profil pacjenta:** Dowolny z poprzednich scenariuszy.

**Kroki:**
1. Otwórz istniejący plan `/dietetyk/pacjenci/[id]/plany/[planId]`.
2. Przełącz do widoku drag & drop (`/plany/drag-drop`).
3. Przeciągnij posiłek z dnia 3 lunch → dzień 5 lunch.
4. Zapisz jako "wersja B".
5. Otwórz "Plan Comparison" — porównaj wersję A (oryginał) i B.
6. Sprawdź które sub-scores się zmieniły.

**Oczekiwany wynik:**
- Drag & drop działa płynnie.
- Porównanie pokazuje różnice w kcal/makro/score per dzień.
- Jeśli zmiana złamała hard constraint (np. protein rotation) — system powinien ostrzec.

**Obserwuj:**
- Responsywność UI (czy przeciąganie nie "skacze" po zapisie).
- Czy porównanie jest czytelne wizualnie.

---

### S10 [P1] — Frozen slots (inkrementalne replanowanie)
**Profil pacjenta:** Dowolny.

**Kroki:**
1. Otwórz istniejący plan.
2. Oznacz 3 posiłki jako "zamrożone" (ulubione śniadania poniedziałek/środa/piątek).
3. Kliknij "Regeneruj resztę" (endpoint `/solve` z `frozen_slots`).
4. Sprawdź że zamrożone posiłki są identyczne, reszta jest nowa.

**Oczekiwany wynik:**
- 3 zamrożone sloty nietknięte.
- Reszta przepisów nowa, wciąż spełnia hard constraints (protein rotation uwzględnia zamrożone).

**Obserwuj:**
- Czy jakość reszty planu nie spada drastycznie (jeśli zamrożenie dużej liczby slotów zmniejszy pulę).

---

### S11 [P1] — Pacjent IBS + FODMAP
**Profil pacjenta:** Kobieta, 38 lat, 64 kg, 167 cm. IBS-D (biegunkowa postać). Dietetyk zaleca dietę LOW-FODMAP faza 1 (eliminacja 6 tyg).

**Kroki:**
1. Dodaj pacjenta. Wywiad: zaznacz `IBS_D`, poziom tolerancji FODMAP: `LOW`.
2. Generuj plan 14-dniowy.
3. Sprawdź składniki: brak cebuli, czosnku, pszenicy (pszenica 543× w bazie — ostrożność), jabłek, nabiału z laktozą, roślin strączkowych, miodu.
4. Sprawdź rekomendacje: psyllium, probiotyki (jeśli są w systemie).

**Oczekiwany wynik:**
- Zero produktów HIGH-FODMAP.
- Pula kandydatów pre-solver >30/slot (jeśli za mało — filtr FODMAP jako hard w DB WHERE wg sesji 2026-04-17).
- Plan różnorodny mimo ograniczeń.

**Obserwuj:**
- Jeśli INFEASIBLE — czy uzasadnienie wyjaśnia przyczynę (mało przepisów LOW-FODMAP dla danej kategorii).
- Sprawdź czy filtr FODMAP nie wyklucza za dużo (Mąka pszenna, Mleko — ostatnio weryfikowane).

---

### S12 [P2] — Pacjent z CKD (przewlekła choroba nerek) stadium 3
**Profil pacjenta:** Mężczyzna, 65 lat, 75 kg, 175 cm. CKD stadium 3 (eGFR 45). Ograniczenie białka (0.8 g/kg), potasu (<2000 mg), fosforu (<800 mg).

**Kroki:**
1. Dodaj pacjenta. Wywiad: zaznacz `CKD_STAGE_3`.
2. W "Nutrition Targets" ustaw białko 60 g, potas max 2000 mg, fosfor max 800 mg.
3. Przekaż `nutrient_limits` do solvera (potassium max 2000, phosphorus max 800).
4. Generuj plan 7-dniowy.
5. Sprawdź podaż K, P, białka.

**Oczekiwany wynik:**
- K dzienne <2000 mg (brak bananów, pomidorów, ziemniaków w dużych ilościach).
- P dzienne <800 mg (ograniczenie nabiału, roślin strączkowych, orzechów).
- Białko ~60 g/dzień.

**Obserwuj:**
- Jakość planu (mikroodżywki mogą ucierpieć przy tylu ograniczeniach).
- Czy solver nie zwraca INFEASIBLE — jeśli tak, sprawdź relax endpoint.

---

## 2. Scenariusze dla pacjentów

### P1 [P0] — Rejestracja pacjenta i pierwszy wywiad
**Kroki:**
1. Kliknij link z emaila zaproszenia od dietetyka (lub wejdź na `/rejestracja` i wpisz kod partnerski dietetyka).
2. Utwórz hasło. Zaloguj się.
3. Onboarding `/onboarding`: wypełnij profil (wzrost, waga, cel).
4. Przejdź do wywiadu `/dashboard/wywiad`. Wypełnij kwestionariusz (15–30 pytań).
5. Zapisz.

**Oczekiwany wynik:**
- Konto utworzone z rolą `PATIENT`, `patient.dietitianId` ustawiony.
- Wywiad zapisany jako zaszyfrowany (`Interview.answers`).
- Dashboard pokazuje "Oczekuj na plan od dietetyka".

**Obserwuj:**
- Czy pytania wywiadu są zrozumiałe dla laika.
- Czy można zapisać postęp w połowie (draft).

---

### P2 [P0] — Odbiór planu i przeglądanie posiłków
**Kroki:**
1. Dietetyk wysyła plan (S4). Sprawdź email z powiadomieniem.
2. Zaloguj się. `/dashboard` — widzisz banner "Nowy plan".
3. Kliknij "Zobacz plan". Otwórz dzień 1 → śniadanie.
4. Kliknij "Przepis" — sprawdź czy są kroki przygotowania.
5. Pobierz PDF planu.
6. Przejdź do `/dashboard/zakupy` — pobierz listę zakupów PDF.

**Oczekiwany wynik:**
- Plan widoczny z wszystkimi posiłkami, makrami, kalorycznością.
- Przycisk "Przepis" działa dla każdego posiłku (regresja bug 2026-04-17).
- PDF mieści się na 1–2 stronach/dzień.
- Lista zakupów jest pogrupowana i posortowana.

**Obserwuj:**
- Czy UI mobilny działa (znaczna część pacjentów używa telefonu).
- Czy przepis zawiera wszystkie składniki z planu (nie tylko część).

---

### P3 [P0] — Realizacja planu i check-in tygodniowy
**Kroki:**
1. Po 7 dniach realizacji planu otwórz `/dashboard/checkin`.
2. Wpisz aktualną wagę, samopoczucie (1–5), poziom trzymania się planu (%).
3. Dodaj notatkę dla dietetyka ("Miałam weekend, nie zjadłam 2 obiadów").
4. Zapisz.
5. Sprawdź `/dashboard/postep` — wykres wagi.

**Oczekiwany wynik:**
- Check-in zapisany, pokazuje się w historii.
- Wykres wagi uaktualniony (jeśli to 2+ check-in).
- Notatka dotarła do dietetyka (dietetyk zobaczy w swoim dashboardzie jako nowy alert).

**Obserwuj:**
- Czy po 2 tygodniach plateau (brak spadku wagi) system zgłasza alert o adaptacji planu.

---

### P4 [P0] — Meal swap (zamiana posiłku)
**Kroki:**
1. Otwórz dowolny posiłek w planie.
2. Kliknij "Nie chcę tego dania" lub "Zamień".
3. Wybierz z 3 alternatyw.
4. Potwierdź zamianę.
5. Sprawdź `/dashboard/zakupy` — czy lista zakupów się zaktualizowała.

**Oczekiwany wynik:**
- Posiłek zamieniony, alternatywa dopasowana do alergii/preferencji.
- Licznik wykorzystanych swapów +1 (limit 5/tydz dla trial).
- Lista zakupów zaktualizowana automatycznie.

**Obserwuj:**
- Czy po wyczerpaniu limitu (5 swapów) pojawia się czytelna informacja ("Wykup pełną opiekę aby mieć nieograniczone swapy").
- Czy makra/kcal nie wykraczają drastycznie poza cel po swapie.

---

### P5 [P1] — Chat z dietetykiem
**Kroki:**
1. `/dashboard/wiadomosci` → napisz wiadomość ("Czy mogę zjeść avocado w śniadanie zamiast serka?").
2. Zaloguj się jako dietetyk → odpowiedz.
3. Sprawdź notyfikacje po obu stronach.

**Oczekiwany wynik:**
- Wiadomość dotarła, status unread → read.
- Powiadomienie email do drugiej strony (zgodnie z preferencjami powiadomień).

**Obserwuj:**
- Czy można wysyłać załączniki (prawdopodobnie NIE — zgłoś).
- Czy jest auto-refresh czy trzeba odświeżać.

---

### P6 [P1] — Przeglądanie rekomendowanych suplementów
**Kroki:**
1. `/dashboard/suplementy` → lista suplementów.
2. Sprawdź uzasadnienia (dlaczego B12, dlaczego omega-3).

**Oczekiwany wynik:**
- Lista dopasowana do stanu pacjenta (wegan → B12, osoba z alergią na ryby → omega-3).
- Linki do opisów suplementów (lub przynajmniej opis z dawkowaniem).

**Obserwuj:**
- Czy są wskazania kliniczne dla każdej rekomendacji.

---

### P7 [P2] — Wystawienie opinii o dietetyku
**Kroki:**
1. Po 4 tygodniach współpracy → `/dashboard/opinia` → wystaw ocenę (1–5) + komentarz.
2. Zapisz.

**Oczekiwany wynik:**
- Opinia trafia do moderacji admina (nie publikowana od razu).
- Dietetyk widzi ocenę w swoim panelu (po zatwierdzeniu).

---

### P8 [P2] — Subskrypcja: cancel, re-subscribe
**Kroki:**
1. `/dashboard/subskrypcja` → "Anuluj subskrypcję".
2. Potwierdź (w Stripe customer portal).
3. Sprawdź czy dostęp do planu pozostaje do końca opłaconego okresu.
4. Po zakończeniu → spróbuj ponownie kupić (`/zamow` → OPIEKA_MIESIECZNA).
5. Sprawdź czy dane pacjenta i historia są zachowane.

**Oczekiwany wynik:**
- Cancel powoduje koniec okresu bez natychmiastowego wylogowania.
- Re-subscribe odzyskuje pełną historię.
- Webhook Stripe aktualizuje status w bazie.

---

## 3. Punkty krytyczne do przetestowania

### 3.1. Edge cases solvera

| Test | Co sprawdzić | Priorytet | Oczekiwany wynik |
|------|--------------|-----------|------------------|
| Bardzo niska kaloryka (1200 kcal) | Pacjentka 50 kg, cel redukcja | P0 | Plan spełnia min. mikroodżywki mimo niskiej kalorii (lub jasny INFEASIBLE) |
| Bardzo wysoka kaloryka (4000 kcal) | Sportowiec 100 kg | P1 | Plan bez głupich powtórek (15× ryż/dzień) |
| 5 restrykcji jednocześnie | Wegan + LOW-FODMAP + gluten-free + bez orzechów + <1500 kcal | P0 | Jeśli INFEASIBLE — zrozumiałe wyjaśnienie w PL (reason + suggestion) |
| Plan 28-dniowy | Wydajność + multi-week uniqueness | P1 | <2 min generacji, żadnego przepisu >3× w miesiącu |
| Frozen slots 50% | Większość slotów zamrożona | P1 | Reszta uzupełniona bez złamania hard constraints |
| Konflikty reguł | `niskokaloryczna` + `wysokobiałkowa` + `niskotłuszczowa` | P1 | System zgłasza konflikt, nie próbuje na siłę |
| Zero kandydatów w slocie | Pacjent z 10+ alergiami wyklucza wszystko | P0 | INFEASIBLE z reason `SLOT_EMPTY` + konkretna sugestia |

### 3.2. Walidacja danych wejściowych

- [ ] **Wywiad:** pole "wiek" — odrzuć <1 i >120.
- [ ] **Waga:** odrzuć <20 kg i >300 kg.
- [ ] **Wzrost:** odrzuć <50 cm i >250 cm.
- [ ] **Email:** walidacja formatu, unikalność w bazie.
- [ ] **Hasło:** min. 8 znaków, polityka złożoności.
- [ ] **Plan:** długość 1–28 dni, posiłki 1–5.
- [ ] **TDEE:** odrzuć <800 kcal i >6000 kcal (nie-kliniczne wartości).
- [ ] **Makra:** suma % protein+fat+carbs w sensownym zakresie.
- [ ] **SQL injection:** próby w polach `name`, `notes`, `message`.
- [ ] **XSS:** próby w notatkach, wiadomościach, opiniach.
- [ ] **URL params:** wszystkie `[id]` to musi być cuid (zod validation).
- [ ] **Upload pliku:** wyniki lab — tylko PDF/JPG/PNG, max 5 MB.

### 3.3. Wydajność

Zmierz na prod-like środowisku (po deploy):

| Operacja | Oczekiwany czas | P0 limit |
|----------|----------------|----------|
| Plan 7-dniowy, 3 posiłki, bez flag | <10 s | <30 s |
| Plan 7-dniowy, 5 posiłków, cukrzyca + hypertension | <15 s | <45 s |
| Plan 14-dniowy | <25 s | <60 s |
| Plan 28-dniowy | <60 s | <120 s |
| Solver /solve/relax (po INFEASIBLE) | +5–10 s | <30 s |
| Logowanie | <2 s | <5 s |
| Dashboard dietetyka (load) | <3 s | <8 s |
| Lista pacjentów (100 pacjentów) | <3 s | <8 s |
| PDF planu 7-dniowego | <5 s | <15 s |
| PDF listy zakupów | <3 s | <10 s |

**Jak mierzyć:**
- Chrome DevTools Network tab.
- Log `duration_ms` z solvera (widoczny w audit log / Sentry).

### 3.4. Sytuacje błędne

- [ ] **INFEASIBLE** — czy komunikat jest po polsku i konkretny ("W slocie 'obiad' zostało tylko 3 przepisy pasujące do Twoich alergii. Usuń jedno ograniczenie lub rozszerz tolerancję kaloryczną.").
- [ ] **Brak produktów w bazie** — symulacja przez zmianę wywiadu na najrzadsze (ASD: wegańska + bez soi + bez glutenu + bez orzechów + <1500 kcal).
- [ ] **Konflikty restrykcji** — `hypertension=true` + protokół `HIGH_SALT` z jakiegoś powodu → czy system ostrzega.
- [ ] **Timeout solvera** — solver >10s → czy UI pokazuje loader i fallback.
- [ ] **Nodemailer fail** — zablokuj SMTP → czy akcja (np. wysyłka planu) zapisuje się mimo błędu emaila.
- [ ] **Stripe webhook opóźniony** — subskrypcja opłacona, webhook dotarł po 5 min → czy stan się poprawia.
- [ ] **Utrata sesji podczas edycji planu** — czy draft jest zachowany (autosave?).
- [ ] **Kolizja 2 dietetyków edytujących jednocześnie ten sam plan** — zachowanie?

---

## 4. Checklista regresji (po każdej poprawce)

### 4.1. Smoke tests (2 min)
- [ ] Logowanie dietetyka i pacjenta działa.
- [ ] Dashboard dietetyka ładuje się bez błędów.
- [ ] Dashboard pacjenta ładuje się bez błędów.
- [ ] Można otworzyć profil pacjenta.
- [ ] Można otworzyć plan (widok pacjenta).
- [ ] Przycisk "Przepis" działa (regresja 2026-04-17).

### 4.2. Generacja planu (5 min)
- [ ] Plan 7-dniowy bez flag generuje się w <15 s.
- [ ] Plan z cukrzycą + hypertension nadal szanuje limity GI i sodu.
- [ ] Plan wegański → brak produktów odzwierzęcych.
- [ ] Plan z celiakią → brak glutenu.
- [ ] Plan z IBS LOW-FODMAP → brak produktów HIGH-FODMAP (sesja 2026-04-17).
- [ ] PDF planu i listy zakupów generują się poprawnie.

### 4.3. Hard constraints solvera (sanity check)
- [ ] Kcal dzienne w ±40%.
- [ ] Protein rotation: żadne źródło >2× w oknie 3-dniowym.
- [ ] Owsianka max 2/tydz, pasta max 3/tydz, soup max 3/tydz.
- [ ] Main ingredient max 3× per slot/tydz, 4× cross-slot.
- [ ] Diabetes: max 2 high-GI/tydz.
- [ ] Frozen slots: zamrożone przepisy nietknięte.

### 4.4. Płatności
- [ ] Checkout Stripe (karta testowa 4242…) — success.
- [ ] Checkout odrzucona (karta 4000…0002) — graceful error.
- [ ] Webhook subscription.created → order created w DB.
- [ ] Portal klienta — anulowanie.

### 4.5. Komunikacja
- [ ] Wysłanie wiadomości z dietetyka do pacjenta i odwrotnie.
- [ ] Email transakcyjny (reset hasła) dociera.

### 4.6. Admin
- [ ] Lista użytkowników ładuje się.
- [ ] Soft delete użytkownika (pacjent oznaczony `deletedAt`, nie fizycznie usunięty).
- [ ] Feature flags można przełączyć bez redeploy.
- [ ] Audit log zapisuje akcje (login, plan generation, export).

### 4.7. Bezpieczeństwo
- [ ] Dietetyk A nie widzi pacjentów dietetyka B (filtrowanie przez `patient.dietitianId`).
- [ ] Pacjent nie widzi wywiadów innych pacjentów (filtrowanie przez `userId`).
- [ ] Admin ma pełen dostęp.
- [ ] Zaszyfrowane pola (Interview.answers, DietPlan.content) nie wyciekają w logach.

---

## 5. Pytania otwarte do dietetyków po sesji (pogłębione wywiady)

### 5.1. Jakość planów klinicznie

1. **Czy plany, które wygenerował system, faktycznie byś dał swojemu pacjentowi bez istotnych modyfikacji?** Jeśli nie — co najczęściej zmieniasz?
2. **Ile czasu zaoszczędziłeś(-aś) generując plan przez system w porównaniu do tworzenia ręcznego?**
3. **Czy polityki kliniczne (85 reguł POLICY + 16 RED_FLAG) pokrywają Twoich typowych pacjentów?** Jaki stan kliniczny brakuje?
4. **Czy wyniki lab są w obecnej formie użyteczne?** (Pamiętaj — OCR jeszcze nie ma, wpisujesz ręcznie.)
5. **Jakie 3 funkcje najczęściej wykorzystujesz?** Jakie 3 w ogóle nie tykałeś?
6. **Czy Plan Quality Score (A–E, 12 sub-scores) jest dla Ciebie zrozumiały i przydatny?** Czy patrzysz na niego przed wysłaniem planu?

### 5.2. Workflow i czasy

7. **Ile średnio czasu zajmuje Ci sesja pracy z jednym pacjentem** (od otwarcia profilu do wysłania planu)?
8. **Kiedy system Cię najbardziej spowalnia?** (Długie ładowanie, dużo kliknięć, brak skrótów.)
9. **Czy używasz szablonów planów?** Jakie typy szablonów byś chciał(a)?
10. **Czy smart swap suggestions trafiają w Twoje potrzeby?**

### 5.3. Komunikacja z pacjentem

11. **Jak często Twoi pacjenci piszą do Ciebie przez chat?** Czy to dobra forma kontaktu?
12. **Czy dostajesz wystarczające alerty o pacjentach** (plateau, dropout risk, nowe check-iny)?
13. **Czy kampanie email są wartościowe dla Twoich pacjentów?**

### 5.4. Funkcje brakujące

14. **Czego w systemie brakuje najbardziej?** (Dzienniczek jedzenia, skaner, aplikacja mobilna, integracja z wagami smart, inne?)
15. **Czy chciał(a)byś pracować z wieloma dietetykami w jednym gabinecie** (wspólni pacjenci)?
16. **Czy w Twojej praktyce masz pacjentów, którzy wymagają funkcji, których system nie obsługuje?**

### 5.5. Ufność i rekomendacja

17. **Na ile ufasz planom wygenerowanym przez system** (1–10)? Co zwiększyłoby Twoją ufność?
18. **Czy poleciłbyś(-abyś) aplikację innym dietetykom?** Dlaczego / dlaczego nie?
19. **Jak oceniasz stosunek ceny do wartości?**

---

## 6. Pytania otwarte do pacjentów (krótsza ankieta)

1. **Jak szybko znalazłeś(-aś) swój pierwszy plan po zalogowaniu?** (sekundy/minuty)
2. **Czy plan jest zrozumiały?** (porcje, składniki, przepisy — wszystko jasne?)
3. **Czy użyłeś(-aś) opcji "zamień posiłek"?** Ile razy w tygodniu? Czy alternatywy Ci się podobały?
4. **Czy realnie zrealizowałeś(-aś) plan?** Jeśli nie — co Cię powstrzymywało? (Składniki trudne do kupienia, przepisy czasochłonne, smak?)
5. **Czy lista zakupów Ci pomogła?** Czego w niej brakowało?
6. **Czy check-in tygodniowy jest dla Ciebie wygodny?** Czy chciał(a)byś zgłaszać częściej / rzadziej?
7. **Jak oceniasz kontakt z dietetykiem przez aplikację?** (odpowiedzi w sensownym czasie, łatwość użycia)
8. **Na ile aplikacja jest wygodna na telefonie?** (1–10)
9. **Co najbardziej Cię sfrustrowało podczas używania?**
10. **Co jest największą zaletą aplikacji?**
11. **Czy kontynuujesz subskrypcję?** Jeśli nie — dlaczego?
12. **Co byś zmienił(a) jako pierwsze?**

---

## Dodatek — harmonogram sugerowany

| Tydzień | Aktywność | Priorytet |
|---------|-----------|-----------|
| W1 | Rekrutacja 20 dietetyków, onboarding | P0 |
| W2 | Scenariusze S1–S4 (onboarding + podstawowy plan) | P0 |
| W3 | Scenariusze S5–S8 (różne profile kliniczne) | P0 |
| W4 | Scenariusze pacjentów P1–P4 | P0 |
| W5 | Scenariusze zaawansowane S9–S12 + P5–P8 | P1 |
| W6 | Edge cases + wydajność + sytuacje błędne | P0 |
| W7 | Wywiady dietetyków + ankiety pacjentów | P1 |
| W8 | Analiza, raport, plan poprawek | P0 |

**Minimalny komplet do launch:** wszystkie P0 zielone + ≥80% P1 zielone.
