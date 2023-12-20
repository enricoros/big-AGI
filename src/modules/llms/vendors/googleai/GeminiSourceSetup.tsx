import * as React from 'react';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { DModelSourceId, useSourceSetup } from '../../store-llms';
import { useUpdateVendorModels } from '../useUpdateVendorModels';

import { geminiListModelsQuery, ModelVendorGemini } from './gemini.vendor';


const GEMINI_API_KEY_LINK = 'https://makersuite.google.com/app/apikey';


export function GeminiSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, sourceSetupValid, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorGemini);

  // derived state
  const { geminiKey } = access;

  const needsUserKey = !ModelVendorGemini.hasBackendCap?.();
  const shallFetchSucceed = !needsUserKey || (!!geminiKey && sourceSetupValid);
  const showKeyError = !!geminiKey && !sourceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useUpdateVendorModels(geminiListModelsQuery, access, shallFetchSucceed, source);

  return <>

    <FormInputKey
      id='gemini-key' label='Gemini API Key'
      rightLabel={<>{needsUserKey
        ? !geminiKey && <Link level='body-sm' href={GEMINI_API_KEY_LINK} target='_blank'>request Key</Link>
        : '✔️ already set in server'}
      </>}
      value={geminiKey} onChange={value => updateSetup({ geminiKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} error={isError}
    />

    {isError && <InlineError error={error} />}

  </>;
}