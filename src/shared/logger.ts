export interface PerfEntry {
  label: string;
  durationMs: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const entries: PerfEntry[] = [];
const startTimes = new Map<string, number>();

function isEnabled(): boolean {
  try {
    return import.meta.env.DEV || import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

export const PerfLogger = {
  start(label: string): void {
    if (!isEnabled()) return;
    startTimes.set(label, performance.now());
  },

  end(label: string, metadata?: Record<string, unknown>): PerfEntry {
    const now = performance.now();
    const start = startTimes.get(label);
    const durationMs = start != null ? now - start : 0;
    startTimes.delete(label);

    const entry: PerfEntry = {
      label,
      durationMs,
      timestamp: Date.now(),
      ...(metadata ? { metadata } : {}),
    };

    if (isEnabled()) {
      entries.push(entry);
    }

    return entry;
  },

  measure<T>(label: string, fn: () => T): T {
    if (!isEnabled()) return fn();
    PerfLogger.start(label);
    const result = fn();
    PerfLogger.end(label);
    return result;
  },

  async async<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!isEnabled()) return fn();
    PerfLogger.start(label);
    const result = await fn();
    PerfLogger.end(label);
    return result;
  },

  getAll(): PerfEntry[] {
    return [...entries];
  },

  clear(): void {
    entries.length = 0;
    startTimes.clear();
  },

  summary(): string {
    if (!isEnabled() || entries.length === 0) return '';

    const header = `${'Label'.padEnd(30)} | ${'Duration (ms)'.padStart(14)} | Timestamp`;
    const divider = '-'.repeat(header.length);
    const rows = entries.map(
      (e) =>
        `${e.label.padEnd(30)} | ${e.durationMs.toFixed(2).padStart(14)} | ${new Date(e.timestamp).toISOString()}`,
    );

    const table = [divider, header, divider, ...rows, divider].join('\n');

    if (import.meta.env.DEV) {
      console.log(table);
    }

    return table;
  },
};
