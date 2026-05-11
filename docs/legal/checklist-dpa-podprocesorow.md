# Checklist DPA podprocesorów — e-dietetyk.com

**Data ostatniej aktualizacji:** 23 marca 2026 r.
**Odpowiedzialny:** Wirgiliusz Ładziński (Administrator danych)

---

## Podsumowanie

Poniższy dokument zawiera praktyczną listę kontrolną dotyczącą umów powierzenia przetwarzania danych osobowych (DPA) z podprocesorami wykorzystywanymi przez serwis e-dietetyk.com. Dla każdego podprocesora wskazano: rolę, zakres danych, status DPA, zabezpieczenia transferu międzynarodowego oraz certyfikaty bezpieczeństwa.

---

## Rejestr podprocesorów

| Lp. | Podprocesor | Rola | Przetwarzane dane | DPA URL / Dokument | SCC | Certyfikaty | Status | Data |
|-----|-------------|------|--------------------|--------------------|-----|-------------|--------|------|
| 1 | **OpenAI LLC** (San Francisco, USA) | Generowanie propozycji planów żywieniowych (API GPT-4) | Dane zdrowotne z wywiadu dietetycznego (zanonimizowane — bez imienia, nazwiska, e-mail) | [Data Processing Addendum](https://openai.com/policies/data-processing-addendum) | TAK | SOC 2 Type II | Do pobrania | — |
| 2 | **Stripe Inc.** (San Francisco, USA) | Obsługa płatności online | Dane transakcyjne (kwota, waluta, data), adres e-mail, dane karty płatniczej (tokenizowane) | [Data Processing Agreement](https://stripe.com/legal/dpa) | TAK | PCI DSS Level 1, SOC 2 Type II | Do pobrania | — |
| 3 | **UAB Hostinger** (Wilno, Litwa) | Hosting VPS (serwer aplikacji, baza danych) | Wszystkie dane osobowe przetwarzane w serwisie (dane użytkowników, wywiady, plany) | [Data Processing Agreement](https://www.hostinger.com/dpa) | N/D (UE) | ISO 27001 | Do pobrania | — |
| 4 | **Resend Inc.** (San Francisco, USA) | Wysyłka wiadomości e-mail transakcyjnych | Adres e-mail, imię (w treści e-mail) | [Sprawdzić: resend.com/legal lub resend.com/dpa](https://resend.com/legal) | TAK (do weryfikacji) | SOC 2 | Do weryfikacji | — |

---

## Szczegóły i działania wymagane

### 1. OpenAI LLC

**Rola:** Podprocesor AI — generowanie propozycji planów żywieniowych.

**Dane przekazywane:**
- Zanonimizowane dane z wywiadu dietetycznego (wiek, płeć, waga, wzrost, alergie, choroby, preferencje żywieniowe, leki)
- Dane o produktach spożywczych (niezawierające danych osobowych)
- **NIE są przekazywane:** imię, nazwisko, e-mail, telefon, adres

**Szczególne kategorie danych (art. 9 RODO):** TAK — dane dotyczące zdrowia (zanonimizowane)

**Transfer międzynarodowy:** USA — Standardowe Klauzule Umowne (SCC)

**DPA:**
- URL: https://openai.com/policies/data-processing-addendum
- Typ: Data Processing Addendum (automatycznie obowiązujący dla klientów API)
- OpenAI deklaruje, że dane z API nie są wykorzystywane do trenowania modeli

**Akcje wymagane:**
- [ ] Pobrać i zapisać kopię DPA (PDF) — `docs/legal/dpa/openai-dpa-YYYY-MM-DD.pdf`
- [ ] Zweryfikować, czy DPA zawiera postanowienia dotyczące szczególnych kategorii danych (zdrowie)
- [ ] Sprawdzić klauzulę retencji danych (obecnie: max 30 dni dla bezpieczeństwa)
- [ ] Zweryfikować aktualność SCC
- [ ] Upewnić się, że API policy (zero data retention) jest włączone na koncie
- [ ] Udokumentować w DPIA (Ocena Skutków) transfer danych zdrowotnych do USA

**Status:** Do pobrania
**Data ostatniej weryfikacji:** —
**Następna weryfikacja:** —

---

### 2. Stripe Inc.

**Rola:** Podprocesor płatności — obsługa transakcji online.

**Dane przekazywane:**
- Adres e-mail klienta
- Dane karty płatniczej (tokenizowane — Stripe nie przekazuje pełnych danych karty do naszego serwera)
- Kwota, waluta, data transakcji
- Metadata zamówienia (ID zamówienia, typ produktu)

**Szczególne kategorie danych (art. 9 RODO):** NIE

**Transfer międzynarodowy:** USA — Standardowe Klauzule Umowne (SCC)

**DPA:**
- URL: https://stripe.com/legal/dpa
- Typ: Data Processing Agreement (automatycznie obowiązujący)
- Stripe przetwarza dane jako podprocesor (dla płatności) oraz jako niezależny administrator (dla compliance / AML)

**Akcje wymagane:**
- [ ] Pobrać i zapisać kopię DPA (PDF) — `docs/legal/dpa/stripe-dpa-YYYY-MM-DD.pdf`
- [ ] Zweryfikować zakres danych przekazywanych do Stripe (dane w `metadata`)
- [ ] Upewnić się, że nie przekazujemy danych medycznych do Stripe
- [ ] Sprawdzić, czy DPA obejmuje Stripe Connect (jeśli dotyczy)
- [ ] Zweryfikować zgodność z PSD2 / SCA

**Status:** Do pobrania
**Data ostatniej weryfikacji:** —
**Następna weryfikacja:** —

---

### 3. UAB Hostinger

**Rola:** Hosting VPS — serwer aplikacji (backend + frontend), baza danych PostgreSQL.

**Dane przetwarzane:**
- Wszystkie dane osobowe przechowywane w bazie danych:
  - Dane identyfikacyjne użytkowników (imię, nazwisko, e-mail)
  - Dane zdrowotne (wywiady dietetyczne, plany żywieniowe) — szyfrowane AES-256-GCM
  - Dane transakcyjne
  - Logi systemowe

**Szczególne kategorie danych (art. 9 RODO):** TAK — dane dotyczące zdrowia (szyfrowane)

**Transfer międzynarodowy:** N/D — Hostinger UAB z siedzibą w Wilnie, Litwa (UE). Serwer VPS znajduje się w Litwie (UE). Brak transferu poza EOG.

**DPA:**
- URL: https://www.hostinger.com/dpa
- Typ: Data Processing Agreement (część Terms of Service)
- Hostinger jako podprocesor — przechowuje dane na infrastrukturze w UE

**Akcje wymagane:**
- [ ] Pobrać i zapisać kopię DPA (PDF) — `docs/legal/dpa/hostinger-dpa-YYYY-MM-DD.pdf`
- [ ] Zweryfikować, czy DPA obejmuje VPS (nie tylko shared hosting)
- [ ] Sprawdzić lokalizację datacenter (potwierdzić: Litwa / UE)
- [ ] Zweryfikować, czy Hostinger nie korzysta z dalszych procesorów spoza UE
- [ ] Udokumentować środki bezpieczeństwa (szyfrowanie dysków, dostęp fizyczny)
- [ ] Sprawdzić politykę backup i retencji

**Status:** Do pobrania
**Data ostatniej weryfikacji:** —
**Następna weryfikacja:** —

---

### 4. Resend Inc.

**Rola:** Podprocesor e-mail — wysyłka wiadomości transakcyjnych (rejestracja, reset hasła, powiadomienia o planach).

**Dane przekazywane:**
- Adres e-mail odbiorcy
- Imię (w treści/nagłówku e-maila)
- Treść e-maila (NIE zawiera danych medycznych)

**Szczególne kategorie danych (art. 9 RODO):** NIE

**Transfer międzynarodowy:** USA — do weryfikacji, czy Resend stosuje SCC

**DPA:**
- URL: Do weryfikacji — sprawdzić https://resend.com/legal lub skontaktować się z Resend
- Status: Nieznany — wymaga weryfikacji

**Akcje wymagane:**
- [ ] Sprawdzić, czy Resend udostępnia DPA (strona /legal lub /dpa)
- [ ] Jeśli DPA dostępne — pobrać i zapisać kopię — `docs/legal/dpa/resend-dpa-YYYY-MM-DD.pdf`
- [ ] Jeśli DPA niedostępne — skontaktować się z Resend (support/legal) z żądaniem DPA
- [ ] Zweryfikować, czy Resend stosuje SCC dla transferu EU→USA
- [ ] Sprawdzić certyfikaty bezpieczeństwa (SOC 2, ISO)
- [ ] Zweryfikować politykę retencji e-maili (jak długo przechowywane)
- [ ] Upewnić się, że treść e-maili nie zawiera danych medycznych
- [ ] **ALTERNATYWA:** Jeśli Resend nie oferuje DPA — rozważyć migrację na dostawcę z DPA (np. Mailgun, Postmark, AWS SES)

**Status:** Do weryfikacji
**Data ostatniej weryfikacji:** —
**Następna weryfikacja:** —

---

## Procedura cyklicznej weryfikacji

1. **Częstotliwość:** Co 12 miesięcy oraz przy każdej zmianie podprocesora.
2. **Odpowiedzialny:** Administrator danych (Wirgiliusz Ładziński) lub wyznaczony IOD.
3. **Zakres weryfikacji:**
   - Aktualność DPA (czy nie zmieniono warunków)
   - Aktualność certyfikatów bezpieczeństwa
   - Zgodność z aktualnymi przepisami (RODO, AI Act, akt wykonawczy)
   - Sprawdzenie dalszych procesorów każdego podprocesora
   - Status transferów międzynarodowych (decyzje adekwatności, SCC)
4. **Dokumentacja:** Wyniki weryfikacji zapisywać w niniejszym dokumencie (kolumna „Data" i „Status").

---

## Struktura katalogów na kopie DPA

```
docs/legal/dpa/
├── openai-dpa-YYYY-MM-DD.pdf
├── stripe-dpa-YYYY-MM-DD.pdf
├── hostinger-dpa-YYYY-MM-DD.pdf
└── resend-dpa-YYYY-MM-DD.pdf     (gdy dostępne)
```

---

## Informacja o podprocesorach dla użytkowników

Zgodnie z art. 13 ust. 1 lit. e) RODO, informacja o odbiorcach (w tym podprocesorach) powinna znajdować się w Polityce Prywatności serwisu. Upewnić się, że Polityka Prywatności zawiera aktualną listę kategorii odbiorców danych wraz z informacją o transferach międzynarodowych.

---

*Checklist DPA podprocesorów — wersja 1.0 — e-dietetyk.com*
*Ostatnia aktualizacja: 23 marca 2026 r.*
