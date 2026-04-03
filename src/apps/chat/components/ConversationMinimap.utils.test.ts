import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildConversationMinimapModel,
  getConversationMinimapContainerHeightPx,
  getConversationMinimapDragGrabOffsetPx,
  getConversationMinimapTrackHeightPx,
  getConversationMinimapScrollTop,
  getConversationMinimapScrollTopForViewportTop,
} from './ConversationMinimap.utils';


test('buildConversationMinimapModel projects entry bounds and viewport into track ratios', () => {
  const model = buildConversationMinimapModel({
    scrollHeight: 3000,
    clientHeight: 600,
    scrollTop: 900,
    entries: [
      { id: 'first', top: 0, height: 300, kind: 'message', backgroundColor: 'hsl(210 72% 38%)', borderColor: 'hsl(210 58% 52%)' },
      { id: 'second', top: 1500, height: 600, kind: 'group' },
    ],
  });

  assert.deepStrictEqual(model, {
    viewportTopRatio: 0.3,
    viewportHeightRatio: 0.2,
    segments: [
      { id: 'first', topRatio: 0, heightRatio: 0.1, kind: 'message', backgroundColor: 'hsl(210 72% 38%)', borderColor: 'hsl(210 58% 52%)' },
      { id: 'second', topRatio: 0.5, heightRatio: 0.2, kind: 'group' },
    ],
  });
});

test('getConversationMinimapScrollTop centers the viewport around the clicked track position and clamps the extremes', () => {
  assert.equal(getConversationMinimapScrollTop({
    clickOffsetPx: 90,
    trackHeightPx: 180,
    scrollHeight: 3000,
    clientHeight: 600,
  }), 1200);

  assert.equal(getConversationMinimapScrollTop({
    clickOffsetPx: 0,
    trackHeightPx: 180,
    scrollHeight: 3000,
    clientHeight: 600,
  }), 0);

  assert.equal(getConversationMinimapScrollTop({
    clickOffsetPx: 180,
    trackHeightPx: 180,
    scrollHeight: 3000,
    clientHeight: 600,
  }), 2400);
});

test('getConversationMinimapScrollTopForViewportTop keeps the grabbed viewport offset stable while dragging and clamps the extremes', () => {
  assert.equal(getConversationMinimapScrollTopForViewportTop({
    viewportTopPx: 90,
    trackHeightPx: 180,
    scrollHeight: 3000,
    clientHeight: 600,
  }), 1500);

  assert.equal(getConversationMinimapScrollTopForViewportTop({
    viewportTopPx: -20,
    trackHeightPx: 180,
    scrollHeight: 3000,
    clientHeight: 600,
  }), 0);

  assert.equal(getConversationMinimapScrollTopForViewportTop({
    viewportTopPx: 170,
    trackHeightPx: 180,
    scrollHeight: 3000,
    clientHeight: 600,
  }), 2400);
});

test('getConversationMinimapContainerHeightPx reserves the overlay inset so the floating block fits inside the messages viewport', () => {
  assert.equal(getConversationMinimapContainerHeightPx(900), 872);
  assert.equal(getConversationMinimapContainerHeightPx(220), 192);
  assert.equal(getConversationMinimapContainerHeightPx(120), 92);
});

test('getConversationMinimapTrackHeightPx subtracts only the active minimap chrome so arrow spacing stays symmetric', () => {
  assert.equal(getConversationMinimapTrackHeightPx(900), 776);
  assert.equal(getConversationMinimapTrackHeightPx(220), 96);
  assert.equal(getConversationMinimapTrackHeightPx(120), 0);
});

test('getConversationMinimapDragGrabOffsetPx centers track clicks and preserves the pointer offset when grabbing the viewport indicator itself', () => {
  assert.equal(getConversationMinimapDragGrabOffsetPx({
    trackHeightPx: 300,
    viewportHeightRatio: 0.2,
    pointerOffsetWithinViewportPx: null,
  }), 30);

  assert.equal(getConversationMinimapDragGrabOffsetPx({
    trackHeightPx: 300,
    viewportHeightRatio: 0.2,
    pointerOffsetWithinViewportPx: 12,
  }), 12);

  assert.equal(getConversationMinimapDragGrabOffsetPx({
    trackHeightPx: 300,
    viewportHeightRatio: 0.2,
    pointerOffsetWithinViewportPx: 120,
  }), 60);
});
