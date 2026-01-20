import * as React from 'react';

import { Alert, Divider, IconButton } from '@mui/joy';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { BaseProduct } from '~/common/app.release';
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

import { ModelVendorOpenAI } from './openai.vendor';
import { OpenAIHostAutocomplete } from './OpenAIHostAutocomplete';


// avoid repeating it all over
const HELICONE_OPENAI_HOST = 'https://oai.hconeai.com';


export function OpenAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings, updateLabel } =
    useServiceSetup(props.serviceId, ModelVendorOpenAI);

  // derived state
  const { clientSideFetch, oaiKey, oaiOrg, oaiHost, heliKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // state
  const initialShowOAIAdvanced = !!props.serviceId?.includes('-') /* likely a custom service */ && needsUserKey && !oaiKey && !oaiHost /* missing both */;
  const advanced = useToggleableBoolean(initialShowOAIAdvanced);
  const showAdvanced = advanced.on;

  const keyValid = true; //isValidOpenAIApiKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id} />


    {(showAdvanced || !!oaiHost) && (
      <OpenAIHostAutocomplete
        value={oaiHost}
        onChange={host => updateSettings({ oaiHost: host })}
      />
    )}

    <FormInputKey
      autoCompleteId='openai-key' label='API Key'
      rightLabel={<>{needsUserKey
        ? (!oaiKey && !oaiHost && <Link level='body-sm' href='https://platform.openai.com/account/api-keys' target='_blank'>create key</Link>)
        : (!oaiHost && <AlreadySet /> /* only show "Already set" when using default OpenAI, not custom endpoints */)
      } {oaiKey && !oaiHost && keyValid && <Link level='body-sm' href='https://platform.openai.com/account/usage' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSettings({ oaiKey: value })}
      required={needsUserKey || !!oaiHost} isError={keyError}
      placeholder='sk-...'
    />

    {showAdvanced && <Divider sx={{ mx: 4, my: 1 }}>Advanced</Divider>}

    {showAdvanced && <FormTextField
      autoCompleteId='openai-service-name'
      title='Custom Name'
      // tooltip='Custom name for this service. Useful when you have multiple OpenAI-compatible services configured.'
      placeholder='e.g., Fireworks, etc.'
      value={service?.label || ''}
      onChange={updateLabel}
      endDecorator={
        <IconButton size='sm' variant='plain' color='neutral' onClick={() => updateLabel('')}>
          <RestartAltIcon />
        </IconButton>
      }
    />}

    {showAdvanced && <FormTextField
      autoCompleteId='openai-org'
      title='Organization ID'
      description={<Link level='body-sm' href={BaseProduct.OpenSourceRepo + '/issues/63'} target='_blank'>What is this</Link>}
      placeholder='Optional, for enterprise users'
      value={oaiOrg}
      onChange={text => updateSettings({ oaiOrg: text })}
    />}

    {showAdvanced && !oaiHost && <FormTextField
      autoCompleteId='openai-helicone-key'
      title='Helicone Key'
      disabled={!!oaiHost}
      description={<>Generate <Link level='body-sm' href='https://www.helicone.ai/keys' target='_blank'>here</Link></>}
      placeholder='sk-...'
      value={heliKey}
      onChange={text => updateSettings({ heliKey: text })}
    />}

    {!!heliKey && <Alert variant='soft' color={oaiHost?.includes(HELICONE_OPENAI_HOST) ? 'success' : 'warning'}>
      Advanced: You set the Helicone key. {!oaiHost?.includes(HELICONE_OPENAI_HOST)
      ? `But you also need to set the API Endpoint to ${HELICONE_OPENAI_HOST} to use Helicone.`
      : 'OpenAI traffic will now be routed through Helicone.'}
    </Alert>}

    {(showAdvanced || clientSideFetch) && <SetupFormClientSideToggle
      visible={!!oaiHost || !!oaiKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText="Fetch models and make requests directly to OpenAI's Responses / Completions and List Models API using your browser instead of through the server."
    />}

    {/* Note, there will be an item here, becasue the former adds an item when visible=false, and as such it must be the last item, to guarantee the gap is always there */}

    <SetupFormRefetchButton refetch={refetch} disabled={isFetching} error={isError} loading={isFetching} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
