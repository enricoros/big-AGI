import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getParticipantEditorGridTemplateColumns,
  getParticipantEditorSpeakWhenGridColumn,
  getParticipantRosterGridTemplateColumns,
} from './ChatBarChat.layout';

test('expanded participant roster collapses to a single desktop column', () => {
  assert.deepStrictEqual(getParticipantRosterGridTemplateColumns(true), {
    xs: '1fr',
    md: '1fr',
  });
});

test('expanded participant editor avoids a 3-column control row in the popup', () => {
  assert.deepStrictEqual(getParticipantEditorGridTemplateColumns(), {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
  });
});

test('speak-when selector spans the full editor row once the editor splits into columns', () => {
  assert.deepStrictEqual(getParticipantEditorSpeakWhenGridColumn(), {
    xs: 'auto',
    sm: '1 / -1',
  });
});
