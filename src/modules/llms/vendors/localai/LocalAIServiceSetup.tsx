import * as React from 'react';
import * as z from 'zod/v4';

import { Button, Chip, Typography } from '@mui/joy';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { LocalAIAdmin } from './LocalAIAdmin';
import { ModelVendorLocalAI } from './localai.vendor';


const localAIHostSchema = z.url().startsWith('http');


export function LocalAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const [checkboxExpanded, setCheckboxExpanded] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);

  // external state
  const { hasLlmLocalAIHost: backendHasHost, hasLlmLocalAIKey: backendHasKey } = getBackendCapabilities();
  const { service, serviceAccess, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorLocalAI);

  // derived state
  const { oaiHost: localAIHost, oaiKey: localAIKey } = serviceAccess;

  // host validation
  const userHostRequired = !backendHasHost;
  const userHostValid = localAIHost.length >= 6 && localAIHostSchema.safeParse(localAIHost).success;
  const userHostError = !!localAIHost && !userHostValid;
  const shallFetchSucceed = localAIHost ? userHostValid : backendHasHost;

  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>
    <ApproximateCosts>
      <div>
        <Typography level='body-sm'>
          Please ensure your <ExternalLink href='https://localai.io'>LocalAI</ExternalLink> instance is correctly configured.
          {checkboxExpanded && <> Visit the <Link href='https://localai.io/basics/getting_started/' target='_blank'>LocalAI website</Link> for detailed setup instructions.</>}
          <Chip component='span' variant='outlined' sx={{ ml: 1, fontSize: '0.75rem' }} onClick={() => setCheckboxExpanded(on => !on)}>
            Show {checkboxExpanded ? 'less' : 'more'}
          </Chip>
        </Typography>

        <ExpanderControlledBox expanded={checkboxExpanded}>
          <Typography level='title-sm' sx={{ mt: 2 }}>LocalAI integration status:</Typography>
          <Typography level='body-xs' sx={{ whiteSpace: 'break-spaces', mt: 0.5, ml: '1px' }}>
            ✅{'  '}<Link href='https://localai.io/features/text-generation/' target='_blank'>Text generation</Link> with GPTs<br />
            ✅{'  '}<Link href='https://localai.io/features/openai-functions/' target='_blank'>Function calling</Link> by GPTs<br />
            ✅{'  '}<Link href='https://localai.io/models/' target='_blank'>Model Gallery</Link><br />
            ✅{'  '}<Link href='https://localai.io/features/gpt-vision/' target='_blank'>Vision API</Link> for image chats<br />
            ✅{'  '}<Link href='https://localai.io/features/constrained_grammars/' target='_blank'>JSON output</Link><br />
            ✖️{'  '}<Link href='https://localai.io/features/image-generation' target='_blank'>Image generation</Link> with stable diffusion<br />
            ✖️{'  '}<Link href='https://localai.io/features/audio-to-text/' target='_blank'>Speech transcription</Link><br />
            ✖️{'  '}<Link href='https://localai.io/features/text-to-audio/' target='_blank'>Text to speech</Link><br />
            ✖️{'  '}<Link href='https://localai.io/features/embeddings/' target='_blank'>Embeddings generation</Link><br />
            ✖️{'  '}Voice cloning
          </Typography>
        </ExpanderControlledBox>
      </div>
    </ApproximateCosts>

    <FormInputKey
      autoCompleteId='localai-host' label='LocalAI URL'
      placeholder='e.g. http://127.0.0.1:8080'
      noKey
      required={userHostRequired}
      isError={userHostError}
      rightLabel={backendHasHost ? <AlreadySet /> : <Link level='body-sm' href='https://localai.io' target='_blank'>Learn more</Link>}
      value={localAIHost} onChange={value => updateSettings({ localAIHost: value })}
    />

    <FormInputKey
      autoCompleteId='localai-api-key' label='Optional API Key'
      placeholder='...'
      required={false}
      rightLabel={backendHasKey ? '✔️ already set in server' : undefined}
      value={localAIKey} onChange={value => updateSettings({ localAIKey: value })}
    />

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError}
      leftButton={
        <Button color='neutral' variant='solid' disabled={adminOpen} onClick={() => setAdminOpen(true)}>
          Gallery Admin
        </Button>
      }
    />

    {isError && <InlineError error={error} />}

    {adminOpen && <LocalAIAdmin access={serviceAccess} onClose={() => setAdminOpen(false)} />}

  </>;
}
