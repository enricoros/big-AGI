import * as React from 'react';

import { FormControl, FormHelperText, Option, Select } from '@mui/joy';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import type { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';
import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorGemini } from './gemini.vendor';


const GEMINI_API_KEY_LINK = 'https://makersuite.google.com/app/apikey';

const SAFETY_OPTIONS: { value: GeminiWire_Safety.HarmBlockThreshold, label: string }[] = [
  { value: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED', label: 'Default' },
  { value: 'BLOCK_LOW_AND_ABOVE', label: 'Low and above' },
  { value: 'BLOCK_MEDIUM_AND_ABOVE', label: 'Medium and above' },
  { value: 'BLOCK_ONLY_HIGH', label: 'Only high' },
  { value: 'BLOCK_NONE', label: 'None' },
];


export function GeminiServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasBackendCap, serviceHasLLMs, serviceSetupValid, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorGemini);

  // derived state
  const { geminiKey, minSafetyLevel } = serviceAccess;
  const needsUserKey = !serviceHasBackendCap;

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

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
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
    </FormControl>

    <FormHelperText sx={{ display: 'block' }}>
      Gemini has <Link href='https://ai.google.dev/docs/safety_setting_gemini' target='_blank' noLinkStyle>
      adjustable safety settings</Link> on: Harassment, Hate speech,
      Sexually explicit, Civic integrity, and Dangerous content, in addition to non-adjustable built-in filters.
      {/*By default, the model will block content with <em>medium and above</em> probability*/}
      {/*of being unsafe.*/}
    </FormHelperText>

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}