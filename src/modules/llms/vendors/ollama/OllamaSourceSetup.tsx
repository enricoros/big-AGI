import * as React from 'react';

import { Button } from '@mui/joy';

import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { asValidURL } from '~/common/util/urlUtils';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useSourceSetup } from '../useSourceSetup';

import { ModelVendorOllama } from './ollama.vendor';
import { OllamaAdministration } from './OllamaAdministration';


export function OllamaSourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const [adminOpen, setAdminOpen] = React.useState(false);

  // external state
  const { source, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorOllama);

  // derived state
  const { ollamaHost, ollamaJson } = access;

  const hostValid = !!asValidURL(ollamaHost);
  const hostError = !!ollamaHost && !hostValid;
  const shallFetchSucceed = !hostError;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(false /* use button only (we don't have server-side conf) */, source);

  return <>

    <FormTextField
      autoCompleteId='ollama-host'
      title='Ollama Host'
      description={<Link level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-local-ollama.md' target='_blank'>Information</Link>}
      placeholder='http://127.0.0.1:11434'
      isError={hostError}
      value={ollamaHost || ''}
      onChange={text => updateSetup({ ollamaHost: text })}
    />

    <FormSwitchControl
      title='JSON Output' on='Enabled' fullWidth
      description={<Link level='body-sm' href='https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion' target='_blank'>Information</Link>}
      checked={ollamaJson}
      onChange={on => {
        updateSetup({ ollamaJson: on });
        refetch();
      }}
    />

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError}
      leftButton={
        <Button color='neutral' variant='solid' disabled={adminOpen} onClick={() => setAdminOpen(true)}>
          Ollama Admin
        </Button>
      }
    />

    {isError && <InlineError error={error} />}

    {adminOpen && <OllamaAdministration access={access} onClose={() => setAdminOpen(false)} />}

  </>;
}