# Rejestr podprocesorów — e-dietetyk.com

**Data ostatniej aktualizacji:** 17 kwietnia 2026 r.
**Administrator danych:** Wirgiliusz Ładziński (JDG), `kontakt@e-dietetyk.com`
**Podstawa:** Art. 28 ust. 3 lit. d RODO (lista podprocesorów) + zgłaszanie
zmian do administratora głównego.

Ten dokument jest **żywy** — aktualizuj go przy każdej zmianie integracji
(dodanie nowego providera, zmiana regionu, podpisanie DPA, odnowienie
certyfikatów).

---

## Ogólne zasady

- Każdy podprocesor przetwarza dane **wyłącznie** na udokumentowane
  polecenie administratora (Art. 28 ust. 3 lit. a RODO).
- Transfery poza EOG opierają się na **Standardowych Klauzulach Umownych
  (SCC)** z czerwca 2021 r. oraz dodatkowych środkach technicznych
  (szyfrowanie AES-256-GCM danych medycznych przed transferem).
- DPA z każdym podprocesorem jest pobrane i przechowywane w
  `docs/legal/dpa/<nazwa>-dpa-YYYY-MM-DD.pdf`.
- Lista podprocesorów w polityce prywatności (publicznej) jest
  synchronizowana z tym dokumentem.

---

## Tabela zbiorcza

| # | Podprocesor | Siedziba | Region przetwarzania | Zakres danych | Podstawa transferu | Status DPA | Certyfikaty |
|---|---|---|---|---|---|---|---|
| 1 | **OpenAI, LLC** | San Francisco, USA | USA | Zanonimizowane dane wywiadu dietetycznego (waga, wzrost, alergie, choroby) — **bez** imion/mailów | SCC + DPA + AES-256-GCM przed wysyłką | ✅ Auto-applied via API TOS | SOC 2 Type II |
| 2 | **Stripe, Inc.** | San Francisco, USA / Dublin, Irlandia | USA + EU | Email, dane karty (tokenizowane), kwota, metadata zamówienia | SCC + DPA; Stripe sam procesuje dane kart | ✅ https://stripe.com/legal/dpa | PCI DSS Level 1, SOC 2 Type II |
| 3 | **UAB Hostinger** | Wilno, Litwa (EU) | Litwa (EOG) | Cała baza aplikacji: dane osobowe, zdrowotne (zaszyfrowane), logi | Brak transferu poza EOG | ⚠️ Do pobrania kopii | ISO 27001 |
| 4 | **Resend, Inc.** | San Francisco, USA | USA | Adres e-mail odbiorcy, imię w treści maila. **Bez** danych medycznych w treści | SCC (do weryfikacji) + DPA | ⚠️ Do weryfikacji na https://resend.com/legal | SOC 2 |
| 5 | **Functional Software, Inc. (Sentry)** | San Francisco, USA | USA (US region wybrany) | Stack traces błędów 5xx, metadata requestów. Pola wrażliwe (password, answers, content, medicalFlags, email) są filtrowane przed wysyłką — patrz `docs/sentry-pii-scrubbing.md` | SCC + DPA | ⚠️ Do pobrania kopii | SOC 2 Type II, ISO 27001 |
| 6 | **Google Ireland Limited** (Google Analytics 4) | Dublin, Irlandia | EU primary → USA (onward) | Anonimowany IP, pageviews, zdarzenia — wyłącznie **po zgodzie** użytkownika w banerze cookies. Brak PII i danych medycznych | SCC dla onward transfer do Google LLC (USA) + anonymize_ip | ✅ Default Google Ads Data Processing Terms | ISO 27001, SOC 2 |

Legenda statusu DPA:
- ✅ podpisane / obowiązujące
- ⚠️ obowiązujące lecz kopia wymaga pobrania/archiwizacji
- ❌ brak / do negocjacji

---

## 1. OpenAI, LLC

**Rola:** generowanie planów dietetycznych AI (GPT-4.1).

**Zakres danych przekazywanych:**
- Dane z wywiadu żywieniowego (waga, wzrost, wiek, płeć, alergie, choroby przewlekłe, preferencje, leki)
- Dane o produktach spożywczych (baza niezawierająca PII)
- **Nie przekazujemy:** imienia, nazwiska, e-maila, telefonu, adresu zamieszkania

**Szczególne kategorie danych (art. 9 RODO):** TAK — dane zdrowotne (zanonimizowane).

**Transfer:** USA — SCC (Komisja Europejska decyzja 2021/914) + szyfrowanie AES-256-GCM w bazie przed wyciągnięciem do promptu.

**DPA:** https://openai.com/policies/data-processing-addendum (automatycznie obowiązujący dla klientów API).

**Retencja po stronie OpenAI:** 30 dni (enterprise zero-data-retention setting — zweryfikować czy włączone).

**TODO:**
- [ ] Pobrać PDF DPA → `docs/legal/dpa/openai-dpa-YYYY-MM-DD.pdf`
- [ ] Zweryfikować że "Do Not Train" i "Zero Retention" są włączone na koncie API

---

## 2. Stripe, Inc.

**Rola:** przetwarzanie płatności, subskrypcje.

**Zakres danych:**
- Email klienta
- Dane karty (tokenizowane — Stripe nie udostępnia nam pełnego numeru)
- Kwota, waluta, data transakcji
- Metadata zamówienia (ID, productType)

**Szczególne kategorie danych:** NIE.

**Transfer:** USA + EU — Stripe posiada infrastrukturę w obu regionach. SCC.

**DPA:** https://stripe.com/legal/dpa (automatycznie obowiązujący).

**TODO:**
- [ ] Pobrać PDF DPA → `docs/legal/dpa/stripe-dpa-YYYY-MM-DD.pdf`
- [ ] Zweryfikować że w `Stripe.metadata` nie przekazujemy danych medycznych (grep w kodzie pod `metadata:`)

---

## 3. UAB Hostinger

**Rola:** hosting VPS (aplikacja + PostgreSQL).

**Zakres danych:** **cała baza** — imiona, e-maile, zaszyfrowane dane medyczne, logi aktywności, pliki backupu.

**Transfer międzynarodowy:** N/D — datacenter w Wilnie (EOG).

**Środki bezpieczeństwa:**
- Dyski szyfrowane na poziomie dostawcy
- Dane medyczne **dodatkowo** szyfrowane AES-256-GCM na poziomie aplikacji
- Backup lokalny (wolumen `./backups`) szyfrowany GPG AES-256 — patrz `docs/backup-recovery.md`

**DPA:** https://www.hostinger.com/dpa (część Terms of Service).

**TODO:**
- [ ] Pobrać PDF DPA → `docs/legal/dpa/hostinger-dpa-YYYY-MM-DD.pdf`
- [ ] Zweryfikować czy Hostinger korzysta z dalszych sub-procesorów (CDN?)

---

## 4. Resend, Inc.

**Rola:** wysyłka e-maili transakcyjnych (reset hasła, potwierdzenia zamówień, powiadomienia o planach).

**Zakres danych:**
- Adres e-mail odbiorcy
- Imię (jeśli używane w powitaniu)
- **Nie zawiera:** treści wywiadów, treści planów dietetycznych, danych medycznych

**Transfer:** USA — do weryfikacji czy stosują SCC.

**Retencja po stronie Resend:** metadata e-mail przez 30 dni (standard branżowy; zweryfikować).

**TODO (priorytet WYSOKI — blokuje pełną zgodność):**
- [ ] Sprawdzić https://resend.com/legal / napisać do `support@resend.com` o DPA
- [ ] Pobrać PDF DPA → `docs/legal/dpa/resend-dpa-YYYY-MM-DD.pdf`
- [ ] Udokumentować politykę retencji Resend (ile trzymają metadata/bounce logs)

---

## 5. Functional Software, Inc. (Sentry)

**Rola:** monitoring błędów aplikacji (błędy 5xx, crashe solvera, BullMQ job failures).

**Zakres danych:**
- Stack trace błędu
- Metadata requestu (URL, method, response status)
- **Filtrowane przed wysyłką** (`beforeSend` scrubber, patrz `docs/sentry-pii-scrubbing.md`):
  - `password`, `answers`, `content`, `medicalFlags`, `rawResponse`, `authorization`, `cookie`, `token`, `apiKey`, `encryption_key`, `secret`
- `user.email` — **nie wysyłany**, zostaje tylko `user.id` i `user.role`
- Session Replay (frontend): wszystkie teksty, inputy, media zamaskowane (`maskAllText`, `maskAllInputs`, `blockAllMedia`)

**Transfer:** USA (region US wybrany — rozważyć migrację na `de.sentry.io` przy najbliższym przeglądzie).

**Retencja:** Sentry Team plan — 90 dni (domyślna).

**TODO:**
- [ ] Pobrać DPA z Sentry Organization Settings → Legal → Data Processing Agreement
- [ ] Zapisać jako `docs/legal/dpa/sentry-dpa-YYYY-MM-DD.pdf`
- [ ] (opcja) migracja na EU region — czas realizacji ~1h, wymaga nowego DSN

---

## 6. Google Ireland Limited (Google Analytics 4)

**Rola:** analityka ruchu serwisu (pageviews, źródła wejść, custom event `ai_referral`).

**Zakres danych:**
- **Anonimizowany IP** (`anonymize_ip: true`)
- Pageviews, zdarzenia GA4
- Identyfikator sesji (cookie `_ga`, `_ga_*`)
- `ai_referral` event — źródło wizyty (ChatGPT/Claude/Perplexity/Gemini)
- **Nie zbierane:** imię, nazwisko, email, treść wywiadu, plan dietetyczny

**Loading gating:** GA4 ładuje się **wyłącznie po wyrażeniu zgody** w banerze cookies (kategoria "Analityczne"). Patrz `apps/web/src/components/analytics/GoogleAnalytics.tsx`.

**Administrator dla użytkowników EOG:** Google Ireland Limited (Dublin, Irlandia).

**Transfer dalszy:** do Google LLC (USA) na podstawie **SCC** zgodnie z Google Ads Data Processing Terms.

**Retencja GA4:** 14 miesięcy (domyślna).

**DPA:** Google Ads Data Processing Terms — automatycznie obowiązujące: https://business.safety.google/adsprocessorterms/

**TODO:**
- [ ] Pobrać PDF Processing Terms → `docs/legal/dpa/google-ga4-dpt-YYYY-MM-DD.pdf`
- [ ] Zweryfikować w konsoli GA4 → Admin → Data Retention że ustawienie to **14 miesięcy** i auto-reset jest włączony

---

## Zidentyfikowane potencjalne podprocesory (nieaktywne)

Dostawcy wymienieni w kodzie/architekturze, ale **niewykorzystywani** lub
działający wyłącznie w środowisku dewelopmenckim. Udokumentowane dla
transparentności — jeśli zaczną przetwarzać dane pacjentów, **przenieść**
do tabeli powyżej.

| Dostawca | Rola | Status |
|---|---|---|
| FingerprintJS OSS (`@fingerprintjs/fingerprintjs`) | Identyfikacja urządzenia do wykrywania nadużyć trial | Biblioteka **open-source**, liczy fingerprint **lokalnie w przeglądarce** — brak transferu danych do podmiotu zewnętrznego. NIE jest podprocesorem. |
| Redis | Cache + BullMQ queue | Kontener na tym samym VPS (Hostinger). Nie jest osobnym podprocesorem. |
| Cloudflare R2 / Backblaze B2 (off-site backup) | Planowana destynacja offsite backupu | **Nie wdrożone.** Obecnie backup tylko lokalny na VPS. |

---

## Procedura cyklicznej weryfikacji

1. **Częstotliwość:** raz na 12 miesięcy LUB przy każdej zmianie integracji.
2. **Odpowiedzialny:** administrator danych (Wirgiliusz Ładziński).
3. **Zakres weryfikacji:**
   - Aktualność DPA (czy warunki nie zmienione jednostronnie)
   - Aktualność certyfikatów (SOC 2, PCI DSS, ISO 27001)
   - Zgodność z aktualnymi przepisami (RODO, AI Act, decyzje adekwatności KE)
   - Sprawdzenie nowych sub-procesorów każdego podprocesora
   - Status transferów międzynarodowych (czy nie wycofano decyzji adekwatności)
4. **Dokumentacja:** aktualizuj datę w nagłówku tego pliku + kolumnę "Status DPA".

---

## Odpowiedzi dla UODO / audytu

### "Pokaż rejestr podprocesorów."
→ Ten dokument + `docs/legal/checklist-dpa-podprocesorow.md`.

### "Gdzie są przechowywane kopie DPA?"
→ `docs/legal/dpa/<nazwa>-dpa-YYYY-MM-DD.pdf` (private, niewypychane do GitHuba).

### "Czy informujesz użytkowników o liście podprocesorów?"
→ TAK, w `apps/web/content/legal/pl/polityka-prywatnosci.md` pkt 6.

### "Czy przewidujesz procedurę powiadomienia użytkowników przy zmianie podprocesora?"
→ TAK — ta procedura jest w `docs/data-breach-procedure.md` (jeśli zmiana wpływa
na bezpieczeństwo) lub przez aktualizację polityki prywatności z informacją w
stopce serwisu (przy zmianie informacyjnej).

---

## Historia zmian

| Data | Zmiana |
|---|---|
| 2026-04-17 | Utworzenie dokumentu (konsolidacja z polityki prywatności + checklist) — dodano Google GA4 i Sentry (wcześniej brakowało) |
