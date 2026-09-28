import { describe, it, expect } from 'vitest';
import { generateTrackingToken, generateReplyAlias } from '../token.js';

describe('Tracking Token Generation', () => {
  it('generates 32-character hex tokens with 128-bit entropy', () => {
    const token = generateTrackingToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique tokens without collisions in 10,000 iterations', () => {
    const tokens = new Set<string>();
    const count = 10000;
    for (let i = 0; i < count; i++) {
      tokens.add(generateTrackingToken());
    }
    expect(tokens.size).toBe(count);
  });

  it('generates well-formed reply alias with plus addressing', () => {
    const alias = generateReplyAlias('track.mailtrace.io', 'token_abc123');
    expect(alias).toBe('reply+token_abc123@track.mailtrace.io');
  });
});
