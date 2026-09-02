import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

function getSecretKey(): Buffer {
  const rawKey = env.ENCRYPTION_SECRET_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  if (rawKey.length === 64) {
    return Buffer.from(rawKey, 'hex');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypt sensitive plaintext using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptField(plaintext: string): string {
  if (!plaintext) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM with authentication verification.
 */
export function decryptField(encryptedPayload: string): string {
  if (!encryptedPayload) return '';

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new AppError('Invalid ciphertext structure', 500, 'DECRYPTION_MALFORMED_PAYLOAD');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getSecretKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    throw new AppError('Field decryption authentication failed (tampered ciphertext)', 500, 'DECRYPTION_AUTH_FAILED');
  }
}

/**
 * Mask PAN (e.g. ABCDE1234F -> XXXXX1234F) for display without exposing full identifier
 */
export function maskPan(pan: string): string {
  if (!pan || pan.length < 5) return 'XXXXX0000X';
  return `XXXXX${pan.slice(5)}`;
}

/**
 * Mask GSTIN (e.g. 27ABCDE1234F1Z5 -> 27XXXXXXXXX1Z5)
 */
export function maskGstin(gstin: string): string {
  if (!gstin || gstin.length < 15) return '27XXXXXXXXXX1Z5';
  return `${gstin.slice(0, 2)}XXXXXXXXXX${gstin.slice(12)}`;
}
