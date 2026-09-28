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
    expect(outlookScript.js).toContain('dist/content/outlook.js');
  });
});
