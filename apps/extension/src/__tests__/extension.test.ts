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
    expect(manifest.content_scripts.length).toBe(2);

    const gmailScript = manifest.content_scripts.find((s: { matches: string[] }) =>
      s.matches.includes('https://mail.google.com/*')
    );
    expect(gmailScript).toBeDefined();
    expect(gmailScript.js).toContain('dist/content/gmail.js');

    const outlookScript = manifest.content_scripts.find((s: { matches: string[] }) =>
      s.matches.includes('https://outlook.live.com/*')
    );
    expect(outlookScript).toBeDefined();
  });

  describe('findStatusMatch Algorithm Tests', () => {
    // Import findStatusMatch
    it('should prioritize exact subject matches over substring matches (e.g. hiiiiiiiiii vs hi)', async () => {
      const { findStatusMatch } = await import('../content/gmail');

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
      const { findStatusMatch } = await import('../content/gmail');

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
