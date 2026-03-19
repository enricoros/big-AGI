import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


test('app chat settings expose a persisted call button toggle defaulting to off in the composer UI', () => {
  const settingsSource = readFileSync(new URL('./AppChatSettingsUI.tsx', import.meta.url), 'utf8');
  const storeSource = readFileSync(new URL('../../chat/store-app-chat.ts', import.meta.url), 'utf8');
  const composerSource = readFileSync(new URL('../../chat/components/composer/Composer.tsx', import.meta.url), 'utf8');
  const conversationHandlerSource = readFileSync(new URL('../../../common/chat-overlay/ConversationHandler.ts', import.meta.url), 'utf8');

  assert.match(settingsSource, /useChatShowCallButton/);
  assert.match(settingsSource, /title='Call Button'/);
  assert.match(settingsSource, /description=\{showCallButton \? 'Show call action' : 'Hidden'\}/);
  assert.match(settingsSource, /<Switch checked=\{showCallButton\} onChange=\{handleShowCallButtonChange\}/);

  assert.match(settingsSource, /useChatShowCompletionNotifications/);
  assert.match(settingsSource, /title='Completion Notifications'/);
  assert.match(settingsSource, /description=\{showCompletionNotifications \? 'System notifications on reply completion' : 'Muted'\}/);
  assert.match(settingsSource, /handleTestCompletionNotification/);
  assert.match(settingsSource, /showTestSystemNotification/);
  assert.match(settingsSource, /ensureSystemNotificationPermission/);
  assert.match(settingsSource, /System notification could not be shown\./);
  assert.match(settingsSource, /<Button size='sm' variant='soft' color='neutral' onClick=\{handleTestCompletionNotification\}>/);
  assert.match(settingsSource, /Test notification/);
  assert.match(settingsSource, /<Switch checked=\{showCompletionNotifications\} onChange=\{handleShowCompletionNotificationsChange\}/);
  assert.match(settingsSource, /Notification\.requestPermission\(\)/);
  assert.match(settingsSource, /System notifications are not supported here\./);
  assert.match(settingsSource, /System notifications were not allowed\./);

  assert.match(storeSource, /showCallButton: boolean;/);
  assert.match(storeSource, /setShowCallButton: \(showCallButton: boolean\) => void;/);
  assert.match(storeSource, /showCallButton: false,/);
  assert.match(storeSource, /setShowCallButton: \(showCallButton: boolean\) => _set\(\{ showCallButton \}\)/);
  assert.match(storeSource, /export const useChatShowCallButton = \(\): \[boolean, \(showCallButton: boolean\) => void\] =>/);

  assert.match(storeSource, /showCompletionNotifications: boolean;/);
  assert.match(storeSource, /setShowCompletionNotifications: \(showCompletionNotifications: boolean\) => void;/);
  assert.match(storeSource, /showCompletionNotifications: true,/);
  assert.match(storeSource, /setShowCompletionNotifications: \(showCompletionNotifications: boolean\) => _set\(\{ showCompletionNotifications \}\)/);
  assert.match(storeSource, /export const getChatShowCompletionNotifications = \(\): boolean =>/);
  assert.match(storeSource, /export const useChatShowCompletionNotifications = \(\): \[boolean, \(showCompletionNotifications: boolean\) => void\] =>/);

  assert.match(composerSource, /const \[showCallButton\] = useChatShowCallButton\(\);/);
  assert.match(composerSource, /\? \(showCallButton/);
  assert.match(composerSource, /\{showChatExtras && showCallButton && <ButtonCallMemo disabled=\{noConversation \|\| noLLM \|\| assistantAbortible\} onClick=\{handleCallClicked\} \/>\}/);

  assert.match(conversationHandlerSource, /getChatShowCompletionNotifications/);
  assert.match(conversationHandlerSource, /getChatShowCompletionNotifications\(\)\s*\?\s*getMessageCompletionNotification/);
  assert.match(conversationHandlerSource, /export function showCompletionSystemNotification/);
  assert.match(conversationHandlerSource, /export function showTestSystemNotification/);
  assert.match(conversationHandlerSource, /new Notification\(notification\.title/);
  assert.match(conversationHandlerSource, /systemNotification\.onclick =/);
  assert.match(conversationHandlerSource, /openConversationFromCompletionNotification\(notification\.conversationId\)/);
  assert.match(conversationHandlerSource, /icon: '\/icons\/icon-192x192\.png'/);
});
