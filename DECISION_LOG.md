# DECISION_LOG.md — bambooIT

> **Zapis wszystkich istotnych decyzji strategicznych, biznesowych i architektonicznych** podjętych w trakcie rozmów koncepcyjnych. Każda decyzja ma kontekst (skąd się wzięła), uzasadnienie (dlaczego tak a nie inaczej) i ewentualne odrzucone alternatywy.

**Cel pliku:** Claude Code czyta ten dokument przy każdej sesji żeby rozumieć *dlaczego* projekt jest taki jaki jest, nie tylko *co* jest do zrobienia. Bez tego dokumentu — co kilka tygodni ktoś (Ty, Claude Code, nowy dev) będzie zadawał te same pytania ("dlaczego npm a nie pnpm?", "dlaczego brak multi-tenancy?").

**Ostatnia aktualizacja:** 2026-05-11

---

## Spis decyzji

- [D-001: Custom Next.js zamiast WordPress](#d-001)
- [D-002: Nowy projekt bambooIT zamiast forku e-dietetyk](#d-002)
- [D-003: Mimo wszystko klon e-dietetyk jako starter (wariant B)](#d-003)
- [D-004: Nazwa: bambooit](#d-004)
- [D-005: Zespół 2-osobowy: Remigiusz + Wirgiliusz](#d-005)
- [D-006: Cztery filary usług](#d-006)
- [D-007: Cennik abonamentu: 390 / 690 / 1190 zł netto](#d-007)
- [D-008: 2h/5h/10h zamiast "bez limitu" w pakiecie Start](#d-008)
- [D-009: Niewykorzystane godziny NIE przechodzą na kolejny miesiąc](#d-009)
- [D-010: Strony i aplikacje — wycena indywidualna z widełkami](#d-010)
- [D-011: Automatyzacje — mix pakietów i wycen indywidualnych](#d-011)
- [D-012: 15% rabatu na projekty dla klientów abonamentu](#d-012)
- [D-013: Hosting na VPS współdzielonym z e-dietetyk](#d-013)
- [D-014: Osobna baza PostgreSQL z osobnym user dla bambooIT](#d-014)
- [D-015: npm workspaces, NIE pnpm](#d-015)
- [D-016: Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui](#d-016)
- [D-017: Express backend zamiast Next.js API routes](#d-017)
- [D-018: Stripe Subscriptions + Customer Portal](#d-018)
- [D-019: Fakturownia jako jedyne źródło faktur VAT](#d-019)
- [D-020: Resend dla maili transakcyjnych](#d-020)
- [D-021: Anthropic API (Claude Haiku 4.5) dla chatu — own build, not Tidio](#d-021)
- [D-022: MDX dla bloga, NIE headless CMS](#d-022)
- [D-023: i18n z PL + EN stub (EN wyłączone, opcja na przyszłość)](#d-023)
- [D-024: Brak roli AGENT — tylko ADMIN + CLIENT](#d-024)
- [D-025: Brak multi-tenancy (skasować Tenant model)](#d-025)
- [D-026: Brak własnego systemu ticketów w MVP](#d-026)
- [D-027: Brak mini-panelu klienta z liczeniem godzin](#d-027)
- [D-028: Bambooit-netguru-v3 jako mockup design reference](#d-028)
- [D-029: Sekcja "Pełne wsparcie" + sekcja "Obsługa IT deep dive"](#d-029)
- [D-030: Sekcja zespołu na podstronie /o-nas, mała wzmianka na głównej](#d-030)
- [D-031: MVP scope (marketing + audyt) vs Post-MVP (Stripe, chat, panel)](#d-031)
- [D-032: Target user: 1-30 osób, biura księgowe / kancelarie / gabinety](#d-032)
- [D-033: Anti-persona: korporacje, startupy techniczne, mikrofirmy budget 0-200 zł](#d-033)
- [D-034: AnyDesk/RustDesk — wariant A (linki do oficjalnych stron, nie własny hosting)](#d-034)
- [D-035: Conventional Commits + osobne migracje Prisma](#d-035)
- [D-036: Cleanup w 14 commitach (split przez routes/controllers/services)](#d-036)
- [D-037: Komentowanie z TODO zamiast usuwania w cross-cutting plikach](#d-037)
- [D-038: Zostawiamy Testimonial, Referral, AiCostLog jako infrastrukturę](#d-038)
- [D-039: Zostawiamy dietitianReport.service jako szkielet pod internalReport](#d-039)
- [D-040: data/ (281 MB CIQUAL) — usunąć bezwarunkowo](#d-040)

---

## D-001: Custom Next.js zamiast WordPress

**Kontekst:** Wybór technologii dla strony bambooit. Klient (Twój wspólnik Remigiusz) miał oryginalnie spec z założeniem WordPress + WooCommerce + Subscriptions plugin.

**Decyzja:** Idziemy w custom Next.js 15.

**Uzasadnienie:**
- **Twoje doświadczenie** — pracujesz w Next.js codziennie (e-dietetyk), WordPress to dodatkowa krzywa uczenia
- **Pełna kontrola** — żadnych ograniczeń pluginów, żadnych aktualizacji łamiących site
- **Wydajność** — Next.js + Vercel/VPS = <1s ładowanie, świetne SEO, Core Web Vitals
- **Bezpieczeństwo** — brak typowych dziur WordPress (xmlrpc, brute force wp-admin, podatne pluginy)
- **Skalowalność** — łatwiej dorzucać feature'y kodem niż szukać pluginów
- **Reużywalność** — komponenty i hooki przeniesiesz do innych projektów

**Odrzucone:**
- WordPress + WooCommerce + Subscriptions plugin — tańszy MVP (12-20k zł), ale wyższy koszt utrzymania, pluginy wymagające miesięcznych aktualizacji, ograniczenia subscription logic dla B2B SMB
- WooCommerce + SureCart — mniej dojrzały ekosystem polski

**Wpływ na wycenę:** custom +10-15k netto vs WordPress, ale klient dostaje produkt na lata, nie quick & dirty.

---

## D-002: Nowy projekt bambooIT zamiast forku e-dietetyk

**Kontekst:** Pytanie czy budować nowy projekt od zera, czy forkować e-dietetyk i wycinać niepotrzebne części.

**Decyzja początkowa (pierwsze rozmowy):** Nowy projekt od zera z e-dietetyk jako *wzorcem* (nie forkiem).

**Uzasadnienie:**
- e-dietetyk to Twój własny SaaS w produkcji — nie wolno go mieszać z projektem klienta
- 70-80% e-dietetyk (solver, plany żywieniowe, baza produktów) jest do *wyrzucenia* — więcej kodu usuwasz niż reużywasz
- Inny model produktowy (SaaS multi-tenant dla dietetyków vs strona sprzedażowa B2B)
- Klient powinien dostać czyste repo bez historii Twojego SaaS-u

**Status:** Decyzja zmieniona — patrz D-003.

---

## D-003: Mimo wszystko klon e-dietetyk jako starter (wariant B)

**Kontekst:** Po dyskusji argumentów za nowym projektem, zdecydowałeś że szybciej będzie sklonować dev-bazę i wyciąć niepotrzebne, niż pisać od zera to co już działa (Stripe, NextAuth, RODO, anti-abuse, audyt).

**Decyzja:** Wariant B — klon `DietetykDEV` do `bambooIT`, świeży git init (czysta historia), świeże repo na GitHub.

**Uzasadnienie:**
- Działający kod jest cenniejszy niż czysta architektura na papierze
- Stripe + NextAuth + Resend + Sentry + RODO + anti-abuse to **tygodnie pracy** w e-dietetyk — reużywalne w bambooIT bez modyfikacji
- Historia git e-dietetyk nie wycieka (świeży `git init`)
- bambooIT to **Twój** drugi projekt (nie klienta) — repo jest Twoje, więc reużywanie infrastruktury jest OK
- Klonowanie z dev, nie produkcji — produkcyjne e-dietetyk bezpieczne

**Warunki bezpieczeństwa:**
- Najpierw klonowanie, potem czyszczenie (zachowanie e-dietetyk-dev jako backup)
- Świeży git init, nowe repo, nowa baza
- Sekrety (.env) nie kopiujemy — tylko .env.example

**Wpływ:** Oszczędność ~3-5 dni pracy vs nowy projekt. Cost: konieczność systematycznego cleanupu (14 commitów wg PLAN_CZYSZCZENIA.md).

---

## D-004: Nazwa: bambooit

**Kontekst:** Potrzebowaliśmy nazwy firmy/projektu.

**Decyzja:** `bambooit` (małymi literami w UI: "Bambooit").

**Uzasadnienie:**
- Bambus rośnie powoli, ale po wyrośnięciu jest **elastyczny i nie do złamania**. Tak powinna działać technologia w firmie klienta.
- "IT" w nazwie jasno komunikuje branżę
- "Bamboo" przyjazne, zielone, eco-vibe (paleta projektu nawiązuje: zielony akcent)
- Nie sklepowe ("Naprawa Komputerów Wrocław"), nie korporacyjne

**Ostrzeżenia (do uwagi):**
- Sprawdzić dostępność `bambooit.pl` i `bambooit.com`
- Konflikt brand z "BambooHR" (HR SaaS, niespokrewniona firma) — niekrytyczne, ale czasem ludzie mylą

**Status weryfikacji domeny:** [TBD]

---

## D-005: Zespół 2-osobowy: Remigiusz + Wirgiliusz

**Kontekst:** Początkowo rozważaliśmy 3-osobowy zespół (oddzielne osoby od stron, aplikacji, automatyzacji). Ostatecznie potwierdziłeś 2 osoby.

**Decyzja:**
- **Remigiusz** — Obsługa IT (abonamenty, helpdesk, pomoc zdalna, sieci, M365)
- **Wirgiliusz** — Strony, aplikacje webowe, automatyzacje procesów (Next.js, n8n, Make)

**Bio (zatwierdzone do mockupów):**

> **Remigiusz** — Opiekuje się obsługą IT i pakietami abonamentowymi. Od lat rozwiązuje codzienne problemy techniczne małych firm — od drukarek i poczty, po sieci, bezpieczeństwo i konfigurację stanowisk. Twoja pierwsza linia kontaktu, gdy coś przestaje działać.

> **Wirgiliusz** — Buduje strony internetowe, aplikacje webowe i automatyzacje procesów. Pracuje w nowoczesnych technologiach (Next.js, React, n8n, Make). Twórca SaaS-u e-dietetyk.com dla profesjonalnych dietetyków. Twój partner, gdy firma rośnie i potrzebuje czegoś więcej niż gotowca z internetu.

**Wpływ na komunikację:**
- Pozycjonowanie: "Dwie osoby. Dwie specjalizacje. Jeden kontakt."
- "Bez infolinii" jako pillar komunikacji
- Sekcja zespołu na /o-nas + krótka wzmianka na głównej

**Skalowanie:** plan rozważyć 3 osobę w 12-18 miesięcy, kierunek zależny od który filar rośnie najszybciej.

---

## D-006: Cztery filary usług

**Kontekst:** Pierwotnie strona miała sprzedawać tylko obsługę IT (zgodnie ze spec klienta). W trakcie rozmowy dodałeś trzy kolejne usługi: strony, aplikacje, automatyzacje.

**Decyzja:** Cztery filary, ale **z różnym ciężarem komunikacyjnym** (opcja C z naszej dyskusji):

1. **Obsługa IT** — flagship, abonament, widoczna w hero, pełna sekcja deep dive
2. **Strony internetowe** — cross-sell, podstrona `/strony-internetowe`
3. **Aplikacje na zamówienie** — cross-sell, podstrona `/aplikacje`
4. **Automatyzacje procesów** — cross-sell, podstrona `/automatyzacje`

**Uzasadnienie tego balansu (a nie pełnej agencji 4 równe):**
- Pełna agencja "robimy wszystko" → rozmycie pozycjonowania, niższa konwersja
- Tylko obsługa IT → tracimy leady od osób szukających stron/aplikacji/automatyzacji
- Hybryda (opcja C) → najjasniejsza dla księgowej (widzi abonament IT), nie tracimy też devów szukających aplikacji

**Wpływ na stronę:**
- Sekcja "Cztery filary, jeden partner" zaraz po hero, z **Obsługą IT jako featured card**
- Pozostałe 3 usługi mają własne podstrony z lead-magnet (audyt procesów dla automatyzacji, bezpłatna rozmowa dla stron/aplikacji)
- W menu: dropdown "Usługi" z 4 podstronami

---

## D-007: Cennik abonamentu: 390 / 690 / 1190 zł netto

**Kontekst:** Mockup wstępnie miał ceny 499/999/1899 (z stylu netguru). Po dyskusji obniżyliśmy.

**Decyzja:**
- **Start:** 390 zł netto/mies, do 3 stanowisk, 2h wsparcia
- **Firma:** 690 zł netto/mies, do 7 stanowisk, 5h wsparcia (najczęściej wybierany)
- **Firma Plus:** 1190 zł netto/mies, 8-15 stanowisk, 10h wsparcia
- **Enterprise:** wycena indywidualna, 16+ stanowisk

**Uzasadnienie:**
- Te ceny były od początku omawiane, mockup miał placeholdery
- 390 zł to **dolna granica rentowności** dla Start (195 zł/h przy 2h) — chroni przed nadużyciem
- 690 zł sweet spot dla 5-7 osobowych firm (księgowa, kancelaria) — najczęstszy target
- 1190 zł dla większych firm z priorytetem reakcji

**Ostrzeżenia:**
- Start jest "lejkiem wejściowym" — niska marża, ma przyciągnąć klienta do Firma w 6-12 mies (up-sell)
- Nie pozwalać "bez limitu zgłoszeń" w żadnym pakiecie — zawsze konkretne godziny

---

## D-008: 2h/5h/10h zamiast "bez limitu" w pakiecie Start

**Kontekst:** Mockup w sekcji pricing dla Start miał frazę "Pomoc zdalna 8-18" bez limitu godzin (sugestywnie unlimited).

**Decyzja:** Wszystkie pakiety mają **konkretny limit godzin miesięcznie**:
- Start: 2h
- Firma: 5h
- Firma Plus: 10h

**Uzasadnienie:**
- Przy 390 zł/mies, "bez limitu" = ekonomiczne samobójstwo (klient z 5 awariami w tygodniu = strata)
- Konkretne godziny = przewidywalna rentowność per klient
- Nadgodziny rozliczane osobno (150 zł netto/h) — patrz D-009

**Wpływ na regulamin:** w warunkach świadczenia usług konkretnie napisać limit godzin + procedurę nadgodzin.

---

## D-009: Niewykorzystane godziny NIE przechodzą na kolejny miesiąc

**Kontekst:** Typowe pytanie klienta: "co jeśli nie wykorzystam swoich 5h?"

**Decyzja:** Niewykorzystane godziny **przepadają z końcem miesiąca**. Dodatkowe godziny ponad pakiet: **150 zł netto/h**, fakturowane osobno.

**Uzasadnienie:**
- Chroni rentowność — bez tego klient może "oszczędzać" godziny i zażądać 20h w jednym miesiącu
- Standard branżowy dla abonamentów IT (Cisco managed services, większość MSP)
- Klient dostaje *gotowość* (czas reakcji), nie *zapas* godzin
- Prostsze do rozliczenia w arkuszu / CRM

**Wpływ na regulamin:** explicite zapisane.

---

## D-010: Strony i aplikacje — wycena indywidualna z widełkami

**Kontekst:** Pytanie czy strony i aplikacje mają stały cennik (jak abonament) czy wycenę indywidualną.

**Decyzja:** Wycena indywidualna z **widełkami widocznymi na stronie**:

**Strony internetowe:**
- Wizytówka / landing: 4-8 tys. zł netto
- Strona firmowa: 10-18 tys. zł netto
- Sklep / aplikacja webowa: 20-40 tys. zł netto
- Powyżej: indywidualnie

**Aplikacje:**
- Małe aplikacje: 25-50 tys. zł netto
- Średnie projekty: 50-150 tys. zł netto
- Duże projekty: 150 tys.+ zł netto

**Uzasadnienie:**
- Strony i aplikacje są zbyt różnorodne na fixed pricing
- Ale klient szukający "ile to kosztuje" musi **widzieć rząd wielkości** — inaczej odbija się i idzie do konkurencji z widocznym cennikiem
- Widełki + "wycena po rozmowie/warsztacie" = balans transparentności i elastyczności

**Wpływ:** podstrony `/strony-internetowe` i `/aplikacje` mają widełki w sekcji "Ile to kosztuje" + jasny CTA "Umów rozmowę" / "Umów warsztat scopingowy".

---

## D-011: Automatyzacje — mix pakietów i wycen indywidualnych

**Kontekst:** Czy automatyzacje wycenać tak jak strony (widełki) czy spakować w produkty.

**Decyzja:** **Mix** — małe procesy w pakietach, duże indywidualnie:

- **Audyt procesów:** 1500 zł netto (zaliczane do dalszego projektu)
- **Mała automatyzacja** (1 proces): od 2500 zł netto
- **Pakiet automatyzacji** (3-5 procesów): od 8000 zł netto
- **Duże projekty:** wycena indywidualna
- **Utrzymanie:** od 200 zł/mies

**Uzasadnienie:**
- Automatyzacje są bardziej "produktowe" niż custom apps — można spakować
- Audyt jako lead magnet (jak audyt IT)
- Utrzymanie = revenue recurring po projekcie

---

## D-012: 15% rabatu na projekty dla klientów abonamentu

**Kontekst:** Pytanie jak ramować cross-sell żeby zachęcać klientów abonamentu do dokupowania projektów.

**Decyzja:** **15% rabatu na strony/aplikacje/automatyzacje dla aktywnych klientów abonamentu IT.**

**Uzasadnienie:**
- Tworzy lejek: klient zaczyna od abonamentu (niski koszt wejścia) → po roku ufania dokupuje projekt
- 15% to "psychologiczna granica" — wystarczy żeby zauważyć, nie tak dużo żeby psuło marżę
- Komunikat na stronie głównej (dolne CTA / sticky bar): *"Klient abonamentu IT? Strony, aplikacje i automatyzacje wyceniamy z 15% rabatem."*

**Wpływ:** zapisane w PRD.md sekcja 5.3 (cross-sell).

---

## D-013: Hosting na VPS współdzielonym z e-dietetyk

**Kontekst:** Pytanie czy bambooIT ma być na osobnym VPS, czy współdzielić z e-dietetyk.

**Decyzja:** **Współdzielony VPS, ale z pełną izolacją:**

- Osobny port aplikacji (np. 3001 dla bambooit, 3000 dla e-dietetyk)
- Osobny user systemowy
- Osobny katalog (`/var/www/bambooit`)
- Osobna baza PostgreSQL (`bambooit_prod`)
- Osobny user PostgreSQL z dostępem tylko do swojej bazy
- Osobny `.env` z osobnymi sekretami
- Osobny serwis systemd / proces PM2
- Wspólny Nginx jako reverse proxy (różne `server_name`)
- Wspólny Postgres server (różne bazy)

**Uzasadnienie:**
- Niższy koszt (jeden VPS zamiast dwóch)
- Łatwiejsze zarządzanie (jedno miejsce aktualizacji, monitoring)
- Wystarczająca izolacja przy osobnych user/db
- Re-evaluacja gdy ruch bambooIT zacznie ciążyć e-dietetyk

**Wymagania VPS:** minimum 4 GB RAM + 2 vCPU (komfort: 8 GB / 4 vCPU).

**Rekomendacja narzędzia deploymentu:** Coolify (self-hosted PaaS, jak Vercel ale na własnym VPS) — jeśli planujesz 3+ projektów. Alternatywa: ręczny Nginx + PM2.

---

## D-014: Osobna baza PostgreSQL z osobnym user dla bambooIT

**Kontekst:** Bezpieczeństwo i izolacja danych klientów bambooIT vs e-dietetyk.

**Decyzja:** Osobna baza, osobny user, osobne hasło.

- **Baza dev:** `bambooit_dev`
- **Baza prod:** `bambooit_prod`
- **User:** `bambooit_user` z `GRANT` tylko na te bazy
- **Hasło:** silne, różne dla dev i prod, różne od e-dietetyk

**Uzasadnienie:**
- Compromise bambooit nie sięga do danych e-dietetyk (i odwrotnie)
- Backupy osobne, retention osobny
- Łatwiej migrować jedno na drugą maszynę gdy zajdzie potrzeba
- Wymóg RODO: dane różnych biznesów osobno
- **Bezpieczeństwo:** różne hasła to safety net — pomyłka w `DATABASE_URL` bambooit nie da się zalogować do e-dietetyk

---

## D-015: npm workspaces, NIE pnpm

**Kontekst:** Pierwotnie planowaliśmy pnpm (szybsze, mniejsze `node_modules`). Po klonowaniu okazało się że e-dietetyk używa npm workspaces.

**Decyzja:** Zostajemy na **npm + workspaces**.

**Uzasadnienie:**
- Migracja na pnpm w trakcie cleanupu = osobny projekt (regeneracja lockfile, weryfikacja workspaces, testy, deploy)
- npm workspaces jest wystarczające dla 2-osobowego zespołu
- Mniejsze ryzyko niż wprowadzenie nowego toolingu jednocześnie z cleanupem

**Status:** Migracja na pnpm to potencjalny **future ticket** (niski priorytet, post-MVP).

**Wpływ na CLAUDE.md:** komendy używają `npm run`, nie `pnpm`.

---

## D-016: Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui

**Kontekst:** Stack frontendu.

**Decyzja:** Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui (jak w e-dietetyk).

**Uzasadnienie:**
- Spójność z e-dietetyk (re-use komponentów, hooków, konwencji)
- App Router to obecny standard Next.js 15
- shadcn/ui = high quality komponenty z możliwością customizacji
- Tailwind = szybkie prototypowanie + spójność z mockupem netguru

**Odrzucone:**
- Remix / SvelteKit / Astro — Twoje doświadczenie jest w Next.js
- Vue / Nuxt — to samo
- Pages Router — przestarzały dla nowych projektów

---

## D-017: Express backend zamiast Next.js API routes

**Kontekst:** Mając Next.js, czemu osobny backend Express?

**Decyzja:** Express jako osobny backend (re-use z e-dietetyk).

**Uzasadnienie:**
- Re-use z e-dietetyk — Stripe, NextAuth, Resend, anti-abuse, audit, DSAR są w Express
- Niezależne skalowanie (backend i frontend mogą iść na osobne kontenery)
- Jaśniejszy podział odpowiedzialności (Express = business logic, Next.js = UI + BFF)
- API routes Next.js byłyby OK dla prostych projektów, ale tu mamy złożoną domenę

**Odrzucone:**
- Tylko Next.js API routes — utrata re-use z e-dietetyk = wiele tygodni pracy
- Hono / Fastify — Express jest standardem, e-dietetyk go używa

**Wpływ:** monorepo z `apps/web` + `apps/backend` + `packages/database`.

---

## D-018: Stripe Subscriptions + Customer Portal

**Kontekst:** Płatności cykliczne dla abonamentu IT.

**Decyzja:** Stripe Subscriptions dla pakietów + Stripe Customer Portal dla zarządzania subskrypcją.

**Uzasadnienie:**
- Stripe robi cykliczność lepiej niż custom (retry logic, failed payments, dunning)
- **Customer Portal** = zero kodu po stronie frontend dla zarządzania subskrypcją (zmiana karty, anulowanie, zmiana pakietu)
- Polish KYC support (Stripe akceptuje polskie firmy)
- Webhooks już zaimplementowane w e-dietetyk — re-use

**Odrzucone:**
- Przelewy24 / PayU — gorsza dokumentacja API, brak Customer Portal
- Własne UI subskrypcji — kompletna strata czasu vs gotowe Customer Portal

**Konfiguracja Stripe:**
- Konto Polska
- VAT mode: tax inclusive (Stripe Tax)
- Currency: PLN
- 3 products: START, FIRMA, FIRMA_PLUS, każde z miesięcznym price

---

## D-019: Fakturownia jako jedyne źródło faktur VAT

**Kontekst:** Polski VAT, JPK, klient potrzebuje faktur VAT dla księgowości.

**Decyzja:** Fakturownia API jako jedyne źródło faktur. Lokalna tabela `Invoice` to *cache* (mirror), nie źródło prawdy.

**Uzasadnienie:**
- Fakturownia spełnia wszystkie polskie wymogi (numeracja, JPK, korekty, kopie elektroniczne)
- Klient księgowy może bezpośrednio pobrać dane z Fakturowni
- Tańsze niż własne generowanie PDF + zgodność prawna
- Po Stripe `invoice.payment_succeeded` webhook tworzy fakturę w Fakturowni automatycznie

**Odrzucone:**
- wFirma / iFirma / InFakt — Fakturownia ma najlepsze API i plugin do WordPress (gdybyśmy zmienili decyzję)
- Własne generowanie PDF — non-compliance ryzyko + utrzymanie templatów

**Webhook flow:**
```
Stripe invoice.payment_succeeded
  → backend webhook handler
  → POST Fakturownia API (create invoice)
  → save Invoice record (cache)
  → Resend send PDF to klient
```

---

## D-020: Resend dla maili transakcyjnych

**Kontekst:** Mail powitalny, faktury, audyty, recovery.

**Decyzja:** Resend (re-use z e-dietetyk).

**Uzasadnienie:**
- Świetna deliverability (lepsza niż SendGrid w PL)
- Polski domain `bambooit.pl` jako sender
- React Email integration (templates jako komponenty)
- Free tier wystarcza dla MVP (100/day)

**Plan domeny:**
- `noreply@bambooit.pl` — transakcyjne
- `hello@bambooit.pl` — leady, formularz audytu, kontakt
- `remigiusz@`, `wirgiliusz@` — osobiste

---

## D-021: Anthropic API (Claude Haiku 4.5) dla chatu — own build, not Tidio

**Kontekst:** Spec klienta wspominała o live chat AI. Opcje: gotowiec (Tidio, Chatbase, Intercom) vs własna implementacja na Anthropic API.

**Decyzja:** **Własna implementacja** na Anthropic SDK + Claude Haiku 4.5.

**Uzasadnienie:**
- Tańsze long-term (Tidio ~100 zł/mies, Anthropic API ~20-100 zł/mies w zależności od użycia)
- Pełna kontrola system promptu (możemy wpisać dokładnie ofertę bambooit, ograniczenia, function calling do leadów)
- Function calling: `submit_lead`, `recommend_package`, `submit_audit_request` — zbieranie danych podczas konwersacji
- Spójność wizualna (własny widget zamiast brandingu Tidio)
- Re-use własnego know-how z e-dietetyk (już jest Anthropic SDK)

**Odrzucone:**
- Tidio / Chatbase / Intercom — zewnętrzny branding, koszty rosną z volumes
- OpenAI — droższe, mniej kontroli, gorszy dla polskich treści

**Konfiguracja:**
- Model: Claude Haiku 4.5 (tani, szybki, wystarczający dla customer service)
- System prompt z kontekstem bambooit (pakiety, kompetencje, ograniczenia: nie obiecuj czasu reakcji poza pakietem, nie diagnozuj poważnych awarii, nie udawaj człowieka)
- Streaming odpowiedzi
- Rate limiting per IP (anti-abuse z e-dietetyk)
- Cost tracking w `AiCostLog` / `AiUsageLog`

**Wpływ:** Post-MVP feature (fazy 2-3, po stronie marketing + Stripe).

---

## D-022: MDX dla bloga, NIE headless CMS

**Kontekst:** Blog jest kluczowy dla SEO (content marketing). Pytanie czy MDX (pliki w repo) czy headless CMS (Sanity, Payload).

**Decyzja:** **MDX w repo**. Pliki `content/blog/*.mdx`.

**Uzasadnienie:**
- Pisarzami są Remigiusz i Wirgiliusz (2 osoby) — Sanity/Payload to overkill dla tej skali
- Git jako CMS = wersjonowanie i revert za darmo
- Frontmatter (YAML) dla meta: title, date, category, excerpt, image
- Code blocks z syntax highlighting natywnie (Shiki)
- Następna iteracja może dorzucić Sanity jeśli pojawią się więcej autorów

**Odrzucone:**
- Sanity — overkill, +50 zł/mies za nic
- Payload CMS — overkill dla 2 autorów
- Ghost — osobny system, separate hosting

**Edycja:** Wirgiliusz edytuje przez VS Code + git commit. Remigiusz może przez GitHub web UI (basic markdown).

---

## D-023: i18n z PL + EN stub (EN wyłączone, opcja na przyszłość)

**Kontekst:** e-dietetyk ma next-intl z PL + EN. Bambooit target jest PL-only. Pytanie czy usuwać i18n.

**Decyzja:** **Zostawić next-intl + PL + EN, ale EN wyłączone w `i18n/config.ts`** (tylko PL aktywne).

**Uzasadnienie:**
- Klienci docelowi są PL-only (SMB Wrocław + Polska)
- ALE usuwanie next-intl to wielogodzinna operacja na całym kodzie
- Dodawanie i18n z powrotem za rok jeszcze gorsza (refactor wszystkich tekstów do kluczy)
- Zostawić jako stub: jedna linia w `i18n/config.ts` = włączamy EN gdy będzie trzeba
- `messages/en.json` pusty/minimalny, `messages/pl.json` z całością treści

**Wpływ na kod:**
- Wszystkie route paths pod `app/[locale]/...`
- Default locale: `pl`
- EN routes zwracają 404 lub redirect do PL (do decyzji podczas implementacji)

---

## D-024: Brak roli AGENT — tylko ADMIN + CLIENT

**Kontekst:** e-dietetyk miał role: PATIENT, DIETITIAN, ADMIN. Dla bambooIT pytanie czy potrzebny jest pośredniczący "AGENT" / "SUPPORT".

**Decyzja:** Tylko **ADMIN + CLIENT**. Bez pośredniej roli.

**Uzasadnienie:**
- Zespół 2-osobowy, oboje są adminami
- Dodawanie roli "na zapas" zwiększa złożoność uprawnień i queries bez wartości biznesowej
- Łatwiej dodać niż zdjąć — jak kiedyś będziecie potrzebować, dorzucicie

**Wpływ na kod:**
- Schema Prisma: enum `UserRole { ADMIN, CLIENT }`
- Wszystkie `requireAuth('ADMIN', 'DIETITIAN')` → `requireAuth('ADMIN')`
- DietitianProfile model — kasujemy w cleanup

---

## D-025: Brak multi-tenancy (skasować Tenant model)

**Kontekst:** e-dietetyk ma `Tenant` model (nullable, nieaktywne) jako przygotowanie na multi-tenancy SaaS.

**Decyzja:** Skasować `Tenant` model w całości.

**Uzasadnienie:**
- Bambooit to klasyczny B2B z konkretnymi klientami-firmami (Company), nie SaaS multi-tenant
- `Company` zastępuje rolę "tenanta" w sensownym znaczeniu
- Pole `tenantId` nullable nieaktywne = bezpieczne do usunięcia
- Refactor pod multi-tenancy w przyszłości byłby wielogodzinny — ale tylko jeśli decyzja biznesowa się zmieni

**Status:** Bambooit nie będzie B2B SaaS multi-tenant. Jeśli kiedyś będzie taki produkt, to **inny projekt**.

---

## D-026: Brak własnego systemu ticketów w MVP

**Kontekst:** Spec klienta wspominała o "panel klienta z ticketami". Custom dev tego = ~10-15k zł dodatkowo.

**Decyzja:** **Brak ticketów w MVP**. Klienci kontaktują się przez:
- Telefon (priority dla aktywnego abonamentu)
- Email (`hello@bambooit.pl`)
- Chat AI (po wdrożeniu w fazie 2)

**Uzasadnienie:**
- Skala 10-30 klientów obsługiwana mailem/telefonem bez problemu
- Liczenie godzin po stronie operatora (arkusz, CRM, Notion) — nie w panelu klienta
- ROI ticket systemu pojawia się przy ~50 aktywnych klientach
- Skraca MVP o ~2-3 tygodnie pracy

**Reevaluacja:** przy ~50 aktywnych klientach. Wtedy: FreeScout / Zammad (open-source) albo custom.

---

## D-027: Brak mini-panelu klienta z liczeniem godzin

**Kontekst:** Spec mówiła o panelu klienta gdzie widzi swój pakiet, wykorzystane godziny, zgłoszenia.

**Decyzja:** **Minimalny panel klienta** w MVP:
- Aktywna subskrypcja (status, data odnowienia)
- Lista faktur (z Fakturowni przez API)
- Link do Stripe Customer Portal (do zmiany karty/anulowania)
- Link do pobrania AnyDesk/RustDesk

**NIE w MVP:**
- Liczenie godzin (po stronie operatora, w arkuszu)
- Historia zgłoszeń (brak ticketów)
- Chat AI w panelu (jest na stronie publicznej)

**Uzasadnienie:**
- Standardowe Woo-style "My Account" wystarczy
- Liczenie godzin w panelu wymagałoby integracji z systemem ticketów (którego nie ma)
- Klient nie potrzebuje codziennie patrzeć ile mu zostało — pyta mailem

---

## D-028: bambooit-netguru-v3 jako mockup design reference

**Kontekst:** Mockup został zaprojektowany w 3 iteracjach (v1 → v2 → v3 z dodatkami).

**Decyzja:** `bambooit-netguru-v3.html` to **finalny design reference**, nie kod produkcyjny.

**Co zawiera:**
- Hero z animowaną pandą SVG
- Sekcja "Cztery filary, jeden partner" z 4 kartami usług
- Marquee (ticker tape)
- Narrative / Manifesto (klasyczny styl netguru)
- Sekcja "Sześć kompetencji, jeden abonament" (deep dive obsługi IT, 6 kart w pin scroll)
- Pricing z 3 pakietami (390/690/1190)
- Process (4 kroki)
- Industries (branże)
- Audit form (lead-gen)
- FAQ
- Final CTA
- Footer

**Paleta:**
- Navy `#2C3E50` (main)
- Navy deep `#1a2735`
- Green `#8BC34A` (akcent)
- Green deep `#6fa336`
- Paper `#f6f4ee` (tło)
- White `#ffffff`

**Fonty:**
- Fraunces (display, serif)
- Archivo (sans)
- JetBrains Mono (mono)

**Implementacja:** Claude Code w fazie A bierze ten mockup jako design reference, implementuje w Next.js + Tailwind + shadcn/ui zachowując paletę i typografię.

---

## D-029: Sekcja "Pełne wsparcie" + sekcja "Obsługa IT deep dive"

**Kontekst:** Mockup pierwotnie miał jedną sekcję `Services` z 6 kartami (pomoc zdalna, monitoring, backup, cyber, M365, sprzęt) — ale to było pomyłka conceptu po dodaniu 4 filarów.

**Decyzja:** **Dwie warstwy sekcji** na stronie głównej:

1. **"Cztery filary, jeden partner"** (sekcja A) — 4 karty (Obsługa IT featured + Strony + Aplikacje + Automatyzacje). Zaraz po hero. *"Co robimy w ogóle?"*

2. **"Sześć kompetencji, jeden abonament"** (sekcja B) — istniejąca z mockupu, 6 kart w pin scroll. Pozycja: gdzie była. Kontekst: *"Deep dive: co konkretnie robimy w abonamencie IT?"*

**Uzasadnienie:**
- Sekcja A łapie wszystkich (4 grupy klientów, w tym pytających o strony/aplikacje/automatyzacje)
- Sekcja B konwertuje zainteresowanych abonamentem
- Hierarchia: ogólnie → szczegółowo

**Wpływ na implementację:** w Next.js obie sekcje jako osobne komponenty.

---

## D-030: Sekcja zespołu na podstronie /o-nas, mała wzmianka na głównej

**Kontekst:** Zespół 2-osobowy to silny argument sprzedażowy. Pytanie czy na głównej czy osobna podstrona.

**Decyzja:** **Oba, ale w różnych ciężarach:**

- **Strona główna:** mała wzmianka (cienka linia tekstu z linkiem) — *"Wszystko obsługuje 2-osobowy zespół: Remigiusz (IT) i Wirgiliusz (strony, aplikacje, automatyzacje). Bez infolinii."* + CTA "Poznaj nas →"
- **Podstrona `/o-nas`:** pełna prezentacja zespołu, historia firmy, wartości, zdjęcia, bio, skills

**Uzasadnienie:**
- Wzmianka na głównej buduje zaufanie + tworzy lejek do podstrony
- Podstrona dla skeptyka który chce zweryfikować "czy to nie agencja-fantom"
- Pełna sekcja zespołu na głównej byłaby przeładowaniem

**Wpływ:** Plik `o-nas.html` (mockup) gotowy z 6 sekcjami (hero, stats, story, team, values, CTA, footer).

---

## D-031: MVP scope (marketing + audyt) vs Post-MVP (Stripe, chat, panel)

**Kontekst:** Co musi być w pierwszej wersji wdrażanej na produkcję, a co może poczekać.

**Decyzja:**

**MVP (must-have):**
- Strona główna marketingowa z 4 filarami + zespół + cennik abonamentu + audyt
- Podstrona `/pakiety`
- Podstrona `/pomoc-zdalna`
- Podstrona `/o-nas`
- 3 podstrony branżowe (biura księgowe, kancelarie, gabinety)
- Strony formalne (regulamin, polityka prywatności, RODO, cookies)
- Mobile-first responsywność
- Formularz audytu + kontaktowy + mail do zespołu
- SEO podstawowe (meta, OG, sitemap)
- Cookie banner zgodny z RODO
- Analytics (GA4) + Meta Pixel (respektując consent)
- Deploy na VPS + SSL + backupy

**Post-MVP (faza 2, po pierwszych leadach):**
- Stripe Subscriptions + Customer Portal
- Fakturownia integration
- Mini-panel klienta
- Chat AI (Claude Haiku 4.5)
- Blog MDX
- 3 podstrony usług (`/strony-internetowe`, `/aplikacje`, `/automatyzacje`)

**Future (faza 3+):**
- Headless CMS (jeśli więcej autorów)
- System ticketów (jeśli skala >50 klientów)
- Newsletter (Resend Broadcast)
- Mobile app

**Uzasadnienie:**
- Szybciej zaczynacie zbierać leady (formularz audytu wystarczy bez Stripe)
- Stripe + panel klienta to dodatkowe tygodnie — odkładamy aż mamy pierwszych zainteresowanych kupujących online
- Pierwsi klienci kupią przez "rozmowa → audyt → wycena → proforma → przelew" — bez online checkoutu

---

## D-032: Target user: 1-30 osób, biura księgowe / kancelarie / gabinety

**Kontekst:** Definicja idealnego klienta.

**Decyzja:**

**Profil firmy:**
- Wielkość: 1-30 pracowników
- Branże priorytetowe: biura księgowe, kancelarie prawne, gabinety lekarskie/dentystyczne
- Branże dodatkowe: salony usługowe, małe biura, firmy handlowe, firmy produkcyjne (małe)
- Lokalizacja: Wrocław (priorytet wizyt) + cała Polska (zdalnie)
- Budżet IT: 300-2000 zł netto/miesiąc

**Persony (3):**
- Anna, biuro księgowe 8 osób, 45 lat
- Marek, kancelaria 5 osób, 38 lat
- Piotr, sklep online 4 osoby, 32 lata (cross-sell na automatyzacje/strony)

Szczegóły w PRD.md sekcja 3.

---

## D-033: Anti-persona: korporacje, startupy techniczne, mikrofirmy budget 0-200 zł

**Kontekst:** Kogo wprost nie chcemy obsługiwać (klienci toksyczni dla biznesu).

**Decyzja:** Anti-persona — uprzejmie odmawiać:

- **Korporacje 100+ osób** — wymagają dedykowanych zespołów, SLA na piśmie, formalności
- **Startupy techniczne** — mają własnych devów, nie potrzebują outsourcingu
- **Mikrofirmy 1-osobowe budżet 0-200 zł/mies** — nie spina się ekonomicznie
- **Klienci szukający "najtaniej"** — bambooit konkuruje jakością, nie ceną

**Uzasadnienie:**
- Próby obsługi każdego = rozmycie pozycjonowania + nieopłacalność
- Lepsze 20 dobrych klientów niż 50 problematycznych

**Wpływ na komunikację:** treść strony nie obiecuje "dla każdego" — explicite mówi "dla firm 1-30 osób".

---

## D-034: AnyDesk/RustDesk — wariant A (linki do oficjalnych stron, nie własny hosting)

**Kontekst:** Sekcja "Pomoc zdalna" potrzebuje linków do pobrania aplikacji.

**Decyzja:** **Wariant A** — zwykła podstrona z dużymi przyciskami "Pobierz dla Windows / macOS / Linux", linki prowadzą do oficjalnych stron AnyDesk/RustDesk. Plus instrukcja krok po kroku ze zrzutami ekranu.

**Odrzucone:**
- **Wariant B (Twój hosting plików):** trzymanie instalatorów na serwerze. Korzyść: kontrola wersji. Wada: aktualizacje ręczne, ryzyko że SmartScreen/Gatekeeper zablokuje niepodpisany plik.

**Decyzja klienta przed startem:** który soft (AnyDesk vs RustDesk), kto kupuje licencję.

- **AnyDesk komercyjnie:** wymaga licencji (~kilkaset zł/rok per użytkownik)
- **RustDesk:** open-source, ale wymaga własnego serwera relay dla stabilności

**Status:** [TBD — Remigiusz decyduje]

---

## D-035: Conventional Commits + osobne migracje Prisma

**Kontekst:** Standard commit messages i versioning.

**Decyzja:**

**Commit messages:** Conventional Commits format:
- `feat:` — nowa funkcjonalność
- `fix:` — naprawa buga
- `chore:` — sprzątanie, dependencies
- `chore(cleanup):` — usuwanie diet kodu
- `chore(db):` — migracje Prisma
- `docs:` — dokumentacja
- `refactor:` — refactor bez zmiany behavior
- `test:` — testy

**Migracje Prisma:**
- Każda migracja = osobny commit
- Nazwa migracji opisowa (`add_company_industry_field`, nie `update`)
- Migracje split na logiczne grupy (np. drop diet models w 3 osobnych migracjach)

**NIGDY:** "WIP", "fix stuff", "update", `--name init` ani `--name updates`

---

## D-036: Cleanup w 14 commitach (split przez routes/controllers/services)

**Kontekst:** Po klonowaniu z e-dietetyk trzeba wyciąć 60-80% kodu dietetycznego. Pytanie jak to zrobić.

**Decyzja:** Cleanup w 14 fazach (PLAN_CZYSZCZENIA.md §6), z dodatkowymi splitami:

**KROK 0:** root scripts + baseline (zatag)
**KROK 1:** apps/solver + data + diet docs
**KROK 2a:** drop diet routes
**KROK 2b:** drop diet controllers
**KROK 2c:** drop diet services
**KROK 3:** drop scraper + policies + queues + pdf
**KROK 4:** drop diet frontend pages + components
**KROK 5a-c:** drop diet Prisma models (split na 3 migracje: food_database, planning, clinical)
**KROK 6:** rename Patient → Company + migracja
**KROK 7:** rename UserRole (drop DIETITIAN) + migracja
**KROK 8:** replace ProductType enum + migracja
**KROK 9:** rewrite CLAUDE.md / DEPLOY.md / brand.ts
**KROK 10:** scaffold nowe modele (Company, ServicePackage, AuditFormSubmission)
**KROK 11:** scaffold marketing pages + panel klienta
**KROK 12:** Claude API chat service
**KROK 13:** Fakturownia integration
**KROK 14:** new Stripe Price IDs mapping

**Uzasadnienie splitów:**
- KROK 2 (drop diet routes/controllers/services) — split na 2a/2b/2c dla łatwiejszego revert i czystszej historii git
- KROK 5 (drop Prisma models) — split na 3 migracje bo wszystko w jednej = trudne do cofnięcia

**Każdy krok:**
- Pre-check sanity (grep importerów)
- Faktyczne usunięcie
- `npm run typecheck` → log
- Akceptowalny stan: exit 0 lub tylko `Cannot find module` do świeżo usuniętych
- Commit z opisowym message

---

## D-037: Komentowanie z TODO zamiast usuwania w cross-cutting plikach

**Kontekst:** Plik typu `admin.routes.ts` importuje 13 z usuwanych controllers. Co z nim zrobić w 2b?

**Decyzja:** **Komentować imports + odpowiadające endpoints z markerem `TODO(2b-cleanup)`**, nie usuwać.

**Uzasadnienie:**
- Utrzymuje typecheck zielony (nie sypie się na missing imports)
- Audit trail w git diff (widzimy co było usunięte i kiedy)
- Admin cleanup step (osobny krok) ma jasną listę co finalizować
- Bezpieczniejsze niż "duża chirurgia" w cross-cutting plikach

**Wzorzec komentarza:**
```ts
// TODO(2b-cleanup): removed in 2b cleanup, will be trimmed in admin cleanup step
// import * as foodProductController from '../controllers/foodProduct.controller';
// ...
// adminRouter.get('/food-products/search', foodProductController.search);
```

**Wpływ:** stosowany konsekwentnie w 2b (admin.routes.ts, admin.controller.ts, profile.routes.ts).

---

## D-038: Zostawiamy Testimonial, Referral, AiCostLog jako infrastrukturę

**Kontekst:** Pytanie czy te modele są reusable czy diet-specific.

**Decyzja:** Wszystkie 3 **ZOSTAJĄ** w schemacie Prisma:

- **Testimonial** — opinie klientów, używamy gdy pojawią się referencje
- **ReferralCode + ReferralUsage** — kody polecające ("POLECONY200" dla pierwszych klientów)
- **AiCostLog + AiUsageLog** — tracking użycia i kosztów Claude API (zmiana semantyki: `model` z "gpt-4-turbo" na "claude-haiku-4-5")

**Uzasadnienie:**
- Lekkie modele, zero kosztu utrzymania
- Wartościowe nice-to-have post-MVP
- Drobny refactor zamiast pisania od zera

**NIE zostawiamy:** `DietitianProfile`, `Patient` (przemianowane na `Company`), `MealPlan`, `Recipe`, `FoodProduct`, `Tenant`, `ClinicalRule`, etc.

---

## D-039: Zostawiamy dietitianReport.service jako szkielet pod internalReport

**Kontekst:** Service generuje raporty miesięczne (dietetyczne). Czy zostawić jako szkielet pod internal dashboard MRR?

**Decyzja:** **ZOSTAWIĆ** szkielet `dietitianReport.service.ts`, przemianować na `internalReport.service.ts` w fazie 4. Logikę dietetyczną przepisać pod metryki bambooIT (MRR, liczba aktywnych firm, churn).

**Uzasadnienie:**
- Szkielet (auth, response formatting, paginacja, eksport PDF) jest reusable
- Łatwiej przerobić niż pisać od zera
- Internal dashboard dla zespołu (Wirgiliusz + Remigiusz) — nie dla klientów

**Controller jednak USUWAMY** (47 linii thin wrapper, łatwiej napisać od nowa).

---

## D-040: data/ (281 MB CIQUAL) — usunąć bezwarunkowo

**Kontekst:** Folder `data/` zawierał CIQUAL (francuska baza spożywcza), ilewazy, USDA imports — 281 MB w repo.

**Decyzja:** Usunąć bezwarunkowo w KROK 1 (po pre-check czy nie ma skryptów backupowych).

**Uzasadnienie:**
- 100% diet domain
- 281 MB to ogromne obciążenie repo (clone, CI, backupy)
- Brak skryptów backupowych w środku (zweryfikowano pre-checkiem)
- `data/backup-clean-products-2026-03-19.json` to dump tabeli CleanProduct (diet) — też do kosza

**Wpływ:** repo zmniejszone z 583 MB do 303 MB po KROK 1.

---

## Zasady aktualizacji tego dokumentu

**Każda nowa istotna decyzja (architektoniczna, biznesowa, produktowa) dodawana jest tutaj jako D-XXX z polami:**

1. Kontekst — skąd się wzięła decyzja
2. Decyzja — co konkretnie zdecydowano
3. Uzasadnienie — dlaczego tak a nie inaczej
4. Odrzucone alternatywy (jeśli były)
5. Wpływ — na kod, biznes, koszty, terminy

**Decyzje NIE wymagają wpisu:**
- Drobne wybory implementacyjne (które wystarczy z CLAUDE.md/RULES.md)
- Decyzje per-zadanie (komentowane w commit messages)

**Decyzje WYMAGAJĄ wpisu:**
- Zmiana stacku (np. dodanie/usunięcie biblioteki)
- Zmiana modelu danych
- Zmiana cenowa
- Zmiana pozycjonowania
- Zmiana scope MVP
- Wybór między alternatywami które realnie były rozważane
