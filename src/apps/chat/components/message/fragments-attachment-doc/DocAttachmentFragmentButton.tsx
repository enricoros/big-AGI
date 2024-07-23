import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp } from '@mui/joy';
import AbcIcon from '@mui/icons-material/Abc';
import CodeIcon from '@mui/icons-material/Code';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TelegramIcon from '@mui/icons-material/Telegram';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TextureIcon from '@mui/icons-material/Texture';

import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { DMessageAttachmentFragment, DMessageFragmentId, isDocPart } from '~/common/stores/chat/chat.fragments';
import { LiveFileIcon } from '~/common/livefile/liveFile.icons';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { ellipsizeMiddle } from '~/common/util/textUtils';
import { useLiveFileMetadata } from '~/common/livefile/liveFile.hooks';


// configuration
export const DocSelColor: ColorPaletteProp = 'primary';
const DocUnselColor: ColorPaletteProp = 'primary';


function buttonIconForFragment({ part }: DMessageAttachmentFragment): React.ComponentType<any> {
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


export function DocAttachmentFragmentButton(props: {
  fragment: DMessageAttachmentFragment,
  contentScaling: ContentScaling,
  isSelected: boolean,
  toggleSelected: (fragmentId: DMessageFragmentId) => void,
}) {

  // external state
  const liveFileMetadata = useLiveFileMetadata(props.fragment.liveFileId);

  // derived state
  const { fragment, isSelected, toggleSelected } = props;
  const hasLiveFile = !!liveFileMetadata;
  const isLiveFilePaired = liveFileMetadata ? liveFileMetadata.isPairingValid || false : false;

  // only operate on doc fragments
  if (!isDocPart(fragment.part))
    throw new Error('Unexpected part type: ' + fragment.part.pt);

  // handlers
  const handleSelectFragment = React.useCallback(() => {
    toggleSelected(fragment.fId);
  }, [fragment.fId, toggleSelected]);

  // memos
  const buttonSx = React.useMemo((): SxProps => ({
    // from ATTACHMENT_MIN_STYLE
    // height: '100%',
    minHeight: props.contentScaling === 'md' ? 40 : props.contentScaling === 'sm' ? 38 : 36,
    minWidth: '64px',
    maxWidth: '340px',
    padding: 0,

    // style
    fontSize: themeScalingMap[props.contentScaling]?.fragmentButtonFontSize ?? undefined,
    border: '1px solid',
    borderRadius: 'sm',
    boxShadow: 'xs',
    ...isSelected ? {
      borderColor: `${DocSelColor}.solidBg`,
    } : {
      borderColor: `${DocUnselColor}.outlinedBorder`,
      backgroundColor: 'background.popup',
    },

    // from LLMAttachmentButton
    display: 'flex', flexDirection: 'row',
  }), [isSelected, props.contentScaling]);

  const buttonText = ellipsizeMiddle(fragment.part.l1Title || fragment.title || 'Document', 28 /* totally arbitrary length */);

  const Icon = isSelected ? ExpandCircleDownIcon : buttonIconForFragment(fragment);

  return (
    <Button
      size={props.contentScaling === 'md' ? 'md' : 'sm'}
      variant={isSelected ? 'solid' : 'soft'}
      color={isSelected ? DocSelColor : DocUnselColor}
      onClick={handleSelectFragment}
      sx={buttonSx}
    >
      {!!Icon && (
        <Box sx={{
          height: '100%',
          paddingX: '0.5rem',
          borderRight: '1px solid',
          borderRightColor: isSelected ? `${DocSelColor}.solidBg` : `${DocUnselColor}.outlinedBorder`,
          display: 'flex', alignItems: 'center',
        }}>
          <Icon />
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingX: '0.5rem' }}>
        <Box sx={{ whiteSpace: 'nowrap', fontWeight: 'md' }}>
          {buttonText}
        </Box>
        {/*<Box sx={{ fontSize: 'xs', fontWeight: 'sm' }}>*/}
        {/*  {fragment.caption}*/}
        {/*</Box>*/}
      </Box>
      {hasLiveFile && (
        <TooltipOutlined
          title={!isLiveFilePaired ? 'LiveFile needs re-pairing.' : 'LiveFile is supported'}
          color={!isLiveFilePaired ? 'danger' : 'success'}
          placement='top-end'
        >
          <LiveFileIcon
            color={!isSelected ? 'success' : undefined}
            sx={{ mr: '0.5rem', color: (!isLiveFilePaired && !isSelected) ? 'darkred' : undefined }}
          />
        </TooltipOutlined>
      )}
    </Button>
  );
}
