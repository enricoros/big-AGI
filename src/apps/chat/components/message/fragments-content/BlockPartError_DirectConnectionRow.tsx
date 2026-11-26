import * as React from 'react';

import { Box, FormHelperText, Switch } from '@mui/joy';

import type { useModelServiceClientSideFetch } from '~/common/stores/llms/hooks/useModelServiceClientSideFetch';


/**
 * The Direct Connection row of the error recovery cards: the switch where it can be used, the same row off and
 * disabled with the reason where it cannot, and nothing where there is no reason to give (the model is gone).
 * 'turn-off' offers the way back through the server, for a failure of the browser's own connection: no row when
 * Direct Connection cannot be on, as the next request goes through the server already.
 */
export function BlockPartError_DirectConnectionRow(props: {
  csf: ReturnType<typeof useModelServiceClientSideFetch>;
  direction?: 'turn-on' | 'turn-off';
}) {

  const { csfAvailable, csfActive, csfOffReason, csfToggle, vendorName } = props.csf;
  const turnOff = props.direction === 'turn-off';
  if (!csfAvailable && (turnOff || !csfOffReason))
    return null;

  // the switch is where the user wants it: the next request takes the other path
  const switched = turnOff ? !csfActive : !!csfActive;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.5,
        borderRadius: 'sm',
        bgcolor: 'background.popup',
        boxShadow: csfOffReason ? undefined : 'md',
        ...(csfOffReason && { mt: 1 }),
      }}
    >

      <Box sx={{ flex: 1 }}>
        <Box color={csfOffReason ? 'neutral.plainDisabledColor' : !switched ? undefined : 'primary.solidBg'} fontWeight='lg' mb={0.5}>
          Direct Connection {switched && '- Now Try Again'}
        </Box>
        <FormHelperText>
          {csfOffReason || (turnOff
            ? <>Turn off to reach {vendorName || 'the AI service'} through the server</>
            : <>Connect directly from this client -&gt; {vendorName || 'AI service'}</>)}
        </FormHelperText>
      </Box>

      <Switch
        checked={!!csfActive}
        disabled={!!csfOffReason}
        variant={csfOffReason ? 'outlined' : undefined}
        onChange={(e) => csfToggle(e.target.checked)}
        endDecorator={csfOffReason ? 'Off' : undefined}
      />
    </Box>
  );
}
