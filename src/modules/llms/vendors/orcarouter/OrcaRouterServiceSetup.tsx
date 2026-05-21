import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidOrcaRouterKey, ModelVendorOrcaRouter } from './orcarouter.vendor';


export function OrcaRouterServiceSetup(props: { serviceId: DModelsServiceId }) {

  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorOrcaRouter);

  const { oaiKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  const advanced = useToggleableBoolean(false);
  const showAdvanced = advanced.on;

  const keyValid = isValidOrcaRouterKey(oaiKey);
  const keyError = !!oaiKey && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id} />

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography level='body-sm'>
        <Link href='https://www.orcarouter.ai' target='_blank'>OrcaRouter</Link> is an OpenAI-compatible API gateway.
        Use your OrcaRouter API key and model IDs (for example: <code>openai/gpt-4o-mini</code>, <code>anthropic/claude-sonnet-4.6</code>).
      </Typography>

      <Typography level='body-sm'>
        Docs: <Link href='https://docs.orcarouter.ai' target='_blank'>docs.orcarouter.ai</Link>
      </Typography>
    </Box>

    <FormInputKey
      autoCompleteId='orcarouter-key' label='API Key'
      rightLabel={<>{needsUserKey
        ? !oaiKey && <Link level='body-sm' href='https://www.orcarouter.ai' target='_blank'>dashboard</Link>
        : null
      } {oaiKey && keyValid && <Link level='body-sm' href='https://www.orcarouter.ai' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSettings({ orcaKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-orca-...'
    />

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced}
    />

    {isError && <InlineError error={error} />}

  </>;
}
