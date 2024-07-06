import * as React from 'react';

import { Alert, Typography } from '@mui/joy';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/useToggleableBoolean';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useSourceSetup } from '../useSourceSetup';

import { ModelVendorTogetherAI } from './togetherai.vendor';


const TOGETHERAI_REG_LINK = 'https://api.together.xyz/settings/api-keys';


export function TogetherAISourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    source, sourceHasLLMs, access,
    partialSetup, sourceSetupValid, hasNoBackendCap: needsUserKey, updateSetup,
  } = useSourceSetup(props.sourceId, ModelVendorTogetherAI);

  // derived state
  const { oaiKey: togetherKey } = access;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!togetherKey && sourceSetupValid);
  const showKeyError = !!togetherKey && !sourceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!sourceHasLLMs && shallFetchSucceed, source);


  return <>

    <FormInputKey
      autoCompleteId='togetherai-key' label='Together AI Key'
      rightLabel={<>{needsUserKey
        ? !togetherKey && <Link level='body-sm' href={TOGETHERAI_REG_LINK} target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={togetherKey} onChange={value => updateSetup({ togetherKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <Typography level='body-sm'>
      The Together Inference platform allows you to run recent machine learning models with good speed and low
      cost. See the <Link href='https://www.together.ai/' target='_blank'>Together AI</Link> website for more
      information.
    </Typography>

    {advanced.on && <FormSwitchControl
      title='Rate Limiter' on='Enabled' off='Disabled'
      description={partialSetup?.togetherFreeTrial ? 'Free trial: 2 requests/2s' : 'Disabled'}
      checked={partialSetup?.togetherFreeTrial ?? false}
      onChange={on => updateSetup({ togetherFreeTrial: on })}
    />}

    {advanced.on && !!partialSetup?.togetherFreeTrial && <Alert variant='soft'>
      Note: Please refresh the models list if you toggle the rate limiter.
    </Alert>}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
