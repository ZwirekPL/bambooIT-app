# PRD.md — bambooIT

> **Product Requirements Document**
> Wersja: 1.0
> Data: 2026-05-11
> Status: Draft, do iteracji

---

## 1. Czym jest bambooIT

### 1.1 Pitch w jednym zdaniu

*Dwuosobowy zespół, który ogarnia całą technologię w małej firmie — od poczty i drukarek po custom aplikacje i automatyzacje procesów.*

### 1.2 Pełne pozycjonowanie

Bambooit jest **alternatywą dla dwóch złych wyborów**, które mają dziś małe i średnie firmy w Polsce na rynku usług IT:

- **Jednoosobowy "informatyk od wszystkiego"** — bliski, zna firmę, ale znika na urlopie, choruje, nie ogarnia szerokiego stacku
- **Duża agencja IT** — pełnia kompetencji, ale rozmawiasz z 5 osobami i żadna nie pamięta jak nazywa się Twoja firma

Bambooit łączy zalety obu: **bliskość jednoosobowego informatyka + zakres agencji**. Zamknięte w 2-osobowym, wyspecjalizowanym zespole.

### 1.3 Skąd nazwa

Bambus rośnie powoli, ale po wyrośnięciu jest jednocześnie **elastyczny i nie do złamania**. Tak powinna działać technologia w firmie klienta — wytrzymała pod obciążeniem, elastyczna w obliczu zmian, niezawodna.

---

## 2. Zespół

### 2.1 Skład

**Remigiusz** — Obsługa IT (główny opiekun klientów abonamentowych)
- Specjalizacja: pomoc zdalna, sieci, Wi-Fi, Microsoft 365, bezpieczeństwo, backup, drukarki, sprzęt
- Odpowiedzialność: pierwsza linia kontaktu dla klientów abonamentu, helpdesk, audyty IT, rozwiązywanie problemów technicznych

**Wirgiliusz** — Strony, aplikacje, automatyzacje
- Specjalizacja: Next.js, React, TypeScript, PostgreSQL, n8n, Make, Stripe, Anthropic API
- Odpowiedzialność: projekty dev (strony, aplikacje custom), automatyzacje procesów, kod platformy bambooit, integracje
- Bonus: twórca SaaS e-dietetyk.com (referencja techniczna)

### 2.2 Model pracy

- **Każdy klient ma jedną osobę kontaktu** w zależności od usługi
- **Bez infolinii, bez ticketów w czyśćcu** — odpowiada konkretna osoba, którą znasz
- **Wzajemne backup** — jeśli jeden choruje/urlop, drugi może obsłużyć podstawowe sprawy
- **Cross-sell naturalny** — klient abonamentu IT pyta o stronę → Wirgiliusz wycenia → ten sam zespół realizuje

### 2.3 Skalowanie zespołu

W ciągu 12-18 miesięcy plan rozważyć **trzeciego członka zespołu** w jednym z trzech kierunków (zależnie od który filar najszybciej rośnie):
- Junior IT support (odciążenie Remigiusza w helpdesku)
- Junior dev (odciążenie Wirgiliusza w projektach)
- Specjalista automatyzacji (jeśli ten filar wybije)

---

## 3. Target user

### 3.1 Profil firmy klienta

| Atrybut | Wartość |
|---------|---------|
| Wielkość | 1-30 pracowników |
| Branże priorytetowe | Biura księgowe, kancelarie prawne, gabinety lekarskie/dentystyczne |
| Branże dodatkowe | Salony usługowe, małe biura, firmy handlowe, firmy produkcyjne (małe) |
| Lokalizacja | Wrocław (priorytet wizyt na miejscu) + cała Polska (zdalnie) |
| Budżet IT | 300-2000 zł netto/miesiąc na obsługę |
| Stack IT | Windows głównie, mix MacOS, Microsoft 365 lub Google Workspace, podstawowe oprogramowanie branżowe (Optima, Symfonia, Płatnik etc.) |

### 3.2 Persony

#### Persona 1: Anna, właścicielka biura księgowego (45 lat, 8 osób w biurze)

**Bóle:**
- "Drukarka strajkuje w godzinach szczytu, deadline na podatkach"
- "Klient X dzwoni że poczta nie działa, a ja nie wiem co robić"
- "Nowa księgowa zaczyna w poniedziałek, nikt nie skonfigurował jej komputera"
- "Mój 'informatyk' zniknął na 2 tygodnie i nie odbiera telefonu"
- "Nie wiem czy backup naprawdę działa — sprawdzałam ostatnio rok temu"

**Cel:** "Chcę żeby IT po prostu działało, żebym mogła zająć się klientami."

**Decyzja zakupu:**
- Pakiet abonamentowy bo *przewidywalny koszt > niska cena*
- Wybierze Firma (690 zł) bo "Start to mało, a Plus to za dużo"
- Decyzja po pierwszym audycie i jednej rozmowie telefonicznej

#### Persona 2: Marek, partner w 5-osobowej kancelarii prawnej (38 lat)

**Bóle:**
- "Nasze dane klientów MUSZĄ być bezpieczne — RODO + obowiązek tajemnicy adwokackiej"
- "Sąd wymaga ePUAP, PESEL, podpisów elektronicznych — kto to ogarnie?"
- "Pracujemy z domu i z biura, każdy z innego komputera — chaos"
- "Backup musi być, ale nie mam pojęcia jak go zorganizować pod RODO"

**Cel:** "Chcę spać spokojnie wiedząc że dane klientów są zabezpieczone."

**Decyzja zakupu:**
- Pakiet abonamentowy bo *bezpieczeństwo + ciągłość > własny etat*
- Wybierze Firma Plus (1190 zł) bo priorytet reakcji i pełne bezpieczeństwo
- Decyzja po audycie + wymaga DPA przed startem

#### Persona 3: Piotr, właściciel sklepu online (32 lat, 4 osoby)

**Bóle:**
- "Ręcznie przepisuję dane zamówień ze sklepu do księgowości — 5h tygodniowo"
- "Stara strona wygląda jak z 2010 i tracę klientów"
- "Chcę aplikację do zarządzania reklamacjami, ale nie wiem od czego zacząć"

**Cel:** "Chcę zautomatyzować to co da się zautomatyzować i mieć ładną stronę."

**Decyzja zakupu:**
- NIE abonament IT (ma własnego informatyka z 1/4 etatu)
- Audyt procesów (1500 zł) + automatyzacje (5-15k zł) + redesign strony (15-25k zł)
- Decyzja po warsztacie scopingowym

### 3.3 Anti-persona (kogo NIE chcemy obsługiwać)

- **Korporacje 100+ osób** — wymagają dedykowanych zespołów, SLA na piśmie, formalności
- **Startupy techniczne** — mają własnych devów, nie potrzebują outsourcingu
- **Mikrofirmy 1-osobowe budżet 0-200 zł/mies** — nie spina się ekonomicznie, lepiej DIY
- **Klienci szukający "najtaniej"** — bambooit nie konkuruje ceną, konkuruje jakością obsługi

---

## 4. Cztery filary usług

### 4.1 Filar 1: Obsługa IT (główny produkt, abonament)

**Format:** abonament miesięczny z 3 pakietami

#### Pakiet START — 390 zł netto/mies
- Dla firm do 3 stanowisk
- 2h wsparcia miesięcznie
- Pomoc zdalna 8-18
- Konfiguracja poczty
- Doradztwo IT
- Czas reakcji do 4h

#### Pakiet FIRMA — 690 zł netto/mies (najczęściej wybierany)
- Dla firm do 7 stanowisk
- 5h wsparcia miesięcznie
- Wszystko z pakietu Start
- Pomoc na miejscu, drukarki
- Konfiguracja nowych stanowisk
- Czas reakcji do 1h

#### Pakiet FIRMA PLUS — 1190 zł netto/mies
- Dla firm 8-15 stanowisk
- 10h wsparcia miesięcznie
- Wszystko z pakietu Firma
- Backup zarządzany + recovery
- Microsoft 365 / Google Workspace
- Czas reakcji do 30 min

#### Pakiet Enterprise — wycena indywidualna
- Dla firm 16+ stanowisk
- Indywidualnie ustalany zakres godzin i SLA

#### Zasady ogólne abonamentu
- **Niewykorzystane godziny NIE przechodzą** na kolejny miesiąc (chroni rentowność)
- **Dodatkowe godziny** poza pakietem: 150 zł netto/h (do zafakturowania osobno albo doliczenia w kolejnym cyklu)
- **Subskrypcja miesięczna** — bez długich umów, anulowanie z miesięcznym wyprzedzeniem
- **Faktura VAT** wystawiana automatycznie po każdej płatności
- **Płatność**: karta cykliczna (Stripe) lub przelew z proformy (na życzenie B2B)

### 4.2 Filar 2: Strony internetowe (cross-sell, wycena indywidualna)

**Format:** projekty jednorazowe, wycena po rozmowie

**Widełki cenowe (do komunikacji na stronie):**
- Wizytówka / landing page: 4-8 tys. zł netto
- Strona firmowa (8-12 podstron): 10-18 tys. zł netto
- Sklep WooCommerce / aplikacja webowa: 20-40 tys. zł netto
- Powyżej: indywidualnie

**Proces:**
1. Bezpłatna rozmowa (30 min) — zrozumienie potrzeb
2. Brief + wycena (1-3 dni)
3. Realizacja (2-8 tygodni w zależności od scope)
4. Wsparcie po wdrożeniu (opcjonalny abonament 200-800 zł/mies)

**Stack:**
- WordPress dla prostszych wizytówek (klient sam edytuje)
- Next.js dla bardziej zaawansowanych projektów
- Wszystko mobile-first, SEO-ready, hosted optymalnie

**Cross-sell z abonamentu:**
- **15% rabatu** dla aktywnych klientów abonamentu IT
- Priorytet realizacji
- Naturalna kontynuacja jeśli klient już zaufał

### 4.3 Filar 3: Aplikacje na zamówienie (high-ticket, wycena indywidualna)

**Format:** projekty konsultacyjne, wycena po warsztacie

**Widełki cenowe (do komunikacji na stronie):**
- Małe aplikacje (np. wewnętrzne narzędzie): 25-50 tys. zł netto
- Średnie projekty (CRM custom, panel klienta, SaaS B2B): 50-150 tys. zł netto
- Duże projekty: 150 tys.+ zł netto, ustalane indywidualnie

**Proces:**
1. Bezpłatna rozmowa discovery (30 min) — czy w ogóle pasujemy
2. Płatny warsztat scopingowy (2-4 tys. zł netto, zaliczany do projektu) — wychodzimy z dokumentem co budujemy
3. Wycena projektu (fixed price lub time & materials)
4. Realizacja w sprintach z regularnymi demo
5. Utrzymanie po wdrożeniu (osobna umowa)

**Stack:**
- Next.js + TypeScript + PostgreSQL + Prisma + Stripe
- Anthropic API dla feature'ów AI
- n8n / Make dla integracji
- Docker, deploy na VPS lub Vercel

**Reference:** e-dietetyk.com (własny SaaS Wirgiliusza, w produkcji, prawdziwi użytkownicy)

### 4.4 Filar 4: Automatyzacje procesów (medium-ticket, mix pakiety + indywidualne)

**Format:** mix pakietów (małe) i wycen indywidualnych (duże)

**Cennik:**

| Pakiet | Cena | Zawartość |
|--------|------|-----------|
| Audyt procesów | 1500 zł netto | Identyfikujemy 5-10 procesów do automatyzacji + ROI calculation. Zaliczane do dalszego projektu. |
| Mała automatyzacja | od 2500 zł netto | 1 proces, prosta integracja (np. formularz → CRM → mail) |
| Pakiet automatyzacji | od 8000 zł netto | 3-5 procesów, średnia złożoność |
| Duże automatyzacje | wycena indywidualna | 6+ procesów lub custom dev |
| Utrzymanie | od 200 zł/mies | Monitoring, drobne poprawki, alerty |

**Przykłady procesów do automatyzacji:**
- Faktury z maila → księgowość (oszczędność 2-5h/tydzień)
- Leady z formularza → CRM → autoresponder
- Synchronizacja sklep ↔ magazyn ↔ księgowość
- Raporty sprzedażowe automatyczne (codzienne, tygodniowe)
- Backup danych + powiadomienia
- Onboarding nowego pracownika (konta, dostępy, dokumenty)
- Generowanie ofert na podstawie szablonu

**Stack:**
- n8n (self-hosted lub cloud)
- Make (dawniej Integromat)
- Custom Python/Node.js dla zaawansowanych scenariuszy
- Anthropic API dla AI-driven workflows

---

## 5. Lejek sprzedażowy

### 5.1 Top of funnel (TOF) — pozyskanie leadów

**Kanały:**
- **SEO** — blog (poradniki dla biur księgowych, kancelarii, automatyzacje), podstrony branżowe
- **Polecenia** — najsilniejszy kanał dla SMB (zadowolony klient → 2-3 polecenia)
- **Lokalne** — Wrocław (LinkedIn, lokalne grupy FB, networking)
- **Reklama Meta/Google** — w fazie 2 (po MVP)
- **Współpraca z księgowymi** — biura księgowe polecają bambooit swoim klientom

**Lead magnets:**
- **Bezpłatny audyt IT** (główny CTA) — 30 min online + raport
- **Audyt procesów** — dla firm szukających automatyzacji
- **Treści blogowe** — "Jak zabezpieczyć dane w biurze księgowym", "Backup w kancelarii — RODO checklist" etc.

### 5.2 Middle of funnel (MOF) — kwalifikacja

**Proces po wypełnieniu formularza audytu:**
1. Auto-mail potwierdzenie (Resend)
2. Kontakt telefoniczny w 24h (Remigiusz)
3. Audyt online 30 min (lub na miejscu jeśli Wrocław)
4. Raport audytu w 2-3 dni roboczych
5. Propozycja pakietu lub projektu

**Kryteria kwalifikacji:**
- Wielkość firmy (1-30 osób → tak, więcej → trudniej)
- Lokalizacja (PL → tak, zagranica → nie)
- Branża (jeśli z priorytetowych → priorytet, jeśli anti-persona → uprzejma odmowa)
- Budżet (jeśli oczekuje <200 zł/mies → uprzejma odmowa lub przekierowanie)

### 5.3 Bottom of funnel (BOF) — konwersja

**Dla abonamentu:**
- Audyt jako prezent → pokazuje wartość → propozycja pakietu
- Subskrypcja online (Stripe Checkout) lub proforma + przelew
- Onboarding: konfiguracja monitoringu, backup, dostępów (tydzień)

**Dla projektów (strony/aplikacje/automatyzacje):**
- Warsztat scopingowy (płatny lub bezpłatny w zależności od ticket size)
- Wycena fixed price lub time & materials
- Zaliczka 30-50% przy starcie
- Realizacja w sprintach z demo co 2 tygodnie
- Płatność za milestone'y lub miesięcznie

### 5.4 Retencja i cross-sell

**Retencja abonamentowa:**
- Miesięczny raport stanu IT (automatyczny, generowany skryptem)
- Kontakt proaktywny co kwartał (rozmowa z opiekunem)
- Świadczenie usług ponad obietnicę (jeśli budżet pozwala — wartość dodana bez liczenia każdej minuty)

**Cross-sell:**
- Klient abonamentu pyta o stronę → 15% rabatu
- Klient abonamentu pyta o automatyzację → audyt procesów w cenie pakietu Plus
- Klient projektu (strona/aplikacja) → propozycja abonamentu utrzymaniowego po deploy

**Up-sell:**
- Klient Start → po 6 miesiącach propozycja przejścia na Firma (jeśli przekracza limit godzin)
- Klient Firma → po 12 miesiącach propozycja Firma Plus + audyt bezpieczeństwa

---

## 6. Pozycjonowanie i komunikacja

### 6.1 Pillarów komunikacji (5)

1. **Bez infolinii** — *"Zawsze ten sam człowiek po drugiej stronie"*
2. **Przewidywalna cena** — *"Stała opłata, zero ukrytych kosztów"*
3. **Twoja własność** — *"Kod, hasła, dostępy, dokumentacja — wszystko Twoje"*
4. **Mówimy 'nie'** — *"Gdy projekt nie ma sensu — proponujemy tańsze rozwiązanie"*
5. **Pełnia kompetencji** — *"Od drukarki po custom aplikację — pod jednym dachem"*

### 6.2 Ton komunikacji

- **"Ty"** zamiast "Pan/Pani" (B2B, ale ludzki ton)
- **Konkretnie, bez żargonu** — księgowa zrozumie, dev też nie pomyśli że to amatorszczyzna
- **Bez nadętości korporacyjnej** — żadnych "synergii", "leverage'owania", "best in class"
- **Subtelny humor w kontrolowanych dawkach** — np. "drukarka znów strajkuje na deadline'ie" — tak, "kupujemy synergii" — nie
- **Pokazujemy ludzi, nie technologię** — zdjęcia zespołu, imiona, osobowość

### 6.3 Wizualnie

- **Paleta**: granat `#2C3E50` + zielony `#8BC34A` (akcent) + papierowe tło `#f6f4ee` + biel
- **Fonty**: Fraunces (display, serif) + Archivo (sans-serif) + JetBrains Mono (mono)
- **Styl**: clean, premium, lekka editorialowość, narrative sections
- **Brak**: stockowych zdjęć ludzi z laptopem, generic ikon, gradientów lat 2010

---

## 7. Konkurencja

### 7.1 Bezpośrednia (lokalna, Wrocław)

- **Jednoosobowi informatycy** — niższe ceny (200-400 zł/mies), gorsza dostępność i zakres
- **Lokalne firmy IT** (np. ITPartner, Konsultio) — wyższe ceny (1000-3000 zł/mies), pełne agencje
- **Sieci typu Onex / Komputronik Biznes** — drogo, bezosobowo

**Pozycja bambooit:** *"Mniej kosztu niż agencja, więcej kompetencji niż freelancer."*

### 7.2 Pośrednia

- **Etat informatyka** — koszt 6-12k zł/mies brutto, nieopłacalne dla firm <20 osób
- **Brak obsługi IT** — "jakoś sobie radzimy" — najczęstsze rozwiązanie u firm <10 osób, ale tylko do pierwszej poważnej awarii

### 7.3 Dla projektów (strony, aplikacje, automatyzacje)

- **Software house'y** — droższe (2-3x), mniej elastyczne, gorsza dostępność dla SMB
- **Freelancerzy z OLX** — ryzyko (brak gwarancji, nikna jakość, znikanie)
- **Platformy DIY** (Squarespace, Wix, Bubble) — dla wizytówek OK, dla custom rozwiązań nie wystarczy

---

## 8. Cele biznesowe (12 miesięcy)

> **[TBD — do uzgodnienia z Remigiuszem]**

### 8.1 Wskaźniki ilościowe (cele)

| Metryka | Cel 3 mies. | Cel 6 mies. | Cel 12 mies. |
|---------|-------------|-------------|--------------|
| Aktywne subskrypcje | 5 | 15 | 30 |
| MRR (abonamenty) | 3000 zł | 10000 zł | 25000 zł |
| Projekty (strony/apl/aut) | 1 | 3 | 8 |
| Przychód projekty | 15k | 60k | 200k |
| Łączny przychód roczny | — | — | **~500k zł netto** |

### 8.2 Wskaźniki jakościowe

- NPS klientów abonamentowych: >50
- Churn rate: <10% rocznie
- Czas reakcji średni: w ramach SLA pakietu
- Satysfakcja zespołu: bez wypalenia, bez "spalonych weekendów" rutynowo

---

## 9. MVP — co musi być w pierwszej wersji

### 9.1 MVP (must-have przed deploy na prod)

**Strona marketingowa:**
- [ ] Strona główna z hero, 4 filary, sekcja zespołu, cennik abonamentu, formularz audytu
- [ ] Podstrona `/pakiety` z pełnym porównaniem
- [ ] Podstrona `/pomoc-zdalna` z linkami do AnyDesk/RustDesk
- [ ] Podstrona `/o-nas` z zespołem
- [ ] Podstrony branżowe (min. 3: biura księgowe, kancelarie, gabinety)
- [ ] Strony formalne: regulamin, polityka prywatności, RODO, cookies
- [ ] Mobile-first responsywność
- [ ] SEO podstawowe (meta, OG, sitemap, robots)
- [ ] Cookie banner zgodny z RODO

**Funkcjonalne:**
- [ ] Formularz audytu z walidacją + zapis do bazy + mail do zespołu (Resend)
- [ ] Formularz kontaktowy (jak audyt, prostszy)
- [ ] Analytics (GA4) + Meta Pixel z respektowaniem cookie consent

**Infrastruktura:**
- [ ] Deploy na VPS (Nginx + PM2 lub Coolify)
- [ ] SSL Let's Encrypt
- [ ] Backupy automatyczne (codziennie, retention 30 dni, kopia off-site)
- [ ] Monitoring (Sentry + Uptime Kuma)

### 9.2 Post-MVP (po pierwszych klientach)

**Płatności:**
- [ ] Stripe Subscriptions z 3 pakietami
- [ ] Stripe Customer Portal
- [ ] Fakturownia API integration
- [ ] Mini-panel klienta (subskrypcja, faktury, link do AnyDesk)

**Chat AI:**
- [ ] Widget chat z Claude Haiku 4.5
- [ ] System prompt z kontekstem bambooit
- [ ] Function calling: submit_lead, recommend_package, submit_audit
- [ ] Rate limiting per IP

**Content:**
- [ ] Blog MDX setup
- [ ] 5 startowych wpisów (1 na branżę + 2 ogólne)
- [ ] RSS feed, kategorie, tagi

**Podstrony usług:**
- [ ] `/strony-internetowe`
- [ ] `/aplikacje`
- [ ] `/automatyzacje`

### 9.3 Future (faza 3+)

- Headless CMS dla bloga (jeśli wolumen pisania wzrośnie)
- Panel klienta z ticketami (jeśli skala >50 aktywnych)
- Automatyczne raporty stanu IT (cron + PDF + email)
- Newsletter system (Resend Broadcast)
- Self-service onboarding (klient sam zakłada konto, wybiera pakiet, płaci, dostaje dostępy)
- Aplikacja mobilna (jeśli będzie potrzeba)

---

## 10. Compliance i prawne

### 10.1 RODO/GDPR

- **DPA** podpisywane z każdym klientem abonamentowym (przetwarzanie ich danych personalnych przez bambooit)
- **Sub-procesorzy** wymienieni publicznie (Stripe, Fakturownia, Resend, Anthropic, Sentry, VPS hosting)
- **Polityka retencji**: 3 lata po zakończeniu współpracy (zgodnie z księgowymi wymogami) + procedury usuwania
- **DSAR** (Data Subject Access Request) — endpoint w aplikacji + procedura ręczna
- **Procedura wycieku**: dokumentowana, czas zgłoszenia do PUODO <72h

### 10.2 Wymogi formalne (Polska)

- Regulamin świadczenia usług (e-commerce + B2B)
- Regulamin subskrypcji (specyfika płatności cyklicznych)
- Polityka prywatności
- Polityka cookies (z banerem zgody)
- Wzór umowy serwisowej (do podpisu z klientami)
- Faktura VAT zgodna z polskimi przepisami (Fakturownia ogarnia)

### 10.3 Tajemnice klienta

- **Klienci z kancelarii prawnych** — pełnomocnictwo do dostępu do urządzeń + zachowanie tajemnicy adwokackiej
- **Klienci z gabinetów lekarskich** — uwaga na dane medyczne (dodatkowe wymogi)
- **Klienci z biur księgowych** — dane finansowe klientów ich klientów (cascading)
- **NDA na życzenie** — gotowy szablon do podpisania

---

## 11. Ryzyka i mitygacje

### 11.1 Ryzyko: Wypalenie zespołu 2-osobowego

**Sygnały**: oba weekendy w miesiącu w pracy, telefony z klientami po 20:00, brak urlopu >6 mies.

**Mitygacja**:
- Jasne godziny pracy w komunikacji z klientami (8-18 dni robocze)
- Pomoc poza godzinami — tylko dla pakietu Firma Plus (ze stosownym cennikiem za pracę nocną/weekend)
- Wzajemne backup w urlopach
- W razie sygnałów: zatrudnienie juniora albo zamknięcie nowych klientów

### 11.2 Ryzyko: Zbyt szybki wzrost obsługa IT > moce przerobowe

**Sygnały**: czas reakcji systematycznie poza SLA, klienci niezadowoleni, kolejka >5 ticketów otwartych ponad 24h.

**Mitygacja**:
- Limit aktywnych klientów na początku (np. max 20-25)
- Lista oczekujących zamiast onboardingu na siłę
- Wczesna rekrutacja juniora gdy zbliżamy się do limitu

### 11.3 Ryzyko: Klient toksyczny

**Sygnały**: krzyk, nadmiarowe żądania, brak płatności w terminie, próby wymuszenia darmowej pracy "bo i tak płacimy abonament".

**Mitygacja**:
- W regulaminie: zasady eskalacji, prawo do rozwiązania umowy
- Komunikacja non-violent: jasne zasady od pierwszego incydentu
- Rozstanie się z toksycznym klientem zanim zatruje atmosferę

### 11.4 Ryzyko: Vendor lock-in / awarie infrastruktury

**Sygnały**: Stripe pada, Anthropic przestaje działać, VPS pada, domena wygasa.

**Mitygacja**:
- Backupy offsite (Backblaze B2)
- Monitoring zewnętrzny (Uptime Kuma + Better Stack)
- Auto-renewal domeny ustawiony
- Plan B dla każdej zewnętrznej usługi (alternatywni dostawcy)
- Procedura odzyskiwania: udokumentowana, testowana raz na pół roku

### 11.5 Ryzyko: Niewypłacalność klienta

**Sygnały**: niezapłacone 2 kolejne faktury, klient nie odbiera telefonów.

**Mitygacja**:
- Stripe automatycznie zawiesza subskrypcję po 3 nieudanych próbach
- Manualna ścieżka: 1. przypomnienie, 2. wstrzymanie usług, 3. wezwanie do zapłaty, 4. windykacja
- W regulaminie: zasady i terminy windykacji

---

## 12. Plan komunikacji startowej (launch)

### 12.1 Co przed publicznym ogłoszeniem

- [ ] Strona MVP wdrożona na produkcji
- [ ] Co najmniej 1 case study lub testimonial (od beta klienta)
- [ ] Profile LinkedIn obu członków zespołu zaktualizowane
- [ ] Logo + identyfikacja wizualna (folder design assets)
- [ ] Zdjęcia zespołu (profesjonalne, nie selfie z telefonu)

### 12.2 Launch checklist

- [ ] Post na LinkedIn (Wirgiliusz + Remigiusz, oba profile)
- [ ] Post na lokalnych grupach FB Wrocław (biznes, przedsiębiorcy)
- [ ] Mailing do networku osobistego (rodzina, znajomi, byli klienci)
- [ ] Newsletter do bazy e-dietetyk (jeśli relevantny)
- [ ] Pierwsze 5 wpisów blogowych opublikowanych w ciągu 30 dni
- [ ] Reklamy Meta/Google: NIE od razu (najpierw organiczny ruch)

### 12.3 Pierwsze 90 dni

**Miesiąc 1**: zdobycie 2-3 pierwszych klientów (z networku osobistego)
**Miesiąc 2**: zdobycie 3-5 klientów z SEO/poleceń, pierwsze testimoniale
**Miesiąc 3**: skalowanie kanałów które działają, ewentualne pierwsze płatne reklamy

---

## 13. Dalsze kroki

### 13.1 Co jeszcze zostało do ustalenia

- [ ] **Domena**: zweryfikować dostępność `bambooit.pl`, `bambooit.com`, kupić
- [ ] **Logo + identyfikacja**: zaprojektować lub zlecić projektantowi
- [ ] **Zdjęcia zespołu**: session fotograficzna
- [ ] **Treść regulaminów**: przegląd przez prawnika (radca prawny do umów B2B)
- [ ] **Numer telefonu firmowy**: VOIP lub IP-PBX (np. eVoip, FCN)
- [ ] **Email firmowy**: konfiguracja Resend domain (`hello@bambooit.pl`, `remigiusz@`, `wirgiliusz@`)
- [ ] **Konto Stripe**: założyć, zweryfikować polskie KYC
- [ ] **Konto Fakturownia**: założyć, skonfigurować dane firmy
- [ ] **Konto Anthropic API**: założyć osobne dla bambooit (rozróżnienie kosztów)
- [ ] **VPS**: zweryfikować że obecny ma moc na drugą aplikację, ewentualnie upgrade
- [ ] **DPA template**: przygotować szablon do podpisu z klientami

### 13.2 Co już zostało zrobione

- [x] Decyzja: custom Next.js zamiast WordPress
- [x] Klon repo z e-dietetyk jako starter
- [x] Plan czyszczenia kodu (PLAN_CZYSZCZENIA.md)
- [x] Mockup wizualny strony głównej (bambooit-netguru-v3.html)
- [x] Mockup podstrony o nas (o-nas.html)
- [x] Decyzje cenowe (390 / 690 / 1190 zł)
- [x] Decyzje stacku
- [x] CLAUDE.md (kontekst projektowy dla AI)
- [x] PRD.md (ten dokument)

---

## 14. Glossary

| Termin | Znaczenie |
|--------|-----------|
| MVP | Minimum Viable Product — pierwsza wersja produkcyjna |
| MRR | Monthly Recurring Revenue — przychód cykliczny z subskrypcji |
| Churn | Odejście klienta (anulowanie subskrypcji) |
| SLA | Service Level Agreement — gwarantowany poziom usług (np. czas reakcji) |
| TOF/MOF/BOF | Top/Middle/Bottom of Funnel — etap lejka sprzedażowego |
| DSAR | Data Subject Access Request — prawo użytkownika do swoich danych (RODO) |
| DPA | Data Processing Agreement — umowa o powierzeniu przetwarzania danych |
| KYC | Know Your Customer — weryfikacja tożsamości (Stripe wymaga) |
| Cross-sell | Sprzedaż dodatkowych produktów istniejącym klientom |
| Up-sell | Sprzedaż wyższego pakietu istniejącemu klientowi |
| SMB / MŚP | Small/Medium Business / Małe i Średnie Przedsiębiorstwa |

---

**Ten dokument jest żywy. Aktualizujemy gdy zmienia się model biznesowy, ceny, target.**
