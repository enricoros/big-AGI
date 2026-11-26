import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormSelectControl, type FormSelectOption } from '~/common/components/forms/FormSelectControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { llmsDeepseekWire } from '../../shared/llm.isomorphic';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorDeepseek } from './deepseekai.vendor';


const DEEPSEEK_REG_LINK = 'https://platform.deepseek.com/api_keys';

type ProtocolChoice = 'auto' | 'messages' | 'chat-completions';
const _protocolOptions = (autoIsMessages: boolean): FormSelectOption<ProtocolChoice>[] => [
  { value: 'auto', label: 'Auto', description: autoIsMessages ? 'Anthropic Messages' : 'Chat Completions: custom host' },
  { value: 'messages', label: 'Anthropic Messages', description: 'Served at /anthropic' },
  { value: 'chat-completions', label: 'Chat Completions', description: 'OpenAI-compatible' },
];


export function DeepseekAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorDeepseek);

  // derived state
  const { clientSideFetch, oaiKey: deepseekKey, oaiHost: deepseekHost, dsProtocol } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // advanced mode - initialize open if CSF is enabled, but let user toggle freely
  const advanced = useToggleableBoolean(!!clientSideFetch);
  const showAdvanced = advanced.on || !!deepseekHost || !!dsProtocol;

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
        : <AlreadySet overridden={!!deepseekKey} />}
      </>}
      value={deepseekKey} onChange={value => updateSettings({ deepseekKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    {showAdvanced && <FormTextField
      autoCompleteId='deepseek-host'
      title='API Host'
      tooltip={`A proxy or gateway to use instead of 'api.deepseek.com'.\n\nAnother host is called with Chat Completions, unless the API Protocol says otherwise.`}
      placeholder='e.g., https://proxy.example.com'
      value={deepseekHost}
      onChange={text => updateSettings({ deepseekHost: text })}
    />}

    {showAdvanced && <FormSelectControl
      title='API Protocol'
      tooltip={`Auto calls api.deepseek.com with Anthropic Messages, and any other host with Chat Completions.\n\nSet Anthropic Messages for a proxy that serves it, or Chat Completions to go back to it on DeepSeek's own host.`}
      options={_protocolOptions(llmsDeepseekWire(undefined, deepseekHost) === 'messages')}
      value={dsProtocol ?? 'auto'}
      onChange={value => updateSettings({ deepseekProtocol: value === 'auto' ? undefined : value })}
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
