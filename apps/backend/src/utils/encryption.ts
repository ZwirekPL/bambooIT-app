import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

interface EncryptedJson {
  [key: string]: string | number;
  v: number;
  iv: string;
  tag: string;
  data: string;
}

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY is not set');
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  return buf;
}

function isEncryptedJson(value: unknown): value is EncryptedJson {
  return (
    typeof value === 'object' &&
    value !== null &&
    'v' in value &&
    'iv' in value &&
    'tag' in value &&
    'data' in value
  );
}

export function encryptJson(data: unknown): EncryptedJson {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

/** Encrypt a plain string → "v1:iv:tag:data" format (79.1: chat messages) */
export function encryptString(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypt "v1:iv:tag:data" string → plain text. Returns input if not encrypted. */
export function decryptString(value: string): string {
  if (!value.startsWith('v1:')) return value; // legacy plaintext
  const parts = value.split(':');
  if (parts.length !== 4) return value;
  const key = getKey();
  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const data = Buffer.from(parts[3], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// Handles both encrypted payloads and legacy plaintext JSON (graceful migration)
export function decryptJson(value: unknown): unknown {
  if (!isEncryptedJson(value)) {
    return value;
  }
  const key = getKey();
  const iv = Buffer.from(value.iv, 'hex');
  const authTag = Buffer.from(value.tag, 'hex');
  const data = Buffer.from(value.data, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}
