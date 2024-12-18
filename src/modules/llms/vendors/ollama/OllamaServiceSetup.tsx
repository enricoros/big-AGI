import * as React from 'react';

import { Button, FormControl, Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { asValidURL } from '~/common/util/urlUtils';

import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorOllama } from './ollama.vendor';
import { OllamaAdministration } from './OllamaAdministration';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


export function OllamaServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const [adminOpen, setAdminOpen] = React.useState(false);

  // external state
  const { service, serviceAccess, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorOllama);

  // derived state
  const { ollamaHost, ollamaJson } = serviceAccess;

  const hostValid = !!asValidURL(ollamaHost);
  const hostError = !!ollamaHost && !hostValid;
  const shallFetchSucceed = !hostError;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(false /* use button only (we don't have server-side conf) */, service);

  return <>

    <FormTextField
      autoCompleteId='ollama-host'
      title='Ollama Host'
      description={<Link level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-local-ollama.md' target='_blank'>Information</Link>}
      placeholder='http://127.0.0.1:11434'
      isError={hostError}
      value={ollamaHost || ''}
      onChange={text => updateSettings({ ollamaHost: text })}
    />

    <FormSwitchControl
      title='JSON Output' on='Enabled' fullWidth
      description={<Link level='body-sm' href='https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion' target='_blank'>Information</Link>}
      checked={ollamaJson}
      onChange={on => {
        updateSettings({ ollamaJson: on });
        refetch();
      }}
    />

    <FormControl orientation='horizontal'>
      <FormLabelStart title='Image Input' description='Information' />
      <Typography level='body-xs'>
        Images are well supported (e.g. try Llama3.2-vision). However only the PNG format is accepted by the Ollama API.
        For attachments, use the &quot;Original&quot; format option.
      </Typography>
    </FormControl>

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError}
      leftButton={
        <Button color='neutral' variant='solid' disabled={adminOpen} onClick={() => setAdminOpen(true)}>
          Ollama Admin
        </Button>
      }
    />

    {isError && <InlineError error={error} />}

    {adminOpen && <OllamaAdministration access={serviceAccess} onClose={() => setAdminOpen(false)} />}

  </>;
}