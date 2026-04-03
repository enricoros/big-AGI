import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAutoDisarmDeleteArm } from './ChatDrawerItem.delete';

test('inactive chats can stay armed while waiting for delete confirmation', () => {
  assert.equal(shouldAutoDisarmDeleteArm({
    deleteArmed: true,
    isActive: false,
    wasActive: false,
  }), false);
});

test('active chats disarm when they become inactive', () => {
  assert.equal(shouldAutoDisarmDeleteArm({
    deleteArmed: true,
    isActive: false,
    wasActive: true,
  }), true);
});
