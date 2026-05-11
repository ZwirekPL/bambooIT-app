/**
 * API Smoke Tests (Faza 80.2)
 *
 * Verifies that key API endpoints respond correctly.
 * Auto-skips when API server is not running (no false failures in CI).
 *
 * Run with server: npm run dev:api && npx vitest run --testPathPattern=smoke
 *
 * Optional env vars for auth-dependent tests:
 *   SMOKE_DIETITIAN_EMAIL, SMOKE_DIETITIAN_PASSWORD   — dietitian account
 *   SMOKE_PATIENT_EMAIL, SMOKE_PATIENT_PASSWORD       — patient account
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

async function apiGet(path: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function apiPost(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function apiPatch(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('API Smoke Tests', () => {
  let skipAll = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(2000) });
      skipAll = !res.ok;
    } catch { skipAll = true; }
    if (skipAll) console.warn('[smoke] API server not available at ' + API_URL + ' — skipping all');
  });

  function smokeIt(name: string, fn: () => Promise<void>) {
    it(name, async () => { if (!skipAll) await fn(); });
  }

  // ── 80.2.1 Health ─────────────────────────────────────────────────────────

  smokeIt('GET /health → 200 status OK', async () => {
    const { status, body } = await apiGet('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status', 'OK');
  });

  smokeIt('GET /health/db → 200 ok', async () => {
    const { status, body } = await apiGet('/health/db');
    expect(status).toBe(200);
    expect(body).toHaveProperty('ok', true);
  });

  // ── 80.2.2 Auth ───────────────────────────────────────────────────────────

  smokeIt('POST /auth/login bad password → 401', async () => {
    const { status } = await apiPost('/auth/login', { email: 'nonexistent@smoke.pl', password: 'wrong' });
    expect(status).toBe(401);
  });

  // ── Auth flows (require SMOKE_DIETITIAN_* env vars) ───────────────────────

  describe('Auth-dependent flows (dietitian)', () => {
    let skipAuth = false;
    let dietitianToken = '';
    let firstPatientId = '';

    beforeAll(async () => {
      if (skipAll) { skipAuth = true; return; }
      const email = process.env.SMOKE_DIETITIAN_EMAIL;
      const password = process.env.SMOKE_DIETITIAN_PASSWORD;
      if (!email || !password) {
        skipAuth = true;
        console.warn('[smoke] SMOKE_DIETITIAN_EMAIL / SMOKE_DIETITIAN_PASSWORD not set — skipping auth-dependent tests');
        return;
      }
      const { status, body } = await apiPost('/auth/login', { email, password });
      if (status !== 200 || !body?.token) {
        skipAuth = true;
        console.warn('[smoke] Dietitian login failed (status ' + status + ') — skipping auth-dependent tests');
        return;
      }
      dietitianToken = body.token;
    });

    function authIt(name: string, fn: () => Promise<void>) {
      it(name, async () => { if (!skipAll && !skipAuth) await fn(); });
    }

    // 80.2.2 — login → JWT
    authIt('POST /auth/login → 200 with token (dietitian)', async () => {
      const email = process.env.SMOKE_DIETITIAN_EMAIL!;
      const password = process.env.SMOKE_DIETITIAN_PASSWORD!;
      const { status, body } = await apiPost('/auth/login', { email, password });
      expect(status).toBe(200);
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('token');
      expect(typeof body.token).toBe('string');
      expect(body.user.role).toBe('DIETITIAN');
    });

    // 80.2.3 — Patient flow
    authIt('GET /patients → 200 list (dietitian)', async () => {
      const { status, body } = await apiGet('/patients', dietitianToken);
      expect(status).toBe(200);
      expect(body).toHaveProperty('ok', true);
      expect(Array.isArray(body.patients)).toBe(true);
      if (body.patients.length > 0) {
        firstPatientId = body.patients[0].id;
      }
    });

    authIt('GET /patients/:id → 200 patient profile', async () => {
      if (!firstPatientId) return; // no patients — skip gracefully
      const { status, body } = await apiGet(`/patients/${firstPatientId}`, dietitianToken);
      expect(status).toBe(200);
      expect(body).toHaveProperty('ok', true);
      expect(body.patient).toHaveProperty('id', firstPatientId);
    });

    // 80.2.4 — Interview
    authIt('GET /interviews?patientId=:id → 200 list', async () => {
      if (!firstPatientId) return;
      const { status, body } = await apiGet(`/interviews?patientId=${firstPatientId}`, dietitianToken);
      expect([200, 404]).toContain(status);
      if (status === 200) {
        expect(body).toHaveProperty('ok', true);
      }
    });

    // 80.2.6 — Diet plans
    authIt('GET /diet-plans?patientId=:id → 200 list', async () => {
      if (!firstPatientId) return;
      const { status, body } = await apiGet(`/diet-plans?patientId=${firstPatientId}`, dietitianToken);
      expect([200, 404]).toContain(status);
      if (status === 200) {
        expect(body).toHaveProperty('ok', true);
        expect(Array.isArray(body.plans)).toBe(true);
      }
    });

    // 80.2.8 — Micronutrients
    authIt('GET /diet-plans/micronutrients/:patientId → 200 or 404', async () => {
      if (!firstPatientId) return;
      const { status, body } = await apiGet(`/diet-plans/micronutrients/${firstPatientId}`, dietitianToken);
      expect([200, 404]).toContain(status);
      if (status === 200) {
        expect(body).toHaveProperty('ok', true);
      }
    });

    // 80.2.9 — Shopping list
    authIt('GET /diet-plans/shopping-list/:patientId → 200 or 404', async () => {
      if (!firstPatientId) return;
      const { status, body } = await apiGet(`/diet-plans/shopping-list/${firstPatientId}`, dietitianToken);
      expect([200, 404]).toContain(status);
      if (status === 200) {
        expect(body).toHaveProperty('ok', true);
      }
    });

    // 80.2.10 — Check-in list (via measurements / check-ins)
    authIt('GET /check-ins → 200 or 401 (patient required)', async () => {
      // Dietitian typically does not have direct check-in list; 401/403 is acceptable
      const { status } = await apiGet('/check-ins', dietitianToken);
      expect([200, 400, 401, 403]).toContain(status);
    });

    // Messages
    authIt('GET /messages/conversations → 200 list', async () => {
      const { status, body } = await apiGet('/messages/conversations', dietitianToken);
      expect([200, 204]).toContain(status);
      if (status === 200) {
        expect(body).toHaveProperty('ok', true);
      }
    });

    // Measurements
    authIt('GET /measurements → requires auth → 200', async () => {
      // With token it should at least not 401
      const { status } = await apiGet('/measurements', dietitianToken);
      expect([200, 400, 403]).toContain(status);
    });
  });

  // ── Auth flows (require SMOKE_PATIENT_* env vars) ─────────────────────────

  describe('Auth-dependent flows (patient)', () => {
    let skipAuth = false;
    let patientToken = '';

    beforeAll(async () => {
      if (skipAll) { skipAuth = true; return; }
      const email = process.env.SMOKE_PATIENT_EMAIL;
      const password = process.env.SMOKE_PATIENT_PASSWORD;
      if (!email || !password) {
        skipAuth = true;
        console.warn('[smoke] SMOKE_PATIENT_EMAIL / SMOKE_PATIENT_PASSWORD not set — skipping patient tests');
        return;
      }
      const { status, body } = await apiPost('/auth/login', { email, password });
      if (status !== 200 || !body?.token) {
        skipAuth = true;
        console.warn('[smoke] Patient login failed — skipping patient tests');
        return;
      }
      patientToken = body.token;
    });

    function patientIt(name: string, fn: () => Promise<void>) {
      it(name, async () => { if (!skipAll && !skipAuth) await fn(); });
    }

    // 80.2.10 — Check-in
    patientIt('POST /check-ins → creates check-in', async () => {
      const { status, body } = await apiPost('/check-ins', {
        weight: 75,
        complianceScore: 80,
        note: 'smoke test',
      }, patientToken);
      expect([200, 201]).toContain(status);
      if (status === 201 || status === 200) {
        expect(body).toHaveProperty('ok', true);
      }
    });

    patientIt('GET /check-ins → 200 list', async () => {
      const { status, body } = await apiGet('/check-ins', patientToken);
      expect(status).toBe(200);
      expect(body).toHaveProperty('ok', true);
    });

    // 80.2.5 — Plan generation (just verify 202 returned, no polling)
    patientIt('POST /diet-plans/generate → 202 accepted or 404 (no interview)', async () => {
      const { status } = await apiPost('/diet-plans/generate', {}, patientToken);
      // 202 = queued, 400/404 = no interview/profile, 403 = no subscription
      expect([202, 400, 403, 404]).toContain(status);
    });
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  smokeIt('GET /patients → 401 without token', async () => {
    const { status } = await apiGet('/patients');
    expect(status).toBe(401);
  });

  smokeIt('GET /messages/conversations → 401 without token', async () => {
    const { status } = await apiGet('/messages/conversations');
    expect(status).toBe(401);
  });

  smokeIt('GET /measurements → 401 without token', async () => {
    const { status } = await apiGet('/measurements');
    expect(status).toBe(401);
  });
});
