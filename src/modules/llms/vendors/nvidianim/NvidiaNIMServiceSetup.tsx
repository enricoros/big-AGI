import * as React from 'react';

import { Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorNvidiaNIM } from './nvidianim.vendor';


const NVIDIA_REG_LINK = 'https://build.nvidia.com/settings/api-keys';


export function NvidiaNIMServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorNvidiaNIM);

  // derived state
  const { clientSideFetch, oaiKey: nvidiaKey, oaiHost: nvidiaHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // state
  const advanced = useToggleableBoolean(!!nvidiaHost || !!clientSideFetch);
  const showAdvanced = advanced.on || !!nvidiaHost;

  const keyValid = nvidiaKey.startsWith('nvapi-');
  const shallFetchSucceed = nvidiaKey ? keyValid : (!needsUserKey || !!nvidiaHost);
  const showKeyError = !!nvidiaKey && !keyValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='nvidianim-key' label='NVIDIA API Key'
      rightLabel={<>{needsUserKey
        ? !nvidiaKey && <Link level='body-sm' href={NVIDIA_REG_LINK} target='_blank'>get API Key</Link>
        : <AlreadySet />}
      </>}
      value={nvidiaKey} onChange={value => updateSettings({ nvidiaKey: value })}
      required={needsUserKey && !nvidiaHost} isError={showKeyError}
      placeholder='nvapi-...'
    />

    <Typography level='body-sm'>
      Free hosted models from <Link href='https://build.nvidia.com' target='_blank'>build.nvidia.com</Link> (Nemotron,
      GPT-OSS, DeepSeek, and more), rate-limited to ~40 requests/minute. When creating the key, make sure it includes
      the <code>Public API Endpoints</code> scope. Note: NVIDIA&apos;s trial terms allow it to use prompts to improve
      its services.
    </Typography>

    {showAdvanced && <FormTextField
      autoCompleteId='nvidianim-host'
      title='API Host'
      tooltip={`An alternative endpoint instead of the default 'integrate.api.nvidia.com' - e.g. a self-hosted NIM or vLLM server (such as on a DGX Spark: http://spark-xxxx.local:8000).`}
      placeholder='e.g., http://localhost:8000'
      value={nvidiaHost}
      onChange={text => updateSettings({ nvidiaHost: text })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!nvidiaHost}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect to your custom host directly from the browser. Not available on the default NVIDIA host (CORS).'
      localHostDetected={nvidiaHost?.includes('localhost') || nvidiaHost?.includes('127.0.0.1') || nvidiaHost?.includes('.local')}
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
