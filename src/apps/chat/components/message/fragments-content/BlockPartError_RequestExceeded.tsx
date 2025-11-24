import * as React from 'react';

import { Alert, Box, FormHelperText, Switch, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { ContentScaling } from '~/common/app.theme';
import { useLLM } from '~/common/stores/llms/llms.hooks';
import { useModelServiceClientSideFetch } from '~/common/stores/llms/hooks/useModelServiceClientSideFetch';


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
  const { csfAvailable, csfActive, csfToggle } = useModelServiceClientSideFetch(true, model);

  return (
    <Alert
      size={props.contentScaling === 'xs' ? 'sm' : 'md'}
      color='danger'
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
    >

      <WarningRoundedIcon sx={{ flexShrink: 0, mt: 0.25 }} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>

        <Box fontSize='larger'>
          Request Too Large
        </Box>
        <div>
          Your message or attachments exceed the limit of the Vercel edge network.
        </div>

        {/* Recovery options */}
        {csfAvailable ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Explanation */}
            <Box color='text.secondary' fontSize='sm'>
              <strong>Experimental:</strong> enable direct connection to the AI services, and try again.
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
              }}
            >

              <Box sx={{ flex: 1 }}>
                <Box color={!csfActive ? undefined : 'primary.solidBg'} fontWeight='lg' mb={0.5}>
                  Direct Connection {csfActive && '- Now Try Again'}
                </Box>
                <FormHelperText>
                  Bypassing servers and connect directly from this client -&gt; AI provider
                </FormHelperText>
              </Box>

              <Switch
                checked={csfActive}
                onChange={(e) => csfToggle(e.target.checked)}
              />
            </Box>

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
          </Box>
        ) : (
          <Box>
            <Typography level='body-sm' sx={{ mb: 1 }}>
              <strong>Suggestions:</strong>
            </Typography>
            <Typography component='ul' level='body-sm' sx={{ pl: 2, m: 0 }}>
              <li>Use the cleanup button in the right pane to hide old messages</li>
              <li>Remove large attachments from the conversation</li>
              {/*<li>Reduce conversation length before sending</li>*/}
            </Typography>
          </Box>
        )}
      </Box>
    </Alert>
  );
}
