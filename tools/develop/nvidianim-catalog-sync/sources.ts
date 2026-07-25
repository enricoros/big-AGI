/**
 * NVIDIA Catalog Harvest - unauthenticated sources (1, 2, 3).
 *
 *  1. Live ids:      GET https://integrate.api.nvidia.com/v1/models
 *  2. Build catalog: GET https://build.nvidia.com/models.md (+ ?page=N) and the per-model .md cards,
 *                    plus the page HTML for the 'createdDate' that only lives in the flight payload
 *  3. NGC search:    GET https://api.ngc.nvidia.com/v2/search/catalog/resources/ENDPOINT
 *
 * None of these need a key. build.nvidia.com answers missing .md pages with either a plain-text
 * 404 or an HTTP 200 SPA shell, so a card only counts when it opens with YAML frontmatter.
 */

import type { CatalogCard, CatalogIndexEntry, HarvestedCapabilities, LiveModelId, NgcEndpoint } from './types';


const LIVE_MODELS_URL = 'https://integrate.api.nvidia.com/v1/models';
const BUILD_ORIGIN = 'https://build.nvidia.com';
// NVIDIA's internal NGC org id, which build.nvidia.com accepts as a universal publisher alias for
// every model page (`/<alias>/<slug>.md` works regardless of publisher). The live /models.md index
// links through it, so the value is re-learned from the index on every run (see fetchCatalogIndex) -
// this constant is only the fallback for --only runs or an unreachable index.
const DEFAULT_BUILD_ORG_ALIAS = 'qc69jvmznzxy';
let _buildOrgAlias = DEFAULT_BUILD_ORG_ALIAS;
const NGC_SEARCH_URL = 'https://api.ngc.nvidia.com/v2/search/catalog/resources/ENDPOINT';

const CATALOG_MAX_PAGES = 8;
const PUBLIC_FETCH_TIMEOUT = 45_000;

/**
 * build.nvidia.com sits behind an edge that (a) answers bursts and default UAs with a 403 'Access
 * Denied' page, and (b) - the subtle one - answers a non-browser-looking request for a model page
 * with an HTTP 200 stripped SPA shell that has NO flight payload, so the createdDate silently
 * vanishes. Only a full browser navigation header set gets the hydrated HTML. The .md endpoints
 * are happy with the plain header set.
 */
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PLAIN_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  'Accept': 'text/html,text/markdown,text/plain,*/*',
};

const BROWSER_NAV_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

const RETRY_STATUSES = [403, 429, 500, 502, 503, 504];
const DEFAULT_MAX_ATTEMPTS = 4;
const RETRY_BACKOFF_MS = 1500;


// --- small helpers ---

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _getTextOnce(url: string, headers: Record<string, string>): Promise<{ status: number; text: string } | null> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(PUBLIC_FETCH_TIMEOUT) });
    return { status: response.status, text: await response.text() };
  } catch {
    return null;
  }
}

/** GET with a bounded retry on edge/transport failures - never retries a real 404. */
async function _getText(url: string, maxAttempts = DEFAULT_MAX_ATTEMPTS, headers = PLAIN_HEADERS): Promise<{ status: number; text: string } | null> {
  let last: { status: number; text: string } | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await _sleep(RETRY_BACKOFF_MS * (attempt - 1) + Math.floor(Math.random() * 400));
    last = await _getTextOnce(url, headers);
    if (last && !RETRY_STATUSES.includes(last.status)) return last;
  }
  return last;
}

/** Aggressive normalization for cross-source joins: only alphanumerics survive, so '_' / '.' / '-' all collapse. */
export function joinKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Runs tasks with a small concurrency cap - build.nvidia.com is public but we stay polite. */
export async function mapPooled<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (; ;) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}


// --- source 1: live ids ---

export async function fetchLiveModelIds(): Promise<LiveModelId[]> {
  const got = await _getText(LIVE_MODELS_URL);
  if (!got || got.status !== 200)
    throw new Error(`Cannot list live models (status ${got?.status ?? 'transport-error'}) from ${LIVE_MODELS_URL}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(got.text);
  } catch {
    throw new Error('Cannot parse the /v1/models response as JSON');
  }

  const data = (parsed as { data?: unknown })?.data;
  if (!Array.isArray(data))
    throw new Error('Unexpected /v1/models shape: no data array');

  // note: the 'created' field is a constant sentinel (735790403), so it is deliberately ignored
  const ids: LiveModelId[] = [];
  for (const item of data) {
    const id = (item as { id?: unknown })?.id;
    if (typeof id !== 'string' || !id) continue;
    const ownedBy = (item as { owned_by?: unknown })?.owned_by;
    ids.push({ id, ownedBy: typeof ownedBy === 'string' ? ownedBy : null });
  }
  return ids.sort((a, b) => a.id.localeCompare(b.id));
}


// --- source 2: build.nvidia.com markdown catalog ---

export async function fetchCatalogIndex(): Promise<{ entries: CatalogIndexEntry[]; pagesRead: number; notes: string[] }> {
  const entries: CatalogIndexEntry[] = [];
  const seenSlugs = new Set<string>();
  const notes: string[] = [];
  let pagesRead = 0;

  for (let page = 1; page <= CATALOG_MAX_PAGES; page++) {
    const url = page === 1 ? `${BUILD_ORIGIN}/models.md` : `${BUILD_ORIGIN}/models.md?page=${page}`;
    const got = await _getText(url);
    if (!got || got.status !== 200) {
      notes.push(`catalog index page ${page}: status ${got?.status ?? 'transport-error'}`);
      break;
    }
    pagesRead = page;

    let added = 0;
    for (const rawLine of got.text.split('\n')) {
      // '- [Name](/qc69jvmznzxy/<slug>.md) - <description>' - the separator is an en/em dash on the live pages
      const match = rawLine.match(/^\s*-\s*\[([^\]]+)]\(([^)]+\.md)\)\s*[\u2014\u2013-]?\s*(.*)$/);
      if (!match) continue;
      const [, label, mdPath, description] = match;
      const slug = mdPath.replace(/^.*\//, '').replace(/\.md$/, '');
      // re-learn the org alias from the index's own link paths (self-heals if NVIDIA rotates the id)
      const aliasSegment = mdPath.match(/^\/?([^/]+)\//)?.[1];
      if (aliasSegment && aliasSegment !== _buildOrgAlias) {
        if (_buildOrgAlias !== DEFAULT_BUILD_ORG_ALIAS) notes.push(`catalog index: mixed org aliases ('${_buildOrgAlias}' vs '${aliasSegment}')`);
        _buildOrgAlias = aliasSegment;
      }
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      entries.push({ label: label.trim(), slug, mdPath, description: description.trim() });
      added++;
    }
    if (!added) break;
  }

  return { entries, pagesRead, notes };
}

function _looksLikeCard(text: string): boolean {
  // missing pages answer with a plain-text 404 or an HTML SPA shell, both without YAML frontmatter
  return text.startsWith('---') && /\ntitle:/.test(text.slice(0, 2000));
}

function _frontmatterValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!match) return null;
  const value = match[1].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
  return value || null;
}

function _sectionBody(markdown: string, heading: string): string | null {
  const start = markdown.indexOf(`## ${heading}`);
  if (start < 0) return null;
  const rest = markdown.slice(start + heading.length + 3);
  const end = rest.indexOf('\n## ');
  return end < 0 ? rest : rest.slice(0, end);
}

function _bulletValue(section: string | null, label: string): string | null {
  if (!section) return null;
  const match = section.match(new RegExp(`^\\s*-\\s*\\*\\*${label}:?\\*\\*:?\\s*(.*)$`, 'mi'));
  return match ? match[1].trim() || null : null;
}

function _bulletNumber(section: string | null, label: string): number | null {
  const raw = _bulletValue(section, label);
  if (!raw) return null;
  const digits = raw.replace(/,/g, '').match(/\d+/);
  if (!digits) return null;
  const value = parseInt(digits[0], 10);
  return Number.isFinite(value) ? value : null;
}

function _bulletSupported(section: string | null, label: string): boolean | null {
  const raw = _bulletValue(section, label);
  if (!raw) return null;
  if (/^not\s+supported/i.test(raw)) return false;
  if (/^supported/i.test(raw)) return true;
  return null;
}

function _bulletModalities(section: string | null, label: string): string[] | null {
  const raw = _bulletValue(section, label);
  if (!raw) return null;
  const parts = raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
  return parts.length ? parts : null;
}

export function parseCatalogCard(sourceUrl: string, markdown: string): CatalogCard | null {
  if (!_looksLikeCard(markdown)) return null;

  const fmEnd = markdown.indexOf('\n---', 3);
  const frontmatter = fmEnd < 0 ? markdown.slice(0, 2000) : markdown.slice(3, fmEnd);
  const body = fmEnd < 0 ? markdown : markdown.slice(fmEnd + 4);

  const specs = _sectionBody(body, 'Specifications');
  const caps = _sectionBody(body, 'Capabilities');

  const capabilities: HarvestedCapabilities = {
    tools: _bulletSupported(caps, 'Function Calling'),
    structuredOutput: _bulletSupported(caps, 'Structured Output'),
    reasoning: _bulletSupported(caps, 'Reasoning'),
  };

  return {
    sourceUrl,
    title: _frontmatterValue(frontmatter, 'title'),
    publisher: _frontmatterValue(frontmatter, 'publisher'),
    type: _frontmatterValue(frontmatter, 'type'),
    updated: _frontmatterValue(frontmatter, 'updated'),
    description: _frontmatterValue(frontmatter, 'description'),
    canonical: _frontmatterValue(frontmatter, 'canonical'),
    ctxAdvertised: _bulletNumber(specs, 'Context Length'),
    parameters: _bulletNumber(specs, 'Parameters'),
    modalitiesIn: _bulletModalities(specs, 'Input'),
    modalitiesOut: _bulletModalities(specs, 'Output'),
    capabilities,
  };
}

/** Candidate .md URLs for a model id, most-likely first. */
export function cardUrlCandidates(id: string, catalogSlug: string | null): string[] {
  const [publisher, ...rest] = id.split('/');
  const name = rest.join('/') || publisher;
  const names = Array.from(new Set([name, name.replace(/\./g, '_'), ...(catalogSlug ? [catalogSlug] : [])]));
  const urls: string[] = [];
  for (const candidate of names) {
    if (rest.length) urls.push(`${BUILD_ORIGIN}/${publisher}/${candidate}.md`);
    urls.push(`${BUILD_ORIGIN}/${_buildOrgAlias}/${candidate}.md`);
  }
  return Array.from(new Set(urls));
}

export async function fetchCatalogCard(id: string, catalogSlug: string | null): Promise<CatalogCard | null> {
  for (const url of cardUrlCandidates(id, catalogSlug)) {
    const got = await _getText(url, 3);
    if (!got || got.status !== 200) continue;
    const card = parseCatalogCard(url, got.text);
    if (card) return card;
  }
  return null;
}

/** The createdDate only exists in the page HTML flight payload (escaped inside self.__next_f.push strings). */
export function extractCreatedDate(html: string): string | null {
  const found: string[] = [];
  const regex = /\\?"createdDate\\?":\s*\\?"(20\d{2}-\d{2}-\d{2}T[^"\\]+)/g;
  for (; ;) {
    const match = regex.exec(html);
    if (!match) break;
    found.push(match[1]);
  }
  if (!found.length) return null;
  return [...found].sort()[0]; // earliest, the two payload copies differ by milliseconds
}

export async function fetchCreatedDate(pageUrl: string): Promise<{ createdDate: string | null; failure: string | null }> {
  // the browser navigation header set is mandatory here, or the edge returns a payload-free SPA shell
  const got = await _getText(pageUrl, DEFAULT_MAX_ATTEMPTS, BROWSER_NAV_HEADERS);
  if (!got) return { createdDate: null, failure: 'transport-error' };
  if (got.status !== 200) return { createdDate: null, failure: `HTTP ${got.status}` };
  const createdDate = extractCreatedDate(got.text);
  return { createdDate, failure: createdDate ? null : 'no createdDate in the flight payload' };
}


// --- source 3: NGC endpoint search (deprecation dates + invocation counts) ---

function _ngcAttribute(resource: Record<string, unknown>, key: string): string | null {
  const attributes = resource['attributes'];
  if (!Array.isArray(attributes)) return null;
  for (const attribute of attributes) {
    const entry = attribute as { key?: unknown; value?: unknown };
    if (entry?.key === key && typeof entry.value === 'string') return entry.value;
  }
  return null;
}

export async function fetchNgcEndpoints(): Promise<{ endpoints: NgcEndpoint[]; notes: string[] }> {
  const endpoints = new Map<string, NgcEndpoint>();
  const notes: string[] = [];

  for (const page of [0, 1]) {
    const query = encodeURIComponent(JSON.stringify({ query: '*', page, pageSize: 100 }));
    const got = await _getText(`${NGC_SEARCH_URL}?q=${query}`);
    if (!got || got.status !== 200) {
      notes.push(`NGC search page ${page}: status ${got?.status ?? 'transport-error'}`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(got.text);
    } catch {
      notes.push(`NGC search page ${page}: unparseable JSON`);
      continue;
    }

    const groups = (parsed as { results?: unknown })?.results;
    if (!Array.isArray(groups)) {
      notes.push(`NGC search page ${page}: no results array`);
      continue;
    }

    for (const group of groups) {
      const resources = (group as { resources?: unknown })?.resources;
      if (!Array.isArray(resources)) continue;
      for (const raw of resources) {
        const resource = raw as Record<string, unknown>;
        const resourceId = typeof resource['resourceId'] === 'string' ? resource['resourceId'] : null;
        const name = typeof resource['name'] === 'string' ? resource['name'] : null;
        if (!resourceId || !name) continue;
        const invocations = _ngcAttribute(resource, 'lastMonthApiInvocationCount') ?? _ngcAttribute(resource, 'last_month_api_invocation_count');
        endpoints.set(resourceId, {
          resourceId,
          name,
          displayName: typeof resource['displayName'] === 'string' ? resource['displayName'] : null,
          description: typeof resource['description'] === 'string' ? resource['description'] : null,
          deprecationDate: _ngcAttribute(resource, 'DEPRECATION'),
          lastMonthInvocations: invocations !== null ? (parseInt(invocations, 10) || 0) : null,
          dateCreated: typeof resource['dateCreated'] === 'string' ? resource['dateCreated'] : null,
        });
      }
    }
  }

  return { endpoints: [...endpoints.values()], notes };
}
