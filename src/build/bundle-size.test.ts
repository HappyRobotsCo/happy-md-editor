import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dir = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dir, '../../dist');
const MANIFEST_PATH = resolve(DIST_DIR, '.vite/manifest.json');

const CORE_BUDGET_BYTES = 280 * 1024; // 280KB gzipped
const WITH_SOURCE_MODE_BUDGET_BYTES = 500 * 1024; // 500KB gzipped

interface ManifestEntry {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
}

type Manifest = Record<string, ManifestEntry>;

function getGzipSize(filePath: string): number {
  const content = readFileSync(filePath);
  return gzipSync(content).length;
}

/**
 * Collect transitive static imports for a manifest key.
 */
function collectStaticImports(
  manifest: Manifest,
  key: string,
  visited = new Set<string>(),
): Set<string> {
  if (visited.has(key)) return visited;
  visited.add(key);
  const entry = manifest[key];
  if (!entry) return visited;
  if (entry.imports) {
    for (const imp of entry.imports) {
      collectStaticImports(manifest, imp, visited);
    }
  }
  return visited;
}

/**
 * Collect a chunk and its direct dynamic imports (one level),
 * then follow only static imports from those.
 */
function collectWithDirectDynamics(
  manifest: Manifest,
  key: string,
  visited: Set<string>,
): void {
  collectStaticImports(manifest, key, visited);
  const entry = manifest[key];
  if (!entry?.dynamicImports) return;
  for (const imp of entry.dynamicImports) {
    collectStaticImports(manifest, imp, visited);
  }
}

function sumGzipSizes(manifest: Manifest, keys: Set<string>): number {
  let total = 0;
  const seen = new Set<string>();
  for (const key of keys) {
    const entry = manifest[key];
    if (!entry || seen.has(entry.file)) continue;
    seen.add(entry.file);
    const filePath = resolve(DIST_DIR, entry.file);
    if (existsSync(filePath)) {
      total += getGzipSize(filePath);
    }
  }
  return total;
}

function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

describe.skipIf(!existsSync(MANIFEST_PATH))('Bundle size budgets', () => {
  let manifest: Manifest;

  beforeAll(() => {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  });

  it(`core bundle under ${formatKB(CORE_BUDGET_BYTES)} gzipped`, () => {
    const editorKey = 'src/editor/index.html';
    const coreKeys = collectStaticImports(manifest, editorKey);
    const coreSize = sumGzipSizes(manifest, coreKeys);

    console.log(`Core bundle: ${formatKB(coreSize)} gzipped (budget: ${formatKB(CORE_BUDGET_BYTES)})`);
    expect(coreSize).toBeLessThan(CORE_BUDGET_BYTES);
  });

  it(`total bundle with source mode under ${formatKB(WITH_SOURCE_MODE_BUDGET_BYTES)} gzipped`, () => {
    const editorKey = 'src/editor/index.html';
    const sourceEditorKey = 'src/editor/SourceEditor.tsx';

    // Core static imports
    const allKeys = collectStaticImports(manifest, editorKey);

    // SourceEditor: include the chunk itself and its direct dynamic imports
    // (CodeMirror base modules), but not recursive dynamic imports
    // (136 language packs from @codemirror/language-data)
    collectWithDirectDynamics(manifest, sourceEditorKey, allKeys);

    const totalSize = sumGzipSizes(manifest, allKeys);

    console.log(`With source mode: ${formatKB(totalSize)} gzipped (budget: ${formatKB(WITH_SOURCE_MODE_BUDGET_BYTES)})`);
    expect(totalSize).toBeLessThan(WITH_SOURCE_MODE_BUDGET_BYTES);
  });
});
