import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp } from '@mui/joy';

import type { AgiAttachmentPromptsData } from '~/modules/aifn/agiattachmentprompts/useAgiAttachmentPrompts';


// configuration
export const AGI_SUGGESTIONS_COLOR: ColorPaletteProp = 'success';

// Styles

export const composerTextAreaSx: SxProps = {
  flex: 1,

  // layout - NOTE: minmax(0, 1fr) caps the single column at the container width; an 'auto' track
  // would grow to the items' max-content and let long chips overflow instead of ellipsizing
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
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


/**
 * Textarea end-decorator actions: the pre-send items row (passed as children, e.g. UserInputItemsRow)
 * and the AI-suggested attachment prompts. Knows nothing about the items themselves.
 */
export function ComposerTextAreaActions(props: {
  agiAttachmentPrompts: AgiAttachmentPromptsData,
  onAppendAndSend: (appendText: string) => Promise<void>,
  children?: React.ReactNode,
}) {

  // skip the component if there's nothing to show
  const { agiAttachmentPrompts } = props;
  if (!props.children && !agiAttachmentPrompts.prompts?.length /*&& !props.agiAttachmentPrompts.isVisible*/)
    return null;

  return (
    <Box sx={composerTextAreaSx}>

      {/* Pre-send items row (recipient, reply-to, pending parts) */}
      {props.children}

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
