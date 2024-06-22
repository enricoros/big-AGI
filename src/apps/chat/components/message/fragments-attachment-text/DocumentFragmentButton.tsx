import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Button } from '@mui/joy';

import type { DMessageAttachmentFragment, DMessageFragmentId } from '~/common/stores/chat/chat.message';
import { ellipsizeMiddle } from '~/common/util/textUtils';


const buttonPressedSx: SxProps = {
  minHeight: '2.25rem',
  minWidth: '5rem',
  fontSize: 'sm',
  border: '1px solid',
  borderColor: 'neutral.solidBg',
  boxShadow: 'xs',
};

const buttonSx: SxProps = {
  ...buttonPressedSx,
  borderColor: 'primary.outlinedBorder',
  backgroundColor: 'background.surface',
};


export function DocumentFragmentButton(props: {
  fragment: DMessageAttachmentFragment,
  isSelected: boolean,
  toggleSelected: (fragmentId: DMessageFragmentId) => void
}) {

  // derived state
  const { fragment, isSelected, toggleSelected } = props;

  // handlers
  const handleSelectFragment = React.useCallback(() => {
    toggleSelected(fragment.fId);
  }, [fragment.fId, toggleSelected]);

  // only operate on text
  if (fragment.part.pt !== 'text')
    throw new Error('Unexpected part type: ' + fragment.part.pt);

  const buttonText = ellipsizeMiddle(fragment.title || 'Text', 28 /* totally arbitrary length */);

  return (
    <Button
      size='sm'
      variant={isSelected ? 'solid' : 'soft'}
      color={isSelected ? 'neutral' : 'neutral'}
      onClick={handleSelectFragment}
      sx={isSelected ? buttonPressedSx : buttonSx}
    >
      {buttonText}
    </Button>
  );
}
