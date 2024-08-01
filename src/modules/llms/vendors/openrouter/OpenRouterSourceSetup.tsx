import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { getCallbackUrl } from '~/common/app.routes';

import { DModelSourceId, useModelsStore } from '../../store-llms';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useSourceSetup } from '../useSourceSetup';

import { isValidOpenRouterKey, ModelVendorOpenRouter } from './openrouter.vendor';


export function OpenRouterSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, sourceHasLLMs, sourceHasVisibleLLMs, access, hasNoBackendCap: needsUserKey, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorOpenRouter);

  // derived state
  const { oaiKey } = access;

  const keyValid = isValidOpenRouterKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!sourceHasLLMs && shallFetchSucceed, source, true);


  const handleOpenRouterLogin = () => {
    // replace the current page with the OAuth page
    const callbackUrl = getCallbackUrl('openrouter');
    const oauthUrl = 'https://openrouter.ai/auth?callback_url=' + encodeURIComponent(callbackUrl);
    window.open(oauthUrl, '_self');
    // ...bye / see you soon at the callback location...
  };

  const handleHideNonFreeLLMs = () => {
    // A bit of a hack
    const { llms, removeLLM } = useModelsStore.getState();
    llms
      .filter(llm => llm.sId === props.sourceId)
      .filter(llm => llm.pricing?.chatIn !== 0 && llm.pricing?.chatOut !== 0)
      // .forEach(llm => updateLLM(llm.id, { hidden: true }));
      .forEach(llm => removeLLM(llm.id));
  };

  const handleSetVisibilityAll = React.useCallback((visible: boolean) => {
    const { llms, updateLLM } = useModelsStore.getState();
    llms
      .filter(llm => llm.sId === props.sourceId)
      .forEach(llm => updateLLM(llm.id, { hidden: !visible }));
  }, [props.sourceId]);

  return <>

    <Typography level='body-sm'>
      <Link href='https://openrouter.ai/keys' target='_blank'>OpenRouter</Link> is an independent service
      granting access to <Link href='https://openrouter.ai/docs#models' target='_blank'>exclusive models</Link> such
      as GPT-4 32k, Claude, and more. <Link
      href='https://github.com/enricoros/big-agi/blob/main/docs/config-openrouter.md' target='_blank'>
      Configuration &amp; documentation</Link>.
    </Typography>

    <FormInputKey
      autoCompleteId='openrouter-key' label='OpenRouter API Key'
      rightLabel={<>{needsUserKey
        ? !oaiKey && <Link level='body-sm' href='https://openrouter.ai/keys' target='_blank'>your keys</Link>
        : <AlreadySet />
      } {oaiKey && keyValid && <Link level='body-sm' href='https://openrouter.ai/activity' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSetup({ oaiKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-or-...'
    />

    <Typography level='body-sm'>
      🎁 A selection of <Link href='https://openrouter.ai/docs#models' target='_blank'>OpenRouter models</Link> are
      made available without charge. You can get an API key by using the Login button below.
    </Typography>

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError}
      leftButton={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            color='neutral' variant={(needsUserKey && !keyValid) ? 'solid' : 'outlined'}
            onClick={handleOpenRouterLogin}
            endDecorator={(needsUserKey && !keyValid) ? '🎁' : undefined}
          >
            OpenRouter Login
          </Button>
          <Button
            color='neutral' variant='outlined' size='sm'
            onClick={handleHideNonFreeLLMs}
          >
            Only Free 🎁
          </Button>
          <Button
            color='neutral' variant='outlined' size='sm'
            onClick={() => handleSetVisibilityAll(!sourceHasVisibleLLMs)}
            endDecorator={sourceHasVisibleLLMs ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
          >
            {sourceHasVisibleLLMs ? 'Hide' : 'Show'} All
          </Button>
        </Box>
      }
    />

    {isError && <InlineError error={error} />}

  </>;
}
