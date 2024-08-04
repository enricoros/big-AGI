import * as React from 'react';

import { Box, Sheet } from '@mui/joy';

import { ReplyToBubble } from '../message/ReplyToBubble';


export function ComposerTextAreaActions(props: {
  agiAttachmentButton?: React.ReactNode,
  agiAttachmentPrompts?: string[],
  replyToText?: string,
  onAppendAndSend: (appendText: string) => Promise<void>,
  onReplyToClear: () => void,
}) {

  // skip the component if there's nothing to show
  if (!props.agiAttachmentPrompts?.length && !props.agiAttachmentButton && props.replyToText === undefined)
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
      {props.replyToText !== undefined && (
        <ReplyToBubble
          replyToText={props.replyToText}
          onClear={props.onReplyToClear}
          className='reply-to-bubble'
        />
      )}

      {/* Auto-Prompts from attachments */}
      {!!props.agiAttachmentPrompts?.length && (
        props.agiAttachmentPrompts.map((candidate, index) => (
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
      {props.agiAttachmentButton}

    </Box>
  );
}
