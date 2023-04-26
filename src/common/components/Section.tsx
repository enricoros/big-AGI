import { SxProps } from '@mui/joy/styles/types';
import * as React from 'react';
import { Box, FormHelperText, FormLabel, IconButton, Stack } from '@mui/joy';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export function Section(props: { title?: string; collapsible?: boolean, collapsed?: boolean, disclaimer?: string, sx?: SxProps, children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(props.collapsed ?? false);

  return <>

    <Stack direction='row' sx={{ mt: (props.title ? 1 : 0), alignItems: 'center', ...(props.sx ?? {}) }}>
      {!!props.title && (
        <FormLabel>
          {props.title}
        </FormLabel>
      )}
      {!!props.collapsible && (
        <IconButton size='md' variant='plain' color='neutral' onClick={() => setCollapsed(!collapsed)} sx={{ ml: 1 }}>
          {!collapsed ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </IconButton>
      )}
    </Stack>

    {!collapsed && <Box sx={{ mt: 1.5, mb: 1.5 }}>
      {props.children}
    </Box>}

    {!!props.disclaimer && !collapsed && (
      <FormHelperText>
        {props.disclaimer}
      </FormHelperText>
    )}

  </>;
}