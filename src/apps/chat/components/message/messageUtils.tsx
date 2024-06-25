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


// Animations
const ANIM_BUSY_DOWNLOADING = 'https://i.giphy.com/26u6dIwIphLj8h10A.webp'; // hourglass: https://i.giphy.com/TFSxpAIYz5inJGuY8f.webp, small-lq: https://i.giphy.com/131tNuGktpXGhy.webp, floppy: https://i.giphy.com/RxR1KghIie2iI.webp
const ANIM_BUSY_PAINTING = 'https://i.giphy.com/media/5t9ujj9cMisyVjUZ0m/giphy.webp';
const ANIM_BUSY_THINKING = 'https://i.giphy.com/media/l44QzsOLXxcrigdgI/giphy.webp';
export const ANIM_BUSY_TYPING = 'https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp';


export const messageAsideColumnSx: SxProps = {
  // make this stick to the top of the screen
  position: 'sticky',
  top: 0,

  // flexBasis: 0, // this won't let the item grow
  minWidth: { xs: 50, md: 64 },
  maxWidth: 80,
  textAlign: 'center',
  // layout
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

export const avatarIconSx = {
  width: 36,
  height: 36,
} as const;


export function makeMessageAvatar(
  messageAvatarUrl: string | null,
  messageRole: DMessageRole | string,
  messageOriginLLM: string | undefined,
  messagePurposeId: SystemPurposeId | string | undefined,
  messageIncomplete: boolean,
  larger?: boolean,
): React.JSX.Element {
  const nameByRole = messageRole === 'user' ? 'You' : messageRole === 'assistant' ? 'Assistant' : 'System';
  if (typeof messageAvatarUrl === 'string' && messageAvatarUrl)
    return <Avatar alt={nameByRole} src={messageAvatarUrl} />;

  const mascotSx = larger ? { width: 48, height: 48 } : avatarIconSx;
  switch (messageRole) {
    case 'system':
      return <SettingsSuggestIcon sx={avatarIconSx} />;  // https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png

    case 'user':
      return <Face6Icon sx={avatarIconSx} />;            // https://www.svgrepo.com/show/306500/openai.svg

    case 'assistant':
      const isDownload = messageOriginLLM === 'web';
      const isTextToImage = messageOriginLLM === 'DALL·E' || messageOriginLLM === 'Prodia';
      const isReact = messageOriginLLM?.startsWith('react-');

      // animation on incomplete messages
      if (messageIncomplete)
        return <Avatar
          alt={nameByRole} variant='plain'
          src={isDownload ? ANIM_BUSY_DOWNLOADING
            : isTextToImage ? ANIM_BUSY_PAINTING
              : isReact ? ANIM_BUSY_THINKING
                : ANIM_BUSY_TYPING}
          sx={{ ...mascotSx, borderRadius: 'sm' }}
        />;

      // icon: text-to-image
      if (isTextToImage)
        return <FormatPaintOutlinedIcon sx={{
          ...avatarIconSx,
          animation: `${animationColorRainbow} 1s linear 2.66`,
        }} />;

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
  return <Avatar alt={nameByRole} />;
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
