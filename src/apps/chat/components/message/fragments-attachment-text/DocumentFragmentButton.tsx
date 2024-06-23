import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Button } from '@mui/joy';

import type { DMessageAttachmentFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { ellipsizeMiddle } from '~/common/util/textUtils';


export function DocumentFragmentButton(props: {
  fragment: DMessageAttachmentFragment,
  contentScaling: ContentScaling,
  isSelected: boolean,
  toggleSelected: (fragmentId: DMessageFragmentId) => void,
}) {

  // derived state
  const { fragment, isSelected, toggleSelected } = props;

  // only operate on text
  if (fragment.part.pt !== 'text')
    throw new Error('Unexpected part type: ' + fragment.part.pt);

  // handlers
  const handleSelectFragment = React.useCallback(() => {
    toggleSelected(fragment.fId);
  }, [fragment.fId, toggleSelected]);

  // memos
  const buttonSx = React.useMemo((): SxProps => ({
    minHeight: '2.5em',
    minWidth: '4rem',
    fontSize: themeScalingMap[props.contentScaling]?.fragmentButtonFontSize ?? undefined,
    border: '1px solid',
    borderRadius: 'sm',
    boxShadow: 'xs',
    ...isSelected ? {
      borderColor: 'neutral.solidBg',
    } : {
      borderColor: 'primary.outlinedBorder',
      backgroundColor: 'background.surface',
    },
  }), [isSelected, props.contentScaling]);

  const buttonText = ellipsizeMiddle(fragment.title || 'Text', 28 /* totally arbitrary length */);

  return (
    <Button
      size='sm'
      variant={isSelected ? 'solid' : 'soft'}
      color={isSelected ? 'neutral' : 'neutral'}
      onClick={handleSelectFragment}
      sx={buttonSx}
    >
      {buttonText}
    </Button>
  );
}
