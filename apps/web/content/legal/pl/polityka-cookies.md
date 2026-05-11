# POLITYKA COOKIES

**Aplikacji e-dietetyk.com**

**Wersja 2.0 · Data wejścia w życie: 25 kwietnia 2026 r.**

---

## 1. Czym są cookies?

**Cookies** (tzw. "ciasteczka") to niewielkie pliki tekstowe, które strona internetowa zapisuje na Twoim urządzeniu (komputerze, tablecie, smartfonie) podczas jej przeglądania. Cookies pozwalają:

- Zapamiętać Twoje preferencje (np. język strony)
- Utrzymać Cię zalogowanym między stronami
- Chronić Cię przed atakami (np. CSRF)
- Analizować w jaki sposób korzystasz ze strony (za Twoją zgodą)

Oprócz cookies na naszej stronie używamy również technologii podobnych:
- **localStorage / sessionStorage** — lokalny magazyn danych w przeglądarce
- **Fingerprinting urządzenia** — obliczany **lokalnie w Twojej przeglądarce**, bez wysyłania danych do podmiotów trzecich (służy ochronie przed nadużyciami)

---

## 2. Jakie cookies używamy

Cookies dzielimy na **cztery kategorie**:

### 2.1. Cookies niezbędne (zawsze aktywne)

Bez tych cookies strona nie może prawidłowo działać. Nie wymagają Twojej zgody (art. 173 ust. 3 pkt 2 ustawy Prawo telekomunikacyjne — cookies niezbędne do świadczenia usługi).

| Nazwa | Cel | Czas życia | Dostawca |
|---|---|---|---|
| `__Secure-authjs.session-token` | Sesja logowania (produkcja) | 7 dni | e-dietetyk.com |
| `authjs.session-token` | Sesja logowania (środowisko deweloperskie) | 7 dni | e-dietetyk.com |
| `authjs.csrf-token` | Ochrona przed atakami CSRF | Sesja | e-dietetyk.com |
| `authjs.callback-url` | Przekierowanie po zalogowaniu | Sesja | e-dietetyk.com |
| `idle_last_activity` | Automatyczne wylogowanie po 5 min bezczynności | 5 minut | e-dietetyk.com |
| `cookie-consent` | Zapamiętanie Twoich wyborów cookies | 1 rok | e-dietetyk.com |

### 2.2. Cookies funkcjonalne (opcjonalne)

Umożliwiają zapamiętanie Twoich preferencji. Używamy ich za Twoją zgodą.

| Nazwa | Cel | Czas życia | Dostawca |
|---|---|---|---|
| `NEXT_LOCALE` | Wybór języka (PL/EN) | 1 rok | e-dietetyk.com |

### 2.3. Cookies analityczne (opcjonalne — za zgodą)

Pomagają nam zrozumieć, jak odwiedzający korzystają ze strony, abyśmy mogli ją ulepszać. Używamy ich **wyłącznie za Twoją wyraźną zgodą**.

| Nazwa | Cel | Czas życia | Dostawca |
|---|---|---|---|
| `_ga` | Google Analytics — identyfikator użytkownika | 2 lata | Google LLC (USA) |
| `_ga_<ID>` | Google Analytics — sesja | 2 lata | Google LLC (USA) |
| `_gid` | Google Analytics — identyfikator sesji | 24 godziny | Google LLC (USA) |

**Szczegóły Google Analytics 4 (GA4):**

- **Operator:** Google Ireland Limited (EOG) — dane transferowane do Google LLC (USA)
- **Podstawa transferu:** Standardowe Klauzule Umowne (SCC) zgodne z decyzją Komisji Europejskiej 2021/914
- **Zbierane dane:** odwiedzone strony, zdarzenia, czas spędzony, zanonimizowany adres IP
- **Konfiguracja prywatności:** `anonymize_ip: true` (adres IP jest skracany przed wysłaniem do Google)
- **Cel:** analityka ruchu, optymalizacja treści i funkcji
- **Czas przechowywania danych GA4:** 14 miesięcy (ustawienie minimalne GA4)
- **Więcej informacji o polityce Google:** https://policies.google.com/privacy

### 2.4. Cookies marketingowe

**Obecnie nie używamy żadnych cookies marketingowych** (remarketing, reklamy personalizowane, piksele reklamowe).

Jeśli w przyszłości je wprowadzimy, zaktualizujemy niniejszą Politykę i poprosimy o osobną zgodę.

---

## 3. Inne technologie (nie-cookies)

### 3.1. FingerprintJS (lokalnie w Twojej przeglądarce)

Używamy biblioteki **FingerprintJS OSS** (open-source), która **lokalnie w Twojej przeglądarce** oblicza "odcisk" urządzenia na podstawie:
- User-Agent
- Canvas/WebGL
- Zainstalowane pluginy

**Ten odcisk NIE jest wysyłany do żadnego podmiotu trzeciego** — jest liczony w pełni lokalnie. Trafia wyłącznie na nasz serwer w celu:
- Wykrywania prób obejścia okresu próbnego
- Identyfikacji podejrzanych urządzeń próbujących logowania brute-force
- Ograniczenia maksymalnie 3 kont na urządzenie

**Podstawa prawna:** art. 6 ust. 1 lit. f RODO (uzasadniony interes — ochrona przed nadużyciami).

### 3.2. Google Fonts

Nasza strona korzysta z Google Fonts (fonts.googleapis.com, fonts.gstatic.com) do ładowania krojów pisma. W standardowym zapytaniu HTTP Google otrzymuje jedynie:
- Twój adres IP
- User-Agent przeglądarki

Google nie otrzymuje żadnych innych danych identyfikacyjnych z naszej strony. Jeśli nie chcesz, aby Google otrzymywał Twój IP, możesz zablokować ładowanie Google Fonts (np. wtyczką uBlock Origin) — strona nadal będzie działać, tylko z fontami systemowymi.

### 3.3. Stripe

Gdy dokonujesz płatności, Stripe (zewnętrzny dostawca obsługi płatności) może ustawić własne cookies w celu zapobiegania oszustwom. Dzieje się to **tylko w momencie płatności** — nie jest to aktywne podczas normalnego przeglądania strony.

Polityka Stripe: https://stripe.com/privacy

---

## 4. Jak zarządzać cookies

### 4.1. W naszej aplikacji

Przy pierwszej wizycie pokazujemy **banner cookies** z trzema opcjami:

- ✅ **Akceptuj wszystkie** — zgoda na wszystkie kategorie cookies
- ✅ **Tylko niezbędne** — używamy wyłącznie cookies technicznie koniecznych
- ⚙️ **Ustawienia** — sam wybierasz które kategorie akceptujesz

**Zmiana preferencji w dowolnym momencie:**
Kliknij link **"Ustawienia cookies"** w stopce każdej strony.

Po zmianie ustawień odpowiednie cookies zostaną natychmiast zdeaktywowane, a wcześniej ustawione ciasteczka — usunięte.

### 4.2. W ustawieniach przeglądarki

Możesz też zarządzać cookies z poziomu swojej przeglądarki. Większość przeglądarek pozwala:
- Zobaczyć jakie cookies są zapisane
- Usunąć wybrane cookies
- Zablokować cookies dla konkretnych stron
- Zablokować wszystkie cookies (uwaga — może to ograniczyć działanie wielu stron)

**Instrukcje dla popularnych przeglądarek:**

- **Chrome:** https://support.google.com/chrome/answer/95647
- **Firefox:** https://support.mozilla.org/pl/kb/ciasteczka
- **Safari (Mac):** https://support.apple.com/pl-pl/HT201265
- **Safari (iOS):** https://support.apple.com/pl-pl/HT201265
- **Edge:** https://support.microsoft.com/pl-pl/microsoft-edge/usuwanie-plik%C3%B3w-cookie

### 4.3. Wyłączenie GA — rozszerzenie Google

Jeśli chcesz całkowicie zablokować Google Analytics, zainstaluj oficjalny dodatek Google:
https://tools.google.com/dlpage/gaoptout

---

## 5. Rejestr Twoich zgód

Gdy klikasz "Akceptuj" w bannerze cookies, zapisujemy:
- Twój wybór (które kategorie zaakceptowałeś)
- Datę i godzinę
- Wersję dokumentu Polityki, na który się zgodziłeś
- Twój adres IP (w celu rozliczalności)

**Jeśli masz konto w Aplikacji** — zgody są dodatkowo zapisywane w naszej bazie i połączone z Twoim profilem. Możesz je w każdej chwili przejrzeć w panelu: Profil → "Moje zgody".

**Cofnięcie zgody** nie wpływa na zgodność z prawem przetwarzania, które odbyło się przed cofnięciem (art. 7 ust. 3 RODO).

---

## 6. Czas przechowywania cookies

| Typ | Maksymalny czas życia |
|---|---|
| Sesja (session cookies) | Do zamknięcia przeglądarki |
| Niezbędne trwałe | 7 dni |
| Funkcjonalne | 1 rok |
| Analityczne (GA) | 2 lata (lub 14 miesięcy — zależnie od konkretnego cookie) |
| Zgoda cookies | 1 rok |

Po upływie tego czasu cookies wygasają automatycznie.

---

## 7. Zmiany Polityki Cookies

Aktualizujemy tę Politykę w razie:
- Dodania/usunięcia narzędzi analitycznych
- Zmiany dostawców usług
- Zmian w przepisach prawa

O istotnych zmianach poinformujemy banerem na stronie z minimum 14-dniowym wyprzedzeniem.

**Historia zmian:**
- Wersja 1.0 — 17 kwietnia 2026 r. — pierwsza wersja
- Wersja 2.0 — 25 kwietnia 2026 r. — aktualizacja odzwierciedlająca realny stan techniczny (dodanie GA4, korekta nazw cookies NextAuth v5, aktualizacja listy sub-processorów)

---

## 8. Kontakt

W sprawach związanych z cookies i ochroną danych:

**E-mail:** rodo@e-dietetyk.com

**Administrator danych:**
e-dietetyk Wirgiliusz Ładziński
os. Pod Brzozami 16/8a, 03-995 Warszawa

**Zobacz także:**
- [Polityka Prywatności](/legal/polityka-prywatnosci)
- [Regulamin](/legal/regulamin)
