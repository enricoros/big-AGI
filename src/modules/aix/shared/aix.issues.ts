/**
 * AIX issues: one record for every failure of a chat generation.
 *
 * Built once, by the layer that sees the failure: a parser, the executor or a wrapper (sent live in an `aix-issue`
 * particle), the client for what throws across the relay, the reassembler for its own work. Stored as a
 * `DMessageAixIssuePart` (`pt: 'aix.issue'`), read by every decision: outcome, presentation, retry, replay.
 * `effect` is the one decision stored, a snapshot of what the issue did to its generation. The others are derived,
 * never stored: aix.issues.policy.ts, which holds their table. As built: kb/modules/aix/AIX-TODO-errors.md
 *
 * Facts only. No markup in `text`, no advice, no `cause` chain: what a wrapped error carried goes into `detail`,
 * `causeCode` or `httpStatus`.
 *
 * STABLE: persisted on every user's disk. Fields and codes are added, never reinterpreted. A build reads records written
 * by a newer one: every reader here is total over codes and effects it does not know, and a stored record is cloned
 * verbatim, never rebuilt (a rebuild would drop what a newer build added).
 * For good: `code` and `text` are required strings, `detail` is a string when present. A build deletes, on load, a record
 * that breaks this (aixIssueIsWellFormed): a newer build that changed them would lose its records on every older one.
 *
 * In `shared/`: read by the server, the browser (Direct Connection) and the chat store. Import-free.
 */


/**
 * `<layer>-<what>`, outer to inner. Mode words mean the same on every hop: `connect` never connected, `read` the read threw,
 * `cutoff` ended cleanly where more was due, `http` answered with a status.
 */
export type DAixIssueCode =
  // aix: the AIX client library around the loop
  | 'aix-prepare'           // the request could not be assembled (LLM not found, content assembly)
  | 'aix-load'              // the Direct Connection bundle did not load
  | 'aix-media'             // a generated image/audio/video could not be processed; the rest stands
  | 'aix-unknown'           // unclassified: a bug, a missing end particle, our server's procedure threw
  // relay: the tRPC pipe between the library and the executor on our server (Direct Connection has none)
  | 'relay-connect'         // the browser could not reach our server
  | 'relay-http'            // what sits in front of our server answered with an error status: a 413 from the edge network, a 502 or 429 from a gateway
  | 'relay-html'            // an HTML page instead of the response: a Wi-Fi sign-in page, a proxy, an extension
  | 'relay-rejected'        // our server refused the request: input validation, auth
  | 'relay-read'            // the body read threw: the connection dropped mid-response
  | 'relay-cutoff'          // the body ended cleanly before tRPC's closing chunk: the function was killed (Vercel's limit) or exited
  // dispatch: the executor, in the client (Direct Connection) or on the relay
  | 'dispatch-prepare'      // the dispatch could not be created (missing key, unsupported parameter)
  | 'dispatch-connect'      // the executor could not reach the service
  | 'dispatch-http'         // the service answered with an error status
  | 'dispatch-read'         // the body read threw: the connection to the service dropped
  | 'dispatch-cutoff'       // the body ended with no end from the dialect and no stop reason
  | 'dispatch-parse'        // the service's data could not be processed: a changed API, or our bug
  | 'dispatch-aborted'      // the executor's abort signal fired without a user Stop
  | 'dispatch-unknown'      // the executor threw where it classifies nothing, or a wrapper gave up (causeCode 'continuation-limit')
  // service: what the API answered; model: what the generation did
  | 'service-error'         // an error the service sent in band: an error event, a failed response, an error finish
  | 'service-tool'          // a hosted tool or operation failed while the generation goes on (a failed image generation)
  | 'model-filter'          // the generation was blocked or refused: a filter stop reason
  | 'model-unfinished';     // the service ended without a stop reason: the response may be incomplete


/**
 * What the issue did to its generation. Stated by the producer, settled where the record enters the stream and the
 * message: there an issue after the verdict (a clean stop reason, an earlier failure) becomes a notice.
 * A snapshot: true when stored, not rewritten when the rules change.
 */
export type DAixIssueEffect =
  | 'failed'    // the generation failed at this issue; at most one per message. The producer may still read what the service sends after it (usage)
  | 'lost'      // an output item was lost, the generation went on (a failed hosted tool, a media item)
  | 'notice';   // nothing of the response changed: after the verdict, an uncertain end, a second failure


export type DAixIssue = {
  code: DAixIssueCode;
  effect: DAixIssueEffect;
  text: string;                     // one plain sentence, no markup, no label, no service name. Ours, or the vendor's message for the service codes
  detail?: string;                  // the failing side's own words, bounded: the vendor's message, an engine text, a tRPC text. Never our framing or advice
  causeCode?: string;               // the failing side's own machine code, kept only when code-shaped: a vendor error code or type, a finish reason, a system error name, a tRPC code. Read only together with `code`: each layer has its own vocabulary, ours included ('no-end', 'continuation-limit')
  httpStatus?: number;              // an HTTP status that was on the wire (dispatch-http, relay-http). Never a vendor's in-band code, never one we mapped for retries
  retryAfterMs?: number;            // from the service, when given
  // attempts?: number;             // not built: retries of this same failure that ran out; a retry chip would show the count
  offline?: true;                   // the browser reported no network when the record was built
  runtime?: 'client' | 'relay';     // dispatch-connect, dispatch-read: where the executor ran, in the client (Direct Connection) or on the relay
  atMs?: number;                    // elapsed since the call started, stamped by the reassembler
};

/** What a producer states beyond the code and the effect */
export type AixIssueFacts = Partial<Omit<DAixIssue, 'code' | 'effect'>>;


// Builder

const AIX_ISSUE_TEXT_MAX = 2000; // text and detail each: a vendor's message is kept whole (#1105), the bound only stops a runaway body from being stored, synced and replayed

// Credentials that a vendor message or a URL can echo: the record is stored and shown, so they never enter it
const _SECRETS: [RegExp, string][] = [
  [/AIza[0-9A-Za-z_-]{20,}/g, 'AIza...'],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, 'sk-...'],
  [/\b(key|api_key|apikey|api-key|access_token|token)=[^&\s"')]+/gi, '$1=...'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/g, 'Bearer ...'],
];

function _stored(text: string | undefined): string | undefined {
  let out = text?.trim();
  if (!out) return undefined;
  for (const [pattern, replacement] of _SECRETS)
    out = out.replace(pattern, replacement);
  return out.length > AIX_ISSUE_TEXT_MAX ? out.slice(0, AIX_ISSUE_TEXT_MAX) + '...' : out;
}

/** The value when it is a code, not prose: `causeCode` is shown in a facts row and may leave the server (analytics) */
export function aixIssueCodeShaped(value: unknown): string | undefined {
  const text = typeof value === 'number' ? String(value) : value;
  return typeof text === 'string' && /^[\w.:-]{1,64}$/.test(text) ? text : undefined;
}

/**
 * Build a record: `text` falls back to the code's sentence, `causeCode` is kept only when code-shaped, `text` and `detail`
 * are bounded and scrubbed of credentials, undefined facts are left out.
 * For new records only: a stored record is never passed through here again.
 */
export function aixIssue(code: DAixIssueCode, effect: DAixIssueEffect, facts?: AixIssueFacts): DAixIssue {
  const { httpStatus, retryAfterMs, offline, runtime, atMs } = facts ?? {};
  const causeCode = aixIssueCodeShaped(facts?.causeCode);
  const detail = _stored(facts?.detail);
  return {
    code,
    effect,
    text: _stored(facts?.text) || _defaultText(code, httpStatus, runtime),
    ...(detail && { detail }),
    ...(causeCode && { causeCode }),
    ...(httpStatus !== undefined && { httpStatus }),
    ...(retryAfterMs !== undefined && { retryAfterMs }),
    ...(offline && { offline: true as const }),
    ...(runtime && { runtime }),
    ...(atMs !== undefined && { atMs }),
  };
}


// Reading

/** Whether this issue failed its generation: the one rule for the message outcome, the policy and the analytics */
export function aixIssueFails(issue: Pick<DAixIssue, 'effect'>): boolean {
  return issue.effect === 'failed';
}

/**
 * Whether the issue is part of what the message says: it failed the generation, or it stands for a lost output item.
 * One rule for the replay to the model, the token estimate, copy, export and search; a notice is in none of them.
 * An allow-list: an effect a newer build adds is out of the text here, never replayed to a model as an error by guess.
 */
export function aixIssueInMessageText(issue: Pick<DAixIssue, 'effect'>): boolean {
  return issue.effect === 'failed' || issue.effect === 'lost';
}

/**
 * [Aix.Issue Malformed Guard] The fields a reader dereferences. Checked at the two doors a record enters by: the wire
 * (ContentReassembler, `aix-issue`) and the load repair of stored data (chats.converters.ts); readers trust the type.
 * A newer build's codes, effects and extra fields pass.
 */
export function aixIssueIsWellFormed(issue: unknown): issue is DAixIssue {
  if (!issue || typeof issue !== 'object') return false;
  const { code, text, detail } = issue as Partial<Record<keyof DAixIssue, unknown>>;
  return typeof code === 'string' && typeof text === 'string' && (detail === undefined || typeof detail === 'string');
}

/** The layer a code belongs to: its first segment. Total: a code of a newer build still has one */
export function aixIssueLayer(code: string): string {
  const dash = code.indexOf('-');
  return dash > 0 ? code.slice(0, dash) : code;
}

/**
 * The record as one plain string: the sentence, then the detail in parentheses. For what has no renderer: copy, exports,
 * search, thrown messages, the replay to the model. The facts shown elsewhere (offline, status) are not repeated.
 */
export function aixIssuePlainText(issue: Pick<DAixIssue, 'text' | 'detail'>): string {
  const detail = aixIssueDetailAddingToText(issue)?.replace(/\s+/g, ' ');
  if (!detail)
    return issue.text;
  return `${issue.text} (${detail.replace(/\.$/, '')})`;
}

/** The detail, trimmed, when it says more than the sentence (it is not already in it, whitespace aside); else null */
export function aixIssueDetailAddingToText(issue: Pick<DAixIssue, 'text' | 'detail'>): string | null {
  const detail = issue.detail?.trim();
  if (!detail || issue.text.includes(detail.replace(/\s+/g, ' ')))
    return null;
  return detail;
}


// Texts: the one home of each code's sentence. Plain, no markup, no service name, no blame beyond what the code states.

const _DEFAULT_TEXTS: Record<Exclude<DAixIssueCode, 'relay-http' | 'dispatch-connect' | 'dispatch-http' | 'dispatch-read'>, string> = {
  'aix-prepare': 'The request could not be prepared.',
  'aix-load': 'Direct Connection could not start.',
  'aix-media': 'A generated media item could not be processed.',
  'aix-unknown': 'An unexpected error occurred.',
  'relay-connect': 'Could not reach the server.',
  'relay-html': 'The network returned a web page instead of the response.',
  'relay-rejected': 'The server did not accept the request.',
  'relay-read': 'The connection to the server dropped mid-response.',
  'relay-cutoff': 'The server closed the response early.',
  'dispatch-prepare': 'The request to the service could not be prepared.',
  'dispatch-cutoff': 'The service closed the response before its final status.',
  'dispatch-parse': 'The service sent data this version of the app cannot read.',
  'dispatch-aborted': 'The request was cancelled before it completed.',
  'dispatch-unknown': 'The request failed unexpectedly.',
  'service-error': 'The service reported an error.',
  'service-tool': 'A hosted tool did not complete.',
  'model-filter': 'Response blocked by the provider\'s content filter.',
  'model-unfinished': 'The response may be incomplete: the service gave no finish reason.',
};

function _defaultText(code: DAixIssueCode, httpStatus: number | undefined, runtime: DAixIssue['runtime']): string {
  switch (code) {
    case 'relay-http':
      return httpStatus === 413 ? 'The request is too large for the server.' : `The server answered HTTP ${httpStatus ?? 'error'}.`;
    case 'dispatch-connect':
      return runtime === 'client' ? 'This browser could not reach the service.' : 'The server could not reach the service.';
    case 'dispatch-http':
      return `The service answered HTTP ${httpStatus ?? 'error'}.`;
    case 'dispatch-read':
      return runtime === 'client' ? 'The connection to the service dropped mid-response.' : 'The server\'s connection to the service dropped mid-response.';
    default:
      return _DEFAULT_TEXTS[code];
  }
}
