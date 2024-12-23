import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { getCallbackUrl } from '~/common/app.routes';
import { llmsStoreState } from '~/common/stores/llms/store-llms';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidOpenRouterKey, ModelVendorOpenRouter } from './openrouter.vendor';


export function OpenRouterServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasBackendCap, serviceHasLLMs, serviceHasVisibleLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorOpenRouter);

  // derived state
  const { oaiKey } = serviceAccess;
  const needsUserKey = !serviceHasBackendCap;

  const keyValid = isValidOpenRouterKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  const handleOpenRouterLogin = () => {
    // replace the current page with the OAuth page
    const callbackUrl = getCallbackUrl('openrouter');
    const oauthUrl = 'https://openrouter.ai/auth?callback_url=' + encodeURIComponent(callbackUrl);
    window.open(oauthUrl, '_self');
    // ...bye / see you soon at the callback location...
  };

  const handleRemoveNonFreeLLMs = () => {
    // A bit of a hack
    const { llms, removeLLM } = llmsStoreState();
    llms
      .filter(llm => llm.sId === props.serviceId)
      .filter(llm => llm.pricing?.chat?._isFree === false)
      // .forEach(llm => updateLLM(llm.id, { hidden: true }));
      .forEach(llm => removeLLM(llm.id));
  };

  const handleSetVisibilityAll = React.useCallback((visible: boolean) => {
    const { llms, updateLLM } = llmsStoreState();
    llms
      .filter(llm => llm.sId === props.serviceId)
      .forEach(llm => updateLLM(llm.id, { hidden: !visible }));
  }, [props.serviceId]);

  return <>

    <ApproximateCosts serviceId={service?.id} />

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
      value={oaiKey} onChange={value => updateSettings({ oaiKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-or-...'
    />

    <Typography level='body-sm'>
      🎁 A selection of <Link href='https://openrouter.ai/docs#models' target='_blank'>OpenRouter models</Link> are
      made available free of charge. You can get an API key by using the Login button below.
    </Typography>

    {/*<Typography level='body-sm'>*/}
    {/*  🔓 Some models are available free of moderation by OpenRouter.*/}
    {/*  These are usually moderated by the upstream provider (e.g. OpenAI).*/}
    {/*</Typography>*/}

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
            onClick={handleRemoveNonFreeLLMs}
          >
            Only Free 🎁
          </Button>
          <Button
            color='neutral' variant='outlined' size='sm'
            onClick={() => handleSetVisibilityAll(!serviceHasVisibleLLMs)}
            endDecorator={serviceHasVisibleLLMs ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
          >
            {serviceHasVisibleLLMs ? 'Hide' : 'Show'} All
          </Button>
        </Box>
      }
    />

    {isError && <InlineError error={error} />}

  </>;
}
