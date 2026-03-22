import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('saved agent groups use an inline delete icon in the drawer menu', () => {
  const source = readFileSync(new URL('./ChatDrawer.tsx', import.meta.url), 'utf8');

  assert.match(source, /import DeleteOutlineIcon from '@mui\/icons-material\/DeleteOutline';/);
  assert.match(source, /'aria-label': 'Load saved agent group'/);
  assert.match(source, /<IconButton[\s\S]*aria-label=['"]Delete['"][\s\S]*handleAgentGroupDelete\(group\.id\)[\s\S]*<DeleteOutlineIcon \/>/);
  assert.doesNotMatch(source, /<Button[\s\S]*>\s*Delete\s*<\/Button>/);
});

test('drawer new-chat actions stay blocked for an empty focused draft while saved groups can reuse it', () => {
  const source = readFileSync(new URL('./ChatDrawer.tsx', import.meta.url), 'utf8');

  assert.match(source, /const disableNewButton = props\.disableNewButton;/);
  assert.match(source, /onConversationNew\(disableNewButton \? false : true, false, agentGroupSnapshot\)/);
  assert.match(source, /<MenuItem disabled=\{disableNewButton\} onClick=\{\(\) => onConversationNew\(newButtonDontRecycle, false\)\}>/);
  assert.match(source, /<MenuItem disabled=\{disableNewButton\} onClick=\{\(\) => onConversationNew\(newButtonDontRecycle, true\)\}>/);
});
