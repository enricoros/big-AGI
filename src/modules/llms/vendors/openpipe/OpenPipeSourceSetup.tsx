import * as React from 'react';

import { Typography } from '@mui/joy';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useSourceSetup } from '../useSourceSetup';

import { ModelVendorOpenPipe } from './openpipe.vendor';


const OPENPIPE_API_KEY_LINK = 'https://app.openpipe.ai/settings';


export function OpenPipeSourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  // const advanced = useToggleableBoolean();

  // external state
  const {
    source, sourceHasLLMs, access,
    sourceSetupValid, hasNoBackendCap: needsUserKey, updateSetup,
  } = useSourceSetup(props.sourceId, ModelVendorOpenPipe);

  // derived state
  const { oaiKey: openPipeKey, oaiOrg: openPipeTags } = access;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!openPipeKey && sourceSetupValid);
  const showKeyError = !!openPipeKey && !sourceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!sourceHasLLMs && shallFetchSucceed, source);


  return <>

    <FormInputKey
      autoCompleteId='openpipe-key' label='OpenPipe Project API Key'
      rightLabel={<>{needsUserKey
        ? !openPipeKey && <Link level='body-sm' href={OPENPIPE_API_KEY_LINK} target='_blank'>Get API Key</Link>
        : <AlreadySet />}
      </>}
      value={openPipeKey} onChange={value => updateSetup({ openPipeKey: value })}
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
      value={openPipeTags} onChange={value => updateSetup({ openPipeTags: value })}
    />

    <Typography level='body-sm'>
      <Link href='https://openpipe.ai/' target='_blank'>OpenPipe.ai</Link> allows you to record your chat data,
      and fine-tune and deploy custom models that outperform GPT-4 at a fraction of the cost.
    </Typography>

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
