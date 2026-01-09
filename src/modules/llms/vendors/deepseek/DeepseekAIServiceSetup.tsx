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

import { ModelVendorDeepseek } from './deepseekai.vendor';


const DEEPSEEK_REG_LINK = 'https://platform.deepseek.com/api_keys';


export function DeepseekAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorDeepseek);

  // derived state
  const { clientSideFetch, oaiKey: deepseekKey, oaiHost: deepseekHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch || !!deepseekHost;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!deepseekKey && serviceSetupValid);
  const showKeyError = !!deepseekKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='deepseek-key' label='Deepseek Key'
      rightLabel={<>{needsUserKey
        ? !deepseekKey && <Link level='body-sm' href={DEEPSEEK_REG_LINK} target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={deepseekKey} onChange={value => updateSettings({ deepseekKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    {showAdvanced && <FormTextField
      autoCompleteId='deepseek-host'
      title='API Host'
      tooltip={`An alternative Deepseek API endpoint to use instead of the default 'api.deepseek.com'.\n\nExamples:\n - https://api.deepseek.com/beta`}
      placeholder='e.g., https://api.deepseek.com/beta'
      value={deepseekHost}
      onChange={text => updateSettings({ deepseekHost: text })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!deepseekKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Deepseek API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
