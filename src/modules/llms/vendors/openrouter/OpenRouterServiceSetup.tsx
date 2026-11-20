import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';
import NorthEastIcon from '@mui/icons-material/NorthEast';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalDocsLink } from '~/common/components/ExternalDocsLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { PhGift } from '~/common/components/icons/phosphor/PhGift';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { getCallbackUrl } from '~/common/app.routes';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { presentErrorToHumans } from '~/common/util/errorUtils';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidOpenRouterKey, ModelVendorOpenRouter } from './openrouter.vendor';
import { openRouterOAuthBegin } from './openrouter.oauth';


export function OpenRouterServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorOpenRouter);

  // derived state
  const { clientSideFetch, oaiKey, orRequireParameters } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // advanced mode - initialize open if CSF is enabled, but let user toggle freely
  const advanced = useToggleableBoolean(!!clientSideFetch);
  const showAdvanced = advanced.on;

  const keyValid = isValidOpenRouterKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;
  const needsLink = needsUserKey && !keyValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  const handleOpenRouterLogin = React.useCallback(() => {

    // open the window now, inside the click (popup blockers), and navigate it once the PKCE challenge is ready
    // - using just window name - browser decides best presentation for the platform (mobile: tab, desktop: popup)
    const popup = window.open('', 'openrouter-oauth');

    openRouterOAuthBegin(getCallbackUrl('openrouter')).then(oauthUrl => {

      // listen for the key from the callback page (popup/tab)
      const messageHandler = (event: MessageEvent) => {
        // security: validate origin; ignore unrelated messages (with 'once', any message - e.g. from an extension - consumed the listener)
        if (event.origin !== window.location.origin || event.data?.type !== 'openrouter-oauth-success') return;
        window.removeEventListener('message', messageHandler);
        // save the API key (callback page may not have access to store)
        if (event.data.orApiKey)
          llmsStoreActions().setOpenRouterKey(event.data.orApiKey);
        // refresh models list
        refetch();
      };

      if (popup && !popup.closed) {
        window.addEventListener('message', messageHandler);
        popup.location.href = oauthUrl;
      } else
        window.location.href = oauthUrl; // window.open blocked: full-page redirect

    }).catch((error: any) => {
      popup?.close();
      alert(`Could not start the OpenRouter sign-in: ${presentErrorToHumans(error) || 'unknown error'}`);
    });
  }, [refetch]);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography level='body-sm'>
        <Link href='https://openrouter.ai' target='_blank'>OpenRouter</Link> is a service
        providing access to <Link href='https://openrouter.ai/models' target='_blank'>a wide range of models</Link>. See
        our <ExternalDocsLink level='body-sm' docPage='connect-openrouter'>Docs</ExternalDocsLink>.
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
      endDecorator={<NorthEastIcon sx={{ fontSize: 'lg' }} /> /*<PhKey />*/ /*'🎁'*/}
      sx={{ mx: 'auto', minWidth: 200, /*, boxShadow: needsLink ? 'md' : undefined */ }}
    >
      {oaiKey ? 'Get New Key' : 'Get OpenRouter Key'}
    </Button>

    <FormInputKey
      autoCompleteId='openrouter-key' label='API Key'
      rightLabel={<>{needsUserKey
        ? !oaiKey && <Link level='body-sm' href='https://openrouter.ai/keys' target='_blank'>your keys</Link>
        : <AlreadySet overridden={!!oaiKey} />
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

    {(showAdvanced || !!orRequireParameters) && <FormSwitchControl
      title='Require Parameters' on='Strict' off='Default'
      tooltip='When enabled, OpenRouter only routes to providers that support all the parameters in your request (e.g. temperature, top_p, tools). When off, unsupported parameters are silently dropped.'
      description={orRequireParameters ? 'Strict provider filtering' : 'Best-effort routing'}
      checked={!!orRequireParameters}
      onChange={on => updateSettings({ requireParameters: on })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!oaiKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to OpenRouter API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced}
    />

    {isError && <InlineError error={error} />}

  </>;
}
