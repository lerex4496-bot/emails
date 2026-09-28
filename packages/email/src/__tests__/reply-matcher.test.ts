import { describe, it, expect } from 'vitest';
import { extractReplyCorrelationKeys } from '../replies/matcher.js';

describe('Reply Association Key Extraction', () => {
  it('extracts alias token from plus-addressing', () => {
    const keys = extractReplyCorrelationKeys({
      to: 'reply+01HV998X72TOK@track.mailtrace.io',
    });
    expect(keys).toContainEqual({
      type: 'ALIAS_TOKEN',
      key: '01HV998X72TOK',
    });
  });

  it('extracts Internet Message-ID from In-Reply-To header', () => {
    const keys = extractReplyCorrelationKeys({
      inReplyTo: '<original-msg-12345@domain.com>',
    });
    expect(keys).toContainEqual({
      type: 'INTERNET_MESSAGE_ID',
      key: 'original-msg-12345@domain.com',
    });
  });

  it('extracts multiple Message-IDs from References header', () => {
    const keys = extractReplyCorrelationKeys({
      references: '<parent-1@domain.com> <parent-2@domain.com>',
    });
    expect(keys).toHaveLength(2);
    expect(keys[0].key).toBe('parent-1@domain.com');
    expect(keys[1].key).toBe('parent-2@domain.com');
  });

  it('extracts native provider Thread ID', () => {
    const keys = extractReplyCorrelationKeys({
      threadId: '18ab938fe31a00bc',
    });
    expect(keys).toContainEqual({
      type: 'THREAD_ID',
      key: '18ab938fe31a00bc',
    });
  });
});
