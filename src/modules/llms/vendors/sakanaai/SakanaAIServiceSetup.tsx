import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorSakanaAI } from './sakanaai.vendor';


const SAKANA_REG_LINK = 'https://console.sakana.ai/get-started';


export function SakanaAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorSakanaAI);

  // derived state
  const { oaiKey: sakanaKey, oaiHost: sakanaHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!sakanaHost;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!sakanaKey && serviceSetupValid);
  const showKeyError = !!sakanaKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='sakana-key' label='Sakana AI Key'
      rightLabel={<>{needsUserKey
        ? !sakanaKey && <Link level='body-sm' href={SAKANA_REG_LINK} target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={sakanaKey} onChange={value => updateSettings({ sakanaKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='fish_...'
    />

    {showAdvanced && <FormTextField
      autoCompleteId='sakana-host'
      title='API Host'
      tooltip={`An alternative Sakana AI API endpoint to use instead of the default 'api.sakana.ai'.`}
      placeholder='e.g., https://api.sakana.ai'
      value={sakanaHost}
      onChange={text => updateSettings({ sakanaHost: text })}
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
