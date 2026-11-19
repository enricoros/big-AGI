import * as React from 'react';

import { Box, FormHelperText, Switch } from '@mui/joy';

import type { useModelServiceClientSideFetch } from '~/common/stores/llms/hooks/useModelServiceClientSideFetch';


/**
 * The Direct Connection row of the error recovery cards: the switch where it can be used, the same row off and
 * disabled with the reason where it cannot, and nothing where there is no reason to give (the model is gone).
 */
export function BlockPartError_DirectConnectionRow(props: {
  csf: ReturnType<typeof useModelServiceClientSideFetch>;
}) {

  const { csfAvailable, csfActive, csfOffReason, csfToggle, vendorName } = props.csf;
  if (!csfAvailable && !csfOffReason)
    return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        borderRadius: 'sm',
        bgcolor: 'background.popup',
        boxShadow: csfOffReason ? undefined : 'md',
        ...(csfOffReason && { mt: 1 }),
      }}
    >

      <Box sx={{ flex: 1 }}>
        <Box color={csfOffReason ? 'neutral.plainDisabledColor' : !csfActive ? undefined : 'primary.solidBg'} fontWeight='lg' mb={0.5}>
          Direct Connection {csfActive && '- Now Try Again'}
        </Box>
        <FormHelperText>
          {csfOffReason || <>Connect directly from this client -&gt; {vendorName || 'AI service'}</>}
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
