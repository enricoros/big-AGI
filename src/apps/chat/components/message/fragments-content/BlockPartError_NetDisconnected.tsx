import * as React from 'react';

import { Alert, Box } from '@mui/joy';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';

import type { ContentScaling } from '~/common/app.theme';
import { Is } from '~/common/util/pwaUtils';
import { useLLM } from '~/common/stores/llms/llms.hooks';
import { useModelServiceClientSideFetch } from '~/common/stores/llms/hooks/useModelServiceClientSideFetch';

import { BlockPartError_DirectConnectionRow } from './BlockPartError_DirectConnectionRow';


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
  const csf = useModelServiceClientSideFetch(isServerSideClosed, model);
  const { csfAvailable, vendorName } = csf;

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
        {csfAvailable && (
          <Box color='text.tertiary' fontSize='sm' my={2}>
            <strong>Experimental:</strong> long responses can outlast the server connection - turn on Direct Connection to {vendorName} below, then try again.
          </Box>
        )}

        {/* the switch, or the same row off and disabled with the reason */}
        <BlockPartError_DirectConnectionRow csf={csf} />

        {!csfAvailable && (
          <div>
            <Box sx={{ color: 'text.secondary', my: 1 }}>
              Suggestions:
            </Box>
            <Box component='ul' sx={{ color: 'text.secondary' }}>
              {/* on Vercel the usual cause is the server's response time limit (see the /api/edge route file), not the user's network */}
              <li>{Is.Deployment.VercelFromFrontend
                ? 'Try a faster model, or a service that offers Direct Connection'
                : 'Check your internet connection and try again'}</li>
              <li>The AI service may be experiencing issues - wait a moment and retry</li>
              <li>If the issue persists, please let us know promptly on Discord or GitHub</li>
            </Box>
          </div>
        )}
      </Box>
    </Alert>
  );
}
