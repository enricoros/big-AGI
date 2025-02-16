import * as React from 'react';

import { Button, FormControl, Tooltip, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { OllamaIcon } from '~/common/components/icons/vendors/OllamaIcon';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { asValidURL } from '~/common/util/urlUtils';

import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorOllama } from './ollama.vendor';
import { OllamaAdministration } from './OllamaAdministration';


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

    <FormControl orientation='horizontal'>
      <FormLabelStart title='Image Input' description='PNG only' />
      <Typography level='body-sm'>
        Ollama supports PNG images (e.g. try Llama3.2-vision).
        For Image attachments, use the &quot;Original&quot; format option.
      </Typography>
    </FormControl>

    <FormSwitchControl
      title='JSON mode'
      on={<Typography level='title-sm' endDecorator={<WarningRoundedIcon sx={{ color: 'danger.solidBg' }} />}>Force JSON</Typography>}
      off='Off (default)'
      fullWidth
      description={
        <Tooltip arrow title='Models will output only JSON, including empty {} objects.'>
          <Link level='body-sm' href='https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion' target='_blank'>Information</Link>
        </Tooltip>
      }
      checked={ollamaJson}
      onChange={on => {
        updateSettings({ ollamaJson: on });
        refetch();
      }}
    />

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError}
      leftButton={
        <Button color='neutral' variant='solid' disabled={adminOpen} onClick={() => setAdminOpen(true)} startDecorator={<OllamaIcon sx={{ fontSize:'lg' }}/>}>
          Ollama Admin
        </Button>
      }
    />

    {isError && <InlineError error={error} />}

    {adminOpen && <OllamaAdministration access={serviceAccess} onClose={() => setAdminOpen(false)} />}

  </>;
}