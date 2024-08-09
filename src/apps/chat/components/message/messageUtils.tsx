import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Avatar, Box } from '@mui/joy';
import Face6Icon from '@mui/icons-material/Face6';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { animationColorRainbow } from '~/common/util/animUtils';
import { UIComplexityMode } from '~/common/app.theme';


// Animations
const ANIM_BUSY_DOWNLOADING = 'https://i.giphy.com/26u6dIwIphLj8h10A.webp'; // hourglass: https://i.giphy.com/TFSxpAIYz5inJGuY8f.webp, small-lq: https://i.giphy.com/131tNuGktpXGhy.webp, floppy: https://i.giphy.com/RxR1KghIie2iI.webp
const ANIM_BUSY_PAINTING = 'https://i.giphy.com/media/5t9ujj9cMisyVjUZ0m/giphy.webp';
const ANIM_BUSY_THINKING = 'https://i.giphy.com/media/l44QzsOLXxcrigdgI/giphy.webp';
export const ANIM_BUSY_TYPING = 'https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp';


export const messageAsideColumnSx: SxProps = {
  // make this stick to the top of the screen
  position: 'sticky',
  top: 0,

  // style
  // filter: 'url(#agi-holographic)',

  // flexBasis: 0, // this won't let the item grow
  minWidth: { xs: 50, md: 64 },
  maxWidth: 80,
  textAlign: 'center',
  // layout
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',

  // when with the 'edit-button' class
  '&.msg-edit-button': {
    gap: 0.25,
  },
};

export const messageZenAsideColumnSx: SxProps = {
  ...messageAsideColumnSx,
  minWidth: undefined,
  maxWidth: undefined,
  mx: -1,
};

export const avatarIconSx = {
  borderRadius: 'sm',
  height: 36,
  width: 36,
} as const;

const largerAvatarIconsSx = {
  ...avatarIconSx,
  width: 48,
  height: 48,
};


export function makeMessageAvatarIcon(
  uiComplexityMode: UIComplexityMode,
  messageRole: DMessageRole | string,
  messageOriginLLM: string | undefined,
  messagePurposeId: SystemPurposeId | string | undefined,
  messageIncomplete: boolean,
  larger?: boolean,
): React.JSX.Element {

  const nameOfRole =
    messageRole === 'user' ? 'You'
      : messageRole === 'assistant' ? 'Assistant'
        : 'System';

  switch (messageRole) {
    case 'system':
      return <SettingsSuggestIcon sx={avatarIconSx} />;  // https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png

    case 'user':
      return <Face6Icon sx={avatarIconSx} />;            // https://www.svgrepo.com/show/306500/openai.svg

    case 'assistant':
      const isDownload = messageOriginLLM === 'web';
      const isTextToImage = messageOriginLLM === 'DALL·E' || messageOriginLLM === 'Prodia';
      const isReact = messageOriginLLM?.startsWith('react-');

      // Extra appearance
      if (uiComplexityMode === 'extra') {

        // Pending animations (larger too)
        if (messageIncomplete)
          return <Avatar
            variant='plain'
            alt={nameOfRole}
            src={isDownload ? ANIM_BUSY_DOWNLOADING
              : isTextToImage ? ANIM_BUSY_PAINTING
                : isReact ? ANIM_BUSY_THINKING
                  : ANIM_BUSY_TYPING}
            sx={larger ? largerAvatarIconsSx : avatarIconSx}
          />;

        // Purpose image (if present)
        const purposeImage = SystemPurposes[messagePurposeId as SystemPurposeId]?.imageUri ?? undefined;
        if (purposeImage)
          return <Avatar
            variant='plain'
            alt={nameOfRole}
            src={purposeImage}
            sx={avatarIconSx}
          />;

      }

      // mode: text-to-image
      if (isTextToImage)
        return <FormatPaintOutlinedIcon sx={!messageIncomplete ? avatarIconSx : {
          ...avatarIconSx,
          animation: `${animationColorRainbow} 1s linear infinite`,
        }} />;

      // TODO: llm symbol (if messageIncomplete)
      // if (messageIncomplete)

      // purpose symbol (if present)
      const symbol = SystemPurposes[messagePurposeId as SystemPurposeId]?.symbol;
      if (symbol)
        return <Box sx={{
          fontSize: '24px',
          textAlign: 'center',
          width: '100%',
          minWidth: `${avatarIconSx.width}px`,
          lineHeight: `${avatarIconSx.height}px`,
        }}>
          {symbol}
        </Box>;

      // default assistant avatar
      return <SmartToyOutlinedIcon sx={avatarIconSx} />; // https://mui.com/static/images/avatar/2.jpg
  }
  return <Avatar alt={nameOfRole} />;
}


export function messageBackground(messageRole: DMessageRole | string, wasEdited: boolean, isAssistantIssue: boolean): string {
  switch (messageRole) {
    case 'user':
      return 'primary.plainHoverBg'; // was .background.level1
    case 'assistant':
      return isAssistantIssue ? 'danger.softBg' : 'background.surface';
    case 'system':
      return wasEdited ? 'warning.softHoverBg' : 'neutral.softBg';
    default:
      return '#ff0000';
  }
}
