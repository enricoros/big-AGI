import * as React from 'react';

import { Box, Button, Checkbox, Input, Option, Select, Stack, Typography } from '@mui/joy';

import type { DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';

export const TURN_TERMINATION_MODE_OPTIONS: Record<DConversationTurnTerminationMode, {
  title: string;
  description: string;
}> = {
  'round-robin-per-human': {
    title: 'Human-driven',
    description: 'One human message starts one agent pass, and @mentions can continue it.',
  },
  continuous: {
    title: 'Agents loop',
    description: 'Agents keep taking turns until you stop the room.',
  },
  council: {
    title: 'Council',
    description: 'Triggered agents must agree before one shared reply is shown.',
  },
};

export function ChatBarChatSettingsPanel(props: {
  agentGroupNameDraft: string;
  onAgentGroupNameDraftChange: (value: string) => void;
  turnTerminationMode: DConversationTurnTerminationMode;
  onTurnTerminationModeChange: (_event: React.SyntheticEvent | null, value: string | null) => void;
  councilMaxRoundsDraft: string;
  onCouncilMaxRoundsDraftChange: (value: string) => void;
  onCouncilMaxRoundsCommit: () => void;
  councilTraceAutoCollapsePreviousRounds: boolean;
  onCouncilTraceAutoCollapsePreviousRoundsChange: (value: boolean) => void;
  councilTraceAutoExpandNewestRound: boolean;
  onCouncilTraceAutoExpandNewestRoundChange: (value: boolean) => void;
  canBulkSetSpeakWhen: boolean;
  canSetAllParticipantsEveryTurn: boolean;
  canSetAllParticipantsOnlyMention: boolean;
  onSetAllParticipantsEveryTurn: () => void;
  onSetAllParticipantsOnlyMention: () => void;
}) {
  return (
    <>
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Typography level='body-sm'>Group name</Typography>
        <Input
          size='sm'
          value={props.agentGroupNameDraft}
          onChange={event => props.onAgentGroupNameDraftChange(event.target.value)}
          placeholder='Agents 1'
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Typography level='body-sm'>Turn termination</Typography>
        <Select
          size='sm'
          value={props.turnTerminationMode}
          onChange={props.onTurnTerminationModeChange}
          renderValue={(option) => option ? TURN_TERMINATION_MODE_OPTIONS[option.value as DConversationTurnTerminationMode].title : ''}
        >
          {(Object.entries(TURN_TERMINATION_MODE_OPTIONS) as [DConversationTurnTerminationMode, (typeof TURN_TERMINATION_MODE_OPTIONS)[DConversationTurnTerminationMode]][]).map(([value, mode]) => (
            <Option key={value} value={value}>
              <Box sx={{ display: 'grid', gap: 0.25 }}>
                <Typography level='body-sm'>{mode.title}</Typography>
                <Typography level='body-xs' sx={{ color: 'text.tertiary', whiteSpace: 'normal' }}>
                  {mode.description}
                </Typography>
              </Box>
            </Option>
          ))}
        </Select>
        <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
          {TURN_TERMINATION_MODE_OPTIONS[props.turnTerminationMode].description}
        </Typography>
        {props.canBulkSetSpeakWhen && (
          <Stack direction='row' spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', pt: 0.25 }}>
            <Button
              color='neutral'
              disabled={!props.canSetAllParticipantsOnlyMention}
              onClick={props.onSetAllParticipantsOnlyMention}
              size='sm'
              variant='soft'
            >
              Set all to only mention
            </Button>
            <Button
              color='neutral'
              disabled={!props.canSetAllParticipantsEveryTurn}
              onClick={props.onSetAllParticipantsEveryTurn}
              size='sm'
              variant='soft'
            >
              Set all to every turn
            </Button>
          </Stack>
        )}
      </Box>

      {props.turnTerminationMode === 'council' && (
        <Stack spacing={1}>
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            <Typography level='body-sm'>Council max rounds</Typography>
            <Input
              size='sm'
              type='number'
              value={props.councilMaxRoundsDraft}
              onChange={event => props.onCouncilMaxRoundsDraftChange(event.target.value)}
              onBlur={props.onCouncilMaxRoundsCommit}
              placeholder='Unlimited'
              slotProps={{ input: { min: 1, max: 99, step: 1 } }}
            />
            <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
              Leave blank for unlimited. Otherwise stop the council after this many proposal/review rounds if the reviewers still do not agree.
            </Typography>
          </Box>

          <Checkbox
            checked={props.councilTraceAutoCollapsePreviousRounds}
            label='Auto-collapse previous rounds'
            onChange={event => props.onCouncilTraceAutoCollapsePreviousRoundsChange(event.target.checked)}
            size='sm'
            sx={{ alignSelf: 'flex-start' }}
          />
          <Typography level='body-xs' sx={{ color: 'text.tertiary', mt: -0.5 }}>
            Collapse older rounds automatically when a newer round appears.
          </Typography>

          <Checkbox
            checked={props.councilTraceAutoExpandNewestRound}
            label='Auto-expand newest round'
            onChange={event => props.onCouncilTraceAutoExpandNewestRoundChange(event.target.checked)}
            size='sm'
            sx={{ alignSelf: 'flex-start' }}
          />
          <Typography level='body-xs' sx={{ color: 'text.tertiary', mt: -0.5 }}>
            Expand the latest round automatically as the trace advances.
          </Typography>
        </Stack>
      )}
    </>
  );
}
