import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WindowsSyncQueue } from '../sync-queue.js';

describe('Windows First-Party Client Offline Sync Queue', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('enqueues confirmed view events with platform WINDOWS', () => {
    const queue = new WindowsSyncQueue('test_queue_key');
    const evt = queue.enqueueConfirmView('msg-win-101', 'win-desktop-device-01');

    expect(evt.messageId).toBe('msg-win-101');
    expect(evt.platform).toBe('WINDOWS');
    expect(evt.deviceIdentifier).toBe('win-desktop-device-01');
    expect(queue.getPendingCount()).toBe(1);
  });

  it('flushes queued events to the backend API successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as any);

    const queue = new WindowsSyncQueue('test_queue_key_2');
    queue.enqueueConfirmView('msg-win-102', 'win-pc');

    const result = await queue.flush('http://localhost:3000');
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(queue.getPendingCount()).toBe(0);
  });

  it('retains event in queue if network request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network offline'));

    const queue = new WindowsSyncQueue('test_queue_key_3');
    queue.enqueueConfirmView('msg-win-103', 'win-pc');

    const result = await queue.flush('http://localhost:3000');
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(queue.getPendingCount()).toBe(1);
  });
});
