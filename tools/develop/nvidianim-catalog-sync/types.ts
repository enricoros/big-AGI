/**
 * NVIDIA Catalog Harvest - shared shapes.
 *
 * One HarvestedModel per id returned by the hosted /v1/models endpoint, merging the 4 sources
 * (live ids, build.nvidia.com catalog, NGC endpoint search, authenticated live probes).
 */


/** Liveness classification, from the authenticated chat/completions probe. */
export type AliveClass =
  | 'alive'              // 200 on a minimal completion
  | 'dead-entitlement'   // 404 'Not found for account' - function removed from the account
  | 'no-chat-route'      // plain-text '404 page not found' - embedding/rerank/other non-chat class
  | 'retired'            // 410 Gone
  | 'throttled'          // 429/503 - inconclusive, NOT a death signal
  | 'slow-or-dead'       // timed out on both attempts
  | 'probe-error'        // any other 4xx/5xx, or a transport failure
  | 'unprobed';          // --skip-probes, or no API key

/** Context-window probe outcome, when it is not a plain number. */
export type CtxProbeNote = 'silent-truncation-or-large' | 'timeout' | 'no-match' | 'error' | 'estimated';

export interface HarvestedCapabilities {
  tools: boolean | null;
  structuredOutput: boolean | null;
  reasoning: boolean | null;
}

export interface HarvestedModel {
  id: string;
  alive: AliveClass;
  label: string | null;
  description: string | null;
  publisher: string | null;
  ctxMeasured: number | null;
  ctxAdvertised: number | null;
  capabilities: HarvestedCapabilities;
  modalitiesIn: string[] | null;
  modalitiesOut: string[] | null;
  pubDate: string | null;          // 'YYYYMMDD', from the build.nvidia.com createdDate
  catalogUpdated: string | null;   // ISO, from the .md frontmatter 'updated'
  deprecationDate: string | null;  // 'MM/DD/YYYY', from the NGC DEPRECATION attribute
  lastMonthInvocations: number | null;
  notes: string[];
}

export interface HarvestFile {
  harvestedAt: string;
  counts: Record<string, number>;
  models: HarvestedModel[];
}


// --- source records ---

export interface LiveModelId {
  id: string;
  ownedBy: string | null;
}

/** One line of the build.nvidia.com markdown index. */
export interface CatalogIndexEntry {
  label: string;
  slug: string;
  mdPath: string;   // e.g. '/qc69jvmznzxy/glm-5.2.md'
  description: string;
}

/** One parsed build.nvidia.com model card (.md page). */
export interface CatalogCard {
  sourceUrl: string;
  title: string | null;
  publisher: string | null;
  type: string | null;
  updated: string | null;
  description: string | null;
  canonical: string | null;
  ctxAdvertised: number | null;
  parameters: number | null;
  modalitiesIn: string[] | null;
  modalitiesOut: string[] | null;
  capabilities: HarvestedCapabilities;
}

/** One NGC ENDPOINT search result, reduced to what we join on. */
export interface NgcEndpoint {
  resourceId: string;
  name: string;
  displayName: string | null;
  description: string | null;
  deprecationDate: string | null;
  lastMonthInvocations: number | null;
  dateCreated: string | null;
}
