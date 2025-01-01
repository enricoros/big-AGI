import * as React from 'react';

import { Button, IconButton, useColorScheme } from '@mui/joy';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';


export function DarkModeToggleButton(props: { hasText?: boolean }) {

  // external state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const handleToggleDarkMode = (event: React.MouseEvent) => {
    event.stopPropagation();
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  };

  return props.hasText ? (
    <Button size='sm' variant='soft' color='neutral' onClick={handleToggleDarkMode} sx={{ ml: 'auto' }} startDecorator={colorMode !== 'dark' ? <DarkModeIcon /> : <LightModeIcon />}>
      {colorMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
    </Button>
  ) : (
    <IconButton size="sm" variant="soft" onClick={handleToggleDarkMode} sx={{ ml: 'auto', /*mr: '2px',*/ my: '-0.25rem' /* absorb the menuItem padding */ }}>
      {colorMode !== 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
    </IconButton>
  );
}