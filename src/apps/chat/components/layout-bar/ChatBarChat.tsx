import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Chip, IconButton, Input, Option, Select, Stack, Typography } from '@mui/joy';

import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { createAssistantConversationParticipant, DConversationParticipant, generateAssistantParticipantName } from '~/common/stores/chat/chat.conversation';
import { isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useVisibleLLMs } from '~/common/stores/llms/llms.hooks';

import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';
import { useFolderDropdown } from './useFolderDropdown';


export function ChatBarChat(props: {
  conversationId: DConversationId | null;
  llmDropdownRef: React.Ref<OptimaBarControlMethods>;
  personaDropdownRef: React.Ref<OptimaBarControlMethods>;
}) {

  // state
  const [participantsAnchorEl, setParticipantsAnchorEl] = React.useState<HTMLElement | null>(null);
  const [draftPersonaId, setDraftPersonaId] = React.useState<SystemPurposeId | ''>('');
  const [draftLlmId, setDraftLlmId] = React.useState<string>('');
  const [expandedParticipantId, setExpandedParticipantId] = React.useState<string | null>(null);
  const [participantDrafts, setParticipantDrafts] = React.useState<Record<string, {
    name: string;
    personaId: SystemPurposeId | null;
    llmId: string | null;
    speakWhen: DConversationParticipant['speakWhen'];
  }>>({});

  // external state
  const { chatLLMDropdown, chatLLMId } = useChatLLMDropdown(props.llmDropdownRef);
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId, props.personaDropdownRef);
  const { folderDropdown } = useFolderDropdown(props.conversationId);
  const { participants, messages, systemPurposeId, setParticipants } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(_c => _c.id === props.conversationId);
    return {
      participants: conversation?.participants ?? [],
      messages: conversation?.messages ?? [],
      systemPurposeId: conversation?.systemPurposeId ?? null,
      setParticipants: state.setParticipants,
    };
  }));
  const { llms: visibleLLMs } = useVisibleLLMs(chatLLMId ?? null, false, true);

  // derived state
  const assistantParticipants = React.useMemo(() => participants.filter(participant => participant.kind === 'assistant'), [participants]);
  const latestUserMessage = React.useMemo(() => [...messages].reverse().find(message => message.role === 'user') ?? null, [messages]);
  const latestUserMessageIndex = React.useMemo(() => {
    if (!latestUserMessage)
      return -1;
    return messages.findIndex(message => message.id === latestUserMessage.id);
  }, [latestUserMessage, messages]);
  const assistantMessagesSinceLatestUser = React.useMemo(() => {
    const messagesAfterLatestUser = latestUserMessageIndex >= 0 ? messages.slice(latestUserMessageIndex + 1) : [];
    return messagesAfterLatestUser.filter(message => message.role === 'assistant' && !!message.metadata?.author?.participantId);
  }, [latestUserMessageIndex, messages]);
  const latestAssistantMessage = React.useMemo(() => assistantMessagesSinceLatestUser.at(-1) ?? null, [assistantMessagesSinceLatestUser]);
  const participantMentionPattern = React.useCallback((participantName: string) => {
    const escapedName = participantName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\w])@${escapedName}(?=$|[^\\w])`, 'i');
  }, []);
  const wasParticipantMentionedInLatestUserTurn = React.useCallback((participant: DConversationParticipant) => {
    const participantName = participant.name?.trim() ?? '';
    const mentionRegex = participantName ? participantMentionPattern(participantName) : null;
    return !!(latestUserMessage && mentionRegex && latestUserMessage.fragments.some(fragment =>
      isTextContentFragment(fragment) && mentionRegex.test(fragment.part.text),
    ));
  }, [latestUserMessage, participantMentionPattern]);
  const runnableParticipantIds = React.useMemo(() => assistantParticipants
    .filter(participant => participant.speakWhen !== 'when-mentioned' || wasParticipantMentionedInLatestUserTurn(participant))
    .map(participant => participant.id), [assistantParticipants, wasParticipantMentionedInLatestUserTurn]);
  const spokenThisTurnParticipantIds = React.useMemo(() => new Set(assistantMessagesSinceLatestUser
    .map(message => message.metadata?.author?.participantId)
    .filter((participantId): participantId is string => !!participantId)), [assistantMessagesSinceLatestUser]);
  const nextToSpeakParticipantId = React.useMemo(() => runnableParticipantIds.find(participantId => !spokenThisTurnParticipantIds.has(participantId)) ?? null,
    [runnableParticipantIds, spokenThisTurnParticipantIds]);
  const participantStatusById = React.useMemo(() => new Map(assistantParticipants.map(participant => {
    const participantName = participant.name?.trim() ?? '';
    const mentionRegex = participantName ? participantMentionPattern(participantName) : null;
    const wasMentioned = !!(latestUserMessage && mentionRegex && latestUserMessage.fragments.some(fragment =>
      isTextContentFragment(fragment) && mentionRegex.test(fragment.part.text),
    ));
    const willSpeak = participant.speakWhen !== 'when-mentioned' || wasMentioned;
    const spokeThisTurn = spokenThisTurnParticipantIds.has(participant.id);
    const spokeLast = latestAssistantMessage?.metadata?.author?.participantId === participant.id;
    const isNextToSpeak = nextToSpeakParticipantId === participant.id;
    const reason = isNextToSpeak
      ? 'Next to speak'
      : willSpeak
        ? (spokeThisTurn ? 'Already spoke this turn' : (participant.speakWhen === 'when-mentioned' ? 'Will speak this turn because it was @mentioned' : 'Will speak every turn'))
        : 'Waiting for an @mention';
    return [participant.id, { wasMentioned, willSpeak, spokeThisTurn, spokeLast, isNextToSpeak, reason }];
  })), [assistantParticipants, latestAssistantMessage, latestUserMessage, nextToSpeakParticipantId, participantMentionPattern, spokenThisTurnParticipantIds]);
  const participantPersonaOptions = React.useMemo(() => Object.entries(SystemPurposes) as [SystemPurposeId, (typeof SystemPurposes)[SystemPurposeId]][], []);
  const selectedParticipantLlm = React.useMemo(() => visibleLLMs.find(llm => llm.id === draftLlmId) ?? null, [draftLlmId, visibleLLMs]);
  const canManageParticipants = !!props.conversationId;
  const canRemoveAssistant = assistantParticipants.length > 1;

  React.useEffect(() => {
    if (!participantsAnchorEl) {
      setDraftPersonaId(systemPurposeId ?? '');
      setDraftLlmId('');
      setExpandedParticipantId(null);
      setParticipantDrafts({});
    }
  }, [participantsAnchorEl, systemPurposeId]);

  const handleParticipantsToggle = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!canManageParticipants)
      return;
    setParticipantsAnchorEl(current => current ? null : event.currentTarget);
  }, [canManageParticipants]);

  const handleParticipantRemove = React.useCallback((participantId: string) => {
    if (!props.conversationId || !canRemoveAssistant)
      return;

    setParticipants(props.conversationId, participants.filter(participant => participant.id !== participantId));
  }, [canRemoveAssistant, participants, props.conversationId, setParticipants]);

  const handleParticipantUpdate = React.useCallback((participantId: string, update: Partial<DConversationParticipant>) => {
    if (!props.conversationId)
      return;

    setParticipants(props.conversationId, participants.map(participant =>
      participant.id === participantId ? { ...participant, ...update } : participant,
    ));
  }, [participants, props.conversationId, setParticipants]);

  const handleParticipantDraftChange = React.useCallback((participantId: string, update: Partial<{
    name: string;
    personaId: SystemPurposeId | null;
    llmId: string | null;
    speakWhen: DConversationParticipant['speakWhen'];
  }>) => {
    const participant = participants.find(participant => participant.id === participantId);
    if (!participant)
      return;

    setParticipantDrafts(current => ({
      ...current,
      [participantId]: {
        name: current[participantId]?.name ?? participant.name,
        personaId: current[participantId]?.personaId ?? participant.personaId ?? null,
        llmId: current[participantId]?.llmId ?? participant.llmId ?? null,
        speakWhen: current[participantId]?.speakWhen ?? participant.speakWhen ?? 'every-turn',
        ...update,
      },
    }));
  }, [participants]);

  const handleParticipantDraftCommit = React.useCallback((participantId: string) => {
    const participant = participants.find(participant => participant.id === participantId);
    const draft = participantDrafts[participantId];
    if (!participant || !draft)
      return;

    const nextName = draft.name.trim() || participant.name;
    const hasChanges = nextName !== participant.name
      || (draft.personaId ?? null) !== (participant.personaId ?? null)
      || (draft.llmId ?? null) !== (participant.llmId ?? null)
      || (draft.speakWhen ?? 'every-turn') !== (participant.speakWhen ?? 'every-turn');

    if (hasChanges)
      handleParticipantUpdate(participantId, {
        name: nextName,
        personaId: draft.personaId ?? null,
        llmId: draft.llmId ?? null,
        speakWhen: draft.speakWhen ?? 'every-turn',
      });

    setParticipantDrafts(current => {
      const { [participantId]: _removed, ...rest } = current;
      return rest;
    });
  }, [handleParticipantUpdate, participantDrafts, participants]);

  const handleExpandedParticipantChange = React.useCallback((participantId: string) => {
    if (expandedParticipantId === participantId) {
      handleParticipantDraftCommit(participantId);
      setExpandedParticipantId(null);
      return;
    }

    if (expandedParticipantId)
      handleParticipantDraftCommit(expandedParticipantId);

    setExpandedParticipantId(participantId);
  }, [expandedParticipantId, handleParticipantDraftCommit]);

  const handleParticipantsClose = React.useCallback(() => {
    Object.keys(participantDrafts).forEach(participantId => handleParticipantDraftCommit(participantId));
    setParticipantsAnchorEl(null);
    setExpandedParticipantId(null);
  }, [handleParticipantDraftCommit, participantDrafts]);

  const handleParticipantMove = React.useCallback((participantId: string, direction: -1 | 1) => {
    if (!props.conversationId)
      return;

    const humanParticipants = participants.filter(participant => participant.kind === 'human');
    const assistantParticipants = participants.filter(participant => participant.kind === 'assistant');
    const index = assistantParticipants.findIndex(participant => participant.id === participantId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= assistantParticipants.length)
      return;

    const reorderedAssistants = [...assistantParticipants];
    const [movedParticipant] = reorderedAssistants.splice(index, 1);
    reorderedAssistants.splice(nextIndex, 0, movedParticipant);
    setParticipants(props.conversationId, [...humanParticipants, ...reorderedAssistants]);
  }, [participants, props.conversationId, setParticipants]);

  const handleParticipantAdd = React.useCallback(() => {
    if (!props.conversationId || !draftPersonaId)
      return;

    const nextParticipant = createAssistantConversationParticipant(
      draftPersonaId,
      draftLlmId || null,
      generateAssistantParticipantName(draftPersonaId, assistantParticipants.map(participant => participant.name)),
    );

    setParticipants(props.conversationId, [...participants, nextParticipant]);
    setDraftLlmId('');
    setExpandedParticipantId(nextParticipant.id);
  }, [assistantParticipants, draftLlmId, draftPersonaId, participants, props.conversationId, setParticipants]);

  return <>

    {/* Persona selector */}
    {personaDropdown}

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Participants */}
    <Button
      color='neutral'
      disabled={!canManageParticipants}
      onClick={handleParticipantsToggle}
      size='sm'
      startDecorator={<SmartToyOutlinedIcon />}
      variant={participantsAnchorEl ? 'solid' : 'soft'}
    >
      Agents {assistantParticipants.length > 1 ? assistantParticipants.length : ''}
    </Button>
    <CloseablePopup
      anchorEl={participantsAnchorEl}
      onClose={handleParticipantsClose}
      noAutoFocus
      placement='bottom-start'
      maxWidth={420}
      minWidth={320}
      sx={{ p: 1.25, display: 'grid', gap: 1.25 }}
    >
      <Stack direction='row' spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack spacing={0.25}>
          <Typography level='title-sm'>Agents</Typography>
          <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
            {assistantParticipants.length} configured · ordered top to bottom
          </Typography>
        </Stack>
      </Stack>

      <Stack spacing={0.75}>
        {assistantParticipants.map((participant, index) => {
          const personaTitle = participant.personaId ? SystemPurposes[participant.personaId]?.title ?? participant.personaId : 'No persona';
          const llmLabel = participant.llmId ? (visibleLLMs.find(llm => llm.id === participant.llmId)?.label ?? participant.llmId) : 'Chat model';
          const participantStatus = participantStatusById.get(participant.id);
          const isExpanded = expandedParticipantId === participant.id;
          const summaryLabel = participant.speakWhen === 'when-mentioned' ? 'On mention' : 'Every turn';
          const participantDraft = participantDrafts[participant.id];
          const aliasDraft = participantDraft?.name ?? participant.name;
          const personaDraftValue = participantDraft?.personaId ?? participant.personaId ?? null;
          const llmDraftValue = participantDraft?.llmId ?? participant.llmId ?? '';
          const speakWhenDraftValue = participantDraft?.speakWhen ?? participant.speakWhen ?? 'every-turn';
          return (
            <Box
              key={participant.id}
              sx={{
                display: 'grid',
                gap: 0.75,
                px: 1,
                py: 1,
                borderRadius: 'lg',
                border: '1px solid',
                borderColor: isExpanded ? 'primary.outlinedBorder' : 'divider',
                backgroundColor: isExpanded ? 'background.level1' : 'background.body',
                boxShadow: isExpanded ? 'sm' : 'xs',
              }}
            >
              <Box
                onClick={() => handleExpandedParticipantChange(participant.id)}
                sx={{ cursor: 'pointer' }}
              >
                <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip
                    size='sm'
                    variant={isExpanded ? 'solid' : 'soft'}
                    color={isExpanded ? 'primary' : 'neutral'}
                    sx={{ minWidth: 36, justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {index + 1}
                  </Chip>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction='row' spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography level='title-sm'>{participant.name}</Typography>
                      <Chip size='sm' variant='soft' color={participantStatus?.isNextToSpeak ? 'primary' : participantStatus?.spokeThisTurn ? 'success' : 'neutral'}>
                        {participantStatus?.isNextToSpeak ? 'Next' : participantStatus?.spokeThisTurn ? 'Done' : summaryLabel}
                      </Chip>
                      {participantStatus?.spokeLast && <Chip size='sm' variant='soft'>Latest</Chip>}
                      {participantStatus?.wasMentioned && <Chip size='sm' variant='soft' color='primary'>@mentioned</Chip>}
                    </Stack>
                    <Typography level='body-xs' sx={{ color: 'text.tertiary', mt: 0.35 }}>
                      {personaTitle} · {llmLabel}
                    </Typography>
                    <Typography level='body-xs' sx={{ color: participantStatus?.isNextToSpeak ? 'primary.600' : 'text.tertiary', mt: 0.2 }}>
                      {participantStatus?.reason ?? 'Ready'}
                    </Typography>
                  </Box>

                  <Button
                    size='sm'
                    variant={isExpanded ? 'soft' : 'plain'}
                    color='neutral'
                    onClick={(event) => {
                      event.stopPropagation();
                      handleExpandedParticipantChange(participant.id);
                    }}
                  >
                    {isExpanded ? 'Close' : 'Edit'}
                  </Button>
                </Stack>
              </Box>

              {isExpanded && (
                <Box sx={{ display: 'grid', gap: 0.9, pt: 0.5, pl: { xs: 0, sm: 5.5 }, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Input
                    size='sm'
                    value={aliasDraft}
                    onChange={(event) => handleParticipantDraftChange(participant.id, { name: event.target.value })}
                    onBlur={() => handleParticipantDraftCommit(participant.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleParticipantDraftCommit(participant.id);
                      }
                    }}
                    placeholder='Agent alias'
                  />
                  <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', sm: 'minmax(8rem, 1fr) minmax(9rem, 1fr) minmax(8rem, 1fr)' } }}>
                    <Select
                      size='sm'
                      value={personaDraftValue}
                      onChange={(_event, value) => handleParticipantDraftChange(participant.id, { personaId: (value as SystemPurposeId | null) ?? null })}
                    >
                      {participantPersonaOptions.map(([personaId, persona]) => (
                        <Option key={personaId} value={personaId}>{persona.title}</Option>
                      ))}
                    </Select>

                    <Select
                      size='sm'
                      value={llmDraftValue}
                      onChange={(_event, value) => handleParticipantDraftChange(participant.id, { llmId: ((value as string | null) || null) })}
                    >
                      <Option value={''}>Current chat model</Option>
                      {visibleLLMs.map(llm => (
                        <Option key={llm.id} value={llm.id}>{llm.label}</Option>
                      ))}
                    </Select>

                    <Select
                      size='sm'
                      value={speakWhenDraftValue}
                      onChange={(_event, value) => handleParticipantDraftChange(participant.id, { speakWhen: ((value as DConversationParticipant['speakWhen'] | null) ?? 'every-turn') })}
                    >
                      <Option value='every-turn'>Every turn</Option>
                      <Option value='when-mentioned'>Only @mentioned</Option>
                    </Select>
                  </Box>

                  <Stack direction='row' spacing={0.5} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Stack direction='row' spacing={0.25}>
                      <IconButton size='sm' variant='plain' disabled={index === 0} onClick={() => handleParticipantMove(participant.id, -1)}>
                        <ArrowUpwardIcon />
                      </IconButton>
                      <IconButton size='sm' variant='plain' disabled={index === assistantParticipants.length - 1} onClick={() => handleParticipantMove(participant.id, 1)}>
                        <ArrowDownwardIcon />
                      </IconButton>
                    </Stack>
                    <Button
                      size='sm'
                      color='danger'
                      disabled={!canRemoveAssistant}
                      onClick={() => handleParticipantRemove(participant.id)}
                      startDecorator={<CloseIcon />}
                      variant='plain'
                    >
                      Remove
                    </Button>
                  </Stack>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ display: 'grid', gap: 0.75, p: 1, borderRadius: 'lg', border: '1px dashed', borderColor: 'divider', backgroundColor: 'background.level1' }}>
        <Typography level='body-sm'>Add another agent</Typography>
        <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', sm: 'minmax(10rem, 1fr) minmax(10rem, 1fr) auto' } }}>
          <Select
            placeholder='Persona'
            value={draftPersonaId || null}
            onChange={(_event, value) => setDraftPersonaId((value as SystemPurposeId | null) ?? '')}
            size='sm'
          >
            {participantPersonaOptions.map(([personaId, persona]) => (
              <Option key={personaId} value={personaId}>{persona.title}</Option>
            ))}
          </Select>

          <Select
            placeholder='Model (optional)'
            value={draftLlmId || null}
            onChange={(_event, value) => setDraftLlmId((value as string | null) ?? '')}
            size='sm'
          >
            <Option value={''}>Current chat model</Option>
            {visibleLLMs.map(llm => (
              <Option key={llm.id} value={llm.id}>{llm.label}</Option>
            ))}
          </Select>

          <Button size='sm' onClick={handleParticipantAdd} disabled={!draftPersonaId} startDecorator={<SmartToyOutlinedIcon />}>
            Add
          </Button>
        </Box>
        <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
          {selectedParticipantLlm ? `New agent uses ${selectedParticipantLlm.label}.` : 'New agent uses the current chat model.'}
        </Typography>
      </Box>
    </CloseablePopup>

    {/* Folder selector */}
    {folderDropdown}

  </>;
}
