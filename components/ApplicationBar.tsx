import * as React from 'react';

import { IconButton, Sheet, Typography, useColorScheme, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { ChatModels, SystemPurposes } from '@/lib/data';
import { NoSSR } from '@/components/util/NoSSR';
import { useActiveConfiguration } from '@/lib/store-chats';


/**
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar(props: { onDoubleClick: () => void, onSettingsClick: () => void, sx?: SxProps }) {
  const theme = useTheme();
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const { chatModelId, systemPurposeId } = useActiveConfiguration();

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  return (
    <Sheet variant='solid' invertedColors sx={{
      p: 1,
      display: 'flex', flexDirection: 'row',
      ...(props.sx || {}),
    }}>

      <IconButton variant='plain' color='neutral' onClick={handleDarkModeToggle}>
        <DarkModeIcon />
      </IconButton>

      {/*{!isEmpty && (*/}
      {/*  <IconButton variant='plain' color='neutral' disabled={isDisabledCompose} onClick={onClearConversation}>*/}
      {/*    <DeleteOutlineOutlinedIcon />*/}
      {/*  </IconButton>*/}
      {/*)}*/}

      <Typography sx={{
        textAlign: 'center',
        fontFamily: theme.vars.fontFamily.code, fontSize: '1rem', lineHeight: 1.75,
        my: 'auto',
        flexGrow: 1,
      }} onDoubleClick={props.onDoubleClick}>
        <NoSSR>
          {ChatModels[chatModelId]?.title || 'Select Model'}
          <span style={{ opacity: 0.5 }}> · </span>
          {SystemPurposes[systemPurposeId].title}
        </NoSSR>
      </Typography>

      <IconButton variant='plain' color='neutral' onClick={props.onSettingsClick}>
        <SettingsOutlinedIcon />
      </IconButton>
    </Sheet>
  );
}