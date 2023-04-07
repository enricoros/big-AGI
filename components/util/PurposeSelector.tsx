import * as React from 'react';

import { Box, Button, Grid, Stack, Textarea, Typography, useTheme } from '@mui/joy';

import { useActiveConfiguration } from '@/lib/store-chats';
import { SystemPurposeId, SystemPurposes } from '@/lib/data';


// Constants for tile sizes / grid width - breakpoints need to be computed here to work around
// the "flex box cannot shrink over wrapped content" issue
//
// Absolutely dislike this workaround, but it's the only way I found to make it work

const bpTileSize = { xs: 116, md: 125, xl: 130 };
const tileCols = [3, 4, 6];
const tileSpacing = 1;
const bpMaxWidth = Object.entries(bpTileSize).reduce((acc, [key, value], index) => {
  acc[key] = tileCols[index] * (value + 8 * tileSpacing) - 8 * tileSpacing;
  return acc;
}, {} as Record<string, number>);
const bpTileGap = { xs: 2, md: 3 };


/**
 * Purpose selector for the current chat. Clicking on any item activates it for the current chat.
 */
export function PurposeSelector() {
  // external state
  const theme = useTheme();
  const { setSystemPurposeId, systemPurposeId } = useActiveConfiguration();

  const handlePurposeChange = (purpose: SystemPurposeId | null) => {
    if (purpose)
      setSystemPurposeId(purpose);
  };

  const handleCustomSystemMessageChange = (v: React.ChangeEvent<HTMLTextAreaElement>): void => {
    // TODO: persist this change? Right now it's reset every time.
    //       maybe we shall have a "save" button just save on a state to persist between sessions
    SystemPurposes['Custom'].systemMessage = v.target.value;
  };

  return (
    <Stack direction='column' sx={{ minHeight: '60vh', justifyContent: 'center', alignItems: 'center' }}>

      <Box sx={{ maxWidth: bpMaxWidth }}>

        <Typography level='body3' color='neutral' sx={{ mb: 2 }}>
          AI purpose
        </Typography>

        <Grid container spacing={tileSpacing} sx={{ justifyContent: 'flex-start' }}>
          {Object.keys(SystemPurposes).map(spId => (
            <Grid key={spId}>
              <Button
                variant={systemPurposeId === spId ? 'solid' : 'soft'}
                color={systemPurposeId === spId ? 'primary' : 'neutral'}
                onClick={() => handlePurposeChange(spId as SystemPurposeId)}
                sx={{
                  flexDirection: 'column',
                  fontWeight: 500,
                  gap: bpTileGap,
                  height: bpTileSize,
                  width: bpTileSize,
                  ...(systemPurposeId !== spId ? {
                    boxShadow: theme.vars.shadow.md,
                    background: theme.vars.palette.background.level1,
                  } : {}),
                }}
              >
                <div style={{ fontSize: '2rem' }}>
                  {SystemPurposes[spId as SystemPurposeId]?.symbol}
                </div>
                <div>
                  {SystemPurposes[spId as SystemPurposeId]?.title}
                </div>
              </Button>
            </Grid>
          ))}
        </Grid>

        <Typography level='body2' sx={{ mt: 2 }}>
          {SystemPurposes[systemPurposeId]?.description}
        </Typography>

        {systemPurposeId === 'Custom' && (
          <Textarea
            variant='outlined' autoFocus placeholder={'Enter your custom system message here...'}
            minRows={3}
            defaultValue={SystemPurposes['Custom']?.systemMessage} onChange={handleCustomSystemMessageChange}
            sx={{
              background: theme.vars.palette.background.level1,
              lineHeight: 1.75,
              mt: 1,
            }} />
        )}

      </Box>

    </Stack>
  );
}