import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('saved agent groups use an inline delete icon in the drawer menu', () => {
  const source = readFileSync(new URL('./ChatDrawer.tsx', import.meta.url), 'utf8');

  assert.match(source, /import DeleteOutlineIcon from '@mui\/icons-material\/DeleteOutline';/);
  assert.match(source, /'aria-label': 'Load saved agent group'/);
  assert.match(source, /<IconButton[\s\S]*aria-label=['"]Delete['"][\s\S]*handleAgentGroupDeleteClick\(event, group\.id\)[\s\S]*handleAgentGroupDeleteHoldStart\(event, group\.id\)[\s\S]*<DeleteOutlineIcon \/>/);
  assert.doesNotMatch(source, /<Button[\s\S]*>\s*Delete\s*<\/Button>/);
});

test('drawer new-chat actions stay blocked for an empty focused draft while saved groups can reuse it', () => {
  const source = readFileSync(new URL('./ChatDrawer.tsx', import.meta.url), 'utf8');

  assert.match(source, /const disableNewButton = props\.disableNewButton;/);
  assert.match(source, /onConversationNew\(disableNewButton \? false : true, false, agentGroupSnapshot\)/);
  assert.match(source, /<MenuItem disabled=\{disableNewButton\} onClick=\{\(\) => onConversationNew\(newButtonDontRecycle, false\)\}>/);
  assert.match(source, /<MenuItem disabled=\{disableNewButton\} onClick=\{\(\) => onConversationNew\(newButtonDontRecycle, true\)\}>/);
});

test('archived active chat rows expose separate restore and permanent delete actions', () => {
  const source = readFileSync(new URL('./ChatDrawerItem.tsx', import.meta.url), 'utf8');

  assert.match(source, /title='Delete Permanently'/);
  assert.match(source, /<DeleteForeverIcon \/>/);
  assert.match(source, /title='Restore'/);
  assert.match(source, /Auto-delete in \$\{archiveDaysUntilPermanentDelete\} day/);
  assert.match(source, /archiveDaysUntilPermanentDelete\}d/);
});

test('archived chats entry is hidden when there are no archived chats outside the archived filter', () => {
  const source = readFileSync(new URL('./ChatDrawer.tsx', import.meta.url), 'utf8');

  assert.match(source, /\{\(filterIsArchived \|\| archivedChatsCount > 0\) && \(/);
  assert.match(source, /\{filterIsArchived \? 'Back to Chats' : `Archived Chats \(\$\{archivedChatsCount\}\)`\}/);
  assert.doesNotMatch(source, /disabled=\{!filterIsArchived && archivedChatsCount === 0\}/);
});

test('drawer title uses CSS truncation instead of appending manual ellipsis text', () => {
  const source = readFileSync(new URL('./ChatDrawerItem.tsx', import.meta.url), 'utf8');

  assert.match(source, /textOverflow: 'ellipsis'/);
  assert.match(source, /whiteSpace: 'nowrap'/);
  assert.match(source, /\{title\.trim\(\) \? title : CHAT_NOVEL_TITLE\}/);
  assert.doesNotMatch(source, /' \.\.\.'/);
});
