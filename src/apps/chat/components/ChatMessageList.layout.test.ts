import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAT_MESSAGE_LIST_MINIMAP_TRACK_MAX_RENDER_UNITS,
  getChatMessageListContainerSx,
  getChatMessageListConversationOverlayMode,
  getChatMessageListMinimapOverlaySx,
  shouldShowConversationMinimapTrack,
} from './ChatMessageList.layout';


test('chat message list minimap uses an overlay layer instead of reserving layout width', () => {
  const containerSx = getChatMessageListContainerSx();
  assert.equal(containerSx.position, 'relative');
  assert.equal('gridTemplateColumns' in containerSx, false);

  const overlaySx = getChatMessageListMinimapOverlaySx();
  assert.equal(overlaySx.position, 'sticky');
  assert.equal(overlaySx.height, 0);
  assert.equal(overlaySx.pointerEvents, 'none');
});

test('chat message list reuses the same desktop overlay column for minimap and controls-only modes', () => {
  assert.equal(getChatMessageListConversationOverlayMode({
    isMobile: false,
    isMessageSelectionMode: false,
    showConversationMinimap: true,
    showConversationMinimapTrack: true,
    visibleMessageCount: 8,
  }), 'minimap');

  assert.equal(getChatMessageListConversationOverlayMode({
    isMobile: false,
    isMessageSelectionMode: false,
    showConversationMinimap: false,
    showConversationMinimapTrack: false,
    visibleMessageCount: 8,
  }), 'controls');

  assert.equal(getChatMessageListConversationOverlayMode({
    isMobile: false,
    isMessageSelectionMode: false,
    showConversationMinimap: true,
    showConversationMinimapTrack: false,
    visibleMessageCount: 8,
  }), 'controls');

  assert.equal(getChatMessageListConversationOverlayMode({
    isMobile: true,
    isMessageSelectionMode: false,
    showConversationMinimap: true,
    showConversationMinimapTrack: true,
    visibleMessageCount: 8,
  }), 'hidden');

  assert.equal(getChatMessageListConversationOverlayMode({
    isMobile: false,
    isMessageSelectionMode: true,
    showConversationMinimap: true,
    showConversationMinimapTrack: true,
    visibleMessageCount: 8,
  }), 'hidden');

  assert.equal(getChatMessageListConversationOverlayMode({
    isMobile: false,
    isMessageSelectionMode: false,
    showConversationMinimap: true,
    showConversationMinimapTrack: true,
    visibleMessageCount: 0,
  }), 'hidden');
});

test('chat message list only keeps the full minimap track for fully rendered conversations under the render threshold', () => {
  assert.equal(shouldShowConversationMinimapTrack({
    showConversationMinimap: true,
    hasDeferredOlderEntries: false,
    renderedEntryUnits: 1,
  }), true);

  assert.equal(shouldShowConversationMinimapTrack({
    showConversationMinimap: true,
    hasDeferredOlderEntries: false,
    renderedEntryUnits: CHAT_MESSAGE_LIST_MINIMAP_TRACK_MAX_RENDER_UNITS,
  }), true);

  assert.equal(shouldShowConversationMinimapTrack({
    showConversationMinimap: true,
    hasDeferredOlderEntries: true,
    renderedEntryUnits: 48,
  }), false);

  assert.equal(shouldShowConversationMinimapTrack({
    showConversationMinimap: true,
    hasDeferredOlderEntries: false,
    renderedEntryUnits: CHAT_MESSAGE_LIST_MINIMAP_TRACK_MAX_RENDER_UNITS + 1,
  }), false);

  assert.equal(shouldShowConversationMinimapTrack({
    showConversationMinimap: false,
    hasDeferredOlderEntries: false,
    renderedEntryUnits: 24,
  }), false);
});
