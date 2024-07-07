import * as React from 'react';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/useToggleableBoolean';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useSourceSetup } from '../useSourceSetup';

import { ModelVendorDeepseek } from './deepseekai.vendor';


const DEEPSEEK_REG_LINK = 'https://platform.deepseek.com/api_keys';


export function DeepseekAISourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    source, sourceHasLLMs, access,
    sourceSetupValid, hasNoBackendCap: needsUserKey, updateSetup,
  } = useSourceSetup(props.sourceId, ModelVendorDeepseek);

  // derived state
  const { oaiKey: deepseekKey } = access;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!deepseekKey && sourceSetupValid);
  const showKeyError = !!deepseekKey && !sourceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!sourceHasLLMs && shallFetchSucceed, source);


  return <>

    <FormInputKey
      autoCompleteId='deepseek-key' label='Deepseek Key'
      rightLabel={<>{needsUserKey
        ? !deepseekKey && <Link level='body-sm' href={DEEPSEEK_REG_LINK} target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={deepseekKey} onChange={value => updateSetup({ deepseekKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
