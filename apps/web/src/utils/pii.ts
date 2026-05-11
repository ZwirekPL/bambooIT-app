/**
 * PII guard utilities — strip personal identifiable information from free-text
 * before sending to backend.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\s\-.]?){7,12}/g;
const DATE_RE =
  /\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4}|\d{1,2}\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)\s+\d{4})\b/gi;
const PESEL_RE = /\b\d{11}\b/g;

export function sanitizePii(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(EMAIL_RE, '[adres_email]')
    .replace(PESEL_RE, '[PESEL]')
    .replace(DATE_RE, '[data]')
    .replace(PHONE_RE, '[telefon]')
    .trim();
}
