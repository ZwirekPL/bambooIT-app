# Sentry PII scrubbing

Dokument opisuje mechanizm filtrowania danych osobowych i medycznych
przed wysłaniem eventów do Sentry. Wdrożone w ramach RODO Fala 1,
zadanie 1.2.

## Region Sentry

**US (sentry.io)** — zgodnie z decyzją 2026-04-17. Transfer danych
do Functional Software, Inc. (USA) opiera się na Standardowych
Klauzulach Umownych (SCC). Dodać do `docs/legal/osoba-fizyczna/polityka-prywatnosci.md`
oraz `docs/subprocessors.md`.

Rozważyć migrację na `de.sentry.io` przy najbliższym większym przeglądzie
zgodności (argumenty: mniej papierologii, brak potrzeby SCC).

## Co jest filtrowane

### Session Replay (frontend)

Włączone globalne maskowanie:

- `maskAllText: true` — wszystkie teksty w DOM zamaskowane
- `maskAllInputs: true` — wszystkie inputy zamaskowane (nie tylko `type=password`)
- `blockAllMedia: true` — obrazy, video, audio blokowane

Sampling:
- `replaysSessionSampleRate: 0.1` w prod, `0` poza prod
- `replaysOnErrorSampleRate: 1.0` w prod, `0` poza prod

### Usuwane klucze (deep scrubbing)

Scrubber (`apps/web/src/lib/sentry-scrub.ts` + `apps/backend/src/utils/sentry.ts`)
podmienia wartości na `[REDACTED]` dla kluczy (case-insensitive):

| Klucz | Kontekst |
|-------|----------|
| `password`, `passwordHash`, `password_hash` | logowanie, rejestracja |
| `answers` | `Interview.answers` (art. 9 RODO) |
| `medicalFlags`, `medical_flags` | `Interview.medicalFlags` (art. 9 RODO) |
| `content` | `DietPlan.content`, `DietitianNote.content`, `Message.content` |
| `rawResponse`, `raw_response` | surowe odpowiedzi AI (mogą zawierać PII) |
| `authorization`, `cookie`, `set-cookie` | nagłówki HTTP |
| `apiKey`, `api_key`, `token`, `access_token`, `refresh_token` | sekrety |
| `encryption_key`, `secret` | klucze szyfrujące |

### Obszary event'u przetwarzane przez scrubber

- `event.request.data` — body requestu
- `event.request.headers` — nagłówki (w tym Authorization, Cookie)
- `event.request.cookies` — ciasteczka (zastępowane `[REDACTED]`)
- `event.extra` — dodatkowy kontekst przekazany przez `captureException(err, context)`
- `event.breadcrumbs[].data` — dane w breadcrumbach
- `event.user.email` — **usuwany**, zostaje tylko `id` + `username` (rola)
- `event.user.ip_address` — **usuwany**

### Co NIE jest scrubowane

- `event.contexts` — pozostaje (Sentry wewnętrzna struktura: runtime, os, etc.)
- `event.exception.values[].stacktrace` — stack traces zostają (kod open-source,
  zmienne lokalne **nie** są wysyłane przez Sentry domyślnie)
- `event.message` i `event.exception.values[].value` — nie są filtrowane,
  więc **nie wrzucaj PII do `throw new Error("user email: x@y.com")`** (sprawdzić
  code review).

### Filtry HTTP status code

Eventy z `response.status_code 400-499` są **odrzucane** (zwraca `null`
z `beforeSend`) — błędy walidacji/auth to nie błędy aplikacji.

## Pliki implementujące

- `apps/web/src/lib/sentry-scrub.ts` — helper shared przez client/server/edge
- `apps/web/src/instrumentation-client.ts` — client init z Session Replay masking
- `apps/web/sentry.client.config.ts` — legacy fallback (identyczna config)
- `apps/web/sentry.server.config.ts` — server init
- `apps/web/sentry.edge.config.ts` — edge init
- `apps/backend/src/utils/sentry.ts` — backend init + shared scrubber inline

## Jak testować

1. Wywołać celowo błąd w endpoint'cie zawierający wrażliwe pole w body:
   ```
   curl -X POST http://localhost:4000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.pl","password":"very-secret-pass"}'
   ```
2. Sprawdzić event w Sentry UI → `request.data.password` powinno być
   `[REDACTED]`.
3. Session Replay → otworzyć nagranie → sprawdzić że wszystkie teksty
   (np. imiona pacjentów) są zamazane.

## Historyczne eventy (przed 2026-04-17)

Audit rekomenduje **przegląd historycznych eventów w Sentry UI**
(prod region US) pod kątem wycieku PII z okresu sprzed wdrożenia
scrubbera. Eventy starsze niż 90 dni są automatycznie usuwane przez
Sentry (domyślna retencja).

**TODO:** manualny przegląd przez administratora (wirigiliusz@gmail.com).

## Zmiana listy kluczy

Przy dodawaniu nowych wrażliwych pól (np. kolejne pole medyczne):

1. Dodaj klucz do `SENSITIVE_KEYS` w OBU plikach:
   - `apps/web/src/lib/sentry-scrub.ts`
   - `apps/backend/src/utils/sentry.ts`
2. Zaktualizuj tabelę powyżej w tym pliku.
3. Wdróż równolegle frontend i backend.
