import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('drawer navigation keeps brand-new chats out of the list until they receive a message', () => {
  const source = readFileSync(new URL('./useChatDrawerRenderItems.tsx', import.meta.url), 'utf8');

  assert.match(source, /export function shouldRenderConversationInDrawer\(messageCount: number\): boolean \{\s*return messageCount > 0;\s*\}/);
  assert.match(source, /const messageCount = _c\.messages\.length;\s*if \(!shouldRenderConversationInDrawer\(messageCount\)\)\s*return null;/);
});
