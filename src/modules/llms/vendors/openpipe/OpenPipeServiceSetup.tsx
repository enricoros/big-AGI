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
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorOpenPipe } from './openpipe.vendor';


const OPENPIPE_API_KEY_LINK = 'https://app.openpipe.ai/settings';


export function OpenPipeServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorOpenPipe);

  // derived state
  const { clientSideFetch, oaiKey: openPipeKey, oaiOrg: openPipeTags } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!openPipeKey && serviceSetupValid);
  const showKeyError = !!openPipeKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='openpipe-key' label='OpenPipe Project API Key'
      rightLabel={<>{needsUserKey
        ? !openPipeKey && <Link level='body-sm' href={OPENPIPE_API_KEY_LINK} target='_blank'>Get API Key</Link>
        : <AlreadySet />}
      </>}
      value={openPipeKey} onChange={value => updateSettings({ openPipeKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='opk_...'
    />

    {/*<FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>*/}
    {/*  <FormLabelStart*/}
    {/*    title='Log Requests'*/}
    {/*    description='Sets op-log-request header'*/}
    {/*  />*/}
    {/*  <Checkbox size='sm' label='Log' disabled checked />*/}
    {/*</FormControl>*/}

    <FormInputKey
      autoCompleteId='openpipe-tags' label='OpenPipe Tags'
      noKey required={false}
      rightLabel={<Link level='body-sm' href='https://docs.openpipe.ai/features/request-logs/logging-requests' target='_blank'>Learn more</Link>}
      placeholder='e.g. {"prompt_id": "first_prompt"}'
      value={openPipeTags} onChange={value => updateSettings({ openPipeTags: value })}
    />

    <Typography level='body-sm'>
      <ExternalLink href='https://openpipe.ai/'>OpenPipe</ExternalLink> allows you to <strong>record your chats</strong>,
      and <strong>fine-tune</strong> and deploy custom models cost-effectively for specific tasks.
    </Typography>

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!openPipeKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to OpenPipe API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
