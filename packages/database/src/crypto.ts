import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getKeyBuffer(secret: string): Buffer {
  // If secret is already 32-byte hex (64 chars), use it directly, otherwise hash with SHA-256
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plain text using AES-256-GCM authenticated encryption.
 * Output format: <iv_hex>:<authTag_hex>:<encrypted_hex>
 */
export function encryptCredentials(plainText: string, secretKey: string): string {
  if (!plainText) {
    throw new Error('Cannot encrypt empty or null text');
  }
  if (!secretKey) {
    throw new Error('Secret key is required for encryption');
  }

  const key = getKeyBuffer(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts AES-256-GCM cipher text.
 * Expects format: <iv_hex>:<authTag_hex>:<encrypted_hex>
 */
export function decryptCredentials(cipherText: string, secretKey: string): string {
  if (!cipherText) {
    throw new Error('Cannot decrypt empty cipher text');
  }
  if (!secretKey) {
    throw new Error('Secret key is required for decryption');
  }

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid cipher text format. Expected iv:authTag:encrypted');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKeyBuffer(secretKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid IV or Auth Tag length in cipher text');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
