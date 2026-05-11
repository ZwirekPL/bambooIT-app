# Reguły kliniczne — dokumentacja systemu

> Ostatnia aktualizacja: 2026-03-11
> Stan: 101 aktywnych reguł w bazie (85 POLICY + 16 RED_FLAG)

---

## Spis treści

1. [Czym są reguły kliniczne?](#1-czym-są-reguły-kliniczne)
2. [Jak to działa — opis techniczny](#2-jak-to-działa--opis-techniczny)
3. [Instrukcja dla osoby nietechnicznej — zarządzanie regułami w panelu admina](#3-instrukcja-dla-osoby-nietechnicznej)
4. [Warunki aktywacji — co możesz sprawdzać](#4-warunki-aktywacji--co-możesz-sprawdzać)
5. [Efekty reguł — co reguła może zrobić](#5-efekty-reguł--co-reguła-może-zrobić)
6. [Czerwone flagi (RED_FLAG) — szczegóły](#6-czerwone-flagi-red_flag--szczegóły)
7. [Kategorie reguł](#7-kategorie-reguł)
8. [Jak dodawać nowe reguły przez kod](#8-jak-dodawać-nowe-reguły-przez-kod)
9. [Architektura techniczna — pliki i przepływ danych](#9-architektura-techniczna--pliki-i-przepływ-danych)
10. [Ograniczenia i ważne uwagi](#10-ograniczenia-i-ważne-uwagi)

---

## 1. Czym są reguły kliniczne?

Reguły kliniczne to **automatyczne zasady dietetyczne**, które system sprawdza dla każdego pacjenta przed wygenerowaniem planu żywieniowego. Każda reguła odpowiada na pytanie:

> „Jeśli pacjent ma X → zrób Y"

### Przykłady:
- Jeśli pacjent ma **cukrzycę** → ogranicz węglowodany do max 200g/dzień, poinformuj AI o równomiernym rozkładzie węgli w posiłkach
- Jeśli pacjent ma **alergię na gluten** → wyklucz wszystkie produkty z glutenem z diety
- Jeśli pacjent ma **BMI poniżej 16** → ZABLOKUJ auto-generowanie i wymagaj ręcznego zatwierdzenia przez dietetyka
- Jeśli pacjent ma **CKD (chorobę nerek)** → ogranicz białko, potas, fosfor, zasugeruj suplementację

### Dwa typy reguł:

| Typ | Ikona w UI | Co robi |
|-----|-----------|---------|
| **POLICY** (polityka) | tarcza (Shield) | Modyfikuje plan: zmienia makro, wyklucza produkty, dodaje notatki kliniczne, sugeruje suplementy |
| **RED_FLAG** (czerwona flaga) | trójkąt (AlertTriangle) | Wyświetla ostrzeżenie dietetykowi; CRITICAL blokuje auto-generowanie |

---

## 2. Jak to działa — opis techniczny

### Przepływ przy generowaniu planu

```
1. Pacjent ma wypełniony wywiad (Interview) i obliczone cele (NutritionTargets)
        ↓
2. buildPatientContext() — zbiera dane: choroby, alergie, leki, BMI, wiek, makro...
        ↓
3. evaluateRedFlagsFromDb() — sprawdza KAŻDĄ czerwoną flagę
        │
        ├── CRITICAL wyzwolona? → status planu = MANUAL_REVIEW_REQUIRED, AI NIE generuje
        └── HIGH wyzwolona? → AI generuje, ale status = MANUAL_REVIEW_REQUIRED
        ↓
4. loadPolicyRules() + evaluatePolicies() — sprawdza KAŻDĄ regułę POLICY
        │
        └── Zbiera: modyfikacje makro, limity składników, wykluczone słowa kluczowe,
                     notatki kliniczne, sugestie suplementów
        ↓
5. applyTargetModifications() — stosuje modyfikacje do celów (kcal, białko, tłuszcz, węgle)
        ↓
6. policyMetadata — zapisywane do DietPlan: które reguły zadziałały, jakie flagi, notatki
        ↓
7. triggerN8nWorkflow() — wysyła do AI (n8n → OpenAI) z:
        - skorygowanymi celami makro
        - listą wykluczonych słów kluczowych
        - notatkami klinicznymi (jako wytyczne w prompcie systemowym)
        ↓
8. AI generuje plan uwzględniający wszystkie ograniczenia kliniczne
```

### Skąd biorą się reguły (kolejność priorytetów)

```
Redis cache (5 min TTL)
    ↓ miss
Baza danych PostgreSQL — tabela ClinicalRule
    ↓ pusta lub błąd
Hardcoded fallback — clinical-rules.ts / red-flags.ts
```

Po każdej edycji reguły przez UI cache jest czyszczony automatycznie (przez `invalidateRuleCache()`).

### Dane pacjenta używane przez reguły (PatientContext)

```typescript
{
  // Z wywiadu
  chronicDiseases: string[]    // np. ["cukrzyca typu 2", "nadciśnienie"]
  digestiveIssues: string[]    // np. ["IBS", "refluks"]
  allergies: string[]          // np. ["gluten", "orzechy"]
  dietType: string             // np. "vegan", "keto"
  medications: string          // surowy tekst
  medicationsList: string[]    // sparsowana lista leków
  mealsPerDay: number
  pregnancyStatus?: string
  hormonalIssues?: string[]
  stage?: string               // stadium choroby np. "remission", "decompensated"
  surgeryHistory?: string[]    // np. ["bariatric", "gastrectomy"]

  // Z profilu pacjenta
  sex: string
  weightKg: number
  heightCm: number
  ageYears: number
  goal: string                 // np. "weight_loss", "maintenance"

  // Z NutritionTargets
  targetKcal: number
  targetProteinG: number
  targetFatG: number
  targetCarbsG: number
}
```

---

## 3. Instrukcja dla osoby nietechnicznej

### Jak dostać się do zarządzania regułami

1. Zaloguj się na konto **ADMIN**
2. W menu przejdź do **Panel admina → Reguły kliniczne**
3. Zobaczysz listę wszystkich reguł z filtrami

### Jak przeglądać reguły

- Lista pokazuje: nazwa, waga (kolor), typ (polityka/flaga), kategoria, wersja, priorytet
- **Kliknij w regułę** → rozwijają się szczegóły: warunek aktywacji, efekty, źródła naukowe
- Szara/przyciemniona reguła = **nieaktywna** (nie jest sprawdzana dla pacjentów)

### Filtry na górze

| Filtr | Co robi |
|-------|---------|
| Wyszukiwarka | Szuka po nazwie i opisie |
| Typ | Tylko polityki LUB tylko czerwone flagi |
| Waga | Tylko CRITICAL, HIGH, MODERATE lub LOW |
| Status | Aktywne / nieaktywne / wszystkie |
| Kategoria | Np. tylko metaboliczne, tylko nerkowe |

### Jak edytować istniejącą regułę

1. Kliknij w regułę, żeby ją rozwinąć
2. Kliknij przycisk **Edytuj** (ikona ołówka)
3. Zmień co chcesz w formularzu
4. Kliknij **Zapisz**

> Zmiany wchodzą w życie dla nowych planów w ciągu maksymalnie **5 minut** (odświeżenie cache).

### Jak dezaktywować regułę (wyłączyć bez usuwania)

1. Rozwiń regułę
2. Kliknij **Dezaktywuj** (ikona wyłącznika)
3. Reguła staje się szara — nie jest już sprawdzana dla pacjentów
4. Można ją w dowolnym momencie z powrotem **Aktywować**

### Jak sprawdzić historię zmian

1. Rozwiń regułę
2. Kliknij **Historia**
3. Zobaczysz kto i kiedy zmieniał regułę oraz podsumowanie zmiany

### Jak dodać nową regułę

1. Kliknij przycisk **Dodaj regułę** (górny prawy róg)
2. Wypełnij formularz (szczegóły poniżej w sekcji 4 i 5)
3. Kliknij **Zapisz**

### Których reguł NIE można usunąć?

Reguły oznaczone jako **Domyślna** (seedowane przez programistów jako bazowy zestaw kliniczny) — można je dezaktywować, ale nie usunąć, aby zachować bezpieczeństwo systemu. Własnoręcznie dodane reguły można usuwać.

### Co oznaczają kolory wagi?

| Kolor | Waga | Znaczenie dla systemu |
|-------|------|----------------------|
| 🔴 Czerwony | CRITICAL | Czerwona flaga CRITICAL → blokuje auto-generowanie, dietetyk musi ręcznie zatwierdzić |
| 🟠 Pomarańczowy | HIGH | Czerwona flaga HIGH → plan jest generowany, ale oznaczony do przeglądu |
| 🟡 Żółty | MODERATE | Ostrzeżenie / normalna polityka kliniczna |
| 🔵 Niebieski | LOW | Informacyjna / delikatna rekomendacja |

---

## 4. Warunki aktywacji — co możesz sprawdzać

Warunek decyduje, **kiedy reguła się aktywuje**. Możesz go budować z pojedynczych warunków lub łączyć je logicznie (AND/OR).

### Dostępne typy warunków

#### Sprawdzanie chorób i problemów
- **Ma chorobę/problem** (`HAS_CONDITION`) — szuka wpisanego słowa w liście chorób przewlekłych i problemów trawiennych pacjenta
  - Przykład: `terms: ["cukrzyca", "diabetes"]` → aktywuje się jeśli pacjent ma cokolwiek zawierającego te słowa
  - Dopasowanie jest częściowe i nie uwzględnia wielkości liter (`"cukrzyca typu 2"` pasuje do `"cukrzyca"`)

#### Sprawdzanie alergii
- **Ma alergię** (`HAS_ALLERGY`) — szuka w liście alergii pacjenta
  - Przykład: `terms: ["gluten", "pszenica"]`

#### Sprawdzanie diety
- **Stosuje dietę** (`HAS_DIET`) — sprawdza typ diety pacjenta
  - Przykład: `terms: ["vegan", "wegetariański"]`

#### Sprawdzanie problemów hormonalnych
- **Problem hormonalny** (`HAS_HORMONAL_ISSUE`) — z wywiadu PRO
  - Przykład: `terms: ["hashimoto", "tarczyca"]`

#### Sprawdzanie stadium choroby
- **Stadium choroby** (`HAS_STAGE`) — pole `stage` z wywiadu
  - Przykład: `terms: ["decompensated", "stage4"]`

#### Sprawdzanie operacji
- **Przebyta operacja** (`HAS_SURGERY`) — lista z wywiadu
  - Przykład: `terms: ["bariatric", "gastrektomia"]`

#### Sprawdzanie leków
- **Przyjmuje lek** (`HAS_MEDICATION`) — szuka konkretnego leku na sparsowanej liście
  - Przykład: `terms: ["warfaryna", "metformina"]`
- **Przyjmuje jakiekolwiek leki** (`HAS_MEDICATIONS`) — sprawdza tylko czy pole leków jest niepuste

#### Sprawdzanie wartości liczbowych
- **Porównaj wartość** (`FIELD_COMPARE`) — porównuje pole liczbowe z progiem
  - Dostępne pola: BMI, Wiek, Cel kcal, Waga (kg), Wzrost (cm), Liczba chorób
  - Operatory: `<` (LT), `≤` (LTE), `>` (GT), `≥` (GTE), `=` (EQ)
  - Przykład: BMI < 18.5 → niedowaga

- **Przedział wiekowy** (`AGE_RANGE`) — wiek od X do Y lat
  - Przykład: od 65 lat (bez górnego limitu) → seniorzy

#### Sprawdzanie pól tekstowych
- **Pole równa się** (`FIELD_EQUALS`) — dokładne dopasowanie wartości
  - Dostępne pola: Status ciąży, Cel, Płeć, Typ diety
  - Przykład: `goal = "weight_loss"`, `sex = "female"`

### Łączenie warunków

- **ORAZ (AND)** — wszystkie podowarunki muszą być spełnione
- **LUB (OR)** — wystarczy jeden podowarunek

Przykład złożonego warunku:
```
AND:
  ├── HAS_CONDITION: ["CKD", "przewlekła choroba nerek"]
  └── FIELD_COMPARE: ageYears ≥ 60
```
→ Aktywuje się tylko jeśli pacjent MA chorobę nerek I MA co najmniej 60 lat.

---

## 5. Efekty reguł — co reguła może zrobić

Dla reguł typu POLICY możesz dodać wiele efektów. Działają **kumulatywnie** — reguła A i reguła B mogą razem dodać kilka efektów.

### Notatka kliniczna
Dodaje informację do wyjaśnienia planu. Wyświetlana dietetykowi i przekazywana jako wytyczna do AI.

| Kategoria | Kolor | Kiedy używać |
|-----------|-------|-------------|
| RESTRICTION | czerwony | Zakaz / twarde ograniczenie |
| WARNING | pomarańczowy | Ostrzeżenie, ale nie zakaz |
| RECOMMENDATION | niebieski | Zalecenie, optymalne postępowanie |
| INFO | szary | Informacja bez nacisku |

### Wyklucz słowa kluczowe
Lista słów, których AI nie może użyć przy nazewnictwie produktów w planie.
Przykład: `["alkohol", "piwo", "wino", "sól", "chipsy"]`

### Sugeruj suplement
Sugestia suplementacji przekazywana do planu.
- Nazwa: np. `Witamina D3`
- Dawka: np. `2000 IU/d`
- Powód: np. `Profilaktyka niedoboru przy CKD`

### Modyfikuj cel (makro)
Zmienia obliczone przez system wartości makroskładników.

| Operacja | Co robi | Przykład użycia |
|----------|---------|----------------|
| `SET` (=) | Ustawia dokładną wartość | Kcal = 1800 przy otyłości III stopnia |
| `ADD` (+) | Dodaje do obecnej wartości | Białko +20g przy onkologii |
| `MULTIPLY` (×) | Mnoży przez współczynnik | Kcal × 1.2 przy kacheksji nowotworowej |
| `MAX` | "Przynajmniej tyle" — bierze większą | Białko MAX 120g (gwarantuje minimum) |
| `MIN` | "Co najwyżej tyle" — capuje wartość | Węgle MIN 200g (nie zejdzie poniżej) |

> **Uwaga na MAX i MIN:** `MAX` = dolna granica (zapewnij co najmniej X), `MIN` = górna granica (nie przekraczaj X).

### Limit składnika odżywczego
Weryfikacyjny limit przekazywany do walidacji planu.
- Składniki: kcal, białko, tłuszcz, węgle, błonnik, cukier, sól, nasycone kwasy, sód, cholesterol, potas, puryny, fosfor, wapń
- Zakres: dzienna suma (`DAILY_TOTAL`) lub na 100g produktu (`PER_100G`)
- Możesz ustawić min, maks lub oba

Przykład: sód DAILY_TOTAL maks. 1500 mg → dla nadciśnienia

### Rozkład posiłków
Ograniczenie max procentu składnika w jednym posiłku.
Przykład: węgle maks. 25% na posiłek → przy insulinooporności (wyrównanie glikemii)

### Wyklucz / Preferuj produkty (flaga)
Filtrowanie bazy produktów po flagach dietetycznych.
- Klucze flag: `glutenFree`, `lactoseFree`, `vegetarian`, `vegan`, `ketoCompatible`, `renalDietCompatible`, itp.
- Przykład: wyklucz produkty gdzie `glutenFree = false` → przy celiakii

---

## 6. Czerwone flagi (RED_FLAG) — szczegóły

Czerwone flagi to reguły bezpieczeństwa. Zamiast efektów mają jeden **komunikat tekstowy** dla dietetyka.

### Obecne flagi CRITICAL (blokują generowanie)

| Reguła | Warunek | Dlaczego krytyczna |
|--------|---------|-------------------|
| BMI < 16 | `FIELD_COMPARE: bmi < 16` | Niedowaga skrajna — ryzyko życia |
| Ciąża + redukcja | `AND: pregnancyStatus=pregnant + goal=weight_loss` | Niebezpieczne dla płodu |
| Poniżej 1000 kcal | `FIELD_COMPARE: targetKcal < 1000` | Głodzenie — bezwzględny zakaz |

### Obecne flagi HIGH (wymagają ręcznego przeglądu)

- Zaburzenia odżywiania (anoreksja, bulimia)
- Encefalopatia wątrobowa
- CKD stadium 4–5
- Nowotwory w aktywnym leczeniu
- Ciąża z GDM (cukrzyca ciążowa)
- Bariatria (do 3 miesięcy po operacji)
- Marskość dekompensowana

---

## 7. Kategorie reguł

| Klucz | Etykieta | Przykładowe reguły |
|-------|----------|-------------------|
| `allergen` | Alergie | EU 14 alergenów (gluten, mleko, jaja, orzechy...) |
| `intolerance` | Nietolerancje | Laktoza, fruktoza, histamina |
| `metabolic` | Metaboliczne | Cukrzyca, insulinooporność, otyłość |
| `cardio` | Kardiologiczne | Nadciśnienie, hipercholesterolemia, niewydolność serca |
| `liver` / `hepatic` | Wątrobowe | NAFLD, marskość, encefalopatia |
| `kidney` / `renal` | Nerkowe | CKD, dna moczanowa |
| `digestive` | Żołądkowo-jelitowe | IBS, IBD, GERD, celiakia |
| `endocrine` | Endokrynologiczne | Tarczyca, ciąża, PCOS |
| `bone` | Kostne | Osteoporoza, niedobór wit. D |
| `oncology` | Onkologiczne | Kacheksja, chemioterapia |
| `deficiency` | Niedobory | Żelazo, wit. D, B12, cynk |
| `eating-disorder` | Zaburzenia odżywiania | Anoreksja, bulimia |
| `drug-interaction` | Interakcje lekowe | Warfaryna, MAOI, metformina, statyny |

---

## 8. Jak dodawać nowe reguły przez kod

Nowe reguły na stałe (seedowane jako `isDefault = true`) dodaje się przez pliki seed.

### Krok po kroku

1. Otwórz odpowiedni plik w `apps/backend/src/policies/seed-data/`
   (np. `metabolic-seeds.ts` dla metabolicznych)

2. Dodaj nowy obiekt do tablicy, np.:
```typescript
{
  name: 'Nazwa reguły',
  description: 'Opis kliniczny',
  type: 'POLICY',           // lub 'RED_FLAG'
  severity: 'MODERATE',     // CRITICAL | HIGH | MODERATE | LOW
  priority: 70,             // 0–200
  category: 'metabolic',
  version: '1.0',
  source: 'PTD 2023',
  conditions: {
    type: 'HAS_CONDITION',
    terms: ['choroba'],
  },
  effects: [
    {
      type: 'CLINICAL_NOTE',
      note: 'Tekst notatki dla dietetyka i AI',
      category: 'RESTRICTION',
    },
    {
      type: 'EXCLUDE_KEYWORDS',
      keywords: ['słowo1', 'słowo2'],
    },
  ],
}
```

3. Uruchom seed (z katalogu `apps/backend`):
```bash
npx ts-node src/policies/seed-rules.ts
```

Seed używa `upsert` po nazwie — bezpieczny do wielokrotnego uruchamiania.

### Konwencje

- `priority`: 90–100 = alergie (najważniejsze), 80–89 = metaboliczne/nerkowe, 70–79 = inne
- `version`: zawsze zacznij od `"1.0"`, inkrementuj przy zmianie logiki
- `conflictsWith`: lista nazw innych reguł które kolidują (np. dieta ketogeniczna konfliktuje z CKD)
- Dla RED_FLAG: zamiast `effects: []` podaj `effects: { message: "Treść komunikatu" }`

---

## 9. Architektura techniczna — pliki i przepływ danych

### Pliki backendu

```
apps/backend/src/policies/
├── types.ts              — Typy TypeScript (PatientContext, PolicyEffect, PolicyRule, RedFlag)
├── policy-engine.ts      — buildPatientContext(), evaluatePolicies(), applyTargetModifications()
├── rule-store.ts         — loadPolicyRules(), evaluateRedFlagsFromDb(), Redis cache
├── condition-evaluator.ts — Ewaluacja warunków JSON → boolean
├── clinical-rules.ts     — Hardcoded fallback (używany gdy DB pusta)
├── red-flags.ts          — Hardcoded fallback dla czerwonych flag
├── explainability.ts     — Generowanie wyjaśnień do planu
├── index.ts              — Publiczne API modułu
├── seed-rules.ts         — Skrypt seedujący
└── seed-data/
    ├── allergen-seeds.ts
    ├── metabolic-seeds.ts
    ├── cardio-seeds.ts
    ├── liver-seeds.ts
    ├── kidney-seeds.ts
    ├── digestive-seeds.ts
    ├── endocrine-seeds.ts
    ├── bone-seeds.ts
    ├── oncology-seeds.ts
    ├── deficiency-seeds.ts
    ├── eating-disorder-seeds.ts
    ├── drug-interaction-seeds.ts
    ├── intolerance-seeds.ts
    └── red-flag-seeds.ts
```

### Pliki frontendu

```
apps/web/src/
├── app/[locale]/admin/reguly-kliniczne/page.tsx  — Strona (server component)
└── components/admin/
    ├── ClinicalRulesManager.tsx  — Lista + filtry + paginacja
    └── ClinicalRuleForm.tsx      — Formularz tworzenia/edycji + buildery warunków i efektów
```

### Schemat bazy danych (tabela `ClinicalRule`)

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | cuid | Klucz główny |
| `name` | string unique | Unikalna nazwa reguły |
| `description` | string | Opis kliniczny |
| `type` | enum | POLICY / RED_FLAG |
| `severity` | enum | CRITICAL / HIGH / MODERATE / LOW |
| `priority` | int | 0–200, wyższy = wcześniej ewaluowany |
| `isActive` | bool | Czy sprawdzana dla pacjentów |
| `isDefault` | bool | Seedowana przez kod — nie można usunąć |
| `conditions` | Json | Drzewo warunków (RuleCondition) |
| `effects` | Json | Lista efektów (PolicyEffect[]) lub { message } dla RED_FLAG |
| `version` | string | Wersja dla audit trail |
| `source` | string? | Krótka referencja |
| `sources` | Json? | Lista źródeł naukowych [{ref, year, url}] |
| `conflictsWith` | string[] | Nazwy kolidujących reguł |
| `category` | string? | Kategoria kliniczna |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

### Powiązana tabela `ClinicalRuleHistory`

Automatycznie zapisuje każdą zmianę: kto zmienił, kiedy, co zmienił (`changeSummary`).

---

## 10. Ograniczenia i ważne uwagi

### Cache Redis — 5 minut

Po edycji reguły w UI zmiana jest widoczna dla nowych planów w ciągu **maksymalnie 5 minut**. Jeśli pilnie potrzeba natychmiastowego efektu — programista może wywołać `invalidateRuleCache()` na backendzie.

### Reguły `isDefault` — nieusuwalne

85 reguł seedowanych przez skrypt ma flagę `isDefault = true`. Można je:
- ✅ Edytować
- ✅ Dezaktywować
- ❌ Usunąć (tylko przez migrację bazy danych przez programistę)

### Fallback na hardcoded reguły

Jeśli baza danych jest niedostępna lub pusta — system automatycznie używa wersji hardcoded z kodu (`clinical-rules.ts`, `red-flags.ts`). Planowany plan zostanie wygenerowany, ale bez zmian robionych przez UI.

### Typ reguły (POLICY/RED_FLAG) jest niezmienialny

Po zapisaniu nowej reguły nie można zmienić jej typu. Jeśli pomyłka — trzeba dezaktywować starą i stworzyć nową.

### Dopasowanie warunków jest częściowe (contains)

Warunki `HAS_CONDITION`, `HAS_ALLERGY` itd. używają dopasowania `includes` na małych literach. Oznacza to:
- `"cukrzyca"` → złapie `"cukrzyca"`, `"cukrzyca typu 2"`, `"cukrzyca insulinozależna"`
- Uważaj na krótkie terminy: `"rak"` złapie też `"rak jelita"` ale też ewentualnie `"rak..."` w innych kontekstach
- Stosuj specyficzne terminy gdy to możliwe

### Konflikty reguł — tylko ostrzeżenie

Gdy dwie reguły z ustawionym `conflictsWith` aktywują się jednocześnie — system dodaje ostrzeżenie do `policyMetadata` planu. **Nie blokuje** to generowania — dietetyk widzi informację o konflikcie i może ją rozpatrzyć.

### Priorytety efektów MODIFY_TARGETS

Gdy wiele reguł modyfikuje ten sam cel (np. kcal), operacje stosowane są **po kolei w kolejności priorytetu** reguły (wyższy priorytet = pierwsze zastosowanie). Wynik poprzedniej operacji jest bazą dla następnej.

---

*Dokument wygenerowany na podstawie kodu źródłowego projektu DietetykAI.*
*Plik: `docs/clinical-rules.md`*
