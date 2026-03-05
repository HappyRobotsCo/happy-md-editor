/**
 * Centralized Performance Budget Test Suite (Task P.2)
 *
 * This test suite validates the performance budget registry from spec 11.
 * It ensures:
 * 1. All spec-defined budgets are registered
 * 2. No duplicate labels exist
 * 3. Budget values match spec definitions
 * 4. PerfLogger integration works correctly with the budget registry
 * 5. Lightweight operations can be validated directly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerfLogger } from '../shared/logger';
import {
  PERFORMANCE_BUDGETS,
  getBudget,
} from '../shared/performance-budgets';

// Budget values from spec 11 — used to cross-check the registry
const SPEC_BUDGETS: Record<string, number> = {
  'extension:init': 500,
  'file:open': 100,
  'file:save': 100,
  'file:autosave': 50,
  'file:restore': 50,
  'file:handle-restore': 200,
  'tiptap:init': 200,
  'tiptap:serialize': 100,
  'tiptap:render': 200,
  'tiptap:hydrate': 200,
  'toolbar:action': 16,
  'toolbar:state-sync': 16,
  'toolbar:floating:show': 100,
  'toolbar:floating:hide': 16,
  'mode:switch': 300,
  'mode:serialize': 100,
  'mode:hydrate': 200,
  'theme:switch': 50,
  'theme:init': 100,
  'preview:render': 200,
  'preview:load': 500,
  'preview:sanitize': 200,
  'highlight:page': 100,
  'highlight:block': 10,
  'highlight:lazy-load': 200,
  'highlight:load': 500,
  'codemirror:load': 500,
  'codemirror:init': 500,
  'scroll:sync': 50,
  'frontmatter:parse': 10,
  'frontmatter:recombine': 10,
  'onboarding:init': 100,
  'onboarding:complete': 50,
  'lazy:feature-load': 500,
};

describe('Performance budget registry', () => {
  it('has no duplicate labels', () => {
    const labels = PERFORMANCE_BUDGETS.map((b) => b.label);
    const unique = new Set(labels);
    expect(labels.length).toBe(unique.size);
  });

  it('covers all spec-defined budgets', () => {
    const registeredLabels = new Set(PERFORMANCE_BUDGETS.map((b) => b.label));
    const missingFromRegistry: string[] = [];

    for (const label of Object.keys(SPEC_BUDGETS)) {
      if (!registeredLabels.has(label)) {
        missingFromRegistry.push(label);
      }
    }

    expect(
      missingFromRegistry,
      `Missing from registry: ${missingFromRegistry.join(', ')}`,
    ).toHaveLength(0);
  });

  it('registry budgets match spec values', () => {
    const mismatches: string[] = [];

    for (const budget of PERFORMANCE_BUDGETS) {
      const specBudget = SPEC_BUDGETS[budget.label];
      if (specBudget !== undefined && budget.budgetMs !== specBudget) {
        mismatches.push(
          `${budget.label}: registry=${budget.budgetMs}ms, spec=${specBudget}ms`,
        );
      }
    }

    expect(mismatches, mismatches.join('\n')).toHaveLength(0);
  });

  it('every budget has a description and testedIn reference', () => {
    for (const budget of PERFORMANCE_BUDGETS) {
      expect(budget.description, `${budget.label} missing description`).toBeTruthy();
      expect(budget.testedIn, `${budget.label} missing testedIn`).toBeTruthy();
    }
  });

  it('getBudget returns correct values', () => {
    expect(getBudget('tiptap:init')).toBe(200);
    expect(getBudget('file:open')).toBe(100);
    expect(getBudget('toolbar:action')).toBe(16);
    expect(getBudget('nonexistent:label')).toBeUndefined();
  });
});

describe('PerfLogger budget validation', () => {
  beforeEach(() => {
    PerfLogger.clear();
  });

  it('PerfLogger.start/end produces entries with valid timing', () => {
    PerfLogger.start('test:budget-check');
    // Small synchronous work
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    const entry = PerfLogger.end('test:budget-check', { sum });

    expect(entry.label).toBe('test:budget-check');
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.metadata).toEqual({ sum });

    const all = PerfLogger.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe('test:budget-check');
  });

  it('validates entries against budget registry', () => {
    // Simulate several operations completing within budget
    const testOps = [
      { label: 'frontmatter:parse', work: () => JSON.parse('{"title":"test"}') },
      { label: 'frontmatter:recombine', work: () => '---\ntitle: test\n---\n' + 'body' },
    ];

    for (const op of testOps) {
      PerfLogger.start(op.label);
      op.work();
      PerfLogger.end(op.label);
    }

    const entries = PerfLogger.getAll();
    for (const entry of entries) {
      const budget = getBudget(entry.label);
      expect(budget, `No budget defined for ${entry.label}`).toBeDefined();
      expect(
        entry.durationMs,
        `${entry.label} exceeded budget: ${entry.durationMs}ms > ${budget}ms`,
      ).toBeLessThan(budget!);
    }
  });

  it('summary includes all logged entries', () => {
    PerfLogger.start('test:a');
    PerfLogger.end('test:a');
    PerfLogger.start('test:b');
    PerfLogger.end('test:b');

    const summary = PerfLogger.summary();
    expect(summary).toContain('test:a');
    expect(summary).toContain('test:b');
    expect(summary).toContain('Duration (ms)');
  });
});

describe('Performance budget completeness', () => {
  it('prints budget summary table for CI visibility', () => {
    const header = `${'Operation'.padEnd(30)} | ${'Budget (ms)'.padStart(12)} | Tested In`;
    const divider = '-'.repeat(80);
    const rows = PERFORMANCE_BUDGETS.map(
      (b) =>
        `${b.label.padEnd(30)} | ${String(b.budgetMs).padStart(12)} | ${b.testedIn}`,
    );

    const table = [divider, header, divider, ...rows, divider].join('\n');
    console.log(`\nPerformance Budget Registry (${PERFORMANCE_BUDGETS.length} operations):\n${table}`);

    // Sanity: we have a reasonable number of budgets
    expect(PERFORMANCE_BUDGETS.length).toBeGreaterThanOrEqual(30);
  });

  it('all budgets are positive numbers', () => {
    for (const budget of PERFORMANCE_BUDGETS) {
      expect(budget.budgetMs, `${budget.label} has non-positive budget`).toBeGreaterThan(0);
    }
  });

  it('tight budgets (< 20ms) are limited to UI-thread operations', () => {
    const tightBudgets = PERFORMANCE_BUDGETS.filter((b) => b.budgetMs < 20);
    const expectedTightLabels = new Set([
      'toolbar:action',
      'toolbar:state-sync',
      'toolbar:floating:hide',
      'highlight:block',
      'frontmatter:parse',
      'frontmatter:recombine',
    ]);

    for (const budget of tightBudgets) {
      expect(
        expectedTightLabels.has(budget.label),
        `Unexpected tight budget: ${budget.label} (${budget.budgetMs}ms)`,
      ).toBe(true);
    }
  });
});
