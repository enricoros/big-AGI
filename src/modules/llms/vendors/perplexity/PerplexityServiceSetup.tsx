import * as React from 'react';

import { Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { ModelVendorPerplexity } from './perplexity.vendor';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';


const PERPLEXITY_REG_LINK = 'https://www.perplexity.ai/settings/api';


export function PerplexityServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorPerplexity);

  // derived state
  const { clientSideFetch, oaiKey: perplexityKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch;

  // key validation
  const shallFetchSucceed = !needsUserKey || (!!perplexityKey && serviceSetupValid);
  const showKeyError = !!perplexityKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='perplexity-key' label='Perplexity API Key'
      rightLabel={<>{needsUserKey
        ? !perplexityKey && <Link level='body-sm' href={PERPLEXITY_REG_LINK} target='_blank'>API keys</Link>
        : <AlreadySet />}
      </>}
      value={perplexityKey} onChange={value => updateSettings({ perplexityKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <Typography level='body-sm'>
      The <Link href='https://docs.perplexity.ai/docs/getting-started'>Perplexity API</Link> offers inference
      as a service for a variety of models. See the <Link href='https://www.perplexity.ai/' target='_blank'>Perplexity AI</Link> website for more information.
    </Typography>

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!perplexityKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Perplexity API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
