import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EventBadge } from '../components/common/EventBadge.js';
import { getTruthfulEventLabel, formatEvidence } from '../utils/evidence.js';

describe('EventBadge and Truth-In-Evidence Invariants', () => {
  it('renders "Confirmed view" for CONFIRMED_EMAIL_VIEW', () => {
    const html = renderToString(<EventBadge type="CONFIRMED_EMAIL_VIEW" />);
    expect(html).toContain('Confirmed view');
    expect(html).not.toContain('READ');
  });

  it('renders "Probable open" for PROBABLE_EMAIL_OPEN', () => {
    const html = renderToString(<EventBadge type="PROBABLE_EMAIL_OPEN" />);
    expect(html).toContain('Probable open');
    expect(html).not.toContain('READ');
  });

  it('renders "Tracking request" for TRACKING_RESOURCE_REQUESTED', () => {
    const html = renderToString(<EventBadge type="TRACKING_RESOURCE_REQUESTED" />);
    expect(html).toContain('Tracking request');
    expect(html).not.toContain('READ');
  });

  it('renders "Click" for LINK_CLICKED', () => {
    const html = renderToString(<EventBadge type="LINK_CLICKED" />);
    expect(html).toContain('Click');
  });

  it('renders "Reply" for REPLY_RECEIVED', () => {
    const html = renderToString(<EventBadge type="REPLY_RECEIVED" />);
    expect(html).toContain('Reply');
  });

  it('renders "Delivered" for DELIVERED and DELIVERY_STATUS_UPDATED', () => {
    const html1 = renderToString(<EventBadge type="DELIVERED" />);
    expect(html1).toContain('Delivered');
    const html2 = renderToString(<EventBadge type="DELIVERY_STATUS_UPDATED" />);
    expect(html2).toContain('Delivered');
  });

  it('renders "Bounce" for BOUNCED', () => {
    const html = renderToString(<EventBadge type="BOUNCED" />);
    expect(html).toContain('Bounce');
  });

  it('strictly ensures getTruthfulEventLabel never returns READ for any tracking pixel event', () => {
    const events = [
      'TRACKING_RESOURCE_REQUESTED',
      'POSSIBLE_EMAIL_OPEN',
      'PROBABLE_EMAIL_OPEN',
      'CONFIRMED_EMAIL_VIEW',
      'LINK_CLICKED',
      'REPLY_RECEIVED',
      'DELIVERED',
      'BOUNCED',
    ];

    for (const evt of events) {
      const label = getTruthfulEventLabel(evt);
      expect(label.toUpperCase()).not.toBe('READ');
    }
  });

  it('derives accurate, evidence-based descriptions for proxies and direct events', () => {
    const proxyEvent = {
      type: 'TRACKING_RESOURCE_REQUESTED',
      source: 'remote_pixel',
      isProxy: true,
      proxyType: 'GOOGLE_IMAGE_PROXY',
      metadata: { anonymizedIp: '66.249.80.0/20' },
    };
    const evidence = formatEvidence(proxyEvent);
    expect(evidence).toContain('GoogleImageProxy');
    expect(evidence).toContain('indeterminate whether recipient opened message');

    const confirmedEvent = {
      type: 'CONFIRMED_EMAIL_VIEW',
      source: 'first_party_windows',
      metadata: { platform: 'WINDOWS', deviceIdentifier: 'device-01' },
    };
    const confirmedEvidence = formatEvidence(confirmedEvent);
    expect(confirmedEvidence).toContain('First-party client observation verified');
    expect(confirmedEvidence).toContain('Direct render in recipient viewport confirmed');
  });
});
