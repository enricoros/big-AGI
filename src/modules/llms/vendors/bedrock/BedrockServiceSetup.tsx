import * as React from 'react';

import { Box, Divider, IconButton, Typography } from '@mui/joy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ClaudeCrabIcon } from '~/common/components/icons/vendors/ClaudeCrabIcon';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { BedrockRegionAutocomplete } from './BedrockRegionAutocomplete';
import { isValidBedrockAccessKeyId, isValidBedrockBearerToken, isValidBedrockSecretAccessKey, ModelVendorBedrock } from './bedrock.vendor';


const _styles = {
  iamGrid: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
    gap: 'var(--Card-padding, 1rem)',
  },
  iamSectionDimmed: {
    display: 'none',
    // opacity: 0.5,
    // pointerEvents: 'none',
    // transition: 'opacity 0.2s',
  },
} as const;


export function BedrockServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorBedrock);

  // derived state
  const { bedrockAccessKeyId, bedrockSecretAccessKey, bedrockBearerToken, bedrockRegion } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // advanced mode
  // const advanced = useToggleableBoolean(!!bedrockSessionToken);
  const [showSetupInstructions, setShowSetupInstructions] = React.useState(false);

  // Bearer validation
  const bearerTokenValid = isValidBedrockBearerToken(bedrockBearerToken);
  const bearerTokenError = !!bedrockBearerToken && !bearerTokenValid;

  // IAM validation
  const accessKeyValid = isValidBedrockAccessKeyId(bedrockAccessKeyId);
  const secretKeyValid = isValidBedrockSecretAccessKey(bedrockSecretAccessKey);
  const accessKeyError = !!bedrockAccessKeyId && !accessKeyValid;
  const secretKeyError = !!bedrockSecretAccessKey && !secretKeyValid;

  // bearer token takes implicit priority - dim IAM when bearer is active
  const hasBearer = !!bedrockBearerToken;
  // const hasIAM = !!bedrockAccessKeyId || !!bedrockSecretAccessKey;


  // fetch: succeed if valid client credentials exist, or server-configured
  const shallFetchSucceed =
    bedrockBearerToken ? bearerTokenValid
      : bedrockAccessKeyId ? (accessKeyValid && secretKeyValid)
        : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <ClaudeCrabIcon sx={{ fontSize: '2rem', mt: 0.5 }} />
        <Box sx={{ flex: 1 }}>
          Access Claude models through your <Link color='neutral' href='https://aws.amazon.com/bedrock/' level='body-sm' target='_blank'>AWS Bedrock</Link> account
          using a long-term <strong>API Key</strong> or <strong>IAM credentials</strong>.
          {showSetupInstructions && (
            <Typography level='body-xs' component='ol' sx={{ pl: 2, mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <li><strong>API Key</strong>: in the <Link href='https://console.aws.amazon.com/bedrock/' target='_blank'>Bedrock Console</Link>, create a long-term key (<code>ABSK...</code>). Short-term keys don&apos;t support model listing</li>
              <li><strong>AWS IAM</strong>: in the <Link href='https://console.aws.amazon.com/iam/' target='_blank'>IAM Console</Link>, create a user with the <strong>AmazonBedrockFullAccess</strong> permission policy. Open the user, go to <strong>Security credentials</strong>, then <strong>Create access key</strong> (<strong>&quot;Application running outside AWS&quot;</strong>) and copy both keys</li>
              <li>Select your <strong>AWS Models Region</strong> below</li>
            </Typography>
          )}
        </Box>
        <IconButton size='sm' variant={showSetupInstructions ? 'solid' : 'soft'} color='neutral' onClick={() => setShowSetupInstructions(on => !on)}>
          <InfoOutlinedIcon />
        </IconButton>
      </Box>
    </ApproximateCosts>


    {/* Bearer token (API Key) - highest client-side priority */}
    <FormInputKey
      autoCompleteId='bedrock-bearer-token' label='Bedrock long-term API Key'
      rightLabel={<>{needsUserKey
        ? undefined
        : <AlreadySet />
      }</>}
      value={bedrockBearerToken} onChange={value => updateSettings({ bedrockBearerToken: value })}
      required={false} // required={needsUserKey && !hasIAM}
      isError={bearerTokenError}
      placeholder='ABSK...'
    />

    {!hasBearer && <Divider>or</Divider>}

    {/* IAM credentials - side by side on md+, stacked on mobile, dimmed when bearer is active */}
    {!hasBearer && <Box sx={hasBearer ? _styles.iamSectionDimmed : undefined}>
      <Box sx={_styles.iamGrid}>
        <FormInputKey
          autoCompleteId='bedrock-access-key-id' label='AWS Access Key ID'
          rightLabel={<>{needsUserKey
            ? undefined
            : <AlreadySet />
          }</>}
          value={bedrockAccessKeyId} onChange={value => updateSettings({ bedrockAccessKeyId: value })}
          required={false} // required={needsUserKey && !hasBearer}
          isError={accessKeyError}
          placeholder='AKIA...'
        />

        <FormInputKey
          autoCompleteId='bedrock-secret-access-key' label='AWS Secret Access Key'
          value={bedrockSecretAccessKey} onChange={value => updateSettings({ bedrockSecretAccessKey: value })}
          required={false} // required={needsUserKey && !hasBearer}
          isError={secretKeyError}
          placeholder='wJalr...'
        />
      </Box>
    </Box>}


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

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} /*advanced={advanced}*/ />

    {isError && <InlineError error={error} />}

  </>;
}
