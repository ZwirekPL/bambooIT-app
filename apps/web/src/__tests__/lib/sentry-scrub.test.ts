import { describe, expect, it } from 'vitest';
import { scrubEvent } from '@/lib/sentry-scrub';
import type { ErrorEvent } from '@sentry/nextjs';

function makeEvent(overrides: Partial<ErrorEvent>): ErrorEvent {
  return {
    event_id: 'test',
    timestamp: Date.now() / 1000,
    ...overrides,
  } as ErrorEvent;
}

describe('scrubEvent', () => {
  it('returns null for 4xx HTTP errors', () => {
    const event = makeEvent({
      contexts: { response: { status_code: 401 } },
    });
    expect(scrubEvent(event)).toBeNull();
  });

  it('keeps 5xx HTTP errors', () => {
    const event = makeEvent({
      contexts: { response: { status_code: 500 } },
    });
    expect(scrubEvent(event)).not.toBeNull();
  });

  it('removes email from user', () => {
    const event = makeEvent({
      user: { id: 'u-1', email: 'pacjent@test.pl', username: 'CLIENT' },
    });
    const scrubbed = scrubEvent(event);
    expect(scrubbed?.user?.email).toBeUndefined();
    expect(scrubbed?.user?.id).toBe('u-1');
    expect(scrubbed?.user?.username).toBe('CLIENT');
  });

  it('redacts password in request.data', () => {
    const event = makeEvent({
      request: {
        data: { email: 'test@test.pl', password: 'very-secret' },
      },
    });
    const scrubbed = scrubEvent(event);
    expect((scrubbed?.request?.data as Record<string, string>).password).toBe('[REDACTED]');
    expect((scrubbed?.request?.data as Record<string, string>).email).toBe('test@test.pl');
  });

  it('redacts nested medical fields in request.data', () => {
    const event = makeEvent({
      request: {
        data: {
          company: {
            name: 'Jan',
            interview: {
              answers: { diseases: ['diabetes'] },
              medicalFlags: { allergies: ['peanuts'] },
            },
          },
        },
      },
    });
    const scrubbed = scrubEvent(event);
    const company = (scrubbed?.request?.data as { company: { name: string; interview: Record<string, string> } }).company;
    expect(company.name).toBe('Jan');
    expect(company.interview.answers).toBe('[REDACTED]');
    expect(company.interview.medicalFlags).toBe('[REDACTED]');
  });

  it('redacts DietPlan.content and DietitianNote.content', () => {
    const event = makeEvent({
      extra: {
        dietPlan: { id: 'p-1', content: 'plan details...' },
        note: { content: 'company has depression' },
      },
    });
    const scrubbed = scrubEvent(event);
    const extra = scrubbed?.extra as Record<string, Record<string, string>>;
    expect(extra.dietPlan.content).toBe('[REDACTED]');
    expect(extra.dietPlan.id).toBe('p-1');
    expect(extra.note.content).toBe('[REDACTED]');
  });

  it('redacts authorization and cookie headers', () => {
    const event = makeEvent({
      request: {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-token',
          Cookie: 'session=abc123',
        },
      },
    });
    const scrubbed = scrubEvent(event);
    const headers = scrubbed?.request?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('[REDACTED]');
    expect(headers.Cookie).toBe('[REDACTED]');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('redacts cookies object entirely', () => {
    const event = makeEvent({
      request: { cookies: { session: 'abc' } },
    });
    const scrubbed = scrubEvent(event);
    expect(scrubbed?.request?.cookies).toBe('[REDACTED]');
  });

  it('redacts sensitive keys in breadcrumbs[].data', () => {
    const event = makeEvent({
      breadcrumbs: [
        {
          category: 'http',
          data: { url: '/api/auth', password: 'x', token: 'y' },
        },
      ],
    });
    const scrubbed = scrubEvent(event);
    const data = scrubbed?.breadcrumbs?.[0].data as Record<string, string>;
    expect(data.url).toBe('/api/auth');
    expect(data.password).toBe('[REDACTED]');
    expect(data.token).toBe('[REDACTED]');
  });

  it('is case-insensitive on key names', () => {
    const event = makeEvent({
      extra: { PASSWORD: 'a', ApiKey: 'b', Access_Token: 'c' },
    });
    const scrubbed = scrubEvent(event);
    const extra = scrubbed?.extra as Record<string, string>;
    expect(extra.PASSWORD).toBe('[REDACTED]');
    expect(extra.ApiKey).toBe('[REDACTED]');
    expect(extra.Access_Token).toBe('[REDACTED]');
  });

  it('handles null/undefined gracefully', () => {
    const event = makeEvent({
      request: { data: null as never },
      extra: undefined,
    });
    expect(() => scrubEvent(event)).not.toThrow();
  });
});
