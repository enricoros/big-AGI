import * as React from 'react';

import { Box, Button, Input, Option, Select, Stack, Typography } from '@mui/joy';

import type { DConversationTurnTerminationMode, DConversationTurnsOrder } from '~/common/stores/chat/chat.conversation';

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

export const TURNS_ORDER_OPTIONS: Record<DConversationTurnsOrder, {
  title: string;
  description: string;
}> = {
  custom: {
    title: 'Custom order',
    description: 'Use the roster order you set manually.',
  },
  random: {
    title: 'Random order',
    description: 'Shuffle the roster each turn and show agents in that shuffled order.',
  },
};

export function ChatBarChatSettingsPanel(props: {
  agentGroupNameDraft: string;
  onAgentGroupNameDraftChange: (value: string) => void;
  turnTerminationMode: DConversationTurnTerminationMode;
  onTurnTerminationModeChange: (_event: React.SyntheticEvent | null, value: string | null) => void;
  turnsOrder: DConversationTurnsOrder;
  onTurnsOrderChange: (_event: React.SyntheticEvent | null, value: string | null) => void;
  councilMaxRoundsDraft: string;
  onCouncilMaxRoundsDraftChange: (value: string) => void;
  onCouncilMaxRoundsCommit: () => void;
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

      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Typography level='body-sm'>Turns order</Typography>
        <Select
          size='sm'
          value={props.turnsOrder}
          onChange={props.onTurnsOrderChange}
          renderValue={(option) => option ? TURNS_ORDER_OPTIONS[option.value as DConversationTurnsOrder].title : ''}
        >
          {(Object.entries(TURNS_ORDER_OPTIONS) as [DConversationTurnsOrder, (typeof TURNS_ORDER_OPTIONS)[DConversationTurnsOrder]][]).map(([value, mode]) => (
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
          {TURNS_ORDER_OPTIONS[props.turnsOrder].description}
        </Typography>
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
        </Stack>
      )}
    </>
  );
}
