import * as React from 'react';

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

import { ModelVendorMiniMax } from './minimax.vendor';


const MINIMAX_REG_LINK = 'https://platform.minimaxi.com/user-center/basic-information/interface-key';


export function MiniMaxServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorMiniMax);

  // derived state
  const { clientSideFetch, oaiKey: minimaxKey, oaiHost: minimaxHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // advanced mode - initialize open if CSF is enabled, but let user toggle freely
  const advanced = useToggleableBoolean(!!clientSideFetch);
  const showAdvanced = advanced.on || !!minimaxHost;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!minimaxKey && serviceSetupValid);
  const showKeyError = !!minimaxKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='minimax-key' label='MiniMax API Key'
      rightLabel={<>{needsUserKey
        ? !minimaxKey && <Link level='body-sm' href={MINIMAX_REG_LINK} target='_blank'>API keys</Link>
        : <AlreadySet />}
      </>}
      value={minimaxKey} onChange={value => updateSettings({ minimaxKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    {showAdvanced && <FormTextField
      autoCompleteId='minimax-host'
      title='API Host'
      tooltip={`An alternative MiniMax API endpoint to use instead of the default 'api.minimax.io'.\n\nExamples:\n - https://api.minimax.io/v1`}
      placeholder='e.g., https://api.minimax.io/v1'
      value={minimaxHost}
      onChange={text => updateSettings({ minimaxHost: text })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!minimaxKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to MiniMax API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
