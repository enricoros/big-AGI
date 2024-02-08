import * as React from 'react';

import { Box, FormHelperText, FormLabel, IconButton, Stack } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


export function Section(props: { title?: string; collapsible?: boolean, collapsed?: boolean, disclaimer?: string, asLink?: boolean, sx?: SxProps, children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(props.collapsed ?? false);

  const labelSx: SxProps | null = props.asLink ? {
    textDecoration: 'underline',
    cursor: 'pointer',
  } : null;

  return <Box>

    <Stack direction='row' sx={{ mt: (props.title ? 1 : 0), alignItems: 'center', ...(props.sx ?? {}) }}>
      {!!props.title && (
        <FormLabel onClick={() => !!props.collapsible && setCollapsed(!collapsed)} sx={labelSx}>
          {props.title}
        </FormLabel>
      )}
      {!!props.collapsible && !props.asLink && (
        <IconButton onClick={() => setCollapsed(!collapsed)} sx={{ ml: 1 }}>
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

  </Box>;
}