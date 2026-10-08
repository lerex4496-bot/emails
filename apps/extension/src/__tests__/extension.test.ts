import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('MailTrace Extension Manifest & Companion Tests', () => {
  it('should have valid Manifest V3 structure and restricted permissions', () => {
    const manifestPath = path.resolve(__dirname, '../../manifest.json');
    const rawData = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(rawData);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('MailTrace Webmail Companion');
    expect(manifest.permissions).toContain('storage');
    // Verify no broad permissions like '<all_urls>' or webRequestBlocking
    expect(manifest.host_permissions).not.toContain('<all_urls>');
    expect(manifest.host_permissions).toContain('https://mail.google.com/*');
    expect(manifest.host_permissions).toContain('https://outlook.live.com/*');
  });

  it('should declare content scripts matching only Gmail and Outlook webmail', () => {
    const manifestPath = path.resolve(__dirname, '../../manifest.json');
    const rawData = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(rawData);

    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts.length).toBeGreaterThanOrEqual(2);

    const gmailScript = manifest.content_scripts.find((s: { matches: string[]; js: string[] }) =>
      s.matches.includes('https://mail.google.com/*') && s.js.includes('dist/content/gmail.js')
    );
    expect(gmailScript).toBeDefined();
    expect(gmailScript.js).toContain('dist/content/gmail.js');

    const outlookScript = manifest.content_scripts.find((s: { matches: string[] }) =>
      s.matches.includes('https://outlook.live.com/*')
    );
    expect(outlookScript).toBeDefined();
  });

  describe('Self-fetch suppression (declarativeNetRequest)', () => {
    const rulesPath = path.resolve(__dirname, '../../rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

    it('declares the ruleset referenced by the manifest', () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../manifest.json'), 'utf8')
      );
      expect(manifest.permissions).toContain('declarativeNetRequest');
      const ruleset = manifest.declarative_net_request.rule_resources.find(
        (r: { path: string; enabled: boolean }) => r.path === 'rules.json'
      );
      expect(ruleset).toBeDefined();
      expect(ruleset.enabled).toBe(true);
    });

    it('blocks the sender browser from fetching its own tracking pixel', () => {
      const rule = rules.find(
        (r: any) => r.action?.type === 'block' && r.condition?.urlFilter === '/t/open/'
      );
      expect(rule, 'rules.json must block /t/open/ initiated from Gmail').toBeDefined();
      expect(rule.condition.initiatorDomains).toEqual(['mail.google.com']);
    });

    it('keeps the block rule host-agnostic', () => {
      // The tracking host is derived from the request server-side and is editable in the
      // popup, so pinning requestDomains would silently stop matching if it ever changed.
      const rule = rules.find((r: any) => r.condition?.urlFilter === '/t/open/');
      expect(rule.condition.requestDomains).toBeUndefined();
    });

    it('never blocks proxied opens, which carry no /t/click or /t/open in the wire URL', () => {
      // Guards against someone "fixing" the rule by matching googleusercontent, which
      // would break every image in every email, and against blocking click redirects.
      for (const rule of rules) {
        const filter: string = rule.condition?.urlFilter ?? '';
        expect(filter).not.toContain('googleusercontent');
        expect(filter).not.toContain('/t/click/');
        expect(rule.condition?.requestDomains ?? []).not.toContain('ci3.googleusercontent.com');
      }
    });
  });

  describe('Sent-token registry scoping', () => {
    const gmailSrc = fs.readFileSync(
      path.resolve(__dirname, '../content/gmail.ts'),
      'utf8'
    );

    it('does not seed the suppression registry from the server-wide status poll', () => {
      // tracking-status returns every message on the server, and localStorage on
      // mail.google.com is shared across all Gmail accounts in a Chrome profile, so
      // seeding from it blanked recipients' pixels and suppressed genuine opens.
      expect(gmailSrc).not.toMatch(/^\s*recordSentTokens\(/m);
      expect(gmailSrc).not.toMatch(/function recordSentTokens\b/);
    });

    it('still records this device\'s own sends', () => {
      expect(gmailSrc).toMatch(/recordSentToken\(trackingData\.openToken\)/);
    });
  });

  describe('findStatusMatch Algorithm Tests', () => {
    const gmailDist = fs.readFileSync(path.resolve(__dirname, '../../dist/content/gmail.js'), 'utf8');
    const fnMatch = gmailDist.match(/function findStatusMatch\([\s\S]*?\n\}/);
    if (!fnMatch) throw new Error('findStatusMatch not found in dist/content/gmail.js');
    const findStatusMatch = new Function(
      'subjectText',
      'participantText',
      'rowFullText',
      'statuses',
      'claimedIds',
      `
      ${fnMatch[0]}
      return findStatusMatch(subjectText, participantText, rowFullText, statuses, claimedIds);
    `
    );

    it('should never contain any export statement in dist/content/gmail.js', () => {
      expect(gmailDist).not.toMatch(/^\s*export\s+/m);
    });

    it('should prioritize exact subject matches over substring matches (e.g. hiiiiiiiiii vs hi)', async () => {
      const statuses = [
        {
          messageId: 'msg-delivered-hi',
          subject: 'hi',
          recipientEmail: 'jignesh@therealtorsconcierge.com',
          sentAt: '2026-10-04T09:51:58.409Z',
          status: 'DELIVERED',
          confidence: 'MEDIUM',
          eventLabel: 'Delivered',
          totalOpens: 0,
          totalClicks: 0,
          uniqueClicks: 0,
          replyReceived: false,
          lastActivity: '2026-10-04T09:51:58.409Z',
        },
        {
          messageId: 'msg-opened-hiiiiiiiiii',
          subject: 'hiiiiiiiiii',
          recipientEmail: 'jignesh@therealtorsconcierge.com',
          sentAt: '2026-10-04T09:36:03.661Z',
          status: 'OPENED',
          confidence: 'HIGH',
          eventLabel: 'Probable open',
          totalOpens: 2,
          totalClicks: 0,
          uniqueClicks: 0,
          replyReceived: false,
          lastActivity: '2026-10-04T09:46:55.470Z',
        },
      ];

      // Row with subject "hiiiiiiiiii"
      const matchForHiiiiiiiiii = findStatusMatch(
        'hiiiiiiiiii',
        'jignesh',
        'To: jignesh hiiiiiiiiii - nehhhhhhhhhhhhhhhh 15:06',
        statuses
      );

      expect(matchForHiiiiiiiiii).toBeDefined();
      expect(matchForHiiiiiiiiii?.messageId).toBe('msg-opened-hiiiiiiiiii');
      expect(matchForHiiiiiiiiii?.status).toBe('OPENED');
      expect(matchForHiiiiiiiiii?.totalOpens).toBe(2);

      // Row with subject "hi"
      const matchForHi = findStatusMatch(
        'hi',
        'jignesh',
        'To: jignesh hi - nehhhhhhhh 15:21',
        statuses
      );

      expect(matchForHi).toBeDefined();
      expect(matchForHi?.messageId).toBe('msg-delivered-hi');
      expect(matchForHi?.status).toBe('DELIVERED');
    });

    it('should respect 1-to-1 claiming across multiple rows with identical subjects', async () => {
      const statuses = [
        {
          messageId: 'msg-newer-hi',
          subject: 'hi',
          recipientEmail: 'jignesh@therealtorsconcierge.com',
          sentAt: '2026-10-04T09:51:58.409Z',
          status: 'DELIVERED',
          confidence: 'MEDIUM',
          eventLabel: 'Delivered',
          totalOpens: 0,
          totalClicks: 0,
          uniqueClicks: 0,
          replyReceived: false,
          lastActivity: '2026-10-04T09:51:58.409Z',
        },
        {
          messageId: 'msg-older-hi',
          subject: 'hi',
          recipientEmail: 'jignesh@therealtorsconcierge.com',
          sentAt: '2026-10-04T09:47:52.490Z',
          status: 'DELIVERED',
          confidence: 'MEDIUM',
          eventLabel: 'Delivered',
          totalOpens: 0,
          totalClicks: 0,
          uniqueClicks: 0,
          replyReceived: false,
          lastActivity: '2026-10-04T09:47:52.490Z',
        },
      ];

      const claimed = new Set<string>();

      // First row (newer)
      const row1Match = findStatusMatch('hi', 'jignesh', 'To: jignesh hi', statuses, claimed);
      expect(row1Match?.messageId).toBe('msg-newer-hi');
      claimed.add(row1Match!.messageId);

      // Second row (older) should NOT re-claim msg-newer-hi
      const row2Match = findStatusMatch('hi', 'jignesh', 'To: jignesh hi', statuses, claimed);
      expect(row2Match?.messageId).toBe('msg-older-hi');
      claimed.add(row2Match!.messageId);
    });
  });
});
