import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorZAI } from './zai.vendor';


const ZAI_REG_LINK = 'https://z.ai/manage-apikey/apikey-list';


export function ZAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorZAI);

  // derived state
  const { clientSideFetch, oaiKey: zaiKey, oaiHost: zaiHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch || !!zaiHost;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!zaiKey && serviceSetupValid);
  const showKeyError = !!zaiKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='zai-key' label='Z.ai Key'
      rightLabel={<>{needsUserKey
        ? !zaiKey && <ExternalLink level='body-sm' href={ZAI_REG_LINK}>request Key</ExternalLink>
        : <AlreadySet />}
      </>}
      value={zaiKey} onChange={value => updateSettings({ zaiKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='Your Z.ai API Key'
    />

    {showAdvanced && <FormTextField
      autoCompleteId='zai-host'
      title='API Host'
      tooltip={`An alternative Z.ai API endpoint to use instead of the default 'api.z.ai'.\n\nExample:\n - https://api.z.ai/api/paas`}
      placeholder='e.g., https://api.z.ai/api/paas'
      value={zaiHost}
      onChange={text => updateSettings({ zaiHost: text })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!zaiKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Z.ai API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
