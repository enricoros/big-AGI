import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ChatBarChatSettingsPanel, TURN_TERMINATION_MODE_OPTIONS } from './ChatBarChat.settings';


test('settings panel shows the council max rounds control only in council mode', () => {
  const source = readFileSync(new URL('./ChatBarChat.settings.tsx', import.meta.url), 'utf8');
  for (const mode of Object.values(TURN_TERMINATION_MODE_OPTIONS)) {
    assert.match(source, new RegExp(mode.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(source, new RegExp(mode.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const councilMarkup = renderToStaticMarkup(
    <ChatBarChatSettingsPanel
      agentGroupNameDraft='Agents 2'
      onAgentGroupNameDraftChange={() => undefined}
      turnTerminationMode='council'
      onTurnTerminationModeChange={() => undefined}
      councilMaxRoundsDraft=''
      onCouncilMaxRoundsDraftChange={() => undefined}
      onCouncilMaxRoundsCommit={() => undefined}
      councilTraceAutoCollapsePreviousRounds
      onCouncilTraceAutoCollapsePreviousRoundsChange={() => undefined}
      councilTraceAutoExpandNewestRound
      onCouncilTraceAutoExpandNewestRoundChange={() => undefined}
      canBulkSetSpeakWhen
      canSetAllParticipantsEveryTurn
      canSetAllParticipantsOnlyMention
      onSetAllParticipantsEveryTurn={() => undefined}
      onSetAllParticipantsOnlyMention={() => undefined}
    />,
  );
  assert.match(councilMarkup, /Council max rounds/);
  assert.match(councilMarkup, /placeholder="Unlimited"/);
  assert.match(councilMarkup, /value=""/);
  assert.match(councilMarkup, /Leave blank for unlimited\./);
  assert.match(councilMarkup, /Auto-collapse previous rounds/);
  assert.match(councilMarkup, /Auto-expand newest round/);
  assert.match(councilMarkup, /Triggered agents must agree before one shared reply is shown\./);
  assert.match(councilMarkup, /Set all to every turn/);
  assert.match(councilMarkup, /Set all to only mention/);

  const roundRobinMarkup = renderToStaticMarkup(
    <ChatBarChatSettingsPanel
      agentGroupNameDraft='Agents 2'
      onAgentGroupNameDraftChange={() => undefined}
      turnTerminationMode='round-robin-per-human'
      onTurnTerminationModeChange={() => undefined}
      councilMaxRoundsDraft='7'
      onCouncilMaxRoundsDraftChange={() => undefined}
      onCouncilMaxRoundsCommit={() => undefined}
      councilTraceAutoCollapsePreviousRounds
      onCouncilTraceAutoCollapsePreviousRoundsChange={() => undefined}
      councilTraceAutoExpandNewestRound
      onCouncilTraceAutoExpandNewestRoundChange={() => undefined}
      canBulkSetSpeakWhen
      canSetAllParticipantsEveryTurn
      canSetAllParticipantsOnlyMention
      onSetAllParticipantsEveryTurn={() => undefined}
      onSetAllParticipantsOnlyMention={() => undefined}
    />,
  );
  assert.doesNotMatch(roundRobinMarkup, /Council max rounds/);
  assert.match(roundRobinMarkup, /One human message starts one agent pass, and @mentions can continue it\./);
  assert.match(roundRobinMarkup, /Set all to every turn/);
  assert.match(roundRobinMarkup, /Set all to only mention/);
});

test('settings panel shows bulk speak controls for every turn termination mode when assistants are editable', () => {
  const continuousMarkup = renderToStaticMarkup(
    <ChatBarChatSettingsPanel
      agentGroupNameDraft='Agents 2'
      onAgentGroupNameDraftChange={() => undefined}
      turnTerminationMode='continuous'
      onTurnTerminationModeChange={() => undefined}
      councilMaxRoundsDraft='7'
      onCouncilMaxRoundsDraftChange={() => undefined}
      onCouncilMaxRoundsCommit={() => undefined}
      councilTraceAutoCollapsePreviousRounds
      onCouncilTraceAutoCollapsePreviousRoundsChange={() => undefined}
      councilTraceAutoExpandNewestRound
      onCouncilTraceAutoExpandNewestRoundChange={() => undefined}
      canBulkSetSpeakWhen
      canSetAllParticipantsEveryTurn
      canSetAllParticipantsOnlyMention={false}
      onSetAllParticipantsEveryTurn={() => undefined}
      onSetAllParticipantsOnlyMention={() => undefined}
    />,
  );

  assert.match(continuousMarkup, /Agents keep taking turns until you stop the room\./);
  assert.match(continuousMarkup, /Set all to every turn/);
  assert.match(continuousMarkup, /Set all to only mention/);
});
