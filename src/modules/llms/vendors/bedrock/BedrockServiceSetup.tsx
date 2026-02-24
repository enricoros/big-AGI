import * as React from 'react';

import { Box } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidBedrockAccessKeyId, isValidBedrockSecretAccessKey, ModelVendorBedrock } from './bedrock.vendor';


// AWS regions that support Bedrock
const BEDROCK_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-3',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
] as const;


export function BedrockServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorBedrock);

  // derived state
  const { bedrockAccessKeyId, bedrockSecretAccessKey, bedrockSessionToken, bedrockRegion } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // advanced mode
  const advanced = useToggleableBoolean(!!bedrockSessionToken);

  const accessKeyValid = isValidBedrockAccessKeyId(bedrockAccessKeyId);
  const secretKeyValid = isValidBedrockSecretAccessKey(bedrockSecretAccessKey);
  const accessKeyError = (!!bedrockAccessKeyId) && !accessKeyValid;
  const secretKeyError = (!!bedrockSecretAccessKey) && !secretKeyValid;
  const shallFetchSucceed = bedrockAccessKeyId ? (accessKeyValid && secretKeyValid) : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id}>
      <Box sx={{ level: 'body-sm' }}>
        Access Claude and other AI models through <Link href='https://aws.amazon.com/bedrock/' level='body-sm' target='_blank'>AWS Bedrock</Link>.
        Requires an AWS account with Bedrock model access enabled.
      </Box>
    </ApproximateCosts>

    <FormInputKey
      autoCompleteId='bedrock-access-key-id' label='AWS Access Key ID'
      rightLabel={!needsUserKey ? 'Set on server' : undefined}
      value={bedrockAccessKeyId} onChange={value => updateSettings({ bedrockAccessKeyId: value })}
      required={needsUserKey} isError={accessKeyError}
      placeholder='AKIA...'
    />

    <FormInputKey
      autoCompleteId='bedrock-secret-access-key' label='AWS Secret Access Key'
      value={bedrockSecretAccessKey} onChange={value => updateSettings({ bedrockSecretAccessKey: value })}
      required={needsUserKey} isError={secretKeyError}
      placeholder='wJalr...'
    />

    <FormTextField
      autoCompleteId='bedrock-region'
      title='AWS Region'
      description={<>See <Link level='body-sm' href='https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html' target='_blank'>available regions</Link></>}
      placeholder='us-west-2'
      isError={false}
      value={bedrockRegion || ''}
      onChange={text => updateSettings({ bedrockRegion: text || BEDROCK_REGIONS[1] })}
    />

    {advanced.on && <FormTextField
      autoCompleteId='bedrock-session-token'
      title='Session Token'
      description='For temporary/STS credentials'
      placeholder='FwoGZX...'
      isError={false}
      value={bedrockSessionToken || ''}
      onChange={text => updateSettings({ bedrockSessionToken: text })}
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
