import { describe, it, expect } from 'vitest';
import { classifyTrackingRequest } from '../classifier.js';
import { ConfidenceLevel, Classification, TrackingEventType } from '@mailtrace/shared';

describe('Anti-False-Positive Classification Engine', () => {
  const sentTime = new Date('2026-09-28T10:00:00Z');

  it('classifies first-party client observation as CONFIRMED_EMAIL_VIEW with 1.0 probability', () => {
    const result = classifyTrackingRequest({
      isFirstParty: true,
      requestTime: new Date('2026-09-28T10:05:00Z'),
    });

    expect(result.eventType).toBe(TrackingEventType.CONFIRMED_EMAIL_VIEW);
    expect(result.confidence).toBe(ConfidenceLevel.CONFIRMED);
    expect(result.classification).toBe(Classification.CONFIRMED_FIRST_PARTY);
    expect(result.humanProbability).toBe(1.0);
  });

  it('classifies GoogleImageProxy as POSSIBLE_EMAIL_OPEN with MEDIUM confidence', () => {
    const result = classifyTrackingRequest({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GoogleImageProxy',
      sentAt: sentTime,
      requestTime: new Date('2026-09-28T10:00:02Z'),
    });

    expect(result.eventType).toBe(TrackingEventType.POSSIBLE_EMAIL_OPEN);
    expect(result.confidence).toBe(ConfidenceLevel.MEDIUM);
    expect(result.classification).toBe(Classification.POSSIBLE_HUMAN);
    expect(result.isProxy).toBe(true);
    expect(result.proxyType).toBe('GoogleImageProxy');
    expect(result.humanProbability).toBe(0.5);
  });

  it('classifies AppleMailProxy as POSSIBLE_EMAIL_OPEN with MEDIUM confidence', () => {
    const result = classifyTrackingRequest({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) AppleMailProxy/1.0',
      sentAt: sentTime,
      requestTime: new Date('2026-09-28T10:00:01Z'),
    });

    expect(result.eventType).toBe(TrackingEventType.POSSIBLE_EMAIL_OPEN);
    expect(result.confidence).toBe(ConfidenceLevel.MEDIUM);
    expect(result.proxyType).toBe('AppleMailProxy');
  });

  it('classifies prefetch headers as LIKELY_AUTOMATED with LOW confidence', () => {
    const result = classifyTrackingRequest({
      userAgent: 'Mozilla/5.0 Chrome',
      headers: { 'sec-purpose': 'prefetch' },
      sentAt: sentTime,
      requestTime: new Date('2026-09-28T10:02:00Z'),
    });

    expect(result.eventType).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
    expect(result.confidence).toBe(ConfidenceLevel.LOW);
    expect(result.classification).toBe(Classification.LIKELY_AUTOMATED);
  });

  it('classifies suspicious immediate fetch (<1s from send) as LIKELY_AUTOMATED', () => {
    const result = classifyTrackingRequest({
      userAgent: 'SomeGenericMailClient/1.0',
      sentAt: sentTime,
      requestTime: new Date('2026-09-28T10:00:00.250Z'), // 250ms later
    });

    expect(result.eventType).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
    expect(result.confidence).toBe(ConfidenceLevel.LOW);
    expect(result.classification).toBe(Classification.LIKELY_AUTOMATED);
  });

  it('classifies interactive human timing with standard browser UA as PROBABLE_EMAIL_OPEN with HIGH confidence', () => {
    const result = classifyTrackingRequest({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      sentAt: sentTime,
      requestTime: new Date('2026-09-28T10:02:30Z'), // 2.5 minutes later
    });

    expect(result.eventType).toBe(TrackingEventType.PROBABLE_EMAIL_OPEN);
    expect(result.confidence).toBe(ConfidenceLevel.HIGH);
    expect(result.classification).toBe(Classification.PROBABLE_HUMAN);
    expect(result.humanProbability).toBeGreaterThan(0.8);
  });
});
