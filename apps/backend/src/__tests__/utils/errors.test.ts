import { describe, it, expect } from 'vitest';
import { apiError, AppError } from '../../utils/errors';

describe('apiError()', () => {
  it('returns correct { error: { code, message } } shape', () => {
    expect(apiError('NOT_FOUND', 'Resource not found')).toEqual({
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('propagates code and message verbatim', () => {
    const result = apiError('EMAIL_TAKEN', 'Email is already registered');
    expect(result.error.code).toBe('EMAIL_TAKEN');
    expect(result.error.message).toBe('Email is already registered');
  });
});

describe('AppError', () => {
  it('stores statusCode, code, and message', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Resource not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
  });

  it('is an instance of Error', () => {
    expect(new AppError(500, 'INTERNAL', 'oops')).toBeInstanceOf(Error);
  });

  it('has name "AppError"', () => {
    expect(new AppError(400, 'BAD', 'bad')).toHaveProperty('name', 'AppError');
  });

  it('can be caught as Error', () => {
    expect(() => { throw new AppError(403, 'FORBIDDEN', 'denied'); }).toThrow(Error);
  });
});
