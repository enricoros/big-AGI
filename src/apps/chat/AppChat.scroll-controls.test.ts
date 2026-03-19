import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


test('app chat leaves desktop chat scroll controls to the shared chat overlay and keeps legacy buttons only for mobile or beam views', () => {
  const source = readFileSync(new URL('./AppChat.tsx', import.meta.url), 'utf8');
  assert.match(source, /\(isMobile \|\| _paneBeamIsOpen\)/);
  assert.match(source, /<ScrollToTopButton\s*\/>/);
  assert.match(source, /<ScrollToBottomButton\s*\/>/);
});
