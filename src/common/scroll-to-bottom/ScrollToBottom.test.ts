import assert from 'node:assert/strict';
import test from 'node:test';

import { isScrollViewportAtBottom } from './ScrollToBottom';


test('isScrollViewportAtBottom treats near-bottom viewports as sticky', () => {
  assert.equal(isScrollViewportAtBottom({
    scrollHeight: 2000,
    scrollTop: 1445,
    offsetHeight: 500,
  }), true);
});

test('isScrollViewportAtBottom stops auto-scroll once the user has moved meaningfully above the bottom', () => {
  assert.equal(isScrollViewportAtBottom({
    scrollHeight: 2000,
    scrollTop: 1400,
    offsetHeight: 500,
  }), false);
});
