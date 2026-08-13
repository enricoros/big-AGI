import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import type { FormRadioOption } from '~/common/components/forms/FormRadioControl';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorModular } from './modular.vendor';


const MODULAR_REG_LINK = 'https://console.modular.com/api_tokens';

const _modularModes: ReadonlyArray<FormRadioOption<'cloud' | 'selfhosted'>> = [
  { value: 'cloud', label: 'Modular Cloud', description: 'Prepaid credits at console.modular.com' },
  { value: 'selfhosted', label: 'MAX self-hosted', description: 'Your own MAX server, OpenAI-compatible' },
] as const;


export function ModularServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    partialSettings, serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorModular);

  // derived state
  const { oaiKey: modularKey, oaiHost: modularHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // the mode is not carried by the access object (cloud sends an empty host), so read the setting directly
  const isCloud = (partialSettings?.mode ?? 'cloud') === 'cloud';

  // key validation
  const shallFetchSucceed = !needsUserKey || (isCloud ? serviceSetupValid : !!modularHost);
  const showKeyError = isCloud && !!modularKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormChipControl
      title='Endpoint'
      options={_modularModes}
      value={isCloud ? 'cloud' : 'selfhosted'}
      onChange={mode => updateSettings({ mode })}
    />

    {!isCloud && <FormInputKey
      autoCompleteId='modular-host' label='MAX Server URL'
      required noKey
      placeholder='http://localhost:8000'
      value={modularHost} onChange={value => updateSettings({ modularHost: value })}
    />}

    <FormInputKey
      autoCompleteId='modular-key' label='Modular API Key'
      rightLabel={<>{needsUserKey
        ? !modularKey && isCloud && <Link level='body-sm' href={MODULAR_REG_LINK} target='_blank'>API tokens</Link>
        : <AlreadySet />}
      </>}
      description={isCloud ? 'A 401 can also mean the prepaid credits ran out, or the token expired - not only a wrong key.' : undefined}
      value={modularKey} onChange={value => updateSettings({ modularKey: value })}
      required={needsUserKey && isCloud} isError={showKeyError}
      placeholder='sk-mod-...'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
