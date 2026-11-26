/// <reference types="node" />
// Run: `NODE_ENV=development npx tsx --test src/modules/aix/server/dispatch/chatGenerate/ChatGenerateTransmitter.test.ts`
//
// Issues on the executor side: the transmitter driven the way the parsers and the executor drive it, then the wrapper
// chain on a stubbed connect. Only what goes on the wire is read.
import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';

// relative imports: the root tsconfig excludes tests, so the IDE's inferred project has no '~' paths (tsx and tools/tsconfig do)
import { AixWire_Particles } from '../../api/aix.wiretypes';
import { aixIssue, type DAixIssue } from '../../../shared/aix.issues';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateParseFunction } from './chatGenerate.dispatch';
import { ChatGenerateTransmitter } from './ChatGenerateTransmitter';
import { DispatchContinuationSignal, executeChatGenerateWithContinuation } from './chatGenerate.continuation';
import type { ParticleDialectIssue } from './parsers/IParticleTransmitter';


type Op = AixWire_Particles.ChatGenerateOp;

const issuesOf = (ops: Op[]): DAixIssue[] => ops.flatMap(op => 'cg' in op && op.cg === 'aix-issue' ? [op.issue] : []);
const said = (ops: Op[]) => issuesOf(ops).map(issue => `${issue.code}:${issue.effect}`);
const endOf = (ops: Op[]) => {
  const ends = ops.filter((op): op is Extract<Op, { cg: 'end' }> => 'cg' in op && op.cg === 'end');
  assert.equal(ends.length, 1, 'exactly one end');
  assert.equal(ops.at(-1), ends[0], 'the end is the last particle');
  return ends[0];
};
const flush = (tx: ChatGenerateTransmitter): Op[] => [...tx.flushParticles()];

/** The real wrapper chain (continuation -> operation retry -> executor) on an SSE body per upstream request */
async function runChain(bodies: string[][], createParser: () => ChatGenerateParseFunction, profiler?: object): Promise<Op[]> {
  const _d = { runtime: 'relay', prettyDialect: 'Test', echoRequest: false, requestBodyOverride: undefined, consoleLogErrors: false, wire: undefined, profiler } as unknown as AixDebugObject;
  let request = 0;
  const ops: Op[] = [];
  const particles = executeChatGenerateWithContinuation(async () => ({
    request: { url: 'https://service.invalid/v1', headers: {}, method: 'POST', body: {} },
    customConnect: async () => new Response(bodies[Math.min(request++, bodies.length - 1)].map(data => `data: ${data}\n\n`).join('')),
    demuxerFormat: 'fast-sse',
    chatGenerateParse: createParser(),
  }), new AbortController().signal, _d);
  for await (const op of particles)
    if (!('p' in op && op.p === '❤'))
      ops.push(op);
  return ops;
}

/** Stands for an executor bug: the profiler hook the executor calls after the read, outside its own catches, throws */
const THROWS_AFTER_READ = { measureStart: () => undefined, measureEnd: () => undefined, clearMeasurements: () => undefined, getResultsData: () => { throw new Error('executor bug'); } };

before(() => {
  mock.method(console, 'log', () => undefined);
  mock.method(console, 'warn', () => undefined);
});
after(() => mock.restoreAll());


describe('ChatGenerateTransmitter: issues', () => {

  it('an issue goes out where it arrives, and the read is not ended by it', () => {
    const tx = new ChatGenerateTransmitter('Test');
    tx.appendText('before');
    tx.addDialectIssue({ code: 'service-tool', text: 'Image generation failed.' });
    tx.appendText('after');
    assert.equal(tx.isEnded, false);
    tx.setTokenStopReason('ok');
    tx.setDialectEnded('done-dialect');

    const ops = flush(tx);
    assert.deepEqual(ops.map(op => 't' in op ? op.t : 'cg' in op ? op.cg : '?'), ['before', 'aix-issue', 'after', 'end']);
    assert.deepEqual(said(ops), ['service-tool:lost']);
    assert.equal(endOf(ops).tokenStopReason, 'ok', 'a lost item does not fail the generation');
  });

  it('after a clean stop reason a failure is a notice, and the generation stays clean', () => {
    const tx = new ChatGenerateTransmitter('Test');
    tx.appendText('The whole answer.');
    tx.setTokenStopReason('ok');
    tx.addIssue(aixIssue('dispatch-read', 'failed', { runtime: 'relay' }), false);
    tx.setDispatchEnded('issue-dispatch-rpc');

    const ops = flush(tx);
    assert.deepEqual(said(ops), ['dispatch-read:notice']);
    assert.equal(endOf(ops).tokenStopReason, 'ok');
  });

  it('at most one issue fails: the second is a notice, a clean stop reason after it is refused', () => {
    const tx = new ChatGenerateTransmitter('Test');
    tx.addDialectIssue({ text: 'Overloaded', causeCode: 'overloaded_error' });
    tx.setTokenStopReason('ok'); // what a vendor may still send after its error
    tx.addIssue(aixIssue('dispatch-parse', 'failed'), false);
    tx.setDialectEnded('issue-dialect');

    const ops = flush(tx);
    assert.deepEqual(said(ops), ['service-error:failed', 'dispatch-parse:notice']);
    assert.equal(endOf(ops).tokenStopReason, 'cg-issue');
  });

  it('a filter stop is explained once: by the parser when it has words, else by the stop reason\'s sentence', () => {
    const stated = new ChatGenerateTransmitter('Test');
    stated.setTokenStopReason('filter-recitation');
    stated.addDialectIssue({ code: 'model-filter', causeCode: 'RECITATION' }); // a code, no words: the sentence is the stop reason's
    stated.setDialectEnded('done-dialect');
    const statedOps = flush(stated);
    assert.deepEqual(issuesOf(statedOps).map(({ code, effect, text, causeCode }) => ({ code, effect, text, causeCode })),
      [{ code: 'model-filter', effect: 'failed', text: 'Response blocked - potential copyrighted/recited content.', causeCode: 'RECITATION' }]);
    assert.equal(endOf(statedOps).tokenStopReason, 'filter-recitation', 'the filter stays the stop reason');

    const bare = new ChatGenerateTransmitter('Test');
    bare.setTokenStopReason('filter-refusal');
    bare.setDialectEnded('done-dialect');
    assert.deepEqual(issuesOf(flush(bare)).map(({ code, effect, text }) => ({ code, effect, text })),
      [{ code: 'model-filter', effect: 'failed', text: 'Response refused by the provider\'s safety classifier.' }]);
  });

  for (const [what, end, expected, stop] of [
    ['the read closed with no stop reason', (tx: ChatGenerateTransmitter) => tx.setDispatchEnded('done-dispatch-closed'), ['dispatch-cutoff:failed'], 'cg-issue'],
    ['the read closed after a stop reason', (tx: ChatGenerateTransmitter) => { tx.setTokenStopReason('out-of-tokens'); tx.setDispatchEnded('done-dispatch-closed'); }, [], 'out-of-tokens'],
    ['the abort signal fired', (tx: ChatGenerateTransmitter) => tx.setDispatchEnded('done-dispatch-aborted'), ['dispatch-aborted:failed'], 'cg-issue'],
    ['an error stop reason nothing explained', (tx: ChatGenerateTransmitter) => { tx.setTokenStopReason('cg-issue'); tx.setDialectEnded('done-dialect'); }, ['service-error:failed'], 'cg-issue'],
    ['the dialect ended with no stop reason', (tx: ChatGenerateTransmitter) => tx.setDialectEnded('done-dialect'), ['model-unfinished:notice'], undefined],
    ['a failure already explained', (tx: ChatGenerateTransmitter) => { tx.addDialectIssue({ text: 'Quota exceeded.' }); tx.setDispatchEnded('done-dispatch-closed'); }, ['service-error:failed'], 'cg-issue'],
  ] as const)
    it(`the end states what nothing else did: ${what}`, () => {
      const tx = new ChatGenerateTransmitter('Test');
      tx.appendText('Partial answer.');
      end(tx);
      const ops = flush(tx);
      assert.deepEqual(said(ops), expected);
      assert.equal(endOf(ops).tokenStopReason, stop);
    });

  it('nothing follows the end', () => {
    const tx = new ChatGenerateTransmitter('Test');
    tx.setTokenStopReason('ok');
    tx.setDialectEnded('done-dialect');
    endOf(flush(tx));

    tx.addDialectIssue({ text: 'A late error.' });
    tx.appendText('late');
    assert.deepEqual(flush(tx), []);
  });

  it('an issue closes an open function call: arguments after it are a parser error', () => {
    const tx = new ChatGenerateTransmitter('Test');
    tx.startFunctionCallInvocation('call_1', 'lookup', 'incr_str', '{"q":');
    tx.addDialectIssue({ text: 'A warning between chunks.', effect: 'notice' });
    assert.throws(() => tx.appendFunctionCallInvocationArgs('call_1', '"x"}'), /non-existing function call/);
  });

});


// The rules the client relies on, over call sequences no table lists: a parser and the executor calling in any legal
// order, drained as the executor drains it. Seeded: a failure names its seed, and the same seed replays it.
describe('ChatGenerateTransmitter: what holds for any legal call sequence', () => {

  const STOPS: AixWire_Particles.GCTokenStopReason[] = ['ok', 'ok-tool_invocations', 'out-of-tokens', 'cg-issue', 'filter-content', 'filter-recitation', 'filter-refusal'];
  const ISSUES: ParticleDialectIssue[] = [{ text: 'The vendor failed.' }, { code: 'model-filter', causeCode: 'SAFETY' }, { code: 'dispatch-parse' }, { code: 'service-tool', text: 'A tool failed.' }, { text: 'A notice.', effect: 'notice' }];
  const ENDS: ((tx: ChatGenerateTransmitter) => void)[] = [
    tx => tx.setDialectEnded('done-dialect'),
    tx => tx.setDialectEnded('issue-dialect'),
    tx => tx.setDispatchEnded('done-dispatch-closed'),
    tx => tx.setDispatchEnded('done-dispatch-aborted'),
    tx => tx.setDispatchRpcTerminatingIssue(aixIssue('dispatch-read', 'failed', { runtime: 'relay' }), false),
  ];
  const errorClass = (stop: AixWire_Particles.GCTokenStopReason | undefined) => stop !== undefined && AixWire_Particles.gcStopReasonRow(stop)?.class === 'error';

  /** mulberry32: a small seeded generator, the same numbers on every engine */
  function random(seed: number): () => number {
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  it('one end, last; at most one failure, always with an error stop reason; a failing end is explained; no text is lost', () => {
    for (let seed = 1; seed <= 4000; seed++) {
      const next = random(seed), pick = <T, >(from: T[]) => from[Math.floor(next() * from.length)];
      const tx = new ChatGenerateTransmitter('Test');
      const ops: Op[] = [];
      let textIn = '';

      // the read: one call per event, particles drained after each, until something ends it
      for (let event = 0, events = 1 + Math.floor(next() * 12); event < events && !tx.isEnded; event++) {
        const roll = next();
        if (roll < 0.30) tx.appendText((textIn += `t${event} `, `t${event} `));
        else if (roll < 0.38) tx.appendReasoningText('thinking');
        else if (roll < 0.46) { tx.startFunctionCallInvocation(`call_${event}`, 'lookup', 'incr_str', '{"q":'); tx.appendFunctionCallInvocationArgs(`call_${event}`, '"x"}'); } // a call arrives whole: an issue comes between items
        else if (roll < 0.70) tx.addDialectIssue(pick(ISSUES));
        else if (roll < 0.90) tx.setTokenStopReason(pick(STOPS));
        else pick(ENDS)(tx);
        ops.push(...tx.emitParticles());
      }
      if (!tx.isEnded) pick(ENDS)(tx);
      ops.push(...flush(tx));

      // what a parser or the executor still calls after the end goes nowhere
      tx.addDialectIssue({ text: 'A late error.' });
      tx.appendText('late');
      assert.deepEqual(flush(tx), [], `seed ${seed}: particles after the end`);

      const end = endOf(ops), failed = issuesOf(ops).filter(issue => issue.effect === 'failed');
      const failingEnd = errorClass(end.tokenStopReason) || (end.tokenStopReason === undefined && end.terminationReason !== 'done-dialect');
      assert.ok(failed.length <= 1, `seed ${seed}: ${failed.length} issues failed the generation`);
      assert.equal(failed.length === 1, failingEnd, `seed ${seed}: ${failed.length} failed issue(s) with end ${end.terminationReason}/${end.tokenStopReason}`);
      if (failed.length)
        assert.ok(errorClass(end.tokenStopReason), `seed ${seed}: a failure travels with stop reason ${end.tokenStopReason}`);
      assert.equal(ops.flatMap(op => 't' in op ? [op.t] : []).join(''), textIn, `seed ${seed}: text in, text out`);
    }
  });

});


describe('chat generate wrappers: their own failures', () => {

  const textParser = (): ChatGenerateParseFunction => (pt, data) => pt.appendText(data);

  it('a throw that crosses the executor becomes one failing issue and one end', async () => {
    const ops = await runChain([['Partial answer.']], textParser, THROWS_AFTER_READ);
    assert.deepEqual(issuesOf(ops).map(({ code, effect, detail }) => ({ code, effect, detail })), [{ code: 'dispatch-unknown', effect: 'failed', detail: 'executor bug' }]);
    assert.deepEqual(endOf(ops), { cg: 'end', terminationReason: 'issue-dispatch-rpc', tokenStopReason: 'cg-issue' });
  });

  it('the same throw after an issue that failed the generation is a notice', async () => {
    const ops = await runChain([['boom']], () => (pt) => pt.addDialectIssue({ text: 'The vendor failed.' }), THROWS_AFTER_READ);
    assert.deepEqual(said(ops), ['service-error:failed', 'dispatch-unknown:notice']);
    endOf(ops);
  });

  it('a continuation that never ends stops at the limit, with its own cause code', async () => {
    const pauses = (): ChatGenerateParseFunction => () => { throw new DispatchContinuationSignal({ reason: 'pause_turn', mutateBody: body => body }); };
    const ops = await runChain([['pause']], pauses);
    assert.deepEqual(issuesOf(ops).map(({ code, effect, text, causeCode }) => ({ code, effect, text, causeCode })),
      [{ code: 'dispatch-unknown', effect: 'failed', text: 'The generation exceeded the continuation limit.', causeCode: 'continuation-limit' }]);
    endOf(ops);
  });

  it('a parser states what it kept aside when the read is over, before the end and its nets', async () => {
    const createParser = (statesTheClose: boolean) => (): ChatGenerateParseFunction => {
      let pending: string | undefined;
      return Object.assign(((pt, data) => data.startsWith('error:') ? void (pending = data) : pt.appendText(data)) as ChatGenerateParseFunction, {
        onReadEnd: (pt: Parameters<ChatGenerateParseFunction>[0], closed: boolean) => {
          if (!pending) return;
          pt.addDialectIssue({ text: pending });
          if (statesTheClose && closed) pt.addDialectIssue({ code: 'dispatch-cutoff', effect: 'notice' });
        },
      });
    };
    const ops = await runChain([['Partial answer.', 'error: container not found']], createParser(false));
    assert.deepEqual(issuesOf(ops).map(({ code, effect, text }) => ({ code, effect, text })), [{ code: 'service-error', effect: 'failed', text: 'error: container not found' }], 'no cutoff by the transmitter on top of the vendor\'s error: a close is how other dialects end');
    assert.deepEqual(endOf(ops), { cg: 'end', terminationReason: 'done-dispatch-closed', tokenStopReason: 'cg-issue' });

    // a dialect that always sends a final event is told the body closed without one, and states it as a second observation
    const both = await runChain([['Partial answer.', 'error: container not found']], createParser(true));
    assert.deepEqual(said(both), ['service-error:failed', 'dispatch-cutoff:notice']);
    assert.deepEqual(endOf(both), { cg: 'end', terminationReason: 'done-dispatch-closed', tokenStopReason: 'cg-issue' });
  });

});
