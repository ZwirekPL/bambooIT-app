# POLITYKA PRYWATNOŚCI

**bambooit.pl**

**Wersja 1.0 · Data wejścia w życie: [TBD — przed pierwszym klientem]**

> **UWAGA:** Ten dokument jest **wersją roboczą / stubem**. Przed pierwszym
> klientem MUSI zostać zweryfikowany przez prawnika i podpisany przez Administratora.
> Treść jest punktem wyjścia, nie wiążącym dokumentem prawnym.

---

## 1. Informacje ogólne

Niniejsza Polityka Prywatności wyjaśnia, w jaki sposób bambooIT (dalej „Administrator")
przetwarza dane osobowe użytkowników strony bambooit.pl oraz klientów korzystających
z naszych usług IT.

Działamy zgodnie z:
- Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (**RODO**)
- Ustawą z dnia 10 maja 2018 r. o ochronie danych osobowych
- Ustawą z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną

---

## 2. Administrator danych osobowych

**[TBD — uzupełnić po wyborze formy prawnej]**

- Nazwa: bambooIT
- Adres: [TBD]
- NIP: [TBD]
- Email kontaktowy: hello@bambooit.pl
- Telefon: [TBD]

W bambooIT **nie wyznaczyliśmy Inspektora Ochrony Danych (IOD)** — nie jest to wymagane
dla skali naszej działalności. Wszystkie pytania dotyczące ochrony danych kierować na
adres hello@bambooit.pl.

---

## 3. Jakie dane zbieramy

### 3.1 Dane z formularzy marketingowych (audyt, kontakt)
- Imię i nazwisko
- Nazwa firmy
- NIP (audyt)
- Email
- Telefon (opcjonalnie)
- Branża (audyt)
- Rozmiar zespołu (audyt)
- Treść wiadomości
- Adres IP, User-Agent (anti-spam)
- Czas i forma wyrażenia zgody RODO

### 3.2 Dane z rejestracji konta klienta
- Wszystko z 3.1 +
- Hasło (zaszyfrowane funkcją bcrypt, nie odzyskiwalne)
- Pełny adres firmy (ulica, kod pocztowy, miasto)
- Dane karty płatniczej **NIE są przechowywane** u nas — obsługuje je Stripe (PCI DSS)

### 3.3 Dane techniczne (automatyczne)
- Logi serwera (data, godzina, IP, User-Agent, ścieżka żądania)
- Cookies funkcjonalne i analityczne (zobacz Polityka Cookies)
- Audit log akcji administracyjnych

---

## 4. Cele i podstawy prawne przetwarzania

| Cel | Podstawa prawna | Dane |
|-----|----------------|------|
| Odpowiedź na zapytanie z formularza | Art. 6 ust. 1 lit. b RODO (działania na żądanie osoby) | 3.1 |
| Świadczenie usług IT (subskrypcja) | Art. 6 ust. 1 lit. b RODO (umowa) | 3.2 |
| Wystawianie faktur, księgowość | Art. 6 ust. 1 lit. c RODO (obowiązek prawny) | 3.2 + dane rozliczeniowe |
| Marketing własnych usług | Art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes) | email z 3.1 |
| Statystyki i analityka | Zgoda (cookies analityczne) | 3.3 |
| Bezpieczeństwo (anti-spam, logi) | Art. 6 ust. 1 lit. f RODO | 3.3 |

---

## 5. Okres przechowywania danych

- **Leady niezakwalifikowane (status REJECTED):** 90 dni od utworzenia
- **Leady pozostałe:** do momentu zakończenia kontaktu lub konwersji
- **Dane klientów po zakończeniu umowy:** 5 lat (wymóg podatkowy + ewentualne reklamacje)
- **Logi serwera:** 90 dni
- **Audit log:** 2 lata
- **Cookies analityczne:** zgodnie z konfiguracją (zwykle 13 miesięcy)

Po upływie okresu retencji dane są **automatycznie anonimizowane lub usuwane**.

---

## 6. Odbiorcy danych (podprocesorzy)

Korzystamy z następujących podprocesorów:

- **Stripe Payments Europe Ltd.** (Irlandia) — obsługa płatności, subskrypcji
- **[TBD — provider fakturowy]** — wystawianie faktur (decyzja: Fakturownia vs wfirma w trakcie)
- **[TBD — provider SMTP/Resend]** — wysyłka maili transakcyjnych
- **[TBD — provider hostingu]** — VPS Polska
- **Sentry GmbH** (Niemcy) — monitoring błędów (dane techniczne, bez PII po scrub)
- **AnyDesk Software GmbH** (Niemcy) — pomoc zdalna (sesja, brak długoterminowego przechowywania)

---

## 7. Transfery poza EOG

Standardowo dane przetwarzamy **w EOG**. Wyjątki:
- Sentry — dane techniczne mogą trafiać do USA (Standard Contractual Clauses)

---

## 8. Twoje prawa (RODO art. 15–22)

Masz prawo do:
- **Dostępu** do swoich danych
- **Sprostowania** nieprawidłowych danych
- **Usunięcia** („prawo do bycia zapomnianym")
- **Ograniczenia przetwarzania**
- **Przenoszenia** danych (eksport)
- **Sprzeciwu** wobec przetwarzania
- **Cofnięcia zgody** w dowolnym momencie
- **Skargi do Prezesa UODO** (ul. Stawki 2, 00-193 Warszawa)

Aby skorzystać z praw — napisz na hello@bambooit.pl. Odpowiadamy w ciągu 30 dni.

W panelu klienta dostępne są przyciski:
- **Eksportuj moje dane** (JSON)
- **Usuń moje konto** (soft delete + hard delete po 30 dniach)

---

## 9. Cookies

Szczegóły w osobnym dokumencie: [Polityka Cookies](/dokumenty-prawne#cookies).

---

## 10. Zmiany w polityce

Wszelkie zmiany publikujemy na tej stronie. O istotnych zmianach informujemy klientów
emailem co najmniej 30 dni przed wejściem w życie.

---

## 11. Kontakt

W razie pytań dotyczących ochrony danych:
- Email: hello@bambooit.pl
- Adres: [TBD]

---

*Status: stub roboczy. Wymaga weryfikacji prawnika przed wejściem w życie.*
