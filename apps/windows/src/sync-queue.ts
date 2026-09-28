export interface QueuedConfirmViewEvent {
  id: string;
  messageId: string;
  deviceIdentifier: string;
  platform: 'WINDOWS';
  timestamp: string;
}

export class WindowsSyncQueue {
  private queue: QueuedConfirmViewEvent[] = [];
  private isFlushing = false;

  constructor(private storageKey: string = 'mailtrace_win_offline_queue') {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          this.queue = JSON.parse(raw);
        }
      }
    } catch {
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
      }
    } catch {
      // Storage unavailable or full
    }
  }

  public enqueueConfirmView(messageId: string, deviceIdentifier: string): QueuedConfirmViewEvent {
    const event: QueuedConfirmViewEvent = {
      id: `win-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      messageId,
      deviceIdentifier,
      platform: 'WINDOWS',
      timestamp: new Date().toISOString(),
    };

    this.queue.push(event);
    this.saveToStorage();
    return event;
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getQueue(): QueuedConfirmViewEvent[] {
    return [...this.queue];
  }

  public async flush(apiBaseUrl: string): Promise<{ synced: number; failed: number }> {
    if (this.isFlushing || this.queue.length === 0) {
      return { synced: 0, failed: 0 };
    }

    this.isFlushing = true;
    let synced = 0;
    let failed = 0;

    const remaining: QueuedConfirmViewEvent[] = [];

    for (const item of this.queue) {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/events/confirm-view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (res.ok) {
          synced++;
        } else {
          remaining.push(item);
          failed++;
        }
      } catch {
        remaining.push(item);
        failed++;
      }
    }

    this.queue = remaining;
    this.saveToStorage();
    this.isFlushing = false;

    return { synced, failed };
  }
}
