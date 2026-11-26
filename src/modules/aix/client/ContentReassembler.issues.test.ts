/// <reference types="node" />
// Run: `NODE_ENV=development npx tsx --test src/modules/aix/client/ContentReassembler.issues.test.ts`
// The real reassembler driven with wire particles: how each issue door lands in the stored message, its stop reason and
// outcome. The executor's side of the same failures is the chain gate, aix.issues.chain.test.ts.
import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';

import { TRPCClientError } from '@trpc/client';

// relative imports: the root tsconfig excludes tests, so the IDE's inferred project has no '~' paths (tsx and tools/tsconfig do)
import type { DMessageGenerator } from '../../../common/stores/chat/chat.message';
import { createAixIssueContentFragment, createTextContentFragment, DMessageContentFragment } from '../../../common/stores/chat/chat.fragments';
import { TRPCClientFetchError } from '../../../common/util/fetchFailures';

import type { AixWire_Particles } from '../server/api/aix.wiretypes';
import { aixIssue, type DAixIssue } from '../shared/aix.issues';

import { ContentReassembler } from './ContentReassembler';
import { _llToL2Simple } from './aix.client';
import { aixClassifyStreamingError } from './aix.client.errors';


type Op = AixWire_Particles.ChatGenerateOp;

const GENERATOR: DMessageGenerator = { mgt: 'aix', name: 'mock', aix: { vId: 'openai', mId: 'mock' } };

function reassembler(abortSignal?: AbortSignal): ContentReassembler {
  return new ContentReassembler(GENERATOR, undefined, undefined, [], true, undefined, undefined, abortSignal);
}

async function drive(particles: Op[], r = reassembler()): Promise<ContentReassembler> {
  for (const op of particles)
    r.enqueueWireParticle(op);
  await r.waitForWireComplete();
  return r;
}

function result(r: ContentReassembler) {
  const { fragments, generator, outcome } = r.finalizeReassembly();
  return {
    shape: fragments.map(f => f.ft === 'content' ? (f.part.pt === 'aix.issue' ? `${f.part.issue.code}:${f.part.issue.effect}` : f.part.pt) : f.part.pt === 'ph' ? `notice:${f.part.pText}` : f.part.pt),
    issues: fragments.flatMap(f => f.ft === 'content' && f.part.pt === 'aix.issue' ? [f.part.issue] : []),
    tsr: generator.tokenStopReason,
    outcome,
  };
}

const text = (t: string): Op => ({ t });
const issue = (record: DAixIssue): Op => ({ cg: 'aix-issue', issue: record });
const end = (terminationReason: AixWire_Particles.CGEndReason, tokenStopReason?: AixWire_Particles.GCTokenStopReason): Op =>
  ({ cg: 'end', terminationReason, ...(tokenStopReason && { tokenStopReason }) });
const THROWS_IN_PROCESSING = { p: 'svs', vendor: 'anthropic', state: null } as unknown as Op;

const OVERLOADED = aixIssue('service-error', 'failed', { text: 'Overloaded.' });
const RELAY_DROP = aixIssue('relay-read', 'failed', { detail: 'network error' });

before(() => {
  mock.method(console, 'log', () => undefined);
  mock.method(console, 'warn', () => undefined);
  mock.method(console, 'error', () => undefined);
});
after(() => mock.restoreAll());


describe('issues from the wire', () => {

  it('a failed issue then the end: one record, stored as sent at its place, stamped with its time', async () => {
    const r = result(await drive([
      text('Partial'),
      issue(aixIssue('dispatch-read', 'failed', { runtime: 'relay', detail: 'terminated' })),
      end('issue-dispatch-rpc', 'cg-issue'),
    ]));
    assert.deepEqual(r.shape, ['text', 'dispatch-read:failed']);
    assert.deepEqual([r.tsr, r.outcome], ['issue', 'failed']);
    assert.equal(typeof r.issues[0].atMs, 'number');
    assert.deepEqual([r.issues[0].runtime, r.issues[0].detail], ['relay', 'terminated']);
  });

  it('a lost item then a clean end: completed, the record between the texts it interrupted', async () => {
    const r = result(await drive([
      text('Here is the image:'),
      issue(aixIssue('service-tool', 'lost', { text: 'Image blocked by moderation.' })),
      text('I could not draw it.'),
      end('done-dialect', 'ok'),
    ]));
    assert.deepEqual(r.shape, ['text', 'service-tool:lost', 'text']);
    assert.deepEqual([r.tsr, r.outcome], [undefined, 'completed']);
  });

  it('a failed issue followed by a clean stop reason is still stored failed', async () => {
    const r = result(await drive([text('Partial'), issue(OVERLOADED), end('done-dialect', 'ok')]));
    assert.deepEqual([r.tsr, r.outcome], ['issue', 'failed']);
  });

});


describe('records the client builds', () => {

  it('no end particle: a missing-end record, stored failed', async () => {
    const r = result(await drive([text('Partial')]));
    assert.deepEqual(r.shape, ['text', 'aix-unknown:failed']);
    assert.equal(r.issues[0].causeCode, 'no-end');
    assert.deepEqual([r.tsr, r.outcome], ['issue', 'failed']);
  });

  it('no end particle after a failed issue: the failure explains the silence, no second record', async () => {
    const r = result(await drive([issue(aixIssue('dispatch-connect', 'failed', { runtime: 'relay' }))]));
    assert.deepEqual(r.shape, ['dispatch-connect:failed']);
    assert.deepEqual([r.tsr, r.outcome], ['issue', 'failed']);
  });

  it('input this build cannot place is a void notice, never a record: the response completes', async () => {
    const r = result(await drive([
      text('Answer.'),
      { cg: 'new-control', value: 1 } as unknown as Op, // a newer server's particle
      { cg: 'aix-issue', issue: { code: 'service-error', effect: 'failed', text: null, detail: 'Overloaded.' } } as unknown as Op, // [Aix.Issue Malformed Guard] a record the readers would throw on
      { cg: 'set-upstream-handle', handle: { uht: 'vnd.new', runId: 'r1' } } as unknown as Op, // a handle this build cannot resume from
      end('done-new-reason' as AixWire_Particles.CGEndReason), // a newer server's end reason
    ]));
    assert.deepEqual(r.shape, [
      'text',
      'notice:Part of the response is unknown to this version of the app.',
      'notice:Part of the response is unknown to this version of the app.',
      'notice:Part of the response could not be applied.',
      'notice:Response may be incomplete - the end reason is unknown to this version of the app.',
    ]);
    assert.deepEqual([r.issues.length, r.tsr, r.outcome], [0, undefined, 'completed']);
  });

  it('function-call arguments with no call open fail the message: the call they belong to would stand complete without them', async () => {
    const r = result(await drive([
      { p: 'fci', id: 'call_1', name: 'lookup', i_args: '{"q":' },
      text('Interleaved.'),
      { p: '_fci', _args: '"x"}' }, // the call is closed by the text: its arguments stay cut
      end('done-dialect', 'ok-tool_invocations'),
    ]));
    assert.deepEqual(r.shape, ['tool_invocation', 'text', 'aix-unknown:failed']);
    assert.equal(r.issues[0].text, 'Part of the response could not be processed.');
    assert.deepEqual([r.tsr, r.outcome], ['issue', 'failed']);
  });

  it('a particle that throws in processing: a failed record, the backlog goes on to the end, and a clean end does not undo it', async () => {
    const r = await drive([text('Before'), THROWS_IN_PROCESSING, text('After'), end('done-dialect', 'ok')]);
    assert.equal(r.hasWireEnd, true, 'waitForWireComplete returned after the whole backlog');
    const { shape, issues, tsr, outcome } = result(r);
    assert.deepEqual(shape, ['text', 'aix-unknown:failed', 'text']);
    assert.equal(issues[0].text, 'Part of the response could not be processed.');
    assert.deepEqual([tsr, outcome], ['issue', 'failed']);
  });

  it('at most one issue fails: the executor cannot see the client\'s failure, so its own after it is stored as a notice', async () => {
    const { shape, tsr, outcome } = result(await drive([text('A'), THROWS_IN_PROCESSING, issue(OVERLOADED), end('issue-dialect', 'cg-issue')]));
    assert.deepEqual(shape, ['text', 'aix-unknown:failed', 'service-error:notice']);
    assert.deepEqual([tsr, outcome], ['issue', 'failed']);
  });

  it('a throwing update callback is logged, never stored', async () => {
    const r = reassembler();
    r.updateCallback = () => {
      throw new Error('store update failed');
    };
    const { shape, outcome } = result(await drive([text('Answer.'), end('done-dialect', 'ok')], r));
    assert.deepEqual([shape, outcome], [['text'], 'completed']);
  });

});


describe('the client doors', () => {

  it('an error status from what sits in front of the server is a relay-http record with the status, not an unknown to report', () => {
    // as thrown: the streaming fetch wrapper's own error, wrapped by tRPC
    const thrown = new TRPCClientError('tRPC fetch: HTTP 502', { cause: new TRPCClientFetchError('response-status', 'tRPC fetch: HTTP 502', 502) });
    const record = aixClassifyStreamingError(thrown, { aborted: false, path: 'trpc' });
    assert.deepEqual(record, { code: 'relay-http', effect: 'failed', text: 'The server answered HTTP 502.', httpStatus: 502 });
  });

  it('a relay failure mid-response: its record after the text, stored failed', async () => {
    const r = await drive([text('Partial')]);
    r.setClientExcepted(RELAY_DROP);
    const { shape, tsr, outcome } = result(r);
    assert.deepEqual([shape, tsr, outcome], [['text', 'relay-read:failed'], 'issue', 'failed']);
  });

  it('a relay failure after the verdict is logged only: the termination stands', async () => {
    const afterEnd = await drive([text('The full answer.'), end('done-dialect', 'ok')]);
    afterEnd.setClientExcepted(RELAY_DROP);
    const ended = result(afterEnd);
    assert.deepEqual([ended.shape, ended.outcome], [['text'], 'completed']);

    const afterFailure = await drive([text('Partial'), issue(OVERLOADED)]);
    afterFailure.setClientExcepted(RELAY_DROP);
    const failed = result(afterFailure);
    assert.deepEqual([failed.shape, failed.tsr], [['text', 'service-error:failed'], 'issue']);
  });

  it('the verdict: in after the wire end or an issue that failed, not after a lost item', async () => {
    assert.equal((await drive([text('A')])).hasVerdict, false);
    assert.equal((await drive([text('A'), issue(aixIssue('service-tool', 'lost', { text: 'Image blocked.' }))])).hasVerdict, false);
    assert.equal((await drive([text('A'), end('done-dialect', 'ok')])).hasVerdict, true);
    assert.equal((await drive([text('A'), issue(OVERLOADED)])).hasVerdict, true);
  });

  it('a Stop after an issue that failed: the generation had already failed, stored failed', async () => {
    const r = await drive([text('A'), issue(aixIssue('dispatch-read', 'failed', { runtime: 'relay', detail: 'terminated' }))]);
    assert.deepEqual([r.hasWireEnd, r.hasVerdict], [false, true]);
    r.setClientAborted();
    const { shape, tsr, outcome } = result(r);
    assert.deepEqual([shape, tsr, outcome], [['text', 'dispatch-read:failed'], 'issue', 'failed']);
  });

  it('a Stop with particles still queued: the wait returns, and with no end applied it is a Stop, not a missing end', async () => {
    const controller = new AbortController();
    const r = reassembler(controller.signal);
    r.enqueueWireParticle(text('Partial'));
    r.enqueueWireParticle(end('done-dialect', 'ok'));
    controller.abort(); // before the processing chain runs: both particles stay in the backlog
    await r.waitForWireComplete();
    assert.equal(r.hasWireEnd, false);
    r.setClientAborted();
    const { shape, tsr, outcome } = result(r);
    assert.deepEqual([shape, tsr, outcome], [[], 'client-abort', 'aborted']);
  });

});


describe('retry resets', () => {

  it('a clearing reset takes back the failed attempt\'s issue and its verdict, and keeps what is queued behind it', async () => {
    // all enqueued before processing starts: the reset finds the next attempt's particles already in the backlog
    const r = await drive([
      text('Attempt one'),
      issue(OVERLOADED),
      { cg: 'aix-retry-reset', rScope: 'srv-op', rClearStrategy: 'since-checkpoint', reason: 'Overloaded', attempt: 2, maxAttempts: 3, phase: 'waiting', delayMs: 1000 },
      { cg: 'aix-retry-reset', rScope: 'srv-op', rClearStrategy: 'none', reason: 'Overloaded', attempt: 2, maxAttempts: 3, phase: 'started', delayMs: 0 },
      text('Attempt two.'),
    ]);
    assert.equal(r.hasVerdict, false, 'the failure went with the attempt');
    await drive([end('done-dialect', 'ok')], r);
    const { shape, tsr, outcome } = result(r);
    assert.deepEqual([shape, tsr, outcome], [['text'], undefined, 'completed']);
  });

});


// The text a utility call (title, summary, follow-up) returns: the model's words, and only the failure that throws after it
describe('aixChatGenerateText_Simple: the returned text', () => {

  function textOf(fragments: DMessageContentFragment[]): string | null {
    const dest = { text: null as string | null, generator: GENERATOR, isDone: false };
    _llToL2Simple({ fragments, generator: GENERATOR } as Parameters<typeof _llToL2Simple>[0], dest);
    return dest.text;
  }

  it('an issue the generation survived is not in the text; the one that failed it is, as it streams before the throw', () => {
    for (const record of [aixIssue('aix-media', 'lost', { text: 'The generated image could not be processed.', detail: 'decode failed' }), aixIssue('model-unfinished', 'notice')])
      assert.equal(textOf([createTextContentFragment('Paris trip'), createAixIssueContentFragment(record)]), 'Paris trip', record.code);
    const failure = aixIssue('dispatch-read', 'failed', { text: 'The connection dropped.', detail: 'terminated' });
    assert.equal(textOf([createTextContentFragment('Paris'), createAixIssueContentFragment(failure)]), 'Paris\nThe connection dropped. (terminated)');
  });

});
