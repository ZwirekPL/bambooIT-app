import { redis } from './redis';

const DEFAULT_TTL_SECONDS = 86400; // 24 hours

/**
 * Check if an event has already been processed. If not, mark it as processed.
 *
 * Uses Redis SET NX (set-if-not-exists) to atomically check + reserve in one call.
 * Returns true if the event is NEW (first time seen), false if DUPLICATE.
 *
 * @param namespace - prefix to avoid collisions (e.g. 'stripe', 'n8n')
 * @param eventId   - unique event identifier
 * @param ttlSeconds - how long to remember the event (default 24h)
 */
export async function markEventProcessed(
  namespace: string,
  eventId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const key = `idempotency:${namespace}:${eventId}`;
  try {
    // SET key value NX EX ttl — returns 'OK' if set, null if already exists
    const result = await redis.set(key, Date.now().toString(), 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (err) {
    // Redis failure should not block processing — log and allow through
    console.error(`[idempotency] Redis error for ${key}:`, err instanceof Error ? err.message : err);
    return true; // fail-open: allow processing if Redis is down
  }
}

/**
 * Remove an idempotency key so the event can be reprocessed (e.g. after repair trigger).
 */
export async function clearEventProcessed(namespace: string, eventId: string): Promise<void> {
  const key = `idempotency:${namespace}:${eventId}`;
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[idempotency] Redis DEL error for ${key}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Check if an event was already processed (read-only, no side effects).
 */
export async function isEventProcessed(namespace: string, eventId: string): Promise<boolean> {
  const key = `idempotency:${namespace}:${eventId}`;
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch {
    return false; // fail-open
  }
}
