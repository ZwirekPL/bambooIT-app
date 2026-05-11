// Global test environment setup — runs before every test file
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-only';
process.env.APP_URL = 'http://localhost:3000';
// Faza D Phase 0 Task #1: deterministic OR-Tools solver for gold standard snapshots.
// Production behavior unchanged when this env var is unset (see weekSolver.service.ts).
process.env.SOLVER_SEED = '42';
