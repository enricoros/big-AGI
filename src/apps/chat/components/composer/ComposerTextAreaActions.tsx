import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Alert, Box, Button, CircularProgress, Sheet } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import { proposeActionsForAttachments } from '~/modules/aifn/autoprompts/autoprompts';

import type { AttachmentDraft } from '~/common/attachment-drafts/attachment.types';
import { useShallowStable } from '~/common/util/hooks/useShallowObject';

import { ReplyToBubble } from '../message/ReplyToBubble';
import { getChatAutoAI } from '../../store-app-chat';


export function ComposerTextAreaActions(props: {
  attachmentDrafts: AttachmentDraft[],
  showChatReplyTo: boolean,
  replyToGenerateText: string | null,
  onAppendAndSend: (appendText: string) => Promise<void>,
  onReplyToClear: () => void,
}) {

  // external state
  const { autoSuggestAttachmentPrompts } = getChatAutoAI();

  const allFragments = useShallowStable(props.attachmentDrafts.flatMap(draft => draft.outputFragments));

  const enableAttachmentGuess = autoSuggestAttachmentPrompts && allFragments.length >= 2;

  const { data: attachmentInstructionCandidates, error, isPending, isFetching, refetch } = useQuery({
    enabled: enableAttachmentGuess,
    queryKey: ['attachment-guess', ...allFragments.map(f => f.fId).sort()],
    queryFn: async (context) => proposeActionsForAttachments(allFragments, context.signal),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleUpdateAttachmentGuess = React.useCallback(async () => await refetch(), [refetch]);


  if (!props.showChatReplyTo && !enableAttachmentGuess)
    return null;

  return (

    <Box sx={{
      flex: 1,
      // marginBottom: 0.5,
      // margin: 1,
      // marginTop: 0,

      // layout
      display: 'grid',
      justifyItems: 'start',
      gap: 1,

      // Buttons
      [`& button`]: {
        '--Button-gap': '1.2rem',
        transition: 'background-color 0.2s, color 0.2s',
        // minWidth: 160,
      },
    }}>

      {/* Reply-To bubble */}
      {props.showChatReplyTo && (
        <ReplyToBubble
          replyToText={props.replyToGenerateText}
          onClear={props.onReplyToClear}
          className='reply-to-bubble'
        />
      )}

      {/* User Prompt candidates */}
      {enableAttachmentGuess && !!attachmentInstructionCandidates?.length && (
        attachmentInstructionCandidates.map((candidate, index) => (
          <Sheet
            key={index}
            color='primary'
            variant='soft'
            onClick={() => props.onAppendAndSend(candidate)}
            sx={{
              placeSelf: 'end',
              // width: '100%',
              backgroundColor: 'background.surface',
              border: '1px solid',
              borderColor: 'primary.outlinedBorder',
              borderRadius: '2rem',
              borderTopRightRadius: 0,
              px: 1.5,
              py: 0.5,
              fontSize: 'sm',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'primary.solidBg',
                color: 'primary.solidColor',
              },
            }}
          >
            {candidate}
          </Sheet>
        ))
      )}

      {/* Guess Action Button */}

      {enableAttachmentGuess && <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>

        {/* Guess / Guess Again */}
        <Button
          variant='outlined'
          color='primary'
          disabled={isFetching}
          endDecorator={isFetching ? <CircularProgress color='neutral' sx={{ '--CircularProgress-size': '16px' }} /> : <AutoFixHighIcon sx={{ fontSize: '20px' }} />}
          onClick={handleUpdateAttachmentGuess}
          sx={{
            px: 3,
            backgroundColor: 'background.surface',
            boxShadow: '0 4px 6px -4px rgb(var(--joy-palette-primary-darkChannel) / 40%)',
            borderRadius: 'sm',
          }}
        >
          {isFetching ? 'Guessing what to do...' : isPending ? 'Guess what to do' : 'What else could we do'}
        </Button>

        {!!error && <Alert variant='soft' color='danger'>
          {error.message || 'Error guessing actions'}
        </Alert>}

      </Box>}

    </Box>
  );
}
