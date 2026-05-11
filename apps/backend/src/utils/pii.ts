/**
 * PII guard utilities — strip personal identifiable information from free-text
 * before sending to AI (PRE.11).
 */

// Email pattern
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Polish and international phone numbers (7-12 digit sequences, optionally with + or spaces)
const PHONE_RE = /(\+?\d[\s\-.]?){7,12}/g;

// Dates: common formats like 2024-01-15, 15.01.2024, 15/01/2024, 15 stycznia 2024
const DATE_RE =
  /\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4}|\d{1,2}\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)\s+\d{4})\b/gi;

// Polish PESEL (11 digits)
const PESEL_RE = /\b\d{11}\b/g;

const PLACEHOLDER_EMAIL = '[adres_email]';
const PLACEHOLDER_PHONE = '[telefon]';
const PLACEHOLDER_DATE = '[data]';
const PLACEHOLDER_PESEL = '[PESEL]';

/**
 * Remove PII (emails, phones, dates, PESEL) from a free-text string.
 * Returns the sanitized string.
 */
export function sanitizePii(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(EMAIL_RE, PLACEHOLDER_EMAIL)
    .replace(PESEL_RE, PLACEHOLDER_PESEL)
    .replace(DATE_RE, PLACEHOLDER_DATE)
    .replace(PHONE_RE, PLACEHOLDER_PHONE)
    .trim();
}
