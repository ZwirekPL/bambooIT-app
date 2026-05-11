import { describe, it, expect, beforeEach } from 'vitest';
import { waitForSlot, hostOf, _resetRateLimiter } from '../../scraper/utils/rateLimiter';

beforeEach(() => {
  _resetRateLimiter();
});

describe('hostOf', () => {
  it('extracts host from https URL', () => {
    expect(hostOf('https://aniagotuje.pl/przepis/abc')).toBe('aniagotuje.pl');
  });

  it('extracts host with port', () => {
    expect(hostOf('http://localhost:3000/foo')).toBe('localhost:3000');
  });

  it('returns input unchanged when unparseable', () => {
    expect(hostOf('not a url')).toBe('not a url');
  });
});

describe('waitForSlot', () => {
  it('does not wait on the first call per host', async () => {
    const t0 = Date.now();
    await waitForSlot('example.com', 1000);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(50); // effectively instant
  });

  it('waits approximately the minimum interval between back-to-back calls', async () => {
    await waitForSlot('example.com', 100);
    const t0 = Date.now();
    await waitForSlot('example.com', 100);
    const elapsed = Date.now() - t0;
    // Allow generous slack for CI / timers jitter.
    expect(elapsed).toBeGreaterThanOrEqual(80);
    expect(elapsed).toBeLessThan(250);
  });

  it('does not cross hosts', async () => {
    await waitForSlot('a.com', 500);
    const t0 = Date.now();
    await waitForSlot('b.com', 500);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(50); // different host, no wait
  });

  it('queues concurrent callers on the same host', async () => {
    const t0 = Date.now();
    await Promise.all([
      waitForSlot('c.com', 100),
      waitForSlot('c.com', 100),
      waitForSlot('c.com', 100),
    ]);
    const elapsed = Date.now() - t0;
    // Three calls × 100ms spacing → ~200ms for the last to resolve.
    expect(elapsed).toBeGreaterThanOrEqual(180);
    expect(elapsed).toBeLessThan(400);
  });

  it('accepts zero interval without waiting', async () => {
    const t0 = Date.now();
    await waitForSlot('d.com', 0);
    await waitForSlot('d.com', 0);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(50);
  });
});
