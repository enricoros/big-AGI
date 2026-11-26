/// <reference types="node" />
// Run: `NODE_ENV=development npx tsx --test src/common/stores/chat/chat.issues.readers.test.ts`
// The readers of a stored `aix.issue` part in the chat store: copies, the message text, the token estimate, the outcome,
// and the load repair pass (stored data, as read back from disk).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// relative imports: the root tsconfig excludes tests, so the IDE's inferred project has no '~' paths (tsx and tools/tsconfig do)
import type { DLLM } from '../llms/llms.types';
import { aixIssue, aixIssuePlainText, DAixIssue } from '../../../modules/aix/shared/aix.issues';
import { aixIssueReplayText } from '../../../modules/aix/shared/aix.issues.policy';

import { createAixIssueContentFragment, createErrorContentFragment, createPlaceholderVoidFragment, createTextContentFragment, DMessageFragment, duplicateDMessageFragments, messageFailureText } from './chat.fragments';
import type { DConversation } from './chat.conversation';
import { DMessage, DMessageGenerator, messageFragmentsReduceText } from './chat.message';
import { estimateTextTokens, estimateTokensForFragments } from './chat.tokens';
import { messageTerminalOutcome } from './chat.message.outcome';
import { V4ToHeadConverters } from './chats.converters';


const LLM = { id: 'mock', vId: 'openai', label: 'mock', contextTokens: 128000, maxOutputTokens: 4096 } as unknown as DLLM;

// a record a newer build wrote: a code and a field this build does not know
const FUTURE_RECORD = { code: 'agent-budget', effect: 'failed', text: 'The agent ran out of budget.', budget: { spent: 12, unit: 'usd' }, causeCode: 'limit' } as unknown as DAixIssue;

const text = (value = 'x') => createTextContentFragment(value);
const issue = (record: DAixIssue) => createAixIssueContentFragment(record);
const placeholder = () => createPlaceholderVoidFragment('Generating...');

const FAILED = aixIssue('service-error', 'failed', { text: 'Overloaded.' });
const LOST = aixIssue('service-tool', 'lost', { text: 'Image blocked by moderation.' });
const NOTICE = aixIssue('dispatch-read', 'notice', { detail: 'terminated' });


describe('a copy of the part', () => {

  it('is verbatim, through duplication and a JSON round trip, with a field and a code this build does not know', () => {
    const fragment = issue(FUTURE_RECORD);
    const [copy] = duplicateDMessageFragments([fragment], false);
    if (copy.ft !== 'content' || copy.part.pt !== 'aix.issue') assert.fail('an aix.issue content fragment');
    assert.deepEqual(copy.part, { pt: 'aix.issue', issue: FUTURE_RECORD });
    assert.notEqual(copy.part.issue, FUTURE_RECORD, 'a copy, not the same object');
    assert.notEqual(copy.fId, fragment.fId);
    assert.deepEqual(JSON.parse(JSON.stringify(fragment)), fragment);
  });

  it('is left out when the copy is made to send again, as void fragments are', () => {
    assert.deepEqual(duplicateDMessageFragments([text('the answer'), issue(LOST), issue(FAILED)], true).map(f => f.ft === 'content' ? f.part.pt : f.ft), ['text']);
  });

});


describe('what the message says', () => {

  it('the text holds a failure and a lost output item, never a notice', () => {
    assert.equal(messageFragmentsReduceText([text('partial'), issue(LOST), issue(FAILED), issue(NOTICE)]), 'partial\n\nImage blocked by moderation.\n\nOverloaded.');
  });

  it('the failure text is the issue that failed, before any error part; a message of notices has none', () => {
    assert.equal(messageFailureText([createErrorContentFragment('legacy'), issue(LOST), issue(FAILED)]), 'Overloaded.');
    assert.equal(messageFailureText([text(), createErrorContentFragment('legacy'), issue(NOTICE)]), 'legacy');
    assert.equal(messageFailureText([text(), issue(LOST), issue(NOTICE)]), null);
  });

  it('the token estimate counts what the model is sent: the replay, without an engine detail, and nothing for a notice', () => {
    // a connect failure: the detail is engine text and the host, which the replay leaves out
    const record = aixIssue('dispatch-connect', 'failed', { runtime: 'client', causeCode: 'ECONNREFUSED', detail: 'fetch failed - '.repeat(30) + 'host: api.example.com' });
    const tokens = estimateTokensForFragments(LLM, 'assistant', [issue(record)], false, 'test');
    assert.equal(tokens, estimateTextTokens(aixIssueReplayText(record)!, LLM, 'test'));
    assert.ok(tokens < estimateTextTokens('[ERROR] ' + aixIssuePlainText(record), LLM, 'test'), 'the detail is not counted');
    assert.equal(estimateTokensForFragments(LLM, 'assistant', [issue(NOTICE)], false, 'test'), 0);
  });

});


describe('the outcome of a message', () => {

  const outcome = (fragments: DMessageFragment[], tokenStopReason?: DMessageGenerator['tokenStopReason']) =>
    messageTerminalOutcome({ generator: { mgt: 'named', name: 'm', ...(tokenStopReason && { tokenStopReason }) }, fragments });

  it('without a known stop reason: failed on a trailing issue that failed, of a code this build knows or not', () => {
    assert.equal(outcome([text(), issue(FAILED)]), 'failed');
    assert.equal(outcome([issue(aixIssue('dispatch-connect', 'failed'))]), 'failed');
    assert.equal(outcome([text(), issue(FUTURE_RECORD)]), 'failed');
  });

  it('without a known stop reason: completed past a lost item or a notice, and when content follows a failure (a message joined from several generations)', () => {
    assert.equal(outcome([text(), issue(LOST)]), 'completed');
    assert.equal(outcome([text(), issue(NOTICE)]), 'completed');
    assert.equal(outcome([text(), issue(FAILED), text()]), 'completed');
  });

  it('keeps the rule for error parts: the last content fragment decides, issues that did not fail skipped', () => {
    assert.equal(outcome([text(), createErrorContentFragment('e')]), 'failed');
    assert.equal(outcome([createErrorContentFragment('e'), text()]), 'completed');
    assert.equal(outcome([text(), createErrorContentFragment('e'), issue(NOTICE)]), 'failed');
    assert.equal(outcome([text(), createPlaceholderVoidFragment('n', 'notice')]), 'completed');
  });

  it('the stored stop reason decides first; one this build does not know falls back to the fragments', () => {
    assert.equal(outcome([text(), issue(FAILED)], 'out-of-tokens'), 'truncated');
    assert.equal(outcome([text()], 'issue'), 'failed');
    assert.equal(outcome([text()], 'client-abort'), 'aborted');
    const futureReason = JSON.parse('"a-future-reason"'); // as read from storage, written by a newer build
    assert.equal(outcome([text(), issue(FAILED)], futureReason), 'failed');
    assert.equal(outcome([text(), issue(LOST)], futureReason), 'completed');
  });

});


/** The real load pass over a conversation of one message: the message as it is after the pass, undefined when the pass dropped it */
function loaded(fragments: DMessageFragment[]): DMessage | undefined {
  const message = { id: 'm', role: 'assistant', fragments, created: 0, updated: null } as unknown as DMessage;
  const conversation = { id: 'c', messages: [message] } as unknown as DConversation;
  V4ToHeadConverters.inMemHeadCleanDConversations([conversation]);
  return conversation.messages[0];
}

const repaired = (fragments: DMessageFragment[]) =>
  loaded(fragments)?.fragments.map(f => f.ft === 'content' ? f.part.pt : f.ft === 'void' ? `void:${f.part.pt}` : f.ft);


describe('the load repair', () => {

  // what a stored part can hold after an import, a hand edit or a bug: not what the type says
  const stored = (record: unknown) => ({ ft: 'content', fId: 'f-issue', part: { pt: 'aix.issue', issue: record } }) as unknown as DMessageFragment;
  const MALFORMED: [string, unknown][] = [
    ['null record', null],
    ['missing record', undefined],
    ['record without text', { code: 'service-error', effect: 'failed' }],
    ['record with a non-string detail', { code: 'service-error', effect: 'failed', text: 'The service reported an error.', detail: { message: 'overloaded' } }],
    ['record without a code', { effect: 'failed', text: 'The service reported an error.' }],
  ];

  it('turns a placeholder left by a cut into an error when only issues that did not fail follow it', () => {
    assert.deepEqual(repaired([text(), placeholder()]), ['text', 'error']);
    assert.deepEqual(repaired([placeholder(), issue(LOST), issue(NOTICE)]), ['error', 'aix.issue', 'aix.issue']);
    // real content or a failure after it: the generation went on, the placeholder is not what was cut
    assert.deepEqual(repaired([placeholder(), text()]), ['void:ph', 'text']);
    assert.deepEqual(repaired([placeholder(), issue(FAILED)]), ['void:ph', 'aix.issue']);
    // a message that holds its failure is settled: a placeholder a parser still sent after it stays as it was shown
    assert.deepEqual(repaired([text(), issue(FAILED), placeholder()]), ['text', 'aix.issue', 'void:ph']);
    assert.deepEqual(repaired([issue(FAILED), placeholder(), issue(NOTICE)]), ['aix.issue', 'void:ph', 'aix.issue']);
  });

  it('[Aix.Issue Malformed Guard] removes a damaged issue part and keeps the message with its other fragments', () => {
    for (const [label, record] of MALFORMED) {
      assert.deepEqual(repaired([text('partial'), stored(record), text('more')]), ['text', 'text'], label);
      // a placeholder followed only by the damaged part is the last fragment: repaired, not kept spinning
      assert.deepEqual(repaired([placeholder(), stored(record)]), ['error'], label);
    }
  });

  it('keeps a readable record of a newer build verbatim', () => {
    const kept = loaded([text('partial'), stored(structuredClone(FUTURE_RECORD))])?.fragments[1];
    assert.deepEqual(kept, stored(FUTURE_RECORD));
  });

});
