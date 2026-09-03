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

import { ModelVendorMetaAI } from './metaai.vendor';


const METAAI_REG_LINK = 'https://dev.meta.ai/api-keys';


export function MetaAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorMetaAI);

  // derived state
  const { clientSideFetch, oaiKey: metaaiKey, oaiHost: metaaiHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch || !!metaaiHost;

  // key validation
  const shallFetchSucceed = !needsUserKey || (!!metaaiKey && serviceSetupValid);
  const showKeyError = !!metaaiKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='metaai-key' label='Meta AI Key'
      rightLabel={<>{needsUserKey
        ? !metaaiKey && <ExternalLink level='body-sm' href={METAAI_REG_LINK}>get a Key</ExternalLink>
        : <AlreadySet />}
      </>}
      value={metaaiKey} onChange={value => updateSettings({ metaaiKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='LLM_...'
    />

    {showAdvanced && <FormTextField
      autoCompleteId='metaai-host'
      title='API Host'
      tooltip={`An alternative Meta AI endpoint to use instead of the default 'api.meta.ai'.`}
      placeholder='e.g., https://api.meta.ai'
      value={metaaiHost}
      onChange={text => updateSettings({ metaaiHost: text })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!metaaiKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Meta AI from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
