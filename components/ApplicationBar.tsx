import * as React from 'react';

import { IconButton, Option, Select, Sheet, Stack, useColorScheme, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { useActiveConfiguration } from '@/lib/store-chats';
import { NoSSR } from '@/components/util/NoSSR';


function NicerSelector<TValue extends string>(props: { value: TValue, items: Record<string, { title: string }>, onChange: (event: any, value: TValue | null) => void, sx?: SxProps }) {
  const theme = useTheme();
  return (
    <Select
      variant='solid' color='neutral' size='md'
      value={props.value} onChange={props.onChange}
      indicator={<KeyboardArrowDown />}
      slotProps={{
        listbox: {
          variant: 'plain', color: 'info',
          disablePortal: false,
        },
        indicator: {
          sx: {
            opacity: 0.5,
          },
        },
      }}
      sx={{
        mx: 0,
        fontFamily: theme.vars.fontFamily.code,
        ...(props.sx || {}),
      }}
    >
      {Object.keys(props.items).map((key: string) => (
        <Option key={key} value={key}>
          {props.items[key].title}
        </Option>
      ))}
    </Select>
  );
}


/**
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar(props: { onDoubleClick: () => void, onSettingsClick: () => void, sx?: SxProps }) {
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();
  const { chatModelId, setChatModelId, setSystemPurposeId, systemPurposeId } = useActiveConfiguration();

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleChatModelChange = (event: any, value: ChatModelId | null) => value && setChatModelId(value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) => value && setSystemPurposeId(value);

  return (
    <Sheet
      variant='solid' invertedColors
      sx={{
        p: 1,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        ...(props.sx || {}),
      }}>

      <IconButton variant='plain' onClick={handleDarkModeToggle}>
        <DarkModeIcon />
      </IconButton>

      {/*{!isEmpty && (*/}
      {/*  <IconButton variant='plain' color='neutral' disabled={isDisabledCompose} onClick={onClearConversation}>*/}
      {/*    <DeleteOutlineOutlinedIcon />*/}
      {/*  </IconButton>*/}
      {/*)}*/}

      <NoSSR><Stack direction='row' sx={{ my: 'auto' }}>

        <NicerSelector items={ChatModels} value={chatModelId} onChange={handleChatModelChange} />

        <NicerSelector items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />

      </Stack> </NoSSR>

      <IconButton variant='plain' onClick={props.onSettingsClick}>
        <SettingsOutlinedIcon />
      </IconButton>

    </Sheet>
  );
}