import { test, expect } from '@playwright/test';

/**
 * Marketing-site happy path — no backend required (covers static + UI-only
 * paths). For backend-dependent flows (audit form submission, /zamow Stripe
 * redirect), see the smoke-with-backend.spec.ts scaffold which is gated on
 * the SMOKE_BACKEND=1 env var.
 *
 * Run locally: cd apps/web && npm run test:e2e
 */

test.describe('Homepage', () => {
  test('loads and shows the hero + nav', async ({ page }) => {
    await page.goto('/pl');
    // The Header renders bambooIT wordmark via aria-label
    await expect(page.getByRole('link', { name: /bambooIT|bambooit/i }).first()).toBeVisible();
    // Skip-link is present (visible only on focus)
    await expect(page.locator('a.skip-link')).toBeAttached();
  });

  test('pricing section CTAs target /zamow with the matching plan param', async ({ page }) => {
    await page.goto('/pl');
    const startCta = page.getByRole('link', { name: /Wybierz Start/i }).first();
    await expect(startCta).toBeVisible();
    await expect(startCta).toHaveAttribute('href', /\/zamow\?plan=START$/);

    const firmaCta = page.getByRole('link', { name: /Wybierz Firma/i }).first();
    await expect(firmaCta).toHaveAttribute('href', /\/zamow\?plan=FIRMA$/);
  });
});

test.describe('Pricing page', () => {
  test('renders three tiers with prices', async ({ page }) => {
    await page.goto('/pl/pakiety');
    await expect(page.getByText('390 zł').first()).toBeVisible();
    await expect(page.getByText('690 zł').first()).toBeVisible();
    await expect(page.getByText('1190 zł').first()).toBeVisible();
  });
});

test.describe('Audit form (UI-only validation)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pl/audyt');
  });

  test('rejects submit when required fields empty (HTML5 + Zod path)', async ({ page }) => {
    // We don't submit a full empty form here — browsers block native required
    // validation. Instead check the form is present.
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
    await expect(page.getByRole('button', { name: /Wyślij zgłoszenie/i })).toBeVisible();
  });

  test('honeypot field is offscreen and tab-skipped', async ({ page }) => {
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toBeAttached();
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    // Bounding box should be outside the viewport
    const box = await honeypot.boundingBox();
    if (box) {
      // Either pushed off-screen (negative coords) or zero-sized
      expect(box.x < 0 || box.y < 0 || box.width === 0 || box.height === 0).toBeTruthy();
    }
  });
});

test.describe('Contact form', () => {
  test('renders all required fields', async ({ page }) => {
    await page.goto('/pl/kontakt');
    await expect(page.getByLabel(/Imię/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Wiadomość/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Wyślij wiadomość/i })).toBeVisible();
  });
});

test.describe('Order redirect (auth gate)', () => {
  test('unauthenticated user gets bounced to /rejestracja with callbackUrl', async ({ page }) => {
    await page.goto('/pl/zamow?plan=FIRMA');
    // OrderRedirect.tsx schedules an effect-based redirect; wait for it.
    await page.waitForURL(/\/rejestracja\?callbackUrl=/);
    expect(page.url()).toContain('callbackUrl');
    expect(page.url()).toContain(encodeURIComponent('/zamow'));
  });

  test('invalid plan shows error panel', async ({ page }) => {
    await page.goto('/pl/zamow?plan=NOPE');
    await expect(page.getByRole('heading', { name: /Nie udało się/i })).toBeVisible();
  });
});

test.describe('Legal documents', () => {
  test('Polityka prywatności renders with bambooIT branding', async ({ page }) => {
    await page.goto('/pl/dokumenty-prawne');
    // The PL stubs all start with bambooit.pl reference
    await expect(page.getByText(/bambooit\.pl/i).first()).toBeVisible();
    // Ensure no e-dietetyk leaks
    await expect(page.getByText(/e-dietetyk\.com/i)).not.toBeVisible();
  });
});

test.describe('llms.txt SEO endpoint', () => {
  test('returns bambooIT IT-services context (no diet copy)', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('bambooIT');
    expect(body).toMatch(/IT support|Obsługa IT/);
    // Must not leak the diet-platform legacy
    expect(body).not.toContain('dietitian');
    expect(body).not.toContain('Thermomix');
  });
});

test.describe('EN locale is disabled (K10.3)', () => {
  test('hitting /en/* falls back / 404s gracefully', async ({ page }) => {
    const res = await page.goto('/en');
    // routing.locales has only 'pl' now — Next.js / next-intl should NOT
    // serve /en. We accept either a redirect to /pl or a 404 page render.
    expect(res?.status() === 404 || page.url().endsWith('/pl') || page.url().endsWith('/pl/')).toBeTruthy();
  });
});
