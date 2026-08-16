import * as React from 'react';

import { Box, FormControl, FormHelperText, Option, Select, Typography } from '@mui/joy';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { IconButton } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import type { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';
import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidVertexBearerToken, isValidVertexProjectId, ModelVendorVertexAI } from './vertexai.vendor';


const SAFETY_OPTIONS: { value: GeminiWire_Safety.HarmBlockThreshold, label: string }[] = [
  { value: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED', label: 'Default' },
  { value: 'BLOCK_LOW_AND_ABOVE', label: 'Low and above' },
  { value: 'BLOCK_MEDIUM_AND_ABOVE', label: 'Medium and above' },
  { value: 'BLOCK_ONLY_HIGH', label: 'Only high' },
  { value: 'BLOCK_NONE', label: 'None' },
  { value: 'OFF', label: 'Safety Filter Off (2025)' },
];


/**
 * Vertex AI service setup — dedicated vendor UI per #1134 Option A.
 * Token acquisition: paste short-lived token or rely on server VERTEX_AI_BEARER_TOKEN
 * (refreshed externally). No shell/gcloud from the browser (web app constraint).
 */
export function VertexAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, serviceSetupValid, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorVertexAI);

  const { clientSideFetch, geminiBearerToken, vertexProjectId, vertexLocation, geminiHost, minSafetyLevel } = serviceAccess as typeof serviceAccess & {
    geminiBearerToken?: string;
    vertexProjectId?: string;
    vertexLocation?: string;
  };

  // Map access fields back to settings names used by the vendor
  const vertexBearerToken = geminiBearerToken || '';
  const projectId = vertexProjectId || '';
  const location = vertexLocation || '';
  const vertexHost = geminiHost || '';

  const needsUserKey = !serviceHasCloudTenantConfig;
  const advanced = useToggleableBoolean(false);
  const showAdvanced = advanced.on;
  const [showHelp, setShowHelp] = React.useState(false);

  const bearerValid = isValidVertexBearerToken(vertexBearerToken);
  const projectValid = isValidVertexProjectId(projectId);
  const bearerError = !!vertexBearerToken && !bearerValid;

  const shallFetchSucceed =
    serviceHasCloudTenantConfig
    || (bearerValid && projectValid)
    || (!needsUserKey && serviceSetupValid);

  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography level='body-sm'>
            Use <strong>Google Vertex AI</strong> with short-lived Bearer tokens (ADC / enterprise),
            not static Gemini API keys.{' '}
            <Link level='body-sm' href='https://github.com/enricoros/big-AGI/issues/1134' target='_blank'>#1134</Link>
          </Typography>
          {showHelp && (
            <Typography level='body-xs' component='ol' sx={{ pl: 2, mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <li>Obtain a token outside the browser, e.g. <code>gcloud auth application-default print-access-token</code></li>
              <li>Paste it below (tokens typically expire in ~1 hour), or set server env <code>VERTEX_AI_BEARER_TOKEN</code> via a refresh sidecar</li>
              <li>Set your GCP <strong>Project ID</strong> and <strong>Location</strong> (e.g. <code>us-central1</code> or <code>global</code>)</li>
              <li>Optional: custom API host for enterprise gateways</li>
            </Typography>
          )}
        </Box>
        <IconButton size='sm' variant={showHelp ? 'solid' : 'soft'} color='neutral' onClick={() => setShowHelp(on => !on)}>
          <InfoOutlinedIcon />
        </IconButton>
      </Box>
    </ApproximateCosts>

    <FormInputKey
      autoCompleteId='vertex-bearer-token'
      label='Bearer Token (ADC / gateway)'
      rightLabel={<>{!needsUserKey ? <AlreadySet /> : undefined}</>}
      value={vertexBearerToken}
      onChange={value => updateSettings({ vertexBearerToken: value.trim() })}
      required={needsUserKey}
      isError={bearerError}
      placeholder='ya29... short-lived access token'
    />

    <FormTextField
      autoCompleteId='vertex-project-id'
      title='GCP Project ID'
      placeholder='my-gcp-project'
      value={projectId}
      onChange={text => updateSettings({ vertexProjectId: text.trim() })}
    />

    <FormTextField
      autoCompleteId='vertex-location'
      title='Location'
      placeholder='us-central1 or global'
      value={location}
      onChange={text => updateSettings({ vertexLocation: text.trim() })}
    />

    {showAdvanced && <FormTextField
      autoCompleteId='vertex-host'
      title='API Endpoint (optional)'
      placeholder='https://aiplatform.googleapis.com'
      value={vertexHost}
      onChange={text => updateSettings({ vertexHost: text.trim() })}
    />}

    {showAdvanced && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Safety Settings' description='Threshold' />
      <Select
        variant='outlined'
        value={minSafetyLevel}
        onChange={(_event, value) => value && updateSettings({ minSafetyLevel: value })}
        startDecorator={<HealthAndSafetyIcon sx={{ display: { xs: 'none', sm: 'inherit' } }} />}
        slotProps={{
          root: { sx: { width: '100%' } },
          indicator: { sx: { opacity: 0.5 } },
          button: { sx: { whiteSpace: 'inherit' } },
        }}
      >
        {SAFETY_OPTIONS.map(option => (
          <Option key={'vertex-safety-' + option.value} value={option.value}>{option.label}</Option>
        ))}
      </Select>
    </FormControl>}

    {showAdvanced && <FormHelperText sx={{ display: 'block' }}>
      Self-hosted deployments can set <code>VERTEX_AI_BEARER_TOKEN</code>, <code>VERTEX_AI_PROJECT_ID</code>, and{' '}
      <code>VERTEX_AI_LOCATION</code> and refresh the token with a cron/sidecar — the browser never runs gcloud.
    </FormHelperText>}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!vertexBearerToken}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText="Fetch models and make requests from the browser (token stays on the client). Requires Vertex CORS / gateway support."
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
