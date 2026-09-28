import crypto from 'node:crypto';

/**
 * Generates a cryptographically random, collision-resistant tracking token.
 * Uses 16 random bytes (128 bits of entropy) formatted as hexadecimal string (32 chars)
 * or standard UUIDv4.
 */
export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a standard UUIDv4 for message and entity identifiers.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generates a sub-addressing reply alias token.
 */
export function generateReplyAlias(domain: string, token: string): string {
  return `reply+${token}@${domain}`;
}
