import * as React from 'react';

import { Button, IconButton, useColorScheme } from '@mui/joy';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { GoodTooltip } from './GoodTooltip';

export const darkModeToggleButtonSx = {
  boxShadow: 'sm',
  backgroundColor: 'background.surface',
  '&:hover': {
    backgroundColor: 'background.popup',
  },
} as const;

type ThemeMode = 'light' | 'dark' | 'system';

const _nextThemeMode: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const _themeModeLabel: Record<ThemeMode, string> = {
  light: 'Light Theme',
  dark: 'Dark Theme',
  system: 'System Theme',
};

function _themeModeIcon(mode: ThemeMode) {
  switch (mode) {
    case 'dark':
      return <DarkModeIcon />;
    case 'system':
      return <BrightnessAutoIcon />;
    case 'light':
    default:
      return <LightModeIcon />;
  }
}

export function DarkModeToggleButton(props: { hasText?: boolean }) {

  // external state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();
  const mode: ThemeMode = colorMode === 'light' || colorMode === 'dark' || colorMode === 'system'
    ? colorMode
    : 'system';

  const handleToggleDarkMode = (event: React.MouseEvent) => {
    event.stopPropagation();
    setColorMode(_nextThemeMode[mode]);
  };

  const title = `Theme: ${_themeModeLabel[mode]}`;

  return (
    <GoodTooltip title={title}>
      {props.hasText ? (
        <Button
          variant='soft'
          color='neutral'
          onClick={handleToggleDarkMode}
          sx={darkModeToggleButtonSx}
          startDecorator={React.cloneElement(_themeModeIcon(mode), { color: 'primary' })}
        >
          {_themeModeLabel[mode]}
        </Button>
      ) : (
        <IconButton size='sm' variant='soft' onClick={handleToggleDarkMode} sx={{ ml: 'auto', /*mr: '2px',*/ my: '-0.25rem' /* absorb the menuItem padding */ }}>
          {_themeModeIcon(mode)}
        </IconButton>
      )}
    </GoodTooltip>
  );
}
