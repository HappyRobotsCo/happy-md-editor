import { describe, it, expect, beforeEach } from 'vitest';
import { PerfLogger } from './logger';

describe('PerfLogger', () => {
  beforeEach(() => {
    PerfLogger.clear();
  });

  it('records start/end timing', () => {
    PerfLogger.start('test:op');
    const entry = PerfLogger.end('test:op');
    expect(entry.label).toBe('test:op');
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.timestamp).toBeGreaterThan(0);
  });

  it('stores entries accessible via getAll()', () => {
    PerfLogger.start('op1');
    PerfLogger.end('op1');
    PerfLogger.start('op2');
    PerfLogger.end('op2');
    const all = PerfLogger.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].label).toBe('op1');
    expect(all[1].label).toBe('op2');
  });

  it('measure wraps synchronous function', () => {
    const result = PerfLogger.measure('sync:op', () => 42);
    expect(result).toBe(42);
    expect(PerfLogger.getAll()).toHaveLength(1);
    expect(PerfLogger.getAll()[0].label).toBe('sync:op');
  });

  it('async wraps async function', async () => {
    const result = await PerfLogger.async('async:op', async () => {
      return 'done';
    });
    expect(result).toBe('done');
    expect(PerfLogger.getAll()).toHaveLength(1);
    expect(PerfLogger.getAll()[0].label).toBe('async:op');
  });

  it('summary returns formatted string', () => {
    PerfLogger.start('summary:test');
    PerfLogger.end('summary:test');
    const output = PerfLogger.summary();
    expect(output).toContain('summary:test');
    expect(output).toContain('Duration (ms)');
  });

  it('clear removes all entries', () => {
    PerfLogger.start('clear:test');
    PerfLogger.end('clear:test');
    expect(PerfLogger.getAll()).toHaveLength(1);
    PerfLogger.clear();
    expect(PerfLogger.getAll()).toHaveLength(0);
  });

  it('end with metadata attaches metadata', () => {
    PerfLogger.start('meta:test');
    const entry = PerfLogger.end('meta:test', { docSize: 1000 });
    expect(entry.metadata).toEqual({ docSize: 1000 });
  });

  it('getAll returns a copy, not original array', () => {
    PerfLogger.start('copy:test');
    PerfLogger.end('copy:test');
    const all = PerfLogger.getAll();
    all.push({ label: 'fake', durationMs: 0, timestamp: 0 });
    expect(PerfLogger.getAll()).toHaveLength(1);
  });
});
