import * as React from 'react';

import { FormControl, FormHelperText, Option, Select } from '@mui/joy';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import type { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';
import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorGemini } from './gemini.vendor';


const GEMINI_API_KEY_LINK = 'https://aistudio.google.com/app/apikey';

const SAFETY_OPTIONS: { value: GeminiWire_Safety.HarmBlockThreshold, label: string }[] = [
  { value: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED', label: 'Default' },
  { value: 'BLOCK_LOW_AND_ABOVE', label: 'Low and above' },
  { value: 'BLOCK_MEDIUM_AND_ABOVE', label: 'Medium and above' },
  { value: 'BLOCK_ONLY_HIGH', label: 'Only high' },
  { value: 'BLOCK_NONE', label: 'None' },
  { value: 'OFF', label: 'Safety Filter Off (2025)' },
];


export function GeminiServiceSetup(props: { serviceId: DModelsServiceId }) {

  // advanced mode
  const advanced = useToggleableBoolean(false);

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, serviceSetupValid, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorGemini);

  // derived state
  const { geminiKey, geminiHost, minSafetyLevel } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  const shallFetchSucceed = !needsUserKey || (!!geminiKey && serviceSetupValid);
  const showKeyError = !!geminiKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='gemini-key' label='Gemini API Key'
      rightLabel={<>{needsUserKey
        ? !geminiKey && <Link level='body-sm' href={GEMINI_API_KEY_LINK} target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={geminiKey} onChange={value => updateSettings({ geminiKey: value.trim() })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    {advanced.on && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Safety Settings'
                      description='Threshold' />
      <Select
        variant='outlined'
        value={minSafetyLevel} onChange={(_event, value) => value && updateSettings({ minSafetyLevel: value })}
        startDecorator={<HealthAndSafetyIcon sx={{ display: { xs: 'none', sm: 'inherit' } }} />}
        // indicator={<KeyboardArrowDownIcon />}
        slotProps={{
          root: { sx: { width: '100%' } },
          indicator: { sx: { opacity: 0.5 } },
          button: { sx: { whiteSpace: 'inherit' } },
        }}
      >
        {SAFETY_OPTIONS.map(option => (
          <Option key={'gemini-safety-' + option.value} value={option.value}>{option.label}</Option>
        ))}
      </Select>
    </FormControl>}

    {advanced.on && <FormHelperText sx={{ display: 'block' }}>
      Gemini has advanced <Link href='https://ai.google.dev/docs/safety_setting_gemini' target='_blank' noLinkStyle>
      safety settings</Link> on: harassment, hate speech,
      sexually explicit, civic integrity, and dangerous content, in addition to non-adjustable built-in filters.
      {/*By default, the model will block content with <em>medium and above</em> probability*/}
      {/*of being unsafe.*/}
    </FormHelperText>}

    {advanced.on && <FormTextField
      autoCompleteId='gemini-host'
      title='API Endpoint'
      placeholder={`https://generativelanguage.googleapis.com`}
      value={geminiHost}
      onChange={text => updateSettings({ geminiHost: text })}
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}