import { test, expect } from '@playwright/test';

// ── Login page ────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pl/zaloguj');
  });

  test('renders heading and form fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Zaloguj się' })).toBeVisible();
    await expect(page.getByLabel('Adres e-mail')).toBeVisible();
    await expect(page.getByLabel('Hasło')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zaloguj się' })).toBeVisible();
  });

  test('contains link to registration page', async ({ page }) => {
    const link = page.getByRole('link', { name: /utwórz konto/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /rejestracja/);
  });

  test('contains forgot password link', async ({ page }) => {
    const link = page.getByRole('link', { name: /zapomnialem-hasla|Zapomniałeś/i });
    await expect(link).toBeVisible();
  });

  test('shows error when backend returns 401', async ({ page }) => {
    // Mock the NextAuth credentials callback endpoint
    await page.route('**/api/auth/callback/credentials', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'CredentialsSignin', url: null }),
      });
    });

    await page.fill('[name="email"]', 'bad@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Error message should appear (auth error text)
    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 5000 });
  });
});

// ── Register page ─────────────────────────────────────────────────────────────

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pl/rejestracja');
  });

  test('renders heading and all form fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Utwórz konto' })).toBeVisible();
    await expect(page.getByLabel('Imię')).toBeVisible();
    await expect(page.getByLabel('Nazwisko')).toBeVisible();
    await expect(page.getByLabel('Adres e-mail')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Utwórz konto' })).toBeVisible();
  });

  test('contains link to login page', async ({ page }) => {
    const link = page.getByRole('link', { name: /zaloguj/i }).first();
    await expect(link).toBeVisible();
  });

  test('shows client-side error when passwords do not match', async ({ page }) => {
    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.fill('[name="email"]', 'jan@example.com');
    await page.fill('[name="password"]', 'Haslo123');
    await page.fill('[name="confirmPassword"]', 'Haslo999');
    await page.click('button[type="submit"]');

    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 3000 });
  });

  test('shows client-side error when password is too short', async ({ page }) => {
    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.fill('[name="email"]', 'jan@example.com');
    await page.fill('[name="password"]', 'abc');
    await page.fill('[name="confirmPassword"]', 'abc');
    await page.click('button[type="submit"]');

    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 3000 });
  });

  test('shows success state after successful registration', async ({ page }) => {
    // Mock the backend registration endpoint
    await page.route('**/auth/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, user: { id: 'u1', email: 'jan@example.com', role: 'PATIENT' } }),
      });
    });

    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.fill('[name="email"]', 'jan@example.com');
    await page.fill('[name="password"]', 'Haslo123');
    await page.fill('[name="confirmPassword"]', 'Haslo123');
    await page.click('button[type="submit"]');

    // Success state shows registration success title
    await expect(page.getByText(/rejestracja|weryfikac|sprawdź|potwierdzenie/i)).toBeVisible({ timeout: 5000 });
  });
});

// ── Protected routes ──────────────────────────────────────────────────────────

test.describe('Protected routes', () => {
  test('redirects unauthenticated user from /panel to login', async ({ page }) => {
    await page.goto('/pl/panel');
    // Should be redirected to login page
    await expect(page).toHaveURL(/zaloguj/, { timeout: 5000 });
  });

  test('redirects unauthenticated user from /admin to login', async ({ page }) => {
    await page.goto('/pl/admin');
    await expect(page).toHaveURL(/zaloguj/, { timeout: 5000 });
  });
});

// ── 80.4.1 Login → redirect to client panel ──────────────────────────────────

test.describe('Login flow (80.4.1)', () => {
  test.skip(!process.env.SMOKE_CLIENT_EMAIL, 'SMOKE_CLIENT_EMAIL not set');

  test('successful client login → redirects to /panel', async ({ page }) => {
    await page.goto('/pl/zaloguj');
    await page.fill('[name="email"]', process.env.SMOKE_CLIENT_EMAIL!);
    await page.fill('[name="password"]', process.env.SMOKE_CLIENT_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/panel/, { timeout: 10000 });
  });

  test('successful admin login → redirects to /admin', async ({ page }) => {
    test.skip(!process.env.SMOKE_ADMIN_EMAIL, 'SMOKE_ADMIN_EMAIL not set');
    await page.goto('/pl/zaloguj');
    await page.fill('[name="email"]', process.env.SMOKE_ADMIN_EMAIL!);
    await page.fill('[name="password"]', process.env.SMOKE_ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/admin/, { timeout: 10000 });
  });
});
