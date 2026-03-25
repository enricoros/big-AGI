import assert from 'node:assert/strict';
import test from 'node:test';

import { isScrollViewportAtBottom, shouldScrollToBottomOnResize } from './ScrollToBottom';


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

test('shouldScrollToBottomOnResize keeps following large content growth while sticky mode is active', () => {
  assert.equal(shouldScrollToBottomOnResize({
    stickToBottom: true,
    scrollHeight: 2400,
    scrollTop: 1400,
    offsetHeight: 500,
  }), true);
});

test('shouldScrollToBottomOnResize does not re-enable follow mode when sticky mode is off and the viewport is above the threshold', () => {
  assert.equal(shouldScrollToBottomOnResize({
    stickToBottom: false,
    scrollHeight: 2400,
    scrollTop: 1400,
    offsetHeight: 500,
  }), false);
});

test('shouldScrollToBottomOnResize yields to a recent user upward scroll intent even while sticky mode is active', () => {
  assert.equal(shouldScrollToBottomOnResize({
    stickToBottom: true,
    scrollHeight: 2400,
    scrollTop: 1900,
    offsetHeight: 500,
    suppressAutoScrollUntil: 10_000,
    now: 9_900,
  }), false);
});

test('shouldScrollToBottomOnResize resumes auto-follow after the user-intent lock expires', () => {
  assert.equal(shouldScrollToBottomOnResize({
    stickToBottom: true,
    scrollHeight: 2400,
    scrollTop: 1900,
    offsetHeight: 500,
    suppressAutoScrollUntil: 10_000,
    now: 10_001,
  }), true);
});
