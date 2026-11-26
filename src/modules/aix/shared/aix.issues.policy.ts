import type { DAixIssue, DAixIssueCode } from './aix.issues';
import { aixIssueDetailAddingToText, aixIssueFails, aixIssueInMessageText, aixIssueLayer, aixIssuePlainText } from './aix.issues';


/**
 * What an issue means: derived from the record, never stored, so the rules can change without touching stored messages.
 * One table by code, refined by the status, the runtime and the cause code. Two readings:
 * - aixIssuePolicy: what the machinery does (retry, replay)
 * - aixIssuePresentation: what the user is shown (label, tint, form, advice, the Direct Connection row)
 * Both are total: a record of a code this build does not know (a newer build wrote it) gets the fallback row.
 * No decision here reads `text` or `detail`. Plan: kb/modules/aix/AIX-TODO-errors.md
 */
export type AixIssuePolicy = {
  /** the action a loop or the user takes; 'resume' means reattach when an upstream handle exists, else retry; 'reroute' means the other path (Direct Connection on or off), not a retry */
  recovery: 'retry' | 'resume' | 'backoff' | 'reroute' | 'user' | 'rephrase' | 'report' | 'none';
  /** whether the next call to a model sees the issue, as '[ERROR] ...' text in the assistant turn */
  replay: 'never' | 'text';

  // Not built: no reader yet. Each adds a column to the table below when a loop needs it.
  // /** what the issue does to the message outcome: aixIssueFails, with the filter class apart (it stores stop reason 'filter') */
  // fails: 'message' | 'filter' | 'none';
  // /** the largest unit that cannot proceed without a change: a retry can work (call), this service until fixed, everything until the user acts */
  // breaks: 'none' | 'call' | 'service' | 'session';
  // /** whose side the failure is on */
  // blame: 'network' | 'host' | 'service' | 'account' | 'content' | 'app';
};

export type AixIssuePresentation = {
  /** the noun before the sentence */
  label: string;
  /** the renderer shows the service's name in place of the label, when it knows it: every failure on the service's side of the executor names the service */
  byService: boolean;
  tint: 'danger' | 'warning';
  /** by effect. failed: a danger block, or one of the two cards that carry their own explanation; lost: a warning block; notice: a compact, dismissible chip */
  form: 'block' | 'notice' | 'card-cutoff' | 'card-size';
  /** one short sentence on what to do, when there is something to do */
  advice?: string;
  /** the advice asks for a bug report: Details opens by default, so a screenshot carries what the report needs */
  report?: true;
  /** where a detail that adds to the text goes: inline for words a user can act on (the service's own, a setup or request problem, a failed connect's address), behind Details for an engine or tRPC text. Absent when nothing adds */
  detail?: 'inline' | 'details';
  /** offer the Direct Connection switch: on to bypass our server, off to route through it */
  directConnection?: 'turn-on' | 'turn-off';
};


type _Row = Pick<AixIssuePolicy, 'recovery'> & Pick<AixIssuePresentation, 'label' | 'byService'>;

const _ROWS: Record<DAixIssueCode, _Row> = {
  'aix-prepare':        { label: 'Setup', byService: false, recovery: 'user' },
  'aix-load':           { label: 'App', byService: false, recovery: 'reroute' },
  'aix-media':          { label: 'Media', byService: false, recovery: 'retry' },
  'aix-unknown':        { label: 'App', byService: false, recovery: 'report' },
  'relay-connect':      { label: 'Connection', byService: false, recovery: 'retry' },
  'relay-http':         { label: 'Server', byService: false, recovery: 'backoff' },
  'relay-html':         { label: 'Connection', byService: false, recovery: 'user' },
  'relay-rejected':     { label: 'Request', byService: false, recovery: 'report' },
  'relay-read':         { label: 'Connection', byService: false, recovery: 'resume' },
  'relay-cutoff':       { label: 'Connection', byService: false, recovery: 'reroute' },
  'dispatch-prepare':   { label: 'Setup', byService: true, recovery: 'user' },
  'dispatch-connect':   { label: 'Connection', byService: true, recovery: 'retry' },
  'dispatch-http':      { label: 'Service', byService: true, recovery: 'report' },
  'dispatch-read':      { label: 'Connection', byService: true, recovery: 'resume' },
  'dispatch-cutoff':    { label: 'Response', byService: true, recovery: 'resume' },
  'dispatch-parse':     { label: 'App', byService: true, recovery: 'report' },
  'dispatch-aborted':   { label: 'Connection', byService: false, recovery: 'retry' },
  'dispatch-unknown':   { label: 'App', byService: false, recovery: 'report' },
  'service-error':      { label: 'Service', byService: true, recovery: 'retry' },
  'service-tool':       { label: 'Service', byService: true, recovery: 'none' },
  'model-filter':       { label: 'Response', byService: true, recovery: 'rephrase' },
  'model-unfinished':   { label: 'Response', byService: true, recovery: 'none' },
};

/** A code of a newer build: shown and reported, never guessed at */
const _UNKNOWN_ROW: _Row = { label: 'Issue', byService: false, recovery: 'report' };

/** The row of a code, with the refinements a record's facts decide. Own keys only: a stored code may be unknown to this build. */
function _row(issue: Pick<DAixIssue, 'code' | 'httpStatus' | 'causeCode' | 'runtime' | 'retryAfterMs'>): _Row {
  const row = { ...(Object.hasOwn(_ROWS, issue.code) ? _ROWS[issue.code] : _UNKNOWN_ROW) };
  const status = issue.httpStatus;

  if (issue.code === 'relay-http' && status === 413) {
    row.label = 'Request';
    row.recovery = 'user'; // a smaller request, or Direct Connection: it has no front in the way
  } else if (issue.code === 'relay-http' && _isFrontRefusal(status)) {
    row.recovery = 'user'; // the front refuses this client: a reload signs it in again, or updates it
  } else if (issue.code === 'relay-rejected' && _isAuthRejection(issue)) {
    row.recovery = 'user';
  } else if (issue.code === 'relay-rejected' && _rejectedCondition(issue)) {
    row.recovery = _rejectedCondition(issue)!.recovery;
  } else if (issue.code === 'aix-unknown' && issue.causeCode === _ABORT_UNEXPECTED) {
    row.recovery = 'retry';
  } else if (issue.code === 'dispatch-connect' && issue.runtime === 'client') {
    row.recovery = 'reroute'; // the service may refuse browsers: route through the server
  } else if (issue.code === 'dispatch-http' && status !== undefined) {
    if (status === 400 || status === 401 || status === 402 || status === 403 || status === 404 || status === 413 || status === 422)
      row.recovery = 'user'; // the account, the key or the request has to change
    else if (status === 429 || status >= 500)
      row.recovery = 'backoff';
  } else if (issue.code === 'service-error' && issue.retryAfterMs !== undefined) {
    row.recovery = 'backoff';
  }

  return row;
}

function _isAuthRejection(issue: Pick<DAixIssue, 'causeCode'>): boolean {
  return issue.causeCode === 'UNAUTHORIZED' || issue.causeCode === 'FORBIDDEN';
}

/** [relay-http] statuses with which a front (a deployment's protection, a firewall, a stale route) turns this client away: waiting does not help */
function _isFrontRefusal(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 404;
}

/** [relay-rejected] tRPC codes of our own server that are a condition, not a bug: what to do in place of a report */
const _REJECTED_NOT_A_BUG: Record<string, { recovery: AixIssuePolicy['recovery'], advice: string }> = {
  TOO_MANY_REQUESTS: { recovery: 'backoff', advice: 'Try again in a moment.' },
  SERVICE_UNAVAILABLE: { recovery: 'backoff', advice: 'Try again in a moment.' },
  TIMEOUT: { recovery: 'retry', advice: 'Try again.' },
  PAYLOAD_TOO_LARGE: { recovery: 'user', advice: 'Send a smaller request: fewer or smaller attachments, or a shorter chat.' },
  NOT_FOUND: { recovery: 'user', advice: 'Reload the app: it may be out of date.' },
};

/** Own keys of a string only: a stored cause code is whatever was stored, and a code may name a member of the object prototype */
function _rejectedCondition(issue: Pick<DAixIssue, 'causeCode'>): typeof _REJECTED_NOT_A_BUG[string] | undefined {
  return typeof issue.causeCode === 'string' && Object.hasOwn(_REJECTED_NOT_A_BUG, issue.causeCode) ? _REJECTED_NOT_A_BUG[issue.causeCode] : undefined;
}

/** [aix-unknown] an abort-shaped throw with no user Stop (aix.client.errors.ts): an engine or the network cut the request, which says nothing of a bug */
const _ABORT_UNEXPECTED = 'abort-unexpected';


/** The policy of a record. Pure: same record, same answer. */
export function aixIssuePolicy(issue: DAixIssue): AixIssuePolicy {
  return {
    recovery: _row(issue).recovery,
    // An issue that failed the generation is replayed: after real content it tells the model its reply was cut, and a turn
    // that holds nothing else is left out by the request builder. A lost output item (a failed image) is replayed too.
    // A notice is not: the response stood.
    replay: aixIssueInMessageText(issue) ? 'text' : 'never',
  };
}

/**
 * What the next model call sees for this record, or null when it is not replayed. The vendor's own words (the detail)
 * go along for the service and model codes only: an engine or relay text says nothing to a model.
 */
export function aixIssueReplayText(issue: DAixIssue): string | null {
  if (aixIssuePolicy(issue).replay !== 'text')
    return null;
  const layer = aixIssueLayer(issue.code);
  return `[ERROR] ${(layer === 'service' || layer === 'model') ? aixIssuePlainText(issue) : issue.text}`;
}


/** What the user is shown for a record. Pure, total, and no part of it comes from parsing text. */
export function aixIssuePresentation(issue: DAixIssue): AixIssuePresentation {
  const { label, byService } = _row(issue);
  const failed = aixIssueFails(issue);
  const advice = failed ? _advice(issue) : undefined;
  const directConnection = failed ? _directConnection(issue) : undefined;
  const form: AixIssuePresentation['form'] = issue.effect === 'notice' ? 'notice'
    : !failed ? 'block'
      : issue.code === 'relay-cutoff' ? 'card-cutoff'
        : (issue.code === 'relay-http' && issue.httpStatus === 413) ? 'card-size'
          : 'block';
  const detail = aixIssueDetailAddingToText(issue) === null ? undefined : _detailIsActionable(issue) ? 'inline' : 'details';
  const report = !!advice?.endsWith(_REPORT); // our own sentence, the one home of the report ask
  return {
    label,
    byService,
    tint: failed ? 'danger' : 'warning',
    form,
    ...(advice && { advice }),
    ...(report && { report: true }),
    ...(directConnection && { directConnection }),
    ...(detail && { detail }),
  };
}

/**
 * The detail shows inline when it is words a user can act on: the service's own (a 400's reason, a quota), a setup
 * problem, the address of a failed connect. Text for a bug report waits under Details: a bare engine or tRPC text
 * ('terminated', 'Failed to fetch'), a schema error, a rejected request's validation dump, a throw's message.
 */
function _detailIsActionable(issue: DAixIssue): boolean {
  const layer = aixIssueLayer(issue.code);
  return layer === 'service' || layer === 'model' || _DETAIL_ACTIONABLE_CODES.has(issue.code);
}

/** Codes outside the service and model layers whose detail shows inline. A commented code waits under Details, for the reason given. */
const _DETAIL_ACTIONABLE_CODES: ReadonlySet<string> = new Set<DAixIssueCode>([
  'dispatch-http',      // the service's own reason for the status: a 400's message, a quota
  'dispatch-connect',   // the address that could not be reached
  'aix-prepare',        // what in the request could not be prepared
  'dispatch-prepare',   // what in the service's setup is wrong
  'dispatch-unknown',   // the continuation limit and its count
  // 'dispatch-parse',  // a schema error: for a bug report, not for the user
  // 'relay-rejected',  // the server's validation dump, raw JSON: for a bug report
  // 'aix-unknown',     // a thrown error's message: for a bug report
  // the other relay-*, dispatch-read, aix-load: a bare engine or tRPC text ('terminated', 'Failed to fetch')
]);

function _directConnection(issue: DAixIssue): AixIssuePresentation['directConnection'] {
  // our server, or what sits in front of it, is in the way: the browser can call the service itself
  if (issue.code === 'relay-cutoff' || (issue.code === 'relay-http' && issue.httpStatus === 413))
    return 'turn-on';
  if (issue.code === 'relay-connect' && !issue.offline)
    return 'turn-on';
  // a service the server cannot reach (a local one, from a hosted server) may be reachable from the browser
  if (issue.code === 'dispatch-connect' && issue.runtime === 'relay')
    return 'turn-on';
  // the browser is the one that failed: the server can call the service
  // a dropped read is transient: no switch for it
  if (issue.code === 'aix-load' || (issue.code === 'dispatch-connect' && issue.runtime === 'client' && !issue.offline))
    return 'turn-off';
  return undefined;
}

const _OFFLINE = 'You appear to be offline.';
const _REPORT = 'If it keeps happening, report it on GitHub with the details below.';

function _advice(issue: DAixIssue): string | undefined {
  const { code, httpStatus: status } = issue;

  if (code === 'aix-prepare' || code === 'dispatch-prepare')
    return 'Check the model and the setup of its service.';
  if (code === 'aix-load')
    return 'Reload the app.'; // the Direct Connection row under it offers the other path
  if (code === 'aix-unknown' || code === 'dispatch-unknown')
    return code === 'aix-unknown' && issue.causeCode === _ABORT_UNEXPECTED ? 'Try again.' : _REPORT;

  if (code === 'relay-connect' || code === 'relay-read')
    return issue.offline ? _OFFLINE : 'Check your connection and try again.';
  if (code === 'relay-html')
    return 'A Wi-Fi sign-in page, a proxy, an extension or a temporary gateway error answered in its place: reload and try again.';
  if (code === 'relay-http')
    return status === 413 ? undefined // the size card says what to do
      : _isFrontRefusal(status) ? 'Reload the app, then try again.'
        : 'Try again in a moment.';
  if (code === 'relay-rejected')
    return _isAuthRejection(issue) ? 'Sign in again, then retry.' : (_rejectedCondition(issue)?.advice ?? _REPORT);

  if (code === 'dispatch-connect') {
    if (issue.offline) return _OFFLINE;
    return issue.runtime === 'client' ? 'The service may refuse requests from browsers (some do for an invalid API key), or an extension may block them.'
      : 'Check the service address, and that the server can reach it.';
  }
  if (code === 'dispatch-read')
    return issue.offline ? _OFFLINE : issue.runtime === 'client' ? 'Check your connection and try again.' : 'Try again.';
  if (code === 'dispatch-cutoff' || code === 'dispatch-aborted')
    return 'Try again.';
  if (code === 'dispatch-parse')
    return 'Update or reload the app. ' + _REPORT;

  if (code === 'dispatch-http' && status !== undefined) {
    if (status === 401) return 'Check the API key of this service.';
    if (status === 402) return 'Check the balance or the plan of the account.';
    if (status === 403) return 'Check what the key is allowed to do, and from which region.';
    if (status === 404) return 'Not found at the service: check the model and the service address.';
    if (status === 429) return _retryIn(issue.retryAfterMs) ?? 'A rate limit or a quota was reached: try again later, or check the plan of the account.';
    if (status >= 500) return _retryIn(issue.retryAfterMs) ?? 'The service is having problems: try again in a moment.';
    return undefined; // 400, 413, 422 and the rest: the service's own words say what to change
  }
  if (code === 'service-error')
    return _retryIn(issue.retryAfterMs);
  if (code === 'model-filter')
    return 'Rephrase the request, or try another model.';

  return undefined;
}

/** The wait the service asked for; under 2 seconds it adds nothing, and the status sentence stays */
function _retryIn(retryAfterMs: number | undefined): string | undefined {
  if (retryAfterMs === undefined || retryAfterMs < 2000) return undefined;
  const seconds = Math.ceil(retryAfterMs / 1000);
  if (seconds < 90) return `Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 90 ? `Try again in ${minutes} minutes.` : `Try again in ${Math.ceil(minutes / 60)} hours.`;
}
