import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton } from '@mui/joy';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';

import { themeZIndexBeamView } from '~/common/app.theme';

import { useScrollToBottom } from './useScrollToBottom';


const inlineButtonSx: SxProps = {
  // style it
  // NOTE: just an IconButton when inline

  // for usage inside BeamGatherPane, to not enlarge the row
  my: -0.25,

  // fade it in when hovering
  // transition: 'all 0.15s',
  // '&:hover': {
  //   transform: 'scale(1.1)',
  // },
} as const;

const absoluteButtonSx: SxProps = {
  ...inlineButtonSx,

  // more style when float
  backgroundColor: 'background.surface',
  border: '1px solid',
  borderColor: 'neutral.500',
  borderRadius: '50%',
  boxShadow: 'sm',
  zIndex: themeZIndexBeamView + 1, // stay on top of the Chat Message buttons (e.g. copy)

  // place this on the bottom-right corner (FAB-like)
  position: 'absolute',
  bottom: '2rem',
  right: {
    xs: '1rem',
    md: '2rem',
  },
} as const;


export function ScrollToBottomButton(props: { inline?: boolean }) {

  // state
  const { atBottom, stickToBottom, setStickToBottom } = useScrollToBottom();

  const handleStickToBottom = React.useCallback(() => {
    setStickToBottom(true);
  }, [setStickToBottom]);

  // do not render the button at all if we're already snapping
  if (atBottom || stickToBottom)
    return null;

  return (
    <IconButton
      aria-label='Scroll To Bottom'
      variant='plain'
      onClick={handleStickToBottom}
      size={props.inline ? 'sm' : undefined}
      sx={props.inline ? inlineButtonSx : absoluteButtonSx}
    >
      <KeyboardDoubleArrowDownIcon sx={{ fontSize: 'xl' }} />
    </IconButton>
  );
}