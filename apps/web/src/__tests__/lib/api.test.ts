import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiError, apiFetch, api } from '@/lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const err = new ApiError(404, 'Not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it('exposes status and message', () => {
    const err = new ApiError(401, 'Unauthorized');
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
    expect(err.name).toBe('ApiError');
  });
});

describe('apiFetch()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls fetch with Content-Type header', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    await apiFetch('/health');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('includes Authorization header when token provided', async () => {
    const fetchMock = mockFetch(200, { status: 'ok' });
    await apiFetch('/health', { token: 'my-token' });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(options.headers['Authorization']).toBe('Bearer my-token');
  });

  it('does not include Authorization header when no token', async () => {
    const fetchMock = mockFetch(200, { status: 'ok' });
    await apiFetch('/health');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('returns parsed JSON on success', async () => {
    mockFetch(200, { status: 'ok', version: '1.0' });
    const result = await apiFetch<{ status: string }>('/health');
    expect(result).toEqual({ status: 'ok', version: '1.0' });
  });

  it('throws ApiError when response is not ok', async () => {
    mockFetch(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
    await expect(apiFetch('/missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('ApiError has correct status on failure', async () => {
    mockFetch(401, {});
    try {
      await apiFetch('/protected');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
    }
  });
});

describe('api.health', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('api.health.check calls /health', async () => {
    const fetchMock = mockFetch(200, { status: 'ok' });
    await api.health.check();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/health');
  });

  it('api.health.db calls /health/db', async () => {
    const fetchMock = mockFetch(200, { ok: true, usersCount: 5 });
    await api.health.db();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/health/db');
  });
});

describe('api.auth.register', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs to /auth/register with correct body', async () => {
    const fetchMock = mockFetch(201, { ok: true, user: { id: '1', email: 'a@b.com', role: 'PATIENT' } });
    await api.auth.register({ email: 'a@b.com', password: 'secret123', consents: { healthDataProcessing: true, aiDisclaimer: true, emailNotifications: false } });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/register');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toMatchObject({ email: 'a@b.com', password: 'secret123' });
  });

  it('includes optional fields when provided', async () => {
    const fetchMock = mockFetch(201, { ok: true, user: { id: '1', email: 'a@b.com', role: 'PATIENT' } });
    await api.auth.register({
      email: 'a@b.com',
      password: 'secret123',
      firstName: 'Jan',
      lastName: 'Kowalski',
      dietitianCode: 'CODE01',
      consents: { healthDataProcessing: true, aiDisclaimer: true, emailNotifications: false },
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.firstName).toBe('Jan');
    expect(body.dietitianCode).toBe('CODE01');
  });
});

describe('api.auth.forgotPassword', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs to /auth/forgot-password', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    await api.auth.forgotPassword({ email: 'test@example.com' });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/auth/forgot-password');
  });
});
