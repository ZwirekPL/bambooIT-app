/**
 * E2E Smoke Tests — Responsiveness (Faza 80.4.7)
 *
 * Checks that key pages render without overflow at 375 / 768 / 1280px.
 * Does NOT require login — tests only public pages.
 */

import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];

const PUBLIC_PAGES = [
  { path: '/pl', label: 'Home' },
  { path: '/pl/zaloguj', label: 'Login' },
  { path: '/pl/rejestracja', label: 'Register' },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Responsiveness @ ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const { path, label } of PUBLIC_PAGES) {
      test(`${label} — no horizontal overflow`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('domcontentloaded');

        // No horizontal scrollbar (body scrollWidth should not exceed viewport width)
        const overflow = await page.evaluate(() => {
          return document.body.scrollWidth > window.innerWidth;
        });
        expect(overflow, `Horizontal overflow on ${label} at ${viewport.width}px`).toBe(false);
      });

      test(`${label} — main content visible`, async ({ page }) => {
        await page.goto(path);
        // At least one heading or main content block should be visible
        const heading = page.locator('h1, h2, main').first();
        await expect(heading).toBeVisible({ timeout: 5000 });
      });
    }
  });
}

// TODO(4-cleanup): /pl/dashboard removed in K4. Re-add similar test for
// /pl/panel (bambooIT client panel) after K11 rebuild.
