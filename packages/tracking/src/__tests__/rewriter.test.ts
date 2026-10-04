import { describe, it, expect } from 'vitest';
import { extractTrackableLinks, injectTracking } from '../rewriter.js';

describe('HTML Tracking Rewriter & Link Extraction', () => {
  const sampleHtml = `
    <html>
      <head><title>Test Email</title></head>
      <body>
        <h1>Hello John,</h1>
        <p>Please check our <a href="https://example.com/docs" class="btn" style="color: blue;">Documentation</a>.</p>
        <p>Also contact us at <a href="mailto:support@example.com">Support</a> or jump to <a href="#faq">FAQ</a>.</p>
        <p>Read our blog <a href="http://blog.example.com/post-1">here</a>.</p>
      </body>
    </html>
  `;

  it('extracts only http and https URLs, ignoring mailto and anchors', () => {
    const links = extractTrackableLinks(sampleHtml);
    expect(links).toEqual(['https://example.com/docs', 'http://blog.example.com/post-1']);
  });

  it('injects 1x1 transparent tracking pixel before closing body tag', () => {
    const output = injectTracking({
      html: sampleHtml,
      openToken: 'open_tok_12345',
      trackingBaseUrl: 'https://track.mailtrace.io',
    });

    expect(output).toContain('<img src="https://track.mailtrace.io/t/open/open_tok_12345.png"');
    expect(output).toContain('width="1" height="1"');
    expect(output).toContain('opacity:0.01');
    // Ensure pixel is placed before </body>
    const pixelPos = output.indexOf('<img src="https://track.mailtrace.io/t/open/open_tok_12345.png"');
    const bodyClosePos = output.indexOf('</body>');
    expect(pixelPos).toBeLessThan(bodyClosePos);
  });

  it('rewrites trackable links to click redirect endpoint while keeping styles intact', () => {
    const linkMap = {
      'https://example.com/docs': 'click_tok_docs',
      'http://blog.example.com/post-1': 'click_tok_blog',
    };

    const output = injectTracking({
      html: sampleHtml,
      openToken: 'open_tok_12345',
      linkTokenMap: linkMap,
      trackingBaseUrl: 'https://track.mailtrace.io',
    });

    // Validates rewritten links
    expect(output).toContain('href="https://track.mailtrace.io/t/click/click_tok_docs"');
    expect(output).toContain('class="btn" style="color: blue;"');
    expect(output).toContain('href="https://track.mailtrace.io/t/click/click_tok_blog"');
    // Non-http links should remain untouched
    expect(output).toContain('href="mailto:support@example.com"');
    expect(output).toContain('href="#faq"');
  });

  it('handles HTML fragments without body tags gracefully', () => {
    const fragment = '<p>Simple message with <a href="https://site.org">Link</a></p>';
    const output = injectTracking({
      html: fragment,
      openToken: 'open_tok_fragment',
      trackingBaseUrl: 'https://track.mailtrace.io',
    });

    expect(output).toContain('<img src="https://track.mailtrace.io/t/open/open_tok_fragment.png"');
  });
});
