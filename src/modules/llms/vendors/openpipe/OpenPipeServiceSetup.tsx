import * as React from 'react';

import { Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorOpenPipe } from './openpipe.vendor';


const OPENPIPE_API_KEY_LINK = 'https://app.openpipe.ai/settings';


export function OpenPipeServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  // const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasBackendCap, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorOpenPipe);

  // derived state
  const { oaiKey: openPipeKey, oaiOrg: openPipeTags } = serviceAccess;
  const needsUserKey = !serviceHasBackendCap;

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
      and <strong>fine-tune</strong> and deploy custom models that outperform GPT-4 at a
      fraction of the cost.
    </Typography>

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
