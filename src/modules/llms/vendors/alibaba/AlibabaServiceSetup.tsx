import * as React from 'react';

import { Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
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

import { ModelVendorAlibaba } from './alibaba.vendor';


const CLIENT_ALIBABA_DEFAULT_HOST = 'https://dashscope-intl.aliyuncs.com/compatible-mode';
const ALIBABA_REG_LINK = 'https://bailian.console.alibabacloud.com/?apiKey=1#/api-key';
const ALIBABA_MODELS = 'https://www.alibabacloud.com/help/en/model-studio/getting-started/models';


export function AlibabaServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorAlibaba);

  // derived state
  const { clientSideFetch, oaiKey: alibabaOaiKey, oaiHost: alibabaOaiHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const shallFetchSucceed = !needsUserKey || (!!alibabaOaiKey && serviceSetupValid);
  const showKeyError = !!alibabaOaiKey && !serviceSetupValid;
  const showAdvanced = advanced.on || !!clientSideFetch;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id}>
      <div>
        <Typography level='body-sm'>
          Alibaba Cloud supports the <ExternalLink href={ALIBABA_MODELS}>following models</ExternalLink> via
          the OpenAI-compatible endpoint.
        </Typography>
      </div>
    </ApproximateCosts>

    <FormInputKey
      autoCompleteId='alibaba-key' label='Alibaba Cloud API Key'
      rightLabel={needsUserKey
        ? alibabaOaiKey && <Link level='body-sm' href={ALIBABA_REG_LINK} target='_blank'>get API key</Link>
        : <AlreadySet />
      }
      value={alibabaOaiKey}
      onChange={value => updateSettings({ alibabaOaiKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder={needsUserKey ? 'sk-...' : ''}
    />

    {/*<Typography level='body-sm'>*/}
    {/*  Alibaba Cloud Qwen models provide high-quality language model capabilities.*/}
    {/*  See the <ExternalLink href={ALIBABA_REG_LINK}>Alibaba Cloud Model Studio</ExternalLink> for more information.*/}
    {/*</Typography>*/}

    {showAdvanced && <FormTextField
      autoCompleteId='alibaba-host'
      title='API Endpoint'
      tooltip={`The API endpoint for the Alibaba Cloud OpenAI service, to be used instead of the default endpoint.`}
      placeholder={`e.g., ${CLIENT_ALIBABA_DEFAULT_HOST}`}
      value={alibabaOaiHost}
      onChange={text => updateSettings({ alibabaOaiHost: text })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!alibabaOaiKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Alibaba Cloud API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
