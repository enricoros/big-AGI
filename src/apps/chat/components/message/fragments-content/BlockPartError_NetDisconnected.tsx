import * as React from 'react';

import { Alert, Box, FormHelperText, Switch } from '@mui/joy';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';

import type { ContentScaling } from '~/common/app.theme';
import { useLLM } from '~/common/stores/llms/llms.hooks';
import { useModelServiceClientSideFetch } from '~/common/stores/llms/hooks/useModelServiceClientSideFetch';


/**
 * Error recovery component for "Connection terminated" errors.
 */
export function BlockPartError_NetDisconnected(props: {
  disconnectionKind: 'net-client-closed' | 'net-server-closed' | 'net-unknown-closed';
  messageGeneratorLlmId?: string | null;
  contentScaling: ContentScaling;
}) {

  // external state
  const model = useLLM(props.messageGeneratorLlmId) ?? null;
  const isServerSideClosed = props.disconnectionKind === 'net-server-closed'; // do not show CSF option for non-server-side
  const { csfAvailable, csfActive, csfToggle, vendorName } = useModelServiceClientSideFetch(isServerSideClosed, model);

  return (
    <Alert
      size={props.contentScaling === 'xs' ? 'sm' : 'md'}
      color='danger'
      variant='plain'
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
    >


      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>

        {/* Header */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <WifiOffRoundedIcon sx={{ flexShrink: 0, mt: 0.5 }} />
          <div>
            <Box fontSize='larger'>
              Connection Terminated
            </Box>
            <div>
              The connection was unexpectedly closed before the response completed.
            </div>
          </div>
        </Box>


        {/* Recovery options */}
        {csfAvailable ? <>

          {/* Explanation */}
          <Box color='text.tertiary' fontSize='sm' my={2}>
            <strong>Experimental:</strong> enable direct connection to {vendorName} to bypass server timeouts - then try again.
          </Box>

          {/* Toggle */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderRadius: 'sm',
              bgcolor: 'background.popup',
              boxShadow: 'md',
              // border: '1px solid',
              // borderColor: 'divider',
            }}
          >

            <Box sx={{ flex: 1 }}>
              <Box color={!csfActive ? undefined : 'primary.solidBg'} fontWeight='lg' mb={0.5}>
                Direct Connection {csfActive && '- Now Try Again'}
              </Box>
              <FormHelperText>
                Connect directly from this client -&gt; {vendorName || 'AI service'}
              </FormHelperText>
            </Box>

            <Switch
              checked={csfActive}
              onChange={(e) => csfToggle(e.target.checked)}
            />
          </Box>

        </> : (
          <div>
            <Box sx={{ color: 'text.secondary', my: 1 }}>
              Suggestions:
            </Box>
            <Box component='ul' sx={{ color: 'text.secondary' }}>
              <li>Check your internet connection and try again</li>
              <li>The AI service may be experiencing issues - wait a moment and retry</li>
              <li>If the issue persists, please let us know promptly on Discord or GitHib</li>
            </Box>
          </div>
        )}
      </Box>
    </Alert>
  );
}
