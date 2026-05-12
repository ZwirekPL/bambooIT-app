# RULES.md — bambooIT

> **Szczegółowe konwencje kodu i recenzji** dla projektu bambooIT.
> CLAUDE.md zawiera HARD RULES (co WOLNO/NIE WOLNO). RULES.md zawiera *jak* pisać kod — konwencje, wzorce, format API, error handling, logging, testowanie.

**Czytany przez:** Claude Code przy każdej sesji + dev review.

---

## 0. Hierarchia dokumentów

1. **CLAUDE.md** — HARD RULES (override wszystkiego), workflow Claude Code, stack
2. **DECISION_LOG.md** — DLACZEGO (decyzje strategiczne)
3. **RULES.md** (ten plik) — JAK (konwencje implementacyjne)
4. **PRD.md** — biznes
5. **TODO.md** — CO (zadania do zrobienia, po cleanupie)

---

## 1. Struktura plików i nazewnictwo

### 1.1 Frontend (`apps/web/src`)

```
app/
  [locale]/
    layout.tsx              # Root layout z i18n
    page.tsx                # Strona główna
    pakiety/page.tsx
    o-nas/page.tsx
    blog/
      page.tsx              # Lista wpisów
      [slug]/page.tsx       # Pojedynczy wpis
    api/
      auth/[...nextauth]/route.ts
      proxy/[...path]/route.ts
components/
  ui/                       # shadcn/ui (button, card, etc.) - NIE TYKAMY
  layout/                   # Header, Footer, Providers
  marketing/                # Hero, PackagesSection, AuditForm, ...
  panel/                    # Komponenty panelu klienta
  chat/                     # ChatWidget (Claude API chat)
  legal/                    # CookieBanner, LegalMarkdown
  analytics/                # GoogleAnalytics, MetaPixel
hooks/
  useToast.ts
  useMediaQuery.ts
lib/
  api.ts                    # Frontend → backend API client
  utils.ts                  # cn() i inne
  validators/
    nip.ts                  # Polish NIP validator
    common.ts
i18n/
  config.ts
  routing.ts
types/
  api.ts                    # Shared types z backend
messages/
  pl.json
  en.json                   # stub
```

### 1.2 Backend (`apps/backend/src`)

```
server.ts                   # Express bootstrap
config/
  env.ts                    # Zod-validated env vars
  index.ts
controllers/
  audit.controller.ts       # POST /audit-form
  company.controller.ts     # CRUD firmy klienta
  subscription.controller.ts
  ...
services/
  audit.service.ts
  company.service.ts
  stripe.service.ts
  fakturownia.service.ts
  claude.service.ts         # Anthropic SDK wrapper
  email.service.ts          # Resend wrapper
  ...
routes/
  audit.routes.ts
  company.routes.ts
  ...
middleware/
  auth.ts
  errorHandler.ts
  rateLimit.ts
  validation.ts             # Zod request validation
utils/
  logger.ts                 # pino instance
  errors.ts                 # AppError class
  encryption.ts             # PII encryption
  sentry.ts
types/
  index.ts
  api.ts
jobs/                       # Cron jobs (BullMQ alternative — node-cron lub queue)
  cleanupSoftDeleted.job.ts
__tests__/
  controllers/
    audit.test.ts
  services/
    stripe.test.ts
```

### 1.3 Konwencje nazewnictwa plików

| Typ | Konwencja | Przykład |
|---|---|---|
| React komponent | `PascalCase.tsx` | `AuditForm.tsx` |
| Hook | `useCamelCase.ts` | `useAuditForm.ts` |
| Service | `kebab-case.service.ts` | `audit.service.ts` |
| Controller | `kebab-case.controller.ts` | `audit.controller.ts` |
| Routes | `kebab-case.routes.ts` | `audit.routes.ts` |
| Middleware | `camelCase.ts` | `errorHandler.ts` |
| Utility | `kebab-case.ts` | `nip.ts`, `format-date.ts` |
| Test | `*.test.ts` lub `*.spec.ts` | `audit.test.ts` |
| Type definitions | `kebab-case.ts` | `api-types.ts` |

### 1.4 Konwencje TypeScript

```typescript
// Interfaces / Types — PascalCase
interface CompanyDto {
  id: string;
  name: string;
  nip: string;
}

type AuditFormStatus = 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'COMPLETED' | 'REJECTED';

// Enums — PascalCase z wartościami SCREAMING_SNAKE_CASE
enum ProductType {
  START = 'START',
  FIRMA = 'FIRMA',
  FIRMA_PLUS = 'FIRMA_PLUS'
}

// Funkcje — camelCase, zaczynają się od czasownika
function calculateMonthlyRevenue(subscriptions: Subscription[]): number {}
async function fetchInvoicesFromFakturownia(companyId: string) {}

// Konstanty — SCREAMING_SNAKE_CASE
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const STRIPE_API_VERSION = '2024-11-20.acacia';

// Boolean variables — prefix is/has/can/should
const isAuthenticated = true;
const hasActiveSubscription = false;
const canEdit = user.role === 'ADMIN';
```

### 1.5 Konwencje Prisma

```prisma
// Modele — PascalCase singular (Company, nie Companies)
model Company {
  id        String   @id @default(cuid())
  name      String
  nip       String   @unique
  
  // Relacje — nazwa modelu w camelCase
  users         User[]
  subscriptions Subscription[]
  invoices      Invoice[]
  
  // Foreign keys — camelCase z suffixem Id
  createdById   String?
  createdBy     User?   @relation(...)
  
  // Pola czasowe — zawsze createdAt + updatedAt
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Soft delete — używamy gdy istnieje requirement RODO retention
  deletedAt DateTime?
  
  @@index([nip])
  @@map("companies")  // snake_case w bazie
}

// Enum values — SCREAMING_SNAKE_CASE
enum UserRole {
  ADMIN
  CLIENT
}

enum ProductType {
  START
  FIRMA
  FIRMA_PLUS
}
```

**Field naming:**
- `Decimal` dla cen (NIE `Float` — bugi zaokrąglania): `monthlyPriceNet Decimal @db.Decimal(10, 2)`
- `DateTime` dla dat z czasem
- `Date` dla dat bez czasu (Postgres `DATE`)
- `Json` dla struktur (np. `features Json`, `metadata Json`)
- `String` dla emaili/identyfikatorów — Stripe IDs, Fakturownia IDs

---

## 2. Format API response

### 2.1 Standardowy format odpowiedzi

**Sukces (200/201):**
```typescript
{
  data: T;
  meta?: {
    pagination?: { page: number; limit: number; total: number };
    timestamp?: string;
  };
}
```

**Błąd (4xx/5xx):**
```typescript
{
  error: {
    code: string;        // 'VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED', ...
    message: string;     // Human-readable, PL dla user-facing, EN dla dev
    details?: unknown;   // Dodatkowe info (np. Zod issues)
    requestId?: string;  // Sentry / log correlation ID
  };
}
```

**Przykład sukces:**
```typescript
res.status(200).json({
  data: {
    id: company.id,
    name: company.name,
    nip: company.nip,
  },
  meta: { timestamp: new Date().toISOString() }
});
```

**Przykład błąd:**
```typescript
res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Nieprawidłowy NIP',
    details: zodError.issues,
    requestId: req.id,
  }
});
```

### 2.2 Kody HTTP

| Kod | Kiedy |
|---|---|
| 200 OK | GET sukces, PATCH/PUT sukces |
| 201 Created | POST sukces tworzący zasób |
| 204 No Content | DELETE sukces |
| 400 Bad Request | Walidacja request body (Zod) |
| 401 Unauthorized | Brak/nieprawidłowy JWT |
| 403 Forbidden | Auth OK, ale brak uprawnień (np. CLIENT chce dostęp do innej Company) |
| 404 Not Found | Zasób nie istnieje |
| 409 Conflict | NIP już istnieje, email zajęty |
| 422 Unprocessable Entity | Biznes-walidacja po bazie (np. brak słownika) |
| 429 Too Many Requests | Rate limit |
| 500 Internal Server Error | Nieoczekiwany błąd |
| 503 Service Unavailable | Stripe/Fakturownia/Anthropic niedostępne |

### 2.3 Standardowe error codes

```typescript
// utils/errors.ts
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    public userMessage: string,  // PL, user-facing
    public details?: unknown
  ) {
    super(userMessage);
  }
}

// Użycie:
throw new AppError(
  ErrorCode.NOT_FOUND,
  404,
  'Firma nie została znaleziona',
);
```

---

## 3. Validation (Zod)

### 3.1 Każdy request body waliduj przez Zod

**Route-level schema:**
```typescript
// validation/auditForm.schema.ts
import { z } from 'zod';
import { nipSchema } from './shared.schema';

export const auditFormSchema = z.object({
  name: z.string().min(2).max(100),
  company: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[0-9\s-]{9,15}$/),
  employees: z.enum(['1-3', '4-7', '8-15', '16-30', '30+']),
  problem: z.string().min(10).max(2000),
  gdprConsent: z.literal(true, {
    errorMap: () => ({ message: 'Wymagana zgoda na przetwarzanie danych' })
  }),
});

export type AuditFormInput = z.infer<typeof auditFormSchema>;
```

**Middleware:**
```typescript
// middleware/validation.ts
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Nieprawidłowe dane formularza',
        details: result.error.issues,
      }
    });
  }
  req.validatedBody = result.data;
  next();
};

// Użycie w route:
router.post('/audit-form', validate(auditFormSchema), auditController.submit);
```

### 3.2 Shared schemas

`validation/shared.schema.ts` zawiera wzorce reużywalne:
- `nipSchema` — polski NIP z checksum validation
- `emailSchema` — email z lower-case normalization
- `phoneSchema` — polski telefon (różne formaty)
- `passwordSchema` — min 8 znaków, 1 wielka, 1 cyfra, 1 znak specjalny

### 3.3 Frontend reuse

```typescript
// apps/web/src/components/marketing/AuditForm.tsx
import { auditFormSchema, type AuditFormInput } from '@/types/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm<AuditFormInput>({
  resolver: zodResolver(auditFormSchema),
});
```

**Wpływ:** współdzielone typy między backend i frontend (single source of truth).

---

## 4. Error handling

### 4.1 Backend — controllers cienkie, services wyrzucają błędy

```typescript
// controller — cienki, łapie błąd, zwraca response
export async function submitAuditForm(req: Request, res: Response, next: NextFunction) {
  try {
    const submission = await auditService.create(req.validatedBody, req.context);
    res.status(201).json({ data: submission });
  } catch (error) {
    next(error);  // Przekazujemy do error handler middleware
  }
}

// service — wyrzuca AppError, nie response
export async function create(input: AuditFormInput, ctx: RequestContext) {
  const existing = await prisma.auditFormSubmission.findFirst({
    where: { email: input.email, createdAt: { gte: subDays(new Date(), 1) } }
  });
  
  if (existing) {
    throw new AppError(
      ErrorCode.CONFLICT,
      409,
      'Już zgłosiłeś audyt w ciągu ostatnich 24h. Sprawdź email.',
    );
  }
  
  return prisma.auditFormSubmission.create({ data: input });
}
```

### 4.2 Global error handler middleware

```typescript
// middleware/errorHandler.ts
export function errorHandler(err, req, res, next) {
  // Sentry capture (z PII scrubbing)
  Sentry.captureException(err, { tags: { requestId: req.id } });
  
  // AppError — kontrolowany błąd
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.userMessage,
        details: err.details,
        requestId: req.id,
      }
    });
  }
  
  // ZodError — nie powinien tu trafić (middleware validation łapie), ale safety
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Nieprawidłowe dane',
        details: err.issues,
      }
    });
  }
  
  // Prisma — typed errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: ErrorCode.CONFLICT,
        message: 'Rekord o tych danych już istnieje',
      }
    });
  }
  
  // Unknown — generic 500, NIE pokazuj user'owi szczegółów
  logger.error({ err, requestId: req.id }, 'Unhandled error');
  return res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Wystąpił błąd serwera. Spróbuj ponownie lub skontaktuj się z nami.',
      requestId: req.id,
    }
  });
}
```

### 4.3 Frontend — `lib/api.ts` rzuca błędami

```typescript
// lib/api.ts
export async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, options);
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body?.error?.code ?? 'NETWORK_ERROR',
      body?.error?.message ?? 'Wystąpił błąd. Spróbuj ponownie.',
      res.status,
      body?.error?.details
    );
  }
  
  const body = await res.json();
  return body.data;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
  }
}
```

**Komponenty obsługują przez try/catch z react-hook-form lub useState:**

```typescript
const onSubmit = async (data: AuditFormInput) => {
  try {
    await apiCall('/audit-form', { method: 'POST', body: JSON.stringify(data) });
    toast.success('Dziękujemy! Skontaktujemy się w 24h.');
    form.reset();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CONFLICT') {
      toast.error(error.message);
    } else {
      toast.error('Wystąpił błąd. Spróbuj ponownie.');
    }
  }
};
```

### 4.4 NIGDY

❌ `try { ... } catch (e) {}` — silent catch
❌ `try { ... } catch (e) { console.log(e); }` — bez ponownego rzucenia ani user feedback
❌ `@ts-ignore` żeby pominąć błąd typu
❌ Pokazywanie stack trace user'owi w produkcji
❌ Generic "Something went wrong" bez differentiation w error code

---

## 5. Logging

### 5.1 Używamy `pino` (re-use z e-dietetyk), NIE `console.log`

```typescript
// utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  // PII scrubbing w produkcji
  redact: {
    paths: [
      '*.password', '*.token', '*.secret', '*.apiKey',
      '*.email', '*.phone', '*.nip',  // Hash PII zamiast plain
      'req.headers.authorization', 'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});
```

### 5.2 Poziomy logowania

```typescript
logger.fatal(...)  // System down, niemożliwy do recover
logger.error(...)  // Unhandled error, wymaga uwagi
logger.warn(...)   // Coś dziwnego, ale OK (deprecated API, retry success)
logger.info(...)   // Lifecycle events (user signed up, payment processed)
logger.debug(...)  // Development only (request payload, query params)
logger.trace(...)  // Bardzo szczegółowo, do debugowania
```

### 5.3 Strukturalny format (object first, message second)

```typescript
// ✅ DOBRZE
logger.info({ userId: user.id, companyId: company.id, plan: 'FIRMA' }, 'New subscription created');

// ❌ ŹLE — string concatenation
logger.info(`New subscription for user ${user.id}, company ${company.id}`);
```

### 5.4 Sentry capture w `error` i `fatal`

```typescript
catch (err) {
  Sentry.captureException(err, {
    user: { id: req.user?.id },
    tags: { requestId: req.id, route: req.path },
    extra: { body: req.body },  // PII scrubbed by Sentry config
  });
  logger.error({ err, requestId: req.id }, 'Failed to process payment');
  throw err;
}
```

### 5.5 NIGDY

❌ `console.log(...)` w produkcji
❌ Logowanie haseł, tokenów, kluczy API (nawet w debug)
❌ Logowanie pełnych PII (email, NIP, telefon) — zawsze maskuj lub hashuj
❌ Logger.debug w hot path produkcji (performance)

---

## 6. Authentication & Authorization

### 6.1 Backend — middleware `requireAuth`

```typescript
// middleware/auth.ts
export const requireAuth = (...allowedRoles: UserRole[]) => async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Wymagane logowanie');
  }
  
  const payload = verifyJWT(token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  
  if (!user || (allowedRoles.length && !allowedRoles.includes(user.role))) {
    throw new AppError(ErrorCode.FORBIDDEN, 403, 'Brak uprawnień');
  }
  
  req.user = user;
  next();
};

// Użycie:
router.get('/admin/dashboard', requireAuth('ADMIN'), adminController.dashboard);
router.get('/panel/subscription', requireAuth(), panelController.getSubscription);
```

### 6.2 Frontend — NextAuth session

```typescript
// app/(panel)/panel/layout.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function PanelLayout({ children }) {
  const session = await auth();
  if (!session) redirect('/zaloguj');
  return <>{children}</>;
}
```

### 6.3 Session callback (NextAuth v5 gotcha)

```typescript
// auth.config.ts
export const authConfig = {
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
        role: token.role,
      },
    }),
    jwt: ({ token, user }) => {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
  },
};
```

### 6.4 RBAC — sprawdzanie uprawnień per resource

```typescript
// service-level
export async function getCompanyById(id: string, requester: User) {
  const company = await prisma.company.findUnique({ where: { id } });
  
  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'Firma nie znaleziona');
  }
  
  // ADMIN widzi wszystkie, CLIENT tylko swoją
  if (requester.role !== 'ADMIN' && company.id !== requester.companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, 403, 'Brak dostępu do tej firmy');
  }
  
  return company;
}
```

---

## 7. Database access

### 7.1 Zawsze przez Prisma, nigdy raw SQL (chyba że konieczne)

```typescript
// ✅ DOBRZE
const company = await prisma.company.findUnique({
  where: { nip: input.nip },
  include: { subscriptions: { where: { status: 'ACTIVE' } } },
});

// ❌ ŹLE (chyba że Prisma nie daje rady — wtedy z komentarzem dlaczego)
const result = await prisma.$queryRaw`SELECT * FROM companies WHERE nip = ${input.nip}`;
```

### 7.2 Transakcje gdzie operacje muszą być atomowe

```typescript
await prisma.$transaction(async (tx) => {
  const company = await tx.company.create({ data: companyInput });
  const subscription = await tx.subscription.create({
    data: { companyId: company.id, ... }
  });
  return { company, subscription };
});
```

### 7.3 Soft delete dla danych z RODO retention

```typescript
// Schema:
model Company {
  ...
  deletedAt DateTime?
}

// Query domyślnie filtruje deletedAt:
const activeCompanies = await prisma.company.findMany({
  where: { deletedAt: null }
});

// Soft delete:
await prisma.company.update({
  where: { id },
  data: { deletedAt: new Date() }
});

// Hard delete dopiero po policy retention (job cleanupSoftDeleted)
```

### 7.4 Selects, nie includes wszędzie

```typescript
// ✅ DOBRZE — pobiera tylko potrzebne
const users = await prisma.user.findMany({
  select: { id: true, email: true, role: true },
});

// ❌ ŹLE — pobiera wszystko, w tym hashedPassword, jwtSecret, etc.
const users = await prisma.user.findMany();
```

### 7.5 Paginacja zawsze gdy lista może być duża

```typescript
async function listCompanies(page = 1, limit = 20) {
  const [items, total] = await prisma.$transaction([
    prisma.company.findMany({
      where: { deletedAt: null },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.company.count({ where: { deletedAt: null } }),
  ]);
  
  return { items, total, page, limit };
}
```

---

## 8. External APIs (Stripe, Fakturownia, Anthropic, Resend)

### 8.1 Wrappery w services

Każde zewnętrzne API ma dedykowany service który:
- Inicjalizuje SDK z env vars
- Loguje request/response (bez PII)
- Łapie błędy i wyrzuca `AppError` z odpowiednim kodem
- Implementuje retry logic dla idempotentnych operacji

```typescript
// services/stripe.service.ts
import Stripe from 'stripe';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

export async function createCheckoutSession(input: CheckoutInput) {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: input.priceId, quantity: 1 }],
      customer_email: input.email,
      success_url: `${process.env.APP_URL}/zamowienie/sukces?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/zamowienie/anulowano`,
      metadata: { companyId: input.companyId },
    });
    
    logger.info({ sessionId: session.id, companyId: input.companyId }, 'Stripe checkout created');
    return session;
  } catch (error) {
    logger.error({ error, input }, 'Stripe checkout failed');
    throw new AppError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      503,
      'Nie udało się utworzyć sesji płatności. Spróbuj ponownie.',
    );
  }
}
```

### 8.2 Webhooks — idempotency i signature verification

```typescript
// controllers/webhook.controller.ts
export async function stripeWebhook(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.NODE_ENV === 'production'
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET_LOCAL;
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret!);
  } catch (err) {
    logger.warn({ err }, 'Invalid Stripe webhook signature');
    return res.status(400).send('Invalid signature');
  }
  
  // Idempotency — sprawdzamy czy już przetwarzaliśmy
  const existing = await prisma.webhookEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing) {
    logger.info({ eventId: event.id }, 'Webhook already processed, skipping');
    return res.status(200).json({ received: true });
  }
  
  await prisma.$transaction(async (tx) => {
    await tx.webhookEvent.create({ data: { stripeEventId: event.id, type: event.type } });
    
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, tx);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, tx);
        break;
      // ...
    }
  });
  
  res.status(200).json({ received: true });
}
```

### 8.3 Anthropic — caching system promptu

```typescript
// services/claude.service.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `Jesteś asystentem bambooit — firmy oferującej obsługę IT...
[długi prompt z ofertą, ograniczeniami, function calling]`;

export async function chat(messages: Message[], userId?: string) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },  // KLUCZOWE — caching obniża koszt 10x
      }
    ],
    messages,
    tools: [
      submitLeadTool,
      recommendPackageTool,
      submitAuditTool,
    ],
  });
  
  // Cost tracking
  await prisma.aiUsageLog.create({
    data: {
      userId,
      model: 'claude-haiku-4-5',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  });
  
  return response;
}
```

### 8.4 Fakturownia — daty w formacie YYYY-MM-DD

```typescript
// services/fakturownia.service.ts
export async function createInvoice(input: InvoiceInput) {
  const issuedDate = new Date().toISOString().split('T')[0];  // "2026-05-11"
  
  const response = await fetch(`${FAKTUROWNIA_URL}/invoices.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_token: process.env.FAKTUROWNIA_API_TOKEN,
      invoice: {
        kind: 'vat',
        sell_date: issuedDate,
        issue_date: issuedDate,
        payment_to: addDays(issuedDate, 14).toISOString().split('T')[0],
        buyer_name: input.companyName,
        buyer_tax_no: input.nip,
        buyer_email: input.email,
        positions: [{ name: input.productName, total_price_gross: input.amount, vat: 23 }],
      },
    }),
  });
  
  // ...
}
```

### 8.5 Resend — React Email templates

```typescript
// emails/AuditConfirmation.tsx
import { Html, Heading, Text, Button } from '@react-email/components';

export const AuditConfirmation = ({ name }: { name: string }) => (
  <Html>
    <Heading>Dziękujemy za zgłoszenie audytu, {name}!</Heading>
    <Text>Skontaktujemy się z Tobą w ciągu 24h.</Text>
    <Button href="https://bambooit.pl">Wróć do strony</Button>
  </Html>
);

// services/email.service.ts
import { Resend } from 'resend';
import { AuditConfirmation } from '../emails/AuditConfirmation';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendAuditConfirmation(to: string, name: string) {
  await resend.emails.send({
    from: 'Bambooit <noreply@bambooit.pl>',
    to,
    subject: 'Dziękujemy za zgłoszenie audytu',
    react: AuditConfirmation({ name }),
  });
}
```

---

## 9. Frontend — React/Next.js

### 9.1 Server Components by default

```typescript
// app/[locale]/pakiety/page.tsx — Server Component (default)
import { PackagesGrid } from '@/components/marketing/PackagesGrid';
import { getActivePackages } from '@/lib/api';

export default async function PakietyPage() {
  const packages = await getActivePackages();
  
  return (
    <div>
      <PackagesGrid packages={packages} />
    </div>
  );
}
```

### 9.2 'use client' tylko gdy konieczne

```typescript
// components/marketing/AuditForm.tsx
'use client';  // Bo useForm i onSubmit

import { useForm } from 'react-hook-form';
// ...
```

**Kiedy 'use client':**
- Forms (react-hook-form)
- Stan lokalny (useState, useReducer)
- Eventy (onClick, onChange)
- Browser API (localStorage, navigator)
- Third-party libs które wymagają client (np. Stripe.js)

**Inne — zostają Server Components** (lepsze performance, SEO).

### 9.3 Data fetching

```typescript
// Server Components — async function bezpośrednio
export default async function Page() {
  const data = await fetch(`${API_URL}/posts`, {
    next: { revalidate: 3600 }  // Cache 1h
  }).then(r => r.json());
  
  return <PostList posts={data} />;
}

// Client Components — SWR lub TanStack Query
'use client';
import useSWR from 'swr';

export function Dashboard() {
  const { data, error, isLoading } = useSWR('/api/me/subscription', fetcher);
  // ...
}
```

### 9.4 i18n — `useTranslations` i `Link` z next-intl

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';  // NIE next/link

export function Header() {
  const t = useTranslations('nav');
  
  return (
    <nav>
      <Link href="/pakiety">{t('packages')}</Link>
      <Link href="/o-nas">{t('about')}</Link>
    </nav>
  );
}
```

### 9.5 Tailwind — używaj design tokens z mockupu

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#2C3E50',
          deep: '#1a2735',
          soft: '#3d556e',
        },
        green: {
          DEFAULT: '#8BC34A',
          deep: '#6fa336',
          soft: '#c8e6a0',
        },
        paper: '#f6f4ee',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

**Klasy:**
```tsx
<h1 className="font-display font-black text-7xl tracking-tight text-navy-deep">
  Cztery filary, jeden <em className="text-green-deep italic">partner.</em>
</h1>
```

### 9.6 shadcn/ui — używaj, nie modyfikuj generic

Komponenty z `components/ui/` to base library — **nie modyfikuj ich**. Jeśli potrzebujesz zmiany, stwórz wrapper:

```tsx
// components/marketing/CTAButton.tsx
import { Button } from '@/components/ui/button';

export function CTAButton({ children, ...props }) {
  return (
    <Button
      className="bg-green hover:bg-green-deep text-navy-deep font-mono uppercase tracking-wider"
      {...props}
    >
      {children}
    </Button>
  );
}
```

---

## 10. Testing

### 10.1 Pyramid

- **Unit tests (most):** services, utilities, validators, business logic
- **Integration tests (some):** controllers + DB (test DB)
- **E2E tests (few):** krytyczne user flows (rejestracja, checkout, formularz audytu)

### 10.2 Backend — Jest + Supertest

```typescript
// __tests__/services/audit.service.test.ts
import { createAuditSubmission } from '../services/audit.service';
import { prismaMock } from '../utils/test-helpers';

describe('audit.service', () => {
  it('rejects duplicate submissions within 24h', async () => {
    prismaMock.auditFormSubmission.findFirst.mockResolvedValue({
      id: 'existing',
      email: 'test@example.com',
      createdAt: new Date(),
    } as any);
    
    await expect(
      createAuditSubmission({ email: 'test@example.com', ... }, ctx)
    ).rejects.toThrow('Już zgłosiłeś audyt');
  });
});
```

### 10.3 Frontend — Vitest + Testing Library

```typescript
// components/marketing/AuditForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuditForm } from './AuditForm';

test('shows validation error for invalid NIP', async () => {
  render(<AuditForm />);
  fireEvent.change(screen.getByLabelText(/nip/i), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: /wyślij/i }));
  
  await waitFor(() => {
    expect(screen.getByText(/nieprawidłowy nip/i)).toBeInTheDocument();
  });
});
```

### 10.4 E2E — Playwright

```typescript
// e2e/audit-form.spec.ts
test('user submits audit form', async ({ page }) => {
  await page.goto('/audyt');
  await page.fill('[name="company"]', 'Test Firma');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="nip"]', '1234567890');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.toast')).toContainText('Dziękujemy');
});
```

### 10.5 Co MUSI być testowane

- ✅ Walidacja danych wejściowych (Zod schemas)
- ✅ Wszystkie services (logika biznesowa)
- ✅ Webhook handlers (idempotency, signature)
- ✅ Auth middleware (role checking)
- ✅ Krytyczne user flows E2E (audit form, checkout, panel access)

### 10.6 Co NIE musi (chyba że bug)

- shadcn/ui komponenty (są pre-tested)
- Prisma queries trywialne (findUnique, findMany)
- Style / wygląd (visual regression jest opcjonalne)

---

## 11. Performance

### 11.1 Frontend

- **Server Components by default** — mniej JS na klienta
- **Image optimization** — `next/image` zawsze, nie `<img>`
- **Font loading** — `next/font` zamiast `<link>` do Google Fonts
- **Lazy loading** — komponenty ciężkie (np. ChatWidget) przez `dynamic()` z `ssr: false`
- **Bundle analysis** — `@next/bundle-analyzer` w razie wątpliwości

### 11.2 Backend

- **Prisma `select`** zamiast `include` — pobieraj tylko potrzebne pola
- **Indexy** na FK i pola filtrowane (`@@index` w schema)
- **Cache** dla danych rzadko zmienialnych (np. ServicePackage definitions — in-memory cache 5 min)
- **Async/await** zawsze, nigdy `.then()` chains (czytelność)

### 11.3 Database

- **N+1 queries** — używaj `include` lub `select` z relacjami
- **Connection pooling** — Prisma robi sam
- **Slow query log** — Postgres `log_min_duration_statement` na produkcji

---

## 12. Security

### 12.1 Sekrety

- **NIGDY** w kodzie (env vars przez `.env`)
- **Zod-validated** env loading (`config/env.ts`)
- **Rotacja** kluczy co 6 miesięcy (Stripe, Anthropic, Resend, Fakturownia)
- **`.env.example`** zawsze aktualne (nazwy zmiennych, BEZ wartości)

### 12.2 Input sanitization

- Wszystkie inputy walidowane Zod
- HTML escaping by default (React)
- SQL injection — Prisma parametryzuje queries
- XSS — `dangerouslySetInnerHTML` tylko gdy konieczne (np. MDX), z sanitizacją

### 12.3 Rate limiting

```typescript
// middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 100,                   // 100 req per IP
  message: { error: { code: 'RATE_LIMITED', message: 'Zbyt wiele zapytań. Spróbuj za kilka minut.' } },
});

export const userLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 min
  max: 30,
  keyGenerator: (req) => req.user?.id ?? req.ip,
});

export const auditFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 godzina
  max: 3,                     // 3 audyty per IP per godzina (anti-spam)
});
```

### 12.4 RODO/GDPR

- **PII encryption** w bazie — używamy `utils/encryption.ts` z e-dietetyk (AES-256-GCM)
- **PII scrubbing** w logach + Sentry
- **DSAR endpoints** zaimplementowane (export, delete)
- **Cookie consent** przed jakimkolwiek tracking (GA4, Pixel)
- **DPA** z każdym klientem abonamentu

### 12.5 OWASP Top 10 — kontroler

- [ ] Broken Access Control → RBAC + per-resource checks
- [ ] Cryptographic Failures → encryption.ts, TLS everywhere
- [ ] Injection → Zod + Prisma parametryzacja
- [ ] Insecure Design → ADRs (CLAUDE.md) + DECISION_LOG.md
- [ ] Security Misconfiguration → `.env` review przed deployem
- [ ] Vulnerable Components → `npm audit` co miesiąc
- [ ] Auth Failures → NextAuth + JWT + bcrypt
- [ ] Software Integrity Failures → package-lock.json committed, audit produkcji
- [ ] Logging Failures → pino + Sentry + audit log
- [ ] SSRF → walidacja URL inputs (jeśli są)

---

## 13. Git workflow

### 13.1 Branche

- `main` — produkcja, zawsze deploy-ready
- `develop` (opcjonalne) — jeśli chcemy buforu między feature → produkcja
- `feat/audit-form` — pojedyncza feature
- `fix/stripe-webhook-idempotency` — fix
- `chore/upgrade-prisma` — sprzątanie

### 13.2 Commit messages — Conventional Commits

```
feat: add audit form submission endpoint
feat(api): implement Stripe webhook handler
fix: handle Fakturownia API timeout
fix(auth): correct NextAuth session callback for role
chore: bump prisma to 6.20.0
chore(db): migration add_company_industry_field
docs: update CLAUDE.md with NIP validation gotcha
refactor: extract payment processing to service
test: add e2e test for audit form
```

### 13.3 PR review checklist

Przed merge do `main`:

- [ ] `npm run typecheck` exit 0
- [ ] `npm run build:all` exit 0
- [ ] Wszystkie testy przechodzą
- [ ] Nowe testy dla nowej funkcjonalności
- [ ] Migracja Prisma (jeśli zmiana schematu) — osobny commit
- [ ] Brak sekretów w diff
- [ ] Brak `console.log`, `@ts-ignore`, `any` bez uzasadnienia
- [ ] CLAUDE.md / DECISION_LOG.md / RULES.md zaktualizowane jeśli wpływa
- [ ] Zmiany breaking — udokumentowane w PR description

---

## 14. Co Claude Code MUSI sprawdzać

### 14.1 Przed `git add`

```bash
# Lint
npm run lint 2>&1 | tee LINT_CHECK.log

# Typecheck
npm run typecheck > TYPECHECK_CHECK.log 2>&1

# Format (jeśli Prettier configured)
npm run format

# Testy (jeśli zmieniliśmy logikę)
npm run test
```

### 14.2 Po `git commit`

```bash
git log --oneline -5
git show --stat HEAD
```

### 14.3 Przed `git push`

- Pełny `npm run build:all` exit 0
- Testy przechodzą lokalnie
- CLAUDE.md, DECISION_LOG.md, RULES.md aktualne

---

## 15. Anti-patterns — czego NIE rób

### Code smells

❌ `any` w TypeScript bez komentarza dlaczego
❌ Setting `@ts-ignore` żeby ominąć błąd zamiast naprawić
❌ Komentarze typu `// TODO: fix this` bez issue/ticketu
❌ Skopiowany kod (DRY violation) — wydziel do utility
❌ Funkcje >50 linii — najczęściej można rozbić
❌ Pliki >300 linii — podziel logicznie
❌ Nazwy zmiennych typu `x`, `data2`, `tmp` poza pętlami

### Architectural smells

❌ Logika biznesowa w komponentach React (powinna być w services lub hooks)
❌ Bezpośrednie wywołania API w komponentach (powinno przez `lib/api.ts`)
❌ Hard-coded ID Stripe / Fakturownia (zawsze przez env)
❌ Magic numbers (3, 24, 168) — wydziel do nazwanej stałej
❌ Strings duplikowane (np. error codes) — wydziel do enum lub constants

### Process smells

❌ Commit "WIP" lub "fix"
❌ Push na `main` bez review
❌ Skip `npm run typecheck` "bo wiem że działa"
❌ Modyfikacja migracji Prisma po commicie do `main` (zawsze nowa migracja)
❌ Komentowanie testów żeby "zielono" (jeśli test nie ma sensu — usuń, ale z opisem dlaczego)

---

## 16. Jak korzystać z tego dokumentu

**Dla Claude Code:**
- Przy każdej sesji przeczytaj sekcje 1-5 (struktura, naming, API format, validation, errors)
- Przy zadaniach związanych z auth/security przeczytaj 6, 12
- Przy integracjach zewnętrznych przeczytaj 8
- Przy frontend tasks przeczytaj 9
- Przed `git push` przeczytaj 13, 14

**Dla człowieka (Wirgiliusz, Remigiusz):**
- Sprawdzaj że Claude Code stosuje konwencje
- Aktualizuj RULES.md gdy ustalamy nową konwencję
- Konflikt między RULES.md a CLAUDE.md → CLAUDE.md wygrywa (override)

**Aktualizacja:**
- Nowa konwencja → dopisz sekcję / podsekcję
- Zmiana istniejącej → strikethrough starej + nowa wersja (audit trail)
- Major refactor — nowa wersja RULES.md jako branch, merge po review
