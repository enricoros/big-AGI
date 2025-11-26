import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorXAI } from './xai.vendor';


// configuration
const EXTERNAL_LINK_XAI_API_KEYS = 'https://console.x.ai/';


export function XAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, serviceSetupValid, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorXAI);

  // derived state
  const { clientSideFetch, oaiKey: xaiKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch;

  // key validation
  const shallFetchSucceed = !needsUserKey || (!!xaiKey && serviceSetupValid);
  const showKeyError = !!xaiKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='xai-key'
      label='API Key'
      rightLabel={<>{needsUserKey
        ? !xaiKey && <ExternalLink level='body-sm' href={EXTERNAL_LINK_XAI_API_KEYS}>get a key</ExternalLink>
        : <AlreadySet />}
      </>}
      value={xaiKey}
      onChange={(value) => updateSettings({ xaiKey: value })}
      required={needsUserKey}
      isError={showKeyError}
      placeholder='Your xAI API Key'
    />

    {/*<FormTextField*/}
    {/*  autoCompleteId='xai-host'*/}
    {/*  title='API Host'*/}
    {/*  placeholder='https://api.x.ai'*/}
    {/*  value={xaiHost}*/}
    {/*  onChange={(text) => updateSettings({ xaiHost: text })}*/}
    {/*/>*/}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!xaiKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to xAI API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={isFetching} error={isError} loading={isFetching} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
