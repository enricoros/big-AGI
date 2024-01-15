import * as React from 'react';

import { Typography } from '@mui/joy';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../useLlmUpdateModels';
import { useSourceSetup } from '../useSourceSetup';

import { ModelVendorTogetherAI } from './togetherai.vendor';


const TOGETHERAI_REG_LINK = 'https://api.together.xyz/settings/api-keys';


export function TogetherAISourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, access, sourceHasLLMs, sourceSetupValid, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorTogetherAI);

  // derived state
  const { oaiKey: togetherKey } = access;

  // validate if url is a well formed proper url with zod
  const needsUserKey = !ModelVendorTogetherAI.hasBackendCap?.();
  const shallFetchSucceed = !needsUserKey || (!!togetherKey && sourceSetupValid);
  const showKeyError = !!togetherKey && !sourceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(ModelVendorTogetherAI, access, shallFetchSucceed, source);


  return <>

    <Typography level='body-sm'>
      The Together Inference platform allows you to run select machine learning models with good speed and low
      costs. See the <Link href='https://www.together.ai/' target='_blank'>Together AI</Link> website for more
      information.
    </Typography>

    <FormInputKey
      id='togetherai-key' label='Together AI Key'
      rightLabel={<>{needsUserKey
        ? !togetherKey && <Link level='body-sm' href={TOGETHERAI_REG_LINK} target='_blank'>request Key</Link>
        : '✔️ already set in server'}
      </>}
      value={togetherKey} onChange={value => updateSetup({ togetherKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
