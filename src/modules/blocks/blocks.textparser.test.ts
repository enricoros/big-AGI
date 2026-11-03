/// <reference types="node" />

// Run: `NODE_ENV=development npx tsx --test src/modules/blocks/blocks.textparser.test.ts`

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseBlocksFromText } from './blocks.textparser';


function codeBlocks(text: string) {
  return parseBlocksFromText(text).flatMap(b => b.bkt === 'code-bk' ? [b] : []);
}

describe('parseBlocksFromText - fenced code blocks', () => {

  it('keeps triple backticks inside paragraph text as text (#1280)', () => {
    assert.equal(codeBlocks('Test1 ``` Test2\nTest3').length, 0);
  });

  it('keeps two inline fences on one line as text (#1280)', () => {
    assert.equal(codeBlocks('Test1 ``` Test2 ``` Test3\nTest4').length, 0);
  });

  it('parses a fence at the start of a line', () => {
    const blocks = codeBlocks('Intro\n```js\nconst a = 1;\n```\nOutro');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].title, 'js');
    assert.equal(blocks[0].code, 'const a = 1;\n');
    assert.equal(blocks[0].isPartial, false);
  });

  it('parses a fence at offset 0', () => {
    const blocks = codeBlocks('```py\nprint(1)\n```');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].title, 'py');
    assert.equal(blocks[0].sourceStart, 0);
  });

  it('parses indented fences (e.g. inside list items)', () => {
    assert.equal(codeBlocks('1. Step\n   ```bash\n   npm i\n   ```\n').length, 1);
    assert.equal(codeBlocks('- item\n    ```ts\n    x\n    ```\n').length, 1);
  });

  it('keeps nested fences together', () => {
    const blocks = codeBlocks('````md\n```js\nx\n```\n````\nafter');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].title, 'md');
    assert.equal(blocks[0].code, '```js\nx\n```\n');
  });

  it('marks an unterminated (streaming) block as partial', () => {
    const blocks = codeBlocks('Here:\n```js\nconst a');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].code, 'const a');
    assert.equal(blocks[0].isPartial, true);
  });

  it('parses consecutive blocks separated by text', () => {
    assert.equal(codeBlocks('```a\n1\n```\ntext\n```b\n2\n```').length, 2);
  });

});
