import * as React from 'react';

import { Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { isKimiCodeSubscriptionKey, ModelVendorMoonshot } from './moonshot.vendor';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';


const MOONSHOT_API_LINK = 'https://platform.moonshot.ai/console/api-keys';
const KIMI_CODE_API_LINK = 'https://www.kimi.com/code/console';


export function MoonshotServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorMoonshot);

  // derived state
  const { clientSideFetch, oaiKey: moonshotKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // key type auto-detection: 'sk-kimi-' keys are Kimi Code subscription keys, routed to api.kimi.com/coding
  const isKimiCodeKey = isKimiCodeSubscriptionKey(moonshotKey);

  // advanced mode - initialize open if CSF is enabled, but let user toggle freely
  const advanced = useToggleableBoolean(!!clientSideFetch);
  const showAdvanced = advanced.on;

  // key validation
  const shallFetchSucceed = !needsUserKey || (!!moonshotKey && serviceSetupValid);
  const showKeyError = !!moonshotKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id}>
      <div>
        <Typography level='body-sm'>
          {isKimiCodeKey
            ? <>Using your <strong>Kimi Code subscription</strong>: listing your plan&apos;s models on the coding endpoint.</>
            : <>Supports both <ExternalLink href={MOONSHOT_API_LINK}>Kimi Platform</ExternalLink> API
              keys and <ExternalLink href={KIMI_CODE_API_LINK}>Kimi Code</ExternalLink> subscription
              keys.</>}
        </Typography>
      </div>
    </ApproximateCosts>

    <FormInputKey
      autoCompleteId='moonshot-key' label={isKimiCodeKey ? 'Kimi Code API Key' : 'Moonshot API Key'}
      rightLabel={<>{needsUserKey
        ? !moonshotKey
          ? <>
            <Link level='body-sm' href={MOONSHOT_API_LINK} target='_blank'>Kimi Platform</Link>
            {' · '}
            <Link level='body-sm' href={KIMI_CODE_API_LINK} target='_blank'>Kimi Code</Link>
          </>
          : isKimiCodeKey ? 'Kimi Code subscription' : 'Kimi Platform'
        : <AlreadySet />}
      </>}
      value={moonshotKey} onChange={value => updateSettings({ moonshotKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='sk-... or sk-kimi-...'
    />

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!moonshotKey && !isKimiCodeKey /* the Kimi Code endpoint has no CORS */}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Moonshot API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
