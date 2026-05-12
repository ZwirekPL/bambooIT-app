// Global test environment setup — runs before every test file
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-only';
process.env.APP_URL = 'http://localhost:3000';
