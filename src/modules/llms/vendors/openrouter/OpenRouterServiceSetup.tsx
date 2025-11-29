import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';
import LaunchIcon from '@mui/icons-material/Launch';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { getLLMPricing } from '~/common/stores/llms/llms.types';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { PhGift } from '~/common/components/icons/phosphor/PhGift';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { getCallbackUrl } from '~/common/app.routes';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidOpenRouterKey, ModelVendorOpenRouter } from './openrouter.vendor';


export function OpenRouterServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, serviceHasVisibleLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorOpenRouter);

  // derived state
  const { clientSideFetch, oaiKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch;

  const keyValid = isValidOpenRouterKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;
  const needsLink = needsUserKey && !keyValid;

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

  const handleHIdeNonFreeLLMs = () => {
    const { llms } = llmsStoreState();
    const { updateLLMs } = llmsStoreActions();
    const updates = llms
      .filter(llm => llm.sId === props.serviceId)
      .map(llm => {
        const isFree = getLLMPricing(llm)?.chat?._isFree === true;
        return { id: llm.id, partial: { userHidden: !isFree } };
      });
    updateLLMs(updates);
  };

  const handleSetVisibilityAll = React.useCallback((visible: boolean) => {
    const { llms } = llmsStoreState();
    const { updateLLMs } = llmsStoreActions();
    const updates = llms
      .filter(llm => llm.sId === props.serviceId)
      .map(llm => ({ id: llm.id, partial: { userHidden: !visible } }));
    updateLLMs(updates);
  }, [props.serviceId]);

  return <>

    <ApproximateCosts serviceId={service?.id} />

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography level='body-sm'>
        <Link href='https://openrouter.ai' target='_blank'>OpenRouter</Link> is a service
        providing access to <Link href='https://openrouter.ai/models' target='_blank'>a wide range of models</Link>. See our <Link
        href='https://github.com/enricoros/big-agi/blob/main/docs/config-openrouter.md' target='_blank'>
        Docs</Link>.
      </Typography>

      <Typography level='body-sm' endDecorator={
        <PhGift sx={{ color: 'success.softColor' }} />
        // <Chip component='span' size='sm' color='success' variant='soft' sx={{ borderRadius: 'sm', boxShadow: 'none', border: '1px solid', borderColor: 'success.outlinedBorder', mr: 0.5 }} startDecorator={<PhGift />}>
        //   free
        // </Chip>
      }>
        <span>
          {/*A <Link href='https://openrouter.ai/models?q=%3Afree&order=newest' target='_blank'>selection</Link> of*/}
          A selection of OpenRouter models is made available free of charge.
        </span>
      </Typography>
    </Box>

    <Button
      color='neutral' variant={needsLink ? 'solid' : 'outlined'}
      onClick={handleOpenRouterLogin}
      // endDecorator={needsLink ? <LaunchIcon /> /*<PhKey />*/ /*'🎁'*/ : undefined}
      endDecorator={<LaunchIcon /> /*<PhKey />*/ /*'🎁'*/}
      sx={{ mx: 'auto', boxShadow: needsLink ? 'md' : undefined }}
    >
      {needsLink ? 'Link OpenRouter Key' : 'Create New Key'}
    </Button>

    <FormInputKey
      autoCompleteId='openrouter-key' label='API Key'
      rightLabel={<>{needsUserKey
        ? !oaiKey && <Link level='body-sm' href='https://openrouter.ai/keys' target='_blank'>your keys</Link>
        : <AlreadySet />
      } {oaiKey && keyValid && <Link level='body-sm' href='https://openrouter.ai/activity' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSettings({ oaiKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-or-...'
    />

    {/*<Typography level='body-sm'>*/}
    {/*  🔓 Some models are available free of moderation by OpenRouter.*/}
    {/*  These are usually moderated by the upstream provider (e.g. OpenAI).*/}
    {/*</Typography>*/}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!oaiKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to OpenRouter API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced}
      leftButton={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            color='neutral' variant='outlined' size='sm'
            onClick={handleHIdeNonFreeLLMs}
          >
            Only Free <PhGift sx={{ ml: 1, color: 'success.softColor' }} />
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
