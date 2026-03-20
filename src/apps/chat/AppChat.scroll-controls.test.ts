import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


test('app chat leaves desktop chat scroll controls to the shared chat overlay and keeps legacy buttons only for mobile or beam views', () => {
  const source = readFileSync(new URL('./AppChat.tsx', import.meta.url), 'utf8');
  assert.match(source, /\(isMobile \|\| _paneBeamIsOpen\)/);
  assert.match(source, /<ScrollToTopButton\s*\/>/);
  assert.match(source, /<ScrollToBottomButton\s*\/>/);
});

test('app chat only disables the new chat button for empty human-driven chats', () => {
  const source = readFileSync(new URL('./AppChat.tsx', import.meta.url), 'utf8');
  assert.match(source, /turnTerminationMode: focusedChatTurnTerminationMode,/);
  assert.match(source, /const disableNewButton = isFocusedChatEmpty && !isMultiPane && focusedChatTurnTerminationMode === 'round-robin-per-human';/);
});

test('new chat starts from the default single-agent human-driven draft unless a saved group is being loaded', () => {
  const source = readFileSync(new URL('./AppChat.tsx', import.meta.url), 'utf8');
  assert.match(source, /: prependNewConversation\(agentGroupSnapshot\?\.systemPurposeId \?\? undefined, isIncognito\);/);
  assert.doesNotMatch(source, /prependNewConversation\(agentGroupSnapshot\?\.systemPurposeId \?\? getConversationSystemPurposeId\(focusedPaneConversationId\) \?\? undefined, isIncognito\)/);
});
