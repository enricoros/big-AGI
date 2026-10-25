import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import { minify, transform } from 'next/dist/build/swc';

import { createErrorContentFragment, createPlaceholderVoidFragment, createTextContentFragment, isContentFragment, isErrorPart } from './chat.fragments';
import { messageOutcome, messageTerminalOutcome } from './chat.message.outcome';


type OutcomeInput = Parameters<typeof messageTerminalOutcome>[0];

const text = createTextContentFragment('Hello, I can speak this response.');
const error = createErrorContentFragment('The request failed.');
const notice = createPlaceholderVoidFragment('Display-only notice');
const cases: { name: string; message: OutcomeInput; expected: ReturnType<typeof messageTerminalOutcome> }[] = [
  { name: 'normal response', message: { fragments: [text] }, expected: 'completed' },
  { name: 'empty response', message: { fragments: [] }, expected: 'completed' },
  { name: 'normal generator', message: { generator: { mgt: 'named', name: 'Test' }, fragments: [text] }, expected: 'completed' },
  { name: 'trailing error', message: { fragments: [text, error] }, expected: 'failed' },
  { name: 'notice after an error', message: { fragments: [text, error, notice] }, expected: 'failed' },
  { name: 'text after an error', message: { fragments: [error, text] }, expected: 'completed' },
  { name: 'notice after text', message: { fragments: [text, notice] }, expected: 'completed' },
  ...(['out-of-tokens', 'issue', 'filter', 'client-abort'] as const).map(stopReason => ({
    name: stopReason,
    message: { generator: { mgt: 'named', name: 'Test', tokenStopReason: stopReason }, fragments: [text] } satisfies OutcomeInput,
    expected: stopReason === 'out-of-tokens' ? 'truncated' : stopReason === 'client-abort' ? 'aborted' : 'failed',
  } as const)),
];

test('terminal outcomes always classify normal replies, errors and explicit stop reasons', () => {
  for (const { name, message, expected } of cases)
    assert.equal(messageTerminalOutcome(message), expected, name);
  assert.equal(messageOutcome({ fragments: [text], pendingIncomplete: true }), 'pending');
});

// tsx does not minify modules, so run the production SWC transform and minifier explicitly.
test('the production SWC transform and minifier preserve the normal completion path', async () => {
  const source = await readFile(new URL('./chat.message.outcome.ts', import.meta.url), 'utf8');
  const compiled = await transform(source, {
    filename: 'chat.message.outcome.ts',
    jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
    module: { type: 'commonjs' },
  });
  const optimized: unknown = await minify(compiled.code, { compress: { passes: 2 }, mangle: true, ecma: 2022 });
  assert.ok(optimized && typeof optimized === 'object' && 'code' in optimized && typeof optimized.code === 'string');
  const exports: { messageTerminalOutcome?: (message: unknown) => unknown } = {};
  runInNewContext(optimized.code, {
    exports,
    require: (id: string) => {
      assert.equal(id, './chat.fragments');
      return { isContentFragment, isErrorPart };
    },
  });
  assert.ok(exports.messageTerminalOutcome);
  for (const { name, message, expected } of cases)
    assert.equal(exports.messageTerminalOutcome(message), expected, name);
  for (const tokenStopReason of ['future-stop-reason', 'constructor', 'toString', '__proto__'])
    assert.equal(exports.messageTerminalOutcome({ generator: { mgt: 'named', name: 'Test', tokenStopReason }, fragments: [text] }), 'failed', tokenStopReason);
});
