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

import { ModelVendorMistral } from './mistral.vendor';


const MISTRAL_REG_LINK = 'https://console.mistral.ai/';


export function MistralSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, sourceHasLLMs, sourceSetupValid, access, hasNoBackendCap: needsUserKey, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorMistral);

  // derived state
  const { oaiKey: mistralKey } = access;

  const shallFetchSucceed = !needsUserKey || (!!mistralKey && sourceSetupValid);
  const showKeyError = !!mistralKey && !sourceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!sourceHasLLMs && shallFetchSucceed, source);

  return <>

    <FormInputKey
      autoCompleteId='mistral-key' label='Mistral Key'
      rightLabel={<>{needsUserKey
        ? !mistralKey && <Link level='body-sm' href={MISTRAL_REG_LINK} target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={mistralKey} onChange={value => updateSetup({ oaiKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <Typography level='body-sm'>
      In order of capabilities we have Large, Medium, Small (Open 8x7B = Small 2312) and Tiny (Open 7B = Tiny 2312) models.
      Note the elegance of the numbers, representing the Year and Month or release (YYMM).
    </Typography>

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}