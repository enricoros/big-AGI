import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button } from '@mui/joy';

import { BlocksRenderer } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageAttachmentFragment, DMessageFragmentId, DMessageRole } from '~/common/stores/chat/chat.message';
import { ellipsizeMiddle } from '~/common/util/textUtils';
import { marshallWrapText } from '~/common/stores/chat/chat.tokens';


const buttonPressedSx: SxProps = {
  minHeight: '2rem',
  minWidth: '5rem',
  border: '1px solid',
  borderColor: 'neutral.solidBg',
  boxShadow: 'xs',
};

const buttonSx: SxProps = {
  ...buttonPressedSx,
  borderColor: 'primary.outlinedBorder',
  backgroundColor: 'background.surface',
};

const viewPaneSx: SxProps = {
  backgroundColor: 'background.surface',
  border: '1px solid',
  borderColor: 'primary.outlinedBorder',
  borderRadius: 'sm',
  boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)',
  mt: 0.5,
  p: 1.5,
  pt: 0,
};


/**
 * Displays a list of 'cards' which are buttons with a mutually exclusive active state.
 * When one is active, there is a content part just right under (with the collapse mechanism in case it's a user role).
 * If one is clicked the content part (use ContentPartText) is displayed.
 */
export function TextAttachmentFragments(props: {
  textFragments: DMessageAttachmentFragment[],
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile?: boolean,
  renderTextAsMarkdown: boolean;
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
}) {

  // state
  const [selectedFragmentId, setSelectedFragmentId] = React.useState<DMessageFragmentId | null>(null);
  const [editedText, setEditedText] = React.useState<{ [fragmentId: string]: string }>({});

  const handleSelectFragment = React.useCallback((fragmentId: DMessageFragmentId) => {
    setSelectedFragmentId(prevId => prevId === fragmentId ? null : fragmentId);
  }, []);

  const selectedFragment = props.textFragments.find(fragment => fragment.fId === selectedFragmentId);

  return (
    <Box aria-label={`${props.textFragments.length} text attachments`} sx={{
      //
      maxWidth: '100%',
      overflowX: 'auto',

      // layout
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Horizontally scrollable Attachments */}
      <Box sx={{
        // px: '4px', // to show the button shadow
        pb: '4px', // to show the button shadow

        // layout
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        justifyContent: props.messageRole === 'assistant' ? 'flex-start' : 'flex-end',
      }}>
        {props.textFragments.map((attachmentFragment) => {
          // only operate on text
          if (attachmentFragment.part.pt !== 'text')
            throw new Error('Unexpected part type: ' + attachmentFragment.part.pt);

          const isSelected = selectedFragmentId === attachmentFragment.fId;
          const buttonText = ellipsizeMiddle(attachmentFragment.title || 'Text', 28 /* totally arbitrary length */);

          return (
            <Button
              key={'text-toggle-' + attachmentFragment.fId}
              size='sm'
              variant={isSelected ? 'solid' : 'soft'}
              color={isSelected ? 'neutral' : 'neutral'}
              // color={isSelected ? 'primary' : 'neutral'}
              onClick={() => handleSelectFragment(attachmentFragment.fId)}
              sx={isSelected ? buttonPressedSx : buttonSx}
            >
              {buttonText}
            </Button>
          );
        })}
      </Box>

      {/* Viewer for the selected attachment */}
      {!!selectedFragment && selectedFragment.part.pt === 'text' && (
        <Box sx={viewPaneSx}>
          <BlocksRenderer
            text={marshallWrapText(selectedFragment.part.text, '', 'markdown-code')}
            // text={selectedFragment.part.text}
            fromRole={props.messageRole}
            contentScaling={props.contentScaling}
            fitScreen={props.isMobile}
            renderTextAsMarkdown={props.renderTextAsMarkdown}
          />
        </Box>
      )}

    </Box>
  );
}