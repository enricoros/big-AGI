import * as React from 'react';

import { Box, IconButton, Typography } from '@mui/joy';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { ClaudeCrabIcon } from '~/common/components/icons/vendors/ClaudeCrabIcon';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { BedrockRegionAutocomplete } from './BedrockRegionAutocomplete';
import { isValidBedrockAccessKeyId, isValidBedrockSecretAccessKey, ModelVendorBedrock } from './bedrock.vendor';


export function BedrockServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorBedrock);

  // derived state
  const { bedrockAccessKeyId, bedrockSecretAccessKey, bedrockSessionToken, bedrockRegion } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // advanced mode
  // const advanced = useToggleableBoolean(!!bedrockSessionToken);
  const [showSetupInstructions, setShowSetupInstructions] = React.useState(false);

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
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <ClaudeCrabIcon sx={{ fontSize: '2rem', mt: 0.5 }} />
        <Box sx={{ flex: 1 }}>
          Access Claude models through your <Link color='neutral' href='https://aws.amazon.com/bedrock/' level='body-sm' target='_blank'>AWS Bedrock</Link> account.
          Requires an IAM Access Key with Bedrock permissions.
          {showSetupInstructions && (
            <Typography level='body-xs' component='ol' sx={{ pl: 2, mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <li>Open the <Link href='https://console.aws.amazon.com/iam/' target='_blank'>AWS IAM Console</Link></li>
              <li>Go to <strong>Users</strong> -&gt; <strong>Create user</strong> (e.g. <code>big-agi-bedrock</code>, no console access)</li>
              <li>Attach the <strong>AmazonBedrockFullAccess</strong> policy</li>
              <li>Open the user -&gt; <strong>Security credentials</strong> -&gt; <strong>Create access key</strong></li>
              <li>Select <strong>&quot;Application running outside AWS&quot;</strong> -&gt; Create</li>
              <li>Copy the <strong>Access Key ID</strong> and <strong>Secret Access Key</strong> (shown only once)</li>
              <li>Enter them below with your <strong>AWS Region</strong></li>
            </Typography>
          )}
        </Box>
        <IconButton size='sm' variant='plain' color='neutral' onClick={() => setShowSetupInstructions(on => !on)}>
          {showSetupInstructions ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
        </IconButton>
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

    <BedrockRegionAutocomplete
      value={bedrockRegion || ''}
      onChange={value => updateSettings({ bedrockRegion: value })}
    />

    {/*{advanced.on && <FormTextField*/}
    {/*  autoCompleteId='bedrock-session-token'*/}
    {/*  title='Session Token'*/}
    {/*  description='For temporary/STS credentials'*/}
    {/*  placeholder='FwoGZX...'*/}
    {/*  isError={false}*/}
    {/*  value={bedrockSessionToken || ''}*/}
    {/*  onChange={text => updateSettings({ bedrockSessionToken: text })}*/}
    {/*/>}*/}

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />
    {/*<SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced} />*/}

    {isError && <InlineError error={error} />}

  </>;
}
