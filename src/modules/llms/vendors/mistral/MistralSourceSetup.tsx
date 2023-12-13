import * as React from 'react';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { apiQuery } from '~/common/util/trpc.client';

import { DModelSourceId, useModelsStore, useSourceSetup } from '../../store-llms';
import { modelDescriptionToDLLM } from '../openai/OpenAISourceSetup';

import { ModelVendorMistral } from './mistral.vendor';


const MISTRAL_REG_LINK = 'https://console.mistral.ai/';


export function MistralSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, sourceSetupValid, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorMistral);

  // derived state
  const { oaiKey: mistralKey } = access;

  const needsUserKey = !ModelVendorMistral.hasBackendCap?.();
  const shallFetchSucceed = !needsUserKey || (!!mistralKey && sourceSetupValid);
  const showKeyError = !!mistralKey && !sourceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmOpenAI.listModels.useQuery({ access }, {
    enabled: shallFetchSucceed,
    onSuccess: models => source && useModelsStore.getState().setLLMs(
      models.models.map(model => modelDescriptionToDLLM(model, source)),
      props.sourceId,
    ),
    staleTime: Infinity,
  });

  return <>

    <FormInputKey
      id='mistral-key' label='Mistral Key'
      rightLabel={<>{needsUserKey
        ? !mistralKey && <Link level='body-sm' href={MISTRAL_REG_LINK} target='_blank'>request Key</Link>
        : '✔️ already set in server'}
      </>}
      value={mistralKey} onChange={value => updateSetup({ oaiKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <SetupFormRefetchButton
      refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} error={isError}
    />

    {isError && <InlineError error={error} />}

  </>;
}