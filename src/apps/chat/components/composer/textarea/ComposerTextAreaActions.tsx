import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp } from '@mui/joy';

import type { AgiAttachmentPromptsData } from '~/modules/aifn/agiattachmentprompts/useAgiAttachmentPrompts';

import type { AttachmentInputEnhancer } from '~/common/attachment-drafts/attachment.enhancers';
import type { DComposerPendingPart } from '~/common/chat-overlay/store-perchat-composer_slice';
import type { DMetaReferenceItem } from '~/common/stores/chat/chat.message';

import { InReferenceToBubble } from '../../message/in-reference-to/InReferenceToBubble';


// configuration
export const AGI_SUGGESTIONS_COLOR: ColorPaletteProp = 'success';

// Styles

export const composerTextAreaSx: SxProps = {
  flex: 1,

  // layout
  display: 'grid',
  justifyItems: 'start',
  gap: 0.5,
  mb: 0.625,

  // Buttons
  [`& button`]: {
    '--Button-gap': '1.2rem',
    transition: 'background-color 0.2s, color 0.2s',
    // minWidth: 160,
  } as const,
} as const;


const promptButtonSx: SxProps = {
  minHeight: '2rem',
  placeSelf: 'start',

  color: `${AGI_SUGGESTIONS_COLOR}.softActiveColor`,
  backgroundColor: 'background.surface',
  border: '1px solid',
  borderColor: `${AGI_SUGGESTIONS_COLOR}.outlinedBorder`,
  borderRadius: '1rem',
  borderBottomLeftRadius: 0,
  boxShadow: 'xs',
  pl: 1.5,
  pr: 2,
  py: 0.5,
  fontSize: 'sm',
  fontWeight: 'normal',
  cursor: 'pointer',
  transition: 'none',
  textAlign: 'start',
  // whiteSpace: 'balance',
  '&:hover': {
    backgroundColor: `${AGI_SUGGESTIONS_COLOR}.solidBg`,
    borderColor: `${AGI_SUGGESTIONS_COLOR}.solidBg`,
    color: `${AGI_SUGGESTIONS_COLOR}.solidColor`,
    transition: 'none',
  },
};


export function ComposerTextAreaActions(props: {
  agiAttachmentPrompts: AgiAttachmentPromptsData,
  inReferenceTo?: DMetaReferenceItem[] | null
  pendingParts?: DComposerPendingPart[] | null,
  pendingPartsEnhancers?: readonly AttachmentInputEnhancer[],
  onAppendAndSend: (appendText: string) => Promise<void>,
  onRemoveReferenceTo: (item: DMetaReferenceItem) => void,
  onRemovePendingPart?: (part: DComposerPendingPart) => void,
}) {

  // skip the component if there's nothing to show
  const { agiAttachmentPrompts, onRemovePendingPart } = props;
  if (!props.inReferenceTo?.length && !props.pendingParts?.length && !agiAttachmentPrompts.prompts?.length /*&& !props.agiAttachmentPrompts.isVisible*/)
    return null;

  return (
    <Box sx={composerTextAreaSx}>

      {/* In-Reference-To bubbles */}
      {props.inReferenceTo?.map((item, index) => (
        <InReferenceToBubble
          key={index}
          item={item}
          onRemove={props.onRemoveReferenceTo}
          className='within-composer-focus'
        />
      ))}

      {/* Enhancer-pending part chips (e.g. video URLs) - dispatched to the owning enhancer's renderer */}
      {props.pendingParts?.map((part, index) => {
        const enhancer = props.pendingPartsEnhancers?.find(e => e.ownsPart(part));
        if (!enhancer) return null;
        const PendingChip = enhancer.PendingChip;
        return <PendingChip key={index} part={part} onRemove={() => onRemovePendingPart?.(part)} />;
      })}

      {/* Auto-Prompts from attachments */}
      {agiAttachmentPrompts.prompts.map((candidate, index) =>
        <Button
          key={index}
          color={AGI_SUGGESTIONS_COLOR}
          variant='plain'
          onClick={() => props.onAppendAndSend(candidate)}
          // disabled as otherwise it gets white when hovering and the composer has focus
          // className='within-composer-focus'
          sx={promptButtonSx}
        >
          {candidate}
        </Button>,
      )}

      {/* Guess Action Button */}
      {/*{(agiAttachmentPrompts.isVisible || agiAttachmentPrompts.hasData) && (*/}
      {/*  <AttachmentsPromptsButton data={props.agiAttachmentPrompts} />*/}
      {/*)}*/}

    </Box>
  );
}
