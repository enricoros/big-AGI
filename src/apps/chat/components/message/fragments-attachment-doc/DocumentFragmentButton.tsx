import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button } from '@mui/joy';
import AbcIcon from '@mui/icons-material/Abc';
import CodeIcon from '@mui/icons-material/Code';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TelegramIcon from '@mui/icons-material/Telegram';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TextureIcon from '@mui/icons-material/Texture';

import type { DMessageAttachmentFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { ellipsizeMiddle } from '~/common/util/textUtils';


function iconForFragment({ part }: DMessageAttachmentFragment): React.ComponentType<any> {
  switch (part.pt) {
    case 'doc':
      switch (part.type) {
        case 'text/plain':
          return TextFieldsIcon;
        case 'text/html':
          return CodeIcon;
        case 'text/markdown':
          return CodeIcon;
        case 'application/vnd.agi.ocr':
          return part.meta?.srcOcrFrom === 'image' ? AbcIcon : PictureAsPdfIcon;
        case 'application/vnd.agi.ego':
          return TelegramIcon;
        default:
          return TextureIcon;
      }
    case 'image_ref':
      return ImageOutlinedIcon;
    case '_pt_sentinel':
      return TextureIcon;
  }
}


export function DocumentFragmentButton(props: {
  fragment: DMessageAttachmentFragment,
  contentScaling: ContentScaling,
  isSelected: boolean,
  toggleSelected: (fragmentId: DMessageFragmentId) => void,
}) {

  // derived state
  const { fragment, isSelected, toggleSelected } = props;

  // only operate on doc fragments
  if (fragment.part.pt !== 'doc')
    throw new Error('Unexpected part type: ' + fragment.part.pt);

  // handlers
  const handleSelectFragment = React.useCallback(() => {
    toggleSelected(fragment.fId);
  }, [fragment.fId, toggleSelected]);

  // memos
  const buttonSx = React.useMemo((): SxProps => ({
    // from ATTACHMENT_MIN_STYLE
    height: '100%',
    minHeight: '40px',
    minWidth: '64px',
    maxWidth: '280px',

    // style
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

    // from LLMAttachmentItem
    display: 'flex', flexDirection: 'row', gap: 1,
  }), [isSelected, props.contentScaling]);

  const buttonText = ellipsizeMiddle(fragment.title || 'Text', 28 /* totally arbitrary length */);
  // const buttonCaption = fragment.caption;

  const Icon = iconForFragment(fragment);

  return (
    <Button
      size='sm'
      variant={isSelected ? 'solid' : 'soft'}
      color={isSelected ? 'neutral' : 'neutral'}
      onClick={handleSelectFragment}
      sx={buttonSx}
    >
      {!!Icon && <Icon sx={{ width: 24, height: 24 }} />}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <Box sx={{ whiteSpace: 'nowrap', fontWeight: 'md' }}>
          {buttonText}
        </Box>
        {/*<Box sx={{ fontSize: 'xs', fontWeight: 'sm' }}>*/}
        {/*  {buttonCaption}*/}
        {/*</Box>*/}
      </Box>
    </Button>
  );
}
