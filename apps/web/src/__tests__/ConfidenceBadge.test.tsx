import { describe, it, expect } from 'vitest';
import { ConfidenceLevel } from '@mailtrace/shared';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge.js';

describe('ConfidenceBadge UI Component', () => {
  it('renders Confirmed View label and styling for first-party events', () => {
    const html = renderToString(<ConfidenceBadge level={ConfidenceLevel.CONFIRMED} />);
    expect(html).toContain('Confirmed View');
  });

  it('renders Probable Open for high confidence human events', () => {
    const html = renderToString(<ConfidenceBadge level={ConfidenceLevel.HIGH} />);
    expect(html).toContain('Probable Open');
  });

  it('renders Possible Open (Proxy) for medium confidence caching proxies', () => {
    const html = renderToString(<ConfidenceBadge level={ConfidenceLevel.MEDIUM} />);
    expect(html).toContain('Possible Open (Proxy)');
  });

  it('renders Resource Requested for low confidence automated fetches', () => {
    const html = renderToString(<ConfidenceBadge level={ConfidenceLevel.LOW} />);
    expect(html).toContain('Resource Requested');
  });
});
