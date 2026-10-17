/// <reference types="node" />

// Run: `NODE_ENV=development npx tsx --test src/apps/chat/components/message/render-tree/parseTrailingOptions.test.ts`

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTrailingOptions } from './parseTrailingOptions';


const expectOptions = (input: string, beforeText: string, options: string[]) =>
  assert.deepEqual(parseTrailingOptions(input), { beforeText, options });

const expectNone = (input: string) =>
  assert.equal(parseTrailingOptions(input), null, JSON.stringify(input));


describe('parseTrailingOptions', () => {

  it('parses unordered lists, dropping the marker', () => {
    expectOptions('Choose one:\n- Option A\n- Option B\n- Option C', 'Choose one:', ['Option A', 'Option B', 'Option C']);
    expectOptions('Pick one:\n* First\n* Second', 'Pick one:', ['First', 'Second']);
    expectOptions('Select:\n+ One\n+ Two', 'Select:', ['One', 'Two']);
    expectOptions('Pick:\n- A\n- B', 'Pick:', ['A', 'B']);
    expectOptions('Select:\n- Option #1!\n- Option @2?', 'Select:', ['Option #1!', 'Option @2?']);
  });

  it('parses ordered lists, keeping the numbers', () => {
    expectOptions('Select one:\n1. First option\n2. Second option', 'Select one:', ['1. First option', '2. Second option']);
    expectOptions('Pick:\n1. First\n3. Third', 'Pick:', ['1. First', '3. Third']);
  });

  it('needs a prompt line ending with : or ?, and 2 to 8 options', () => {
    expectOptions('Which one?\n- Option A\n- Option B', 'Which one?', ['Option A', 'Option B']);
    expectOptions('This is a long explanation.\nHere are your choices:\n- Option A\n- Option B', 'This is a long explanation.\nHere are your choices:', ['Option A', 'Option B']);
    expectNone('Options\n- One\n- Two');
    expectNone('Choose:\n- Just one option');
    expectNone('Many:\n- 1\n- 2\n- 3\n- 4\n- 5\n- 6\n- 7\n- 8\n- 9');
  });

  it('rejects mixed markers, long items and double blank lines', () => {
    expectNone('Choose:\n- First\n1. Second');
    expectNone('Choose:\n1. First\n- Second');
    expectNone('Pick:\n- ' + 'A'.repeat(101) + '\n- B');
    expectOptions('Choose:\n\n- Option A\n\n- Option B', 'Choose:', ['Option A', 'Option B']);
    expectNone('Choose:\n\n\n- Option A\n- Option B');
  });

  it('leaves other text alone', () => {
    for (const input of ['', '\n', '\n\n', '\na\n', 'a\n\n', '\n\na', '\na', 'a', 'test:\n- aa', 'Just a regular message without options', 'Choose:\n- \n- '])
      expectNone(input);
  });

});
