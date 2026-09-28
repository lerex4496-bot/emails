import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EventTimeline, TimelineEvent } from '../components/messages/EventTimeline.js';

describe('EventTimeline Component Verification', () => {
  const sampleEvents: TimelineEvent[] = [
    {
      id: 'evt-1',
      type: 'TRACKING_RESOURCE_REQUESTED',
      confidence: 'LOW',
      classification: 'LIKELY_AUTOMATED',
      timestamp: '2026-09-28T09:15:00.000Z',
      source: 'security_filter',
      isProxy: true,
      proxyType: 'SECURITY_GATEWAY',
      userAgent: 'Proofpoint-URL-Scanner/2.4',
      metadata: {
        scannerNote: 'Immediate prefetch detected under 2 seconds',
      },
    },
    {
      id: 'evt-2',
      type: 'PROBABLE_EMAIL_OPEN',
      confidence: 'HIGH',
      classification: 'PROBABLE_HUMAN',
      timestamp: '2026-09-28T10:45:30.000Z',
      source: 'http_browser_get',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
      metadata: {
        timeToFirstRequestSec: 5430,
      },
    },
    {
      id: 'evt-3',
      type: 'CONFIRMED_EMAIL_VIEW',
      confidence: 'CONFIRMED',
      classification: 'CONFIRMED_FIRST_PARTY',
      timestamp: '2026-09-28T11:00:00.000Z',
      source: 'first_party_windows',
      metadata: {
        platform: 'WINDOWS',
        deviceIdentifier: 'workstation-desktop-01',
      },
    },
  ];

  it('renders every tracking event with event type, timestamp, source, confidence, and explicit evidence', () => {
    const html = renderToString(<EventTimeline events={sampleEvents} />);

    // 1. Verify Event Type Labels
    expect(html).toContain('Tracking request');
    expect(html).toContain('Probable open');
    expect(html).toContain('Confirmed view');

    // Invariant check: MUST NOT contain "READ"
    expect(html).not.toContain('>READ<');
    expect(html).not.toContain('Email Read');

    // 2. Verify Sources are visible
    expect(html).toContain('security_filter');
    expect(html).toContain('http_browser_get');
    expect(html).toContain('first_party_windows');

    // 3. Verify Confidences are rendered
    expect(html).toContain('Resource Requested');
    expect(html).toContain('Probable Open');
    expect(html).toContain('Confirmed View');

    // 4. Verify Explicit Evidence rationale panels
    expect(html).toContain('Physical Evidence &amp; Rationale:');
    expect(html).toContain('Automated security scanner pre-fetch by corporate mail gateway');
    expect(html).toContain('Client interaction pattern strongly consistent with human reading');
    expect(html).toContain('First-party client observation verified by MailTrace native client');
  });

  it('renders an informative empty state when events list is empty', () => {
    const html = renderToString(<EventTimeline events={[]} />);
    expect(html).toContain('No activity observed yet');
  });
});
