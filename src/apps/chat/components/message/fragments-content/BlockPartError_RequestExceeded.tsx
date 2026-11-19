import * as React from 'react';

import { Alert, Box } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { ContentScaling } from '~/common/app.theme';
import { Is } from '~/common/util/pwaUtils';
import { useLLM } from '~/common/stores/llms/llms.hooks';
import { useModelServiceClientSideFetch } from '~/common/stores/llms/hooks/useModelServiceClientSideFetch';

import { BlockPartError_DirectConnectionRow } from './BlockPartError_DirectConnectionRow';


/**
 * Error recovery component for "Request too large" errors.
 */
export function BlockPartError_RequestExceeded(props: {
  messageGeneratorLlmId?: string | null;
  contentScaling: ContentScaling;
  onRegenerate?: () => void;
}) {

  // external state
  const model = useLLM(props.messageGeneratorLlmId) ?? null;
  const csf = useModelServiceClientSideFetch(true, model);
  const { csfAvailable, vendorName } = csf;

  return (
    <Alert
      size={props.contentScaling === 'xs' ? 'sm' : 'md'}
      color='warning'
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, border: '1px solid', borderColor: 'warning.outlinedBorder' }}
    >

      <WarningRoundedIcon sx={{ flexShrink: 0, mt: 0.25 }} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>

        <Box fontSize='larger'>
          Request Too Large
        </Box>
        <div>
          {/* The 413 can come from any layer in front of the function: the hosted edge network, or a self-hosted
              reverse proxy (nginx, etc.). Don't claim "Vercel" unless this is actually the hosted build. */}
          {Is.Deployment.VercelFromFrontend
            ? <>Your message or attachments exceed the ~4.5&nbsp;MB request limit of the Vercel edge network</>
            : <>Your message or attachments exceed the request size limit of the server</>}
        </div>

        {/* Recovery options */}
        {csfAvailable && (
          <Box color='text.secondary' fontSize='sm' my={2}>
            <strong>Experimental:</strong> enable Direct Connection to {vendorName} to work around size limitations.
          </Box>
        )}

        {/* the switch, or the same row off and disabled with the reason */}
        <BlockPartError_DirectConnectionRow csf={csf} />

          {/* Regenerate button */}
          {/*{props.onRegenerate && (*/}
          {/*  <Button*/}
          {/*    size='sm'*/}
          {/*    variant={csfActive ? 'solid' : 'outlined'}*/}
          {/*    color={csfActive ? 'success' : 'neutral'}*/}
          {/*    startDecorator={<RefreshIcon />}*/}
          {/*    onClick={props.onRegenerate}*/}
          {/*    sx={{ alignSelf: 'flex-start' }}*/}
          {/*  >*/}
          {/*    {csfActive ? 'Regenerate with Direct Connection' : 'Regenerate'}*/}
          {/*  </Button>*/}
          {/*)}*/}

        {!csfAvailable && (
          <Box>
            <Box sx={{ color: 'text.secondary', my: 1 }}>
              Suggestions:
            </Box>
            <Box component='ul' sx={{ color: 'text.secondary' }}>
              <li>Use the cleanup button in the right pane to hide old messages</li>
              <li>Remove large attachments from the conversation</li>
              {/*<li>Reduce conversation length before sending</li>*/}
              {!Is.Deployment.VercelFromFrontend && (
                <li>If self-hosting, raise the request size limit on your server or proxy</li>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Alert>
  );
}
