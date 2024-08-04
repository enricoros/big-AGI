import * as React from 'react';

import { Box, Sheet } from '@mui/joy';

import type { DMetaReferenceItem } from '~/common/stores/chat/chat.message';

import { InReferenceToBubble } from '../message/InReferenceToBubble';


export function ComposerTextAreaActions(props: {
  agiAttachmentButton?: React.ReactNode,
  agiAttachmentPrompts?: string[],
  inReferenceTo?: DMetaReferenceItem[] | null
  onAppendAndSend: (appendText: string) => Promise<void>,
  onRemoveReferenceTo: (item: DMetaReferenceItem) => void,
}) {

  // skip the component if there's nothing to show
  if (!props.agiAttachmentPrompts?.length && !props.agiAttachmentButton && !props.inReferenceTo?.length)
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

      {/* In-Reference-To bubbles */}
      {props.inReferenceTo?.map((item, index) => (
        <InReferenceToBubble
          key={index}
          item={item}
          onRemove={props.onRemoveReferenceTo}
          className='in-reference-to-bubble'
        />
      ))}

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
