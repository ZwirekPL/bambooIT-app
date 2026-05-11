import { z } from 'zod';

/** Shared password schema: min 12 chars, at least 1 letter and 1 digit. */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');
