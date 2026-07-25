import * as React from 'react';

import { Alert, Box, Button, Divider, IconButton, Typography } from '@mui/joy';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { BaseProduct } from '~/common/app.release';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { NvidiaIcon } from '~/common/components/icons/vendors/NvidiaIcon';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorNvidiaNIM } from '../nvidianim/nvidianim.vendor';
import { ModelVendorOpenAI } from './openai.vendor';
import { findMatchingOpenAIAutoProvider, OpenAIHostAutocomplete } from './OpenAIHostAutocomplete';


// --- NVIDIA NIM upgrade notice detection ---

function isNvidiaNIMConfig(host?: string, key?: string) {
  if (!host || !key) return false;
  const isNvidiaHost = host.toLowerCase().includes('integrate.api.nvidia.com');
  const isNvidiaKey = key.startsWith('nvapi-');
  return isNvidiaHost && isNvidiaKey;
}

/**
 * Community upgrade notice: shown on custom-host services pointing at NVIDIA's endpoint, which now
 * has a dedicated vendor (curated models, correct context windows, retired models filtered out).
 */
function NvidiaNIMUpgradeNotice(props: { oaiServiceId: DModelsServiceId, nvapiKey: string }) {

  const handleMigrateService = React.useCallback(() => {
    const { createModelsService, updateServiceSettings, setConfServiceId, removeService } = llmsStoreActions();
    const newService = createModelsService(ModelVendorNvidiaNIM);
    updateServiceSettings(newService.id, { nvidiaKey: props.nvapiKey });
    // select the new service BEFORE removing the current one (same order as the modal's delete handler)
    setConfServiceId(newService.id);
    removeService(props.oaiServiceId);
  }, [props.nvapiKey, props.oaiServiceId]);

  return (
    <Alert variant='soft' color='success' sx={{ alignItems: 'flex-start', gap: 1.5 }}>
      <NvidiaIcon sx={{ fontSize: 'xl3', mt: 0.5 }} />
      <Box>
        <Typography level='title-sm' sx={{ mb: 0.5 }}>NVIDIA NIM is now a dedicated service</Typography>
        <Typography level='body-sm'>
          Thanks to you and the community, NVIDIA&apos;s free models are now fully supported: curated
          model list, correct context windows, reasoning controls, and no more retired models failing
          mid-chat. One click moves your API key to the new service and replaces this one.
        </Typography>
        <Button color='success' onClick={handleMigrateService} sx={{ mt: 1 }}>
          Switch to NVIDIA NIM service
        </Button>
      </Box>
    </Alert>
  );
}


export function OpenAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings, updateLabel } =
    useServiceSetup(props.serviceId, ModelVendorOpenAI);

  // derived state
  const { clientSideFetch, oaiKey, oaiOrg, oaiHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // state
  const initialShowOAIAdvanced = !!props.serviceId?.includes('-') /* likely a custom service */ && needsUserKey && !oaiKey && !oaiHost /* missing both */;
  const advanced = useToggleableBoolean(initialShowOAIAdvanced);
  const showAdvanced = advanced.on;

  const keyValid = true; //isValidOpenAIApiKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;


  // [effect] auto-update the service label when a known provider host is selected
  React.useEffect(() => {
    const match = findMatchingOpenAIAutoProvider(oaiHost);
    if (match)
      updateLabel(match.label);
    else if (!oaiHost)
      updateLabel(''); // resets to vendor default when host is cleared
  }, [oaiHost, updateLabel]);


  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id} />

    {/* Migration notice to the NVIDIA NIM service */}
    {isNvidiaNIMConfig(oaiHost, oaiKey) && (
      <NvidiaNIMUpgradeNotice oaiServiceId={props.serviceId} nvapiKey={oaiKey} />
    )}

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

    {showAdvanced && <Divider>Advanced</Divider>}

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
