/// <reference types="node" />
// Run: `NODE_ENV=development npx tsx --test src/modules/aix/shared/aix.issues.test.ts`
// The record's edges: what enters a stored record, what a reader does with a record this build did not write, and the
// decisions that branch on facts. A code's label, sentence or advice is not pinned here: the table is its own statement.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aixIssue, aixIssueFails, aixIssueInMessageText, aixIssueIsWellFormed, aixIssuePlainText, DAixIssue } from './aix.issues';
import { aixIssuePolicy, aixIssuePresentation, aixIssueReplayText } from './aix.issues.policy';


// a record a newer build wrote: a code, an effect and a field this build does not know
const FUTURE_RECORD = { code: 'alx-loop-limit', effect: 'failed', text: 'The loop hit its limit.', loopTurns: 12 } as unknown as DAixIssue;


describe('a new record', () => {

  it('holds only the facts it was given, so it equals its own serialized copy', () => {
    const issue = aixIssue('dispatch-http', 'failed', { httpStatus: 429, causeCode: undefined, detail: '', retryAfterMs: 2500 });
    assert.deepEqual(issue, { code: 'dispatch-http', effect: 'failed', text: 'The service answered HTTP 429.', httpStatus: 429, retryAfterMs: 2500 });
    assert.deepEqual(JSON.parse(JSON.stringify(issue)), issue);
  });

  it('bounds the text and the detail, and scrubs credentials from both: they are stored forever and shown', () => {
    // a vendor's message is kept whole (#1105): the bound is for a runaway body
    const whole = aixIssue('service-error', 'failed', { text: 'y'.repeat(2000), detail: 'x'.repeat(2000) });
    assert.deepEqual([whole.text.length, whole.detail!.length], [2000, 2000]);
    const long = aixIssue('service-error', 'failed', { text: 'y'.repeat(5000), detail: 'x'.repeat(5000) });
    assert.deepEqual([long.text.length, long.detail!.length], [2003, 2003]);
    const issue = aixIssue('dispatch-connect', 'failed', {
      text: 'Incorrect API key provided: sk-proj-abcdefghijklmnop1234.',
      detail: 'GET https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyA1234567890abcdefghijklmn&alt=sse failed; Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345',
    });
    assert.equal(issue.text, 'Incorrect API key provided: sk-....');
    assert.ok(!issue.detail!.includes('AIzaSy') && !issue.detail!.includes('abcdefghijklmnopqrstuvwxyz'), issue.detail);
    assert.ok(issue.detail!.includes('key=...') && issue.detail!.includes('Bearer ...'), issue.detail);
  });

  it('keeps a cause code only when it is a code: prose is dropped, no key holds undefined', () => {
    assert.equal(aixIssue('service-error', 'failed', { causeCode: 'gemini.FINISH:RECITATION-2' }).causeCode, 'gemini.FINISH:RECITATION-2');
    assert.ok(!('causeCode' in aixIssue('service-error', 'failed', { causeCode: 'has spaces and prose' })));
    assert.ok(!('causeCode' in aixIssue('service-error', 'failed', { causeCode: 'x'.repeat(65) })));
  });

});


describe('the effect', () => {

  it('fails the generation only when failed; is in the message text when failed or lost', () => {
    const read = (effect: DAixIssue['effect']) => [aixIssueFails({ effect }), aixIssueInMessageText({ effect })];
    assert.deepEqual(read('failed'), [true, true]);
    assert.deepEqual(read('lost'), [false, true]);
    assert.deepEqual(read('notice'), [false, false]);
  });

  it('decides the form: a danger block or a card, a warning block, a chip. No advice or switch past a failure', () => {
    const shown = (issue: DAixIssue) => { const { tint, form, advice, directConnection } = aixIssuePresentation(issue); return { tint, form, advice, directConnection }; };
    assert.deepEqual(shown(aixIssue('relay-cutoff', 'failed')), { tint: 'danger', form: 'card-cutoff', advice: undefined, directConnection: 'turn-on' });
    assert.deepEqual(shown(aixIssue('relay-http', 'failed', { httpStatus: 413 })), { tint: 'danger', form: 'card-size', advice: undefined, directConnection: 'turn-on' });
    assert.deepEqual(shown(aixIssue('relay-http', 'failed', { httpStatus: 502 })), { tint: 'danger', form: 'block', advice: 'Try again in a moment.', directConnection: undefined });
    assert.deepEqual(shown(aixIssue('service-tool', 'lost')), { tint: 'warning', form: 'block', advice: undefined, directConnection: undefined });
    // the same cut, after the verdict: the answer stands
    assert.deepEqual(shown(aixIssue('relay-cutoff', 'notice')), { tint: 'warning', form: 'notice', advice: undefined, directConnection: undefined });
  });

  it('decides the replay to the model: the vendor words go along for service and model codes only', () => {
    assert.equal(aixIssueReplayText(aixIssue('dispatch-read', 'failed', { detail: 'terminated' })), '[ERROR] The server\'s connection to the service dropped mid-response.');
    assert.equal(aixIssueReplayText(aixIssue('service-tool', 'lost', { text: 'Image blocked by moderation.', detail: 'Your request was rejected by the safety system.' })), '[ERROR] Image blocked by moderation. (Your request was rejected by the safety system)');
    assert.equal(aixIssueReplayText(aixIssue('service-error', 'notice', { text: 'Rate limit reached.' })), null);
  });

});


describe('a record this build did not write', () => {

  it('of a newer build: the fallback row, a danger block when it failed, its own text', () => {
    assert.deepEqual(aixIssuePolicy(FUTURE_RECORD), { recovery: 'report', replay: 'text' });
    assert.deepEqual(aixIssuePresentation(FUTURE_RECORD), { label: 'Issue', byService: false, tint: 'danger', form: 'block' });
    assert.equal(aixIssuePlainText(FUTURE_RECORD), 'The loop hit its limit.');
    // a code that names a member of the object prototype inherits no row
    assert.equal(aixIssuePresentation({ ...FUTURE_RECORD, code: 'toString' } as unknown as DAixIssue).label, 'Issue');
  });

  it('of a newer build, with an effect this build does not know: shown, never a failure', () => {
    const odd = { ...FUTURE_RECORD, effect: 'paused' } as unknown as DAixIssue;
    assert.equal(aixIssueFails(odd), false);
    assert.deepEqual([aixIssuePresentation(odd).tint, aixIssuePresentation(odd).form], ['warning', 'block']);
    // and never put in the message text or replayed to a model as an error: this build cannot know what it means
    assert.deepEqual([aixIssueInMessageText(odd), aixIssueReplayText(odd)], [false, null]);
  });

  it('[Aix.Issue Malformed Guard] is well formed when the fields a reader dereferences are there', () => {
    assert.equal(aixIssueIsWellFormed(FUTURE_RECORD), true);
    const MALFORMED: unknown[] = [
      null, undefined, 'service-error',
      { code: 'service-error', effect: 'failed' },                                                        // no text
      { effect: 'failed', text: 'The service reported an error.' },                                       // no code
      { code: 'service-error', effect: 'failed', text: 'The service reported an error.', detail: { message: 'overloaded' } },
    ];
    for (const record of MALFORMED)
      assert.equal(aixIssueIsWellFormed(record), false, JSON.stringify(record));
  });

});


describe('the decisions that read facts', () => {

  it('advise the wait the service asked for: nothing under 2 seconds, then seconds, minutes, hours', () => {
    const LIMIT = 'A rate limit or a quota was reached: try again later, or check the plan of the account.';
    const advice = (retryAfterMs?: number) => aixIssuePresentation(aixIssue('dispatch-http', 'failed', { httpStatus: 429, retryAfterMs })).advice;
    assert.deepEqual([undefined, 20, 1999].map(advice), [LIMIT, LIMIT, LIMIT]);
    assert.deepEqual([2000, 89_000, 90_000, 300_000, 86_400_000].map(advice),
      ['Try again in 2 seconds.', 'Try again in 89 seconds.', 'Try again in 2 minutes.', 'Try again in 5 minutes.', 'Try again in 24 hours.']);
    // an in-band error has no status sentence to fall back to, and a wait makes it a backoff
    assert.equal(aixIssuePresentation(aixIssue('service-error', 'failed', { retryAfterMs: 500 })).advice, undefined);
    assert.deepEqual([aixIssuePolicy(aixIssue('service-error', 'failed')).recovery, aixIssuePolicy(aixIssue('service-error', 'failed', { retryAfterMs: 1000 })).recovery], ['retry', 'backoff']);
  });

  it('ask for a bug report only where a bug is likely: not for a front\'s status, a server condition, an abort nobody asked for', () => {
    const advice = (issue: DAixIssue) => aixIssuePresentation(issue).advice ?? '';
    const REPORT = /report it on GitHub/;
    // what sits in front of our server answered: a gateway error or a limit waits, a refusal reloads
    for (const httpStatus of [429, 500, 502, 503, 504])
      assert.deepEqual([advice(aixIssue('relay-http', 'failed', { httpStatus })), aixIssuePolicy(aixIssue('relay-http', 'failed', { httpStatus })).recovery], ['Try again in a moment.', 'backoff'], String(httpStatus));
    for (const httpStatus of [401, 403, 404])
      assert.deepEqual([advice(aixIssue('relay-http', 'failed', { httpStatus })), aixIssuePolicy(aixIssue('relay-http', 'failed', { httpStatus })).recovery], ['Reload the app, then try again.', 'user'], String(httpStatus));
    // our server's own tRPC codes: a condition is not a bug, a rejected input is
    for (const causeCode of ['TOO_MANY_REQUESTS', 'SERVICE_UNAVAILABLE', 'TIMEOUT', 'PAYLOAD_TOO_LARGE', 'NOT_FOUND'])
      assert.doesNotMatch(advice(aixIssue('relay-rejected', 'failed', { causeCode })), REPORT, causeCode);
    for (const causeCode of ['BAD_REQUEST', 'PARSE_ERROR', 'toString', undefined])
      assert.match(advice(aixIssue('relay-rejected', 'failed', { causeCode })), REPORT, String(causeCode));
    // a stored cause code is whatever was stored: one that cannot even be a key is no condition, and no throw
    assert.match(advice({ ...aixIssue('relay-rejected', 'failed'), causeCode: { toString: null } as unknown as string }), REPORT);
    // an abort-shaped throw with no Stop (an engine, a suspended tab): retry; any other unknown: report
    assert.deepEqual([advice(aixIssue('aix-unknown', 'failed', { causeCode: 'abort-unexpected' })), aixIssuePolicy(aixIssue('aix-unknown', 'failed', { causeCode: 'abort-unexpected' })).recovery], ['Try again.', 'retry']);
    assert.match(advice(aixIssue('aix-unknown', 'failed', { causeCode: 'no-end' })), REPORT);
  });

  it('offer Direct Connection on to bypass our server, off when the browser is what failed', () => {
    const dc = (issue: DAixIssue) => aixIssuePresentation(issue).directConnection;
    assert.equal(dc(aixIssue('relay-connect', 'failed')), 'turn-on');
    assert.equal(dc(aixIssue('relay-connect', 'failed', { offline: true })), undefined, 'offline: no path works');
    assert.equal(dc(aixIssue('dispatch-connect', 'failed', { runtime: 'relay' })), 'turn-on');
    assert.equal(dc(aixIssue('dispatch-connect', 'failed', { runtime: 'client' })), 'turn-off');
    assert.equal(dc(aixIssue('dispatch-connect', 'failed', { runtime: 'client', offline: true })), undefined);
    assert.equal(dc(aixIssue('aix-load', 'failed')), 'turn-off');
    assert.equal(dc(aixIssue('dispatch-read', 'failed', { runtime: 'client' })), undefined, 'a dropped read is transient');
    // the same connect failure reroutes from the client and retries from the relay
    assert.deepEqual(['client', 'relay'].map(runtime => aixIssuePolicy(aixIssue('dispatch-connect', 'failed', { runtime: runtime as DAixIssue['runtime'] })).recovery), ['reroute', 'retry']);
  });

});
