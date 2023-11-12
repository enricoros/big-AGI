import * as React from 'react';

import { Sheet, Switch, Tooltip, Typography } from '@mui/joy';


/**
 * [Experimental] A panel with tools for the chat
 */
export function ToolsPanel(props: { showDiff: boolean, setShowDiff: (showDiff: boolean) => void }) {
  return (
    <Sheet
      variant='outlined' invertedColors
      sx={{
        position: 'fixed', top: 64, left: 8, zIndex: 101,
        boxShadow: 'md', borderRadius: '100px',
        p: 2,
        display: 'flex', flexFlow: 'row wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2,
      }}
    >
      <Typography level='title-md'>
        🪛
      </Typography>
      <Tooltip title='Highlight differences'>
        <Switch
          checked={props.showDiff} onChange={() => props.setShowDiff(!props.showDiff)}
          startDecorator={<Typography level='title-md'>Diff</Typography>}
        />
      </Tooltip>
    </Sheet>
  );
}