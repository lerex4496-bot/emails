import { describe, it, expect } from 'vitest';
import { encryptCredentials, decryptCredentials } from '../crypto.js';

describe('AES-256-GCM Credential Encryption', () => {
  const secret = 'super-secret-mailtrace-encryption-key-32b';
  const plainData = JSON.stringify({
    refreshToken: '1//04test_oauth_refresh_token_xyz',
    accessToken: 'ya29.a0AfH6SMD_test_access_token',
    expiry: 1727500000,
  });

  it('encrypts and decrypts OAuth credentials correctly', () => {
    const cipherText = encryptCredentials(plainData, secret);
    expect(cipherText).toBeTypeOf('string');
    expect(cipherText).not.toEqual(plainData);
    expect(cipherText.split(':')).toHaveLength(3);

    const decrypted = decryptCredentials(cipherText, secret);
    expect(decrypted).toEqual(plainData);
    const parsed = JSON.parse(decrypted);
    expect(parsed.refreshToken).toBe('1//04test_oauth_refresh_token_xyz');
  });

  it('fails decryption with wrong key', () => {
    const cipherText = encryptCredentials(plainData, secret);
    expect(() => decryptCredentials(cipherText, 'wrong-secret-key-that-does-not-match')).toThrow();
  });

  it('fails decryption if ciphertext is tampered', () => {
    const cipherText = encryptCredentials(plainData, secret);
    const [iv, tag, data] = cipherText.split(':');
    // Tamper with data byte
    const tamperedData = data.slice(0, -2) + (data.endsWith('0') ? '1' : '0');
    const tamperedCipher = `${iv}:${tag}:${tamperedData}`;

    expect(() => decryptCredentials(tamperedCipher, secret)).toThrow();
  });

  it('produces different ciphertexts for the same plaintext due to random IV', () => {
    const c1 = encryptCredentials(plainData, secret);
    const c2 = encryptCredentials(plainData, secret);
    expect(c1).not.toEqual(c2);
    expect(decryptCredentials(c1, secret)).toEqual(decryptCredentials(c2, secret));
  });
});
