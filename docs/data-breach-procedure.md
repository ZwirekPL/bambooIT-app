# Procedura zgłaszania naruszeń ochrony danych

**Wersja:** 1.0
**Data utworzenia:** 17 kwietnia 2026 r.
**Administrator:** Wirgiliusz Ładziński (JDG)
**Kontakt awaryjny:** `kontakt@e-dietetyk.com`, tel. +48 515-530-088

**Podstawa prawna:**
- RODO Art. 33 — zgłoszenie naruszenia do organu nadzorczego (72 h)
- RODO Art. 34 — powiadomienie osób, których dane dotyczą (jeśli wysokie ryzyko)
- Ustawa o ochronie danych osobowych z 10 maja 2018 r.

---

## 1. Co to jest naruszenie ochrony danych

Zgodnie z RODO Art. 4 pkt 12 — naruszenie bezpieczeństwa prowadzące do:
- **Przypadkowego lub niezgodnego z prawem zniszczenia** (np. skasowanie bazy)
- **Utraty** (skradziony laptop z danymi)
- **Zmodyfikowania** (zmiana danych pacjenta przez nieupoważnioną osobę)
- **Nieuprawnionego ujawnienia** (wyciek bazy, dostęp osoby trzeciej)
- **Nieuprawnionego dostępu** (zhackowane konto admina)

dotyczącego danych osobowych przetwarzanych przez serwis.

### Przykłady realnych naruszeń w kontekście e-dietetyk.com

| Scenariusz | Powaga | Uwagi |
|---|---|---|
| Wyciek bazy PostgreSQL (dump publicznie dostępny) | **KRYTYCZNA** | Dane medyczne, email, imię |
| Zhackowane konto ADMIN | **KRYTYCZNA** | Dostęp do wszystkich pacjentów |
| Zhackowane konto pojedynczego DIETITIAN | **WYSOKA** | Dostęp do ~20-50 pacjentów |
| Zhackowane konto pojedynczego PATIENT | **ŚREDNIA** | Dostęp do własnych danych |
| Wyciek Sentry eventu z danymi medycznymi | **ŚREDNIA** | Po wdrożeniu scrubbera — mało prawdopodobne |
| Zagubiony laptop z kluczami `ENCRYPTION_KEY` | **KRYTYCZNA** | Bez samej bazy → niski real-world; Z bazą → katastrofa |
| Błąd w kodzie ujawnia dane innego pacjenta | **WYSOKA** | Wymaga natychmiastowej łatki |
| Wyciek przez podprocesora (OpenAI, Stripe, Resend) | zależnie | Powiadomienie nas przez podprocesora, czas liczy się od TEGO momentu |

---

## 2. Timeline — co musi się stać w ciągu 72 godzin

```
T+0h       Wykrycie / otrzymanie zgłoszenia
  │
  ├─ T+1h  Triage — ocena czy to naruszenie i jego zakres
  ├─ T+4h  Natychmiastowe środki zaradcze (izolacja, reset haseł, rollback)
  ├─ T+24h Pełna analiza: jakie dane, iloma osobami, jak długo naraża
  ├─ T+48h Decyzja: czy zgłosić do UODO (tak, jeśli ryzyko > znikome)
  └─ T+72h ZGŁOSZENIE DO UODO (formularz online, patrz sekcja 5)

T+72h++    Jeśli wysokie ryzyko dla osób → powiadomienie osób (Art. 34 RODO)
```

**Liczenie zegara zaczyna się od momentu uzyskania świadomości naruszenia,
nie od jego wystąpienia.** Jeśli naruszenie wystąpiło w maju, ale dowiedziałeś
się w czerwcu, 72h liczymy od czerwca.

---

## 3. Jak wykryć naruszenie — sygnały ostrzegawcze

### Monitoring techniczny
- **Sentry alerty** (https://sentry.io/organizations/<org>/issues/) — nagły wzrost błędów 5xx, dziwne stack traces
- **Backend logs** — `docker compose logs backend | grep -iE "error|unauthorized|403|401"`
- **AuditLog anomaly** — nagły wzrost `VIEW_PATIENT` / `EXPORT_PLAN` przez jednego usera
- **Logi nginx** — szukanie podejrzanych wzorców:
  ```bash
  docker compose logs nginx | grep -E "sqlmap|nikto|acunetix|w00t"
  ```
- **Backup health** — kontener `dietetyk_backup` nie wykonał backupu przez 24h
- **Postgres slow query** — zapytania na dużych tabelach (potencjalny scrape)

### Zewnętrzne zgłoszenia
- **Pacjent pisze** — "dostałem e-mail od obcej osoby z moimi danymi"
- **Responsible disclosure** od researchera (X/Twitter, email)
- **Podprocesor informuje** — OpenAI/Stripe/Resend/Hostinger wysłał notyfikację o incydencie po swojej stronie
- **Hosting alert** — Hostinger wysłał powiadomienie o nieautoryzowanym dostępie do VPS
- **UODO/media** — nagłówek "Wyciek z e-dietetyk.com" (najgorszy scenariusz, reaktywny)

---

## 4. Procedura krok po kroku

### Krok 1. **Triage (w ciągu 1h od wykrycia)**

1. Zapisz dokładny moment wykrycia (timestamp) — to start zegara 72h.
2. Zabezpiecz dowody: zrzut logów, screenshoty konsoli, kopie zgłoszeń.
   Umieść je w bezpiecznym folderze `incident-YYYY-MM-DD/`:
   ```bash
   ssh root@31.97.75.190
   mkdir -p /root/incidents/$(date +%Y-%m-%d)
   docker compose logs > /root/incidents/$(date +%Y-%m-%d)/docker-logs.txt
   ```
3. Określ wstępnie:
   - **Jakie dane** (email? medyczne? hasła?)
   - **Ile osób** (1 / dziesiątki / tysiące?)
   - **Czy nadal trwa** (wektor ataku otwarty?)
   - **Kto mógł uzyskać dostęp**

### Krok 2. **Natychmiastowe środki zaradcze (w ciągu 4h)**

Nie czekaj aż zrozumiesz wszystko — **zatrzymaj krwawienie**.

- [ ] **Jeśli zhackowane konto:** reset hasła + unieważnienie wszystkich tokenów JWT tego usera (endpoint `POST /auth/admin/revoke-sessions`)
- [ ] **Jeśli SQL injection / RCE:** wyłącz aplikację (`docker compose stop web backend`) zanim naprawisz; lepiej downtime niż dalszy wyciek
- [ ] **Jeśli wyciek przez kod:** natychmiastowy hotfix (nawet brzydki), deploy, potem code review
- [ ] **Jeśli kompromitacja VPS:** rotacja wszystkich sekretów (`ENCRYPTION_KEY`, `JWT_SECRET`, `AUTH_SECRET`, `BACKUP_PASSPHRASE`, API keys Stripe/Resend/Sentry/OpenAI)
- [ ] **Zablokuj IP napastnika** w nginx lub na poziomie Hostinger firewall
- [ ] **Zmień hasła admina i dostęp SSH** (dodaj MFA na poziomie Hostinger, wygeneruj nowy klucz SSH)

### Krok 3. **Pełna analiza (w ciągu 24h)**

Uzupełnij formularz analizy (załącznik A, poniżej) — wypełnij wszystkie pola.
Jeśli brakuje informacji, napisz "nieznane na moment T+24h". UODO rozumie że
analiza wymaga czasu — możesz **zgłosić częściowo** i uzupełnić później.

### Krok 4. **Decyzja o zgłoszeniu do UODO**

**ZGŁOSIĆ** jeśli:
- Wyciekły dane medyczne (art. 9 RODO) — **zawsze**
- Wyciekły dane identyfikacyjne >100 osób
- Brak możliwości oszacowania zakresu
- Rozsądna wątpliwość → domyślnie **zgłoś**

**NIE zgłaszać** tylko jeśli:
- Zaszyfrowane dane + klucz nie wyciekł (ryzyko "znikome")
- Dane nie-osobowe (np. logi bez ID)
- Pomyłkowy incydent bez realnego ujawnienia (np. błędny e-mail wysłany do jednej osoby i odzyskany)

W razie wątpliwości → zgłoś. Kara za niezgłoszenie jest większa niż za false-positive.

### Krok 5. **Zgłoszenie do UODO (w ciągu 72h)**

**Portal:** https://uodo.gov.pl/pl/134/233 (elektroniczny formularz)
**Formularz PDF (alternatywa):** https://uodo.gov.pl/pl/p/formularze

**Co musi być w zgłoszeniu** (Art. 33 ust. 3 RODO):
1. Charakter naruszenia (co się stało)
2. Kategorie i przybliżona liczba osób dotkniętych
3. Kategorie i przybliżona liczba wpisów danych
4. Dane kontaktowe IOD (jeśli wyznaczony) lub administratora
5. Możliwe konsekwencje naruszenia
6. Zastosowane lub proponowane środki zaradcze

Szablon zgłoszenia — załącznik B poniżej.

### Krok 6. **Powiadomienie osób fizycznych (jeśli wysokie ryzyko)**

**Wymagane** jeśli naruszenie prawdopodobnie skutkuje **wysokim ryzykiem** dla
praw i wolności osób (Art. 34 RODO). Przykłady: kradzież tożsamości, utrata
kontroli nad danymi medycznymi, dyskryminacja, straty finansowe.

**Nie jest wymagane** jeśli dane były szyfrowane (i klucz nie wyciekł) lub
administrator podjął środki eliminujące wysokie ryzyko.

Sposób powiadomienia:
1. E-mail do każdej osoby dotkniętej (z konta `kontakt@e-dietetyk.com`)
2. Komunikat na stronie głównej (jeśli >100 osób)
3. Treść — zrozumiała, bez żargonu technicznego (patrz szablon, załącznik C)

### Krok 7. **Post-mortem i dokumentacja**

W ciągu 7 dni od zgłoszenia:
- Sporządź "post-mortem" w `docs/incidents/YYYY-MM-DD-<slug>.md`
- Lista **wniosków** — co zmieniamy żeby się nie powtórzyło
- Aktualizuj procedury, kod, konfigurację (PR z łatką)
- Zapisz w AuditLog: `action: 'SECURITY_INCIDENT_RESOLVED'`

---

## 5. Kontakty awaryjne

| Rola | Kontakt |
|---|---|
| Administrator danych | Wirgiliusz Ładziński, `kontakt@e-dietetyk.com`, tel. +48 515-530-088 |
| UODO (organ nadzorczy) | Urząd Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa. Infolinia: 606-950-000, e-mail: `kancelaria@uodo.gov.pl` |
| Hostinger (incydent VPS) | https://www.hostinger.com/support → Chat 24/7 |
| OpenAI (incydent API) | `security@openai.com` |
| Stripe (incydent płatności) | https://support.stripe.com |
| Sentry (incydent monitorowania) | `security@sentry.io` |
| Resend (incydent email) | `security@resend.com` |
| Google (incydent GA4) | https://support.google.com/analytics |
| CERT Polska (jeśli potrzebna pomoc techniczna) | `cert@cert.pl`, https://cert.pl |
| Radca prawny / IOD (jeśli wyznaczony) | TBD — dodać dane po wyborze |

---

## Załącznik A — formularz analizy incydentu

Wypełnij w ciągu 24h od wykrycia.

```
1. Data i godzina wykrycia:                      __________________________
2. Data i godzina wystąpienia (jeśli znana):     __________________________
3. Sposób wykrycia (Sentry / zgłoszenie / ...):  __________________________
4. Krótki opis naruszenia:                       __________________________
                                                 __________________________
5. Kategorie danych (zaznacz):
   [ ] imię, nazwisko
   [ ] e-mail, telefon
   [ ] dane logowania (hasło zhash., token)
   [ ] dane medyczne (waga, choroby, leki)
   [ ] dane wywiadu dietetycznego
   [ ] plany dietetyczne, notatki dietetyka
   [ ] dane finansowe (transakcje Stripe)
   [ ] inne: _______________
6. Liczba osób dotkniętych (przybliżona):        __________________________
7. Czy naruszenie nadal trwa?                    [ ] tak  [ ] nie
8. Zastosowane środki zaradcze:                  __________________________
                                                 __________________________
9. Oszacowanie ryzyka dla osób fizycznych:
   [ ] niskie      [ ] średnie      [ ] wysokie
   Uzasadnienie:                                 __________________________
10. Decyzja o zgłoszeniu do UODO (Art. 33):      [ ] tak  [ ] nie
    Jeśli NIE — uzasadnienie:                    __________________________
11. Decyzja o powiadomieniu osób (Art. 34):      [ ] tak  [ ] nie
    Jeśli NIE — uzasadnienie:                    __________________________
12. Data i godzina zgłoszenia do UODO:           __________________________
13. Numer referencyjny zgłoszenia UODO:          __________________________
```

---

## Załącznik B — szablon zgłoszenia do UODO

```
Do: Urząd Ochrony Danych Osobowych
Od: Wirgiliusz Ładziński, e-dietetyk.com, NIP [TBD]
Data: [wypełnij]

Temat: Zgłoszenie naruszenia ochrony danych osobowych
       zgodnie z art. 33 RODO

1. ADMINISTRATOR DANYCH
   Nazwa: Wirgiliusz Ładziński (jednoosobowa działalność gospodarcza)
   Adres: ul. Pod Brzozami 16/8a, 03-995 Warszawa
   Email: kontakt@e-dietetyk.com
   Telefon: +48 515-530-088

2. CHARAKTER NARUSZENIA
   Data i godzina wystąpienia: [uzupełnij]
   Data i godzina wykrycia:     [uzupełnij]
   Rodzaj naruszenia:
     [ ] poufności (ujawnienie)
     [ ] integralności (modyfikacja)
     [ ] dostępności (utrata)
   Krótki opis: [opisz co się stało, w 2-3 zdaniach]

3. KATEGORIE DANYCH
   [lista, np. imię, email, dane zdrowotne z wywiadu dietetycznego]

4. KATEGORIE I LICZBA OSÓB
   Kategoria: użytkownicy serwisu e-dietetyk.com (pacjenci i dietetycy)
   Przybliżona liczba: [uzupełnij]

5. KATEGORIE I LICZBA WPISÓW
   Przybliżona liczba wpisów danych: [uzupełnij]

6. MOŻLIWE KONSEKWENCJE
   [opisz ryzyka, np. kradzież tożsamości, dyskryminacja, wycieki medyczne]

7. ŚRODKI ZARADCZE JUŻ ZASTOSOWANE
   [lista konkretnych działań, np. reset haseł, łatka bezpieczeństwa,
    rotacja kluczy]

8. ŚRODKI ZARADCZE PROPONOWANE
   [co planujesz dalej, np. wdrożenie 2FA dla ADMIN, audyt kodu]

9. INFORMACJA O POWIADOMIENIU OSÓB
   [tak / nie / planowane — sposób i data]

10. ZAŁĄCZNIKI
    - Logi techniczne (jeśli dostępne)
    - Post-mortem incydentu

Podpis: Wirgiliusz Ładziński
```

---

## Załącznik C — szablon e-maila do pacjenta (Art. 34 RODO)

```
Od: e-dietetyk.com <kontakt@e-dietetyk.com>
Temat: Ważna informacja o bezpieczeństwie Twojego konta — e-dietetyk.com

Cześć [imię],

piszemy z ważną informacją o incydencie bezpieczeństwa, który mógł dotyczyć
Twoich danych w serwisie e-dietetyk.com.

CO SIĘ STAŁO
[opisz incydent w zrozumiały sposób, 2-3 zdania — bez żargonu]

KIEDY
Incydent został wykryty: [data, godzina]
Do naruszenia mogło dojść: [zakres czasowy]

JAKIE DANE MOGŁY BYĆ DOTKNIĘTE
[lista konkretna, np. "Twoje imię, adres e-mail oraz odpowiedzi z wywiadu
dietetycznego"]

JAKIE DANE NIE BYŁY DOTKNIĘTE
[lista, np. "Twoje hasło (przechowywane w formie haszowanej, nie jest
odczytywalne)"]

CO ZROBILIŚMY
- [konkretne działanie 1]
- [konkretne działanie 2]
- [konkretne działanie 3]

CO POWINIENEŚ ZROBIĆ
1. Zmień hasło w serwisie e-dietetyk.com
2. Jeśli używałeś tego samego hasła gdzie indziej — zmień też tam
3. Uważaj na podejrzane e-maile podające się za nasz serwis — nigdy nie
   prosimy o hasło ani dane karty w e-mailu

NASZE DANE KONTAKTOWE
Pytania / obawy: kontakt@e-dietetyk.com, tel. +48 515-530-088

ZGŁOSZENIE DO UODO
Zgodnie z obowiązkiem prawnym zgłosiliśmy naruszenie do Urzędu Ochrony
Danych Osobowych w dniu [data]. Numer referencyjny: [numer].

Ponadto masz prawo złożyć skargę bezpośrednio do UODO:
https://uodo.gov.pl/pl/p/kontakt

Przepraszamy za niedogodności. Twoje bezpieczeństwo jest dla nas priorytetem.

Pozdrawiam,
Wirgiliusz Ładziński
e-dietetyk.com
```

---

## Historia zmian

| Data | Zmiana |
|---|---|
| 2026-04-17 | Utworzenie dokumentu (pierwsza wersja procedury) |
