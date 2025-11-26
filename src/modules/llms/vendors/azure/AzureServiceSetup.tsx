import * as React from 'react';

import { Chip, Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { asValidURL } from '~/common/util/urlUtils';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidAzureApiKey, ModelVendorAzure } from './azure.vendor';


export function AzureServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();
  const [checkboxExpanded, setCheckboxExpanded] = React.useState(false);

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorAzure);

  // derived state
  const { clientSideFetch, oaiKey: azureKey, oaiHost: azureEndpoint } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch;

  const keyValid = isValidAzureApiKey(azureKey);
  const keyError = (/*needsUserKey ||*/ !!azureKey) && !keyValid;
  const hostValid = !!asValidURL(azureEndpoint);
  const hostError = !!azureEndpoint && !hostValid;
  const shallFetchSucceed = azureKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts>
      <div>
        <Typography level='body-sm'>
          We support the <ExternalLink href='https://learn.microsoft.com/en-us/azure/ai-services/openai/overview'>Azure OpenAI Service</ExternalLink>.
          See more for Azure AI Foundry.
          {checkboxExpanded && <>
            {' '}This is because the <ExternalLink href='https://learn.microsoft.com/en-us/azure/ai-studio/what-is-ai-studio'>Azure
            AI Foundry</ExternalLink> requires a different model definition/enumeration, which <ExternalLink icon='issue' href='https://github.com/enricoros/big-AGI/issues/757'>not supported yet</ExternalLink> (PRs welcome).
          </>}
          <Chip component='span' variant='outlined' sx={{ ml: 1, fontSize: '0.75rem' }} onClick={() => setCheckboxExpanded(on => !on)}>
            Show {checkboxExpanded ? 'less' : 'more'}
          </Chip>
        </Typography>
      </div>
    </ApproximateCosts>

    <FormTextField
      autoCompleteId='azure-endpoint'
      title='Azure Endpoint'
      description={<Link level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-azure-openai.md' target='_blank'>configuration</Link>}
      placeholder='https://your-resource.openai.azure.com'
      isError={hostError}
      value={azureEndpoint}
      onChange={text => updateSettings({ azureEndpoint: text })}
    />

    <FormInputKey
      autoCompleteId='azure-key' label='Azure Key'
      rightLabel={<>{needsUserKey
        ? !azureKey && <Link level='body-sm' href='https://azure.microsoft.com/en-us/products/ai-services/openai-service' target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={azureKey} onChange={value => updateSettings({ azureKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='...'
    />

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!(azureKey && azureEndpoint)}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Azure OpenAI API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}