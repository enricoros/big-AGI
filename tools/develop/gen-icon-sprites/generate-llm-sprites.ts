#!/usr/bin/env node
/**
 * Generates VendorIconSprite.tsx from individual vendor icon files + a template.
 *
 * Source of truth:  individual icon .tsx files in src/modules/llms/components/
 * Template:         tools/develop/gen-icon-sprites/VendorIconSprite.template.tsx
 * Output:           src/modules/llms/components/LLMVendorIconSprite.tsx
 *
 * Usage:  node tools/develop/gen-icon-sprites/generate-llm-sprites.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../../..');
const VENDORS_DIR = join(ROOT, 'src/common/components/icons/vendors');
const REGISTRY_FILE = join(ROOT, 'src/modules/llms/components/LLMVendorIcon.tsx');
const TEMPLATE_FILE = join(import.meta.dirname, 'VendorIconSprite.template.tsx');
const OUTPUT_FILE = join(ROOT, 'src/modules/llms/components/LLMVendorIconSprite.tsx');


interface VendorEntry {
  vendorId: string;
  componentName: string;
  fileName: string;
}

interface ParsedIcon {
  attrs: Record<string, string>;
  children: string;
}


// ── Step 1: Parse vendor registry (vendorId → component name → file) ──────────

function parseVendorRegistry(): VendorEntry[] {
  const src = readFileSync(REGISTRY_FILE, 'utf-8');

  // Extract imports: import { ComponentName } from '~/common/components/icons/vendors/FileName';
  const importMap: Record<string, string> = {}; // ComponentName → fileName (without .tsx)
  // noinspection RegExpRedundantEscape
  for (const m of src.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*'~\/common\/components\/icons\/vendors\/(\w+)'/g))
    importMap[m[1]] = m[2];

  // Extract registry entries: vendorId: ComponentName
  // noinspection RegExpRedundantEscape
  const registryMatch = src.match(/const vendorIcons[^{]*\{([\s\S]*?)\};/);
  if (!registryMatch) throw new Error('Could not find vendorIcons registry in LLMVendorIcon.tsx');

  const vendors: VendorEntry[] = [];
  for (const m of registryMatch[1].matchAll(/(\w+):\s*(\w+)/g)) {
    const vendorId = m[1];
    const componentName = m[2];
    const fileName = importMap[componentName];
    if (!fileName) throw new Error(`No import found for ${componentName} (vendor: ${vendorId})`);
    vendors.push({ vendorId, componentName, fileName });
  }

  console.log(`Found ${vendors.length} vendors in registry`);
  return vendors;
}


// ── Step 2: Parse a vendor icon .tsx file ─────────────────────────────────────

function parseIconFile(fileName: string): ParsedIcon {
  const filePath = join(VENDORS_DIR, fileName + '.tsx');
  const src = readFileSync(filePath, 'utf-8');

  // Match <SvgIcon [attributes] {...props}> ... </SvgIcon>
  const fullMatch = src.match(/<SvgIcon\s+([\s\S]*?)>([\s\S]*?)<\/SvgIcon>/);
  if (!fullMatch) {
    const selfClose = src.match(/<SvgIcon\s+([\s\S]*?)\/>/);
    if (selfClose) return { attrs: parseAttrs(selfClose[1]), children: '' };
    throw new Error(`Could not parse SvgIcon in ${filePath}`);
  }

  return { attrs: parseAttrs(fullMatch[1]), children: fullMatch[2].trim() };
}

/**
 * Parse JSX attributes from a raw string.
 * Returns: { viewBox: "'0 0 24 24'", strokeWidth: "{1.5}", ... }
 * Values include their delimiters (quotes or braces) for faithful reproduction.
 */
function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // noinspection RegExpRedundantEscape
  const cleaned = raw.replace(/\{\.\.\.props\}/g, '').trim();
  // noinspection RegExpRedundantEscape
  const re = /(\w+)=('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\{[^}]*\})/g;
  let m;
  while ((m = re.exec(cleaned)))
    attrs[m[1]] = m[2];
  return attrs;
}


// ── Step 3: Build <symbol> JSX for one vendor ─────────────────────────────────

function buildSymbol(vendorId: string, parsed: ParsedIcon): string {
  const { attrs, children } = parsed;
  const viewBox = stripQuotes(attrs.viewBox || "'0 0 24 24'");

  // Collect presentation attrs for the <g> wrapper (skip structural ones)
  const skipKeys = new Set(['viewBox', 'width', 'height']);
  const gAttrs: string[] = [];
  let hasFill = false;

  for (const [key, val] of Object.entries(attrs)) {
    if (skipKeys.has(key)) continue;
    gAttrs.push(`${key}=${val}`);
    if (key === 'fill') hasFill = true;
  }

  // Joy's SvgIcon applies CSS `fill: currentColor` which overrides `fill='none'` presentation attrs.
  // To match, always ensure fill='currentColor' on the <g>. Paths with explicit fill='none' still win.
  if (hasFill) {
    const idx = gAttrs.findIndex(a => a.startsWith('fill='));
    if (idx >= 0) gAttrs[idx] = `fill='currentColor'`;
  } else {
    gAttrs.push(`fill='currentColor'`);
  }

  const gAttrsStr = gAttrs.length ? ' ' + gAttrs.join(' ') : '';
  const indent = '          ';

  if (!children) {
    // noinspection JSUnresolvedReference
    return `        <symbol id={VI.${vendorId}} viewBox='${viewBox}'>\n${indent}<g${gAttrsStr} />\n        </symbol>`;
  }

  const childLines = children.split('\n').map(l => indent + l.trimStart()).join('\n');
  // noinspection JSUnresolvedReference
  return `        <symbol id={VI.${vendorId}} viewBox='${viewBox}'>\n${indent}<g${gAttrsStr}>\n${childLines}\n${indent}</g>\n        </symbol>`;
}

function stripQuotes(s: string): string {
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"')))
    return s.slice(1, -1);
  return s;
}


// ── Step 4: Generate output by replacing template placeholders ────────────────

function generateFromTemplate(vendors: VendorEntry[], symbols: string[]): string {
  // Template lines are prefixed with '// ' (or just '//') to avoid linter/tsc processing - strip them
  const template = readFileSync(TEMPLATE_FILE, 'utf-8')
    .split('\n').map(l => l.startsWith('// ') ? l.slice(3) : l === '//' ? '' : l).join('\n');

  // Build VI entries
  const viEntries = vendors.map(v => `  ${v.vendorId}: 'vi-${v.vendorId}',`).join('\n');

  // Build symbols block
  const symbolsBlock = symbols.join('\n\n');

  // Replace placeholders
  return template
    .replace('/* __GENERATED_VI_ENTRIES__ */', viEntries)
    .replace('{/* __GENERATED_SYMBOLS__ */}', symbolsBlock);
}


// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('Generating VendorIconSprite.tsx ...\n');

  const vendors = parseVendorRegistry();
  const symbols: string[] = [];

  for (const v of vendors) {
    try {
      const parsed = parseIconFile(v.fileName);
      symbols.push(buildSymbol(v.vendorId, parsed));
      console.log(`  ✓ ${v.vendorId} (${v.fileName})`);
    } catch (e) {
      console.error(`  ✗ ${v.vendorId} (${v.fileName}): ${(e as Error).message}`);
      process.exit(1);
    }
  }

  const output = generateFromTemplate(vendors, symbols);
  writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`\nWrote ${OUTPUT_FILE}`);
}

main();
