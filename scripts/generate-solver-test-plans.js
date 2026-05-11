/**
 * Generuje plan dietetyczny dla każdego z 5 pacjentów testowych solvera
 * (utworzonych przez `seed-solver-test-patients.js`).
 *
 * Wymagany running backend (`npm run dev:api` z poziomu root) +
 * Postgres + Redis (BullMQ workers). Skrypt:
 *
 *   1. Loguje się jako dietetyk-opiekun → JWT
 *   2. Dla każdego z 5 pacjentów:
 *      a) POST /api/diet-plans/generate/:patientId  → dietPlanId
 *      b) GET  /api/diet-plans/:id/status (poll co 3s, timeout 180s)
 *      c) GET  /api/diet-plans/:id (final — kcal, status, source)
 *   3. Wypisuje tabelę zbiorczą wyników.
 *
 * Usage:
 *   node scripts/generate-solver-test-plans.js
 *
 * Env (opcjonalne):
 *   API_BASE_URL          (default: http://localhost:4000)
 *   SEED_DIETITIAN_EMAIL  (default: dietetyk@test.pl)
 *   DIETITIAN_PASSWORD    (default: TestPass123!)   ← jeśli zmieniłeś, ustaw env
 *   POLL_TIMEOUT_MS       (default: 180000)
 *   POLL_INTERVAL_MS      (default: 3000)
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE_URL       = process.env.API_BASE_URL          || 'http://localhost:4000';
const DIETITIAN_EMAIL    = process.env.SEED_DIETITIAN_EMAIL  || 'dietetyk@test.pl';
const DIETITIAN_PASSWORD = process.env.DIETITIAN_PASSWORD    || 'TestPass123!';
const POLL_TIMEOUT_MS    = Number(process.env.POLL_TIMEOUT_MS  || 180_000);
const POLL_INTERVAL_MS   = Number(process.env.POLL_INTERVAL_MS || 3_000);

const PATIENT_EMAILS = [
  'test-healthy@solver.test',
  'test-diabetes@solver.test',
  'test-pregnant@solver.test',
  'test-senior@solver.test',
  'test-hypertension@solver.test',
];

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function api(path, { method = 'GET', body, token } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; }
  catch { json = { rawText: text }; }

  if (!res.ok) {
    const code = json?.error?.code ?? res.status;
    const msg = json?.error?.message ?? text;
    throw new Error(`${method} ${path} → ${res.status} ${code}: ${msg}`);
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[gen] API: ${API_BASE_URL}`);
  console.log(`[gen] Logowanie jako ${DIETITIAN_EMAIL} ...`);

  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: DIETITIAN_EMAIL, password: DIETITIAN_PASSWORD },
  });
  const token = login.token;
  if (!token) throw new Error('Brak tokenu w odpowiedzi /auth/login');
  console.log(`[gen] OK — rola: ${login.user.role}`);

  // Pobierz patientId po email — z DB (szybciej niż listować po API)
  const users = await prisma.user.findMany({
    where: { email: { in: PATIENT_EMAILS } },
    select: { email: true, patient: { select: { id: true, firstName: true, lastName: true } } },
  });

  const patientsByEmail = new Map(users.map((u) => [u.email, u.patient]));
  const missing = PATIENT_EMAILS.filter((e) => !patientsByEmail.get(e));
  if (missing.length) {
    console.error(`[gen] BŁĄD: brak pacjentów: ${missing.join(', ')}`);
    console.error('[gen] Najpierw uruchom: node scripts/seed-solver-test-patients.js');
    process.exit(1);
  }

  // Generuj dla każdego sekwencyjnie (żeby nie obciążać AI / solvera równolegle)
  const results = [];
  for (const email of PATIENT_EMAILS) {
    const p = patientsByEmail.get(email);
    const label = `${p.firstName} ${p.lastName}`;
    console.log('');
    console.log(`[gen] ── ${label} (${email}) ──`);

    let dietPlanId, source, aiTriggered, finalStatus = 'unknown', kcal = null;
    let errMsg = null;

    try {
      const gen = await api(`/diet-plans/generate/${p.id}`, { method: 'POST', token });
      dietPlanId   = gen.dietPlanId;
      source       = gen.source;
      aiTriggered  = gen.aiTriggered;
      console.log(`[gen]   → dietPlanId=${dietPlanId} source=${source} aiTriggered=${aiTriggered}`);

      // Poll status until done or timeout
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        const st = await api(`/diet-plans/${dietPlanId}/status`, { token });
        finalStatus = st.status ?? st.plan?.status ?? finalStatus;
        kcal = st.kcal ?? st.plan?.kcal ?? kcal;
        const phase = st.phase ?? st.plan?.phase ?? '?';
        process.stdout.write(`[gen]   …status=${finalStatus} phase=${phase} kcal=${kcal ?? '-'}\r`);
        if (finalStatus !== 'AI_DRAFT' && phase === 'done') break;
        if (finalStatus === 'GENERATED' || finalStatus === 'MANUAL_REVIEW_REQUIRED') break;
      }
      process.stdout.write('\n');

      if (finalStatus === 'AI_DRAFT') {
        errMsg = `timeout (${POLL_TIMEOUT_MS / 1000}s) — plan utknął w AI_DRAFT`;
      }
    } catch (e) {
      errMsg = e.message;
      console.error(`[gen]   BŁĄD: ${errMsg}`);
    }

    results.push({ email, label, dietPlanId, source, finalStatus, kcal, errMsg });
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(' Podsumowanie');
  console.log('══════════════════════════════════════════════════════════════════════');
  for (const r of results) {
    const ok = !r.errMsg && (r.finalStatus === 'GENERATED' || r.finalStatus === 'MANUAL_REVIEW_REQUIRED');
    const mark = ok ? '✓' : '✗';
    console.log(`  ${mark} ${r.label.padEnd(20)} status=${(r.finalStatus ?? '-').padEnd(25)} kcal=${(r.kcal ?? '-')}  ${r.errMsg ? '['+r.errMsg+']' : 'planId='+r.dietPlanId}`);
  }
  console.log('');
  console.log('  W UI: zaloguj się jako dietetyk → lista pacjentów → klik pacjent → Plan');
  console.log('  Bezpośrednie podglądy:');
  for (const r of results) {
    if (r.dietPlanId) {
      console.log(`    GET ${API_BASE_URL}/diet-plans/${r.dietPlanId}              # pełen plan`);
      console.log(`    GET ${API_BASE_URL}/diet-plans/${r.dietPlanId}/quality      # plan quality A-E`);
      console.log(`    GET ${API_BASE_URL}/diet-plans/${r.dietPlanId}/decisions    # per-slot reason codes`);
      if (r.email === 'test-diabetes@solver.test') {
        console.log(`    GET ${API_BASE_URL}/diet-plans/${r.dietPlanId}/gi-report    # GI/GL dla cukrzyka`);
      }
    }
  }

  const failed = results.filter((r) => r.errMsg).length;
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => { console.error('[gen] Fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
