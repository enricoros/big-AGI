import * as React from 'react';
import { z } from 'zod';

import { Button, Typography } from '@mui/joy';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { ExpanderAccordion } from '~/common/components/ExpanderAccordion';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useSourceSetup } from '../useSourceSetup';

import { ModelVendorMidoriAI } from './midoriai.vendor';


const localAIHostSchema = z.string().url().startsWith('http');


export function MidoriAISourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const [adminOpen, setAdminOpen] = React.useState(false);

  // external state
  const { hasLlmLocalAIHost: backendHasHost, hasLlmLocalAIKey: backendHasKey } = getBackendCapabilities();
  const { source, sourceHasLLMs, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorMidoriAI);

  // derived state
  const { oaiHost: localAIHost, oaiKey: localAIKey } = access;

  // host validation
  const userHostRequired = !backendHasHost;
  const userHostValid = localAIHost.length >= 6 && localAIHostSchema.safeParse(localAIHost).success;
  const userHostError = !!localAIHost && !userHostValid;
  const shallFetchSucceed = localAIHost ? userHostValid : backendHasHost;

  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!sourceHasLLMs && shallFetchSucceed, source);

  return <>

    {/* from: https://raw.githubusercontent.com/mudler/LocalAI/master/docs/content/docs/overview.md */}
    <ExpanderAccordion
      title={<Typography level='title-sm' sx={{ mr: 'auto' }}>Midori AI integration</Typography>}
      icon={<CheckBoxOutlinedIcon />}
      expandedVariant='soft'
      startCollapsed
    >
      <Typography level='body-sm' sx={{ whiteSpace: 'break-spaces', mt: 0.5, ml: 0.1 }}>
        ✅{'  '}<Link href='https://localai.io/features/text-generation/' target='_blank'>Text generation</Link> with GPTs<br />
        ✅{'  '}<Link href='https://localai.io/features/openai-functions/' target='_blank'>Function calling</Link> by GPTs 🆕<br />
        ✅{'  '}<Link href='https://localai.io/models/' target='_blank'>Model Gallery</Link> 🆕<br />
        ✖️{'  '}<Link href='https://localai.io/features/gpt-vision/' target='_blank'>Vision API</Link> for image chats<br />
        ✖️{'  '}<Link href='https://localai.io/features/image-generation' target='_blank'>Image generation</Link> with stable diffusion<br />
        ✖️{'  '}<Link href='https://localai.io/features/audio-to-text/' target='_blank'>Audio to Text</Link><br />
        ✖️{'  '}<Link href='https://localai.io/features/text-to-audio/' target='_blank'>Text to Audio</Link><br />
        ✖️{'  '}<Link href='https://localai.io/features/embeddings/' target='_blank'>Embeddings generation</Link><br />
        ✖️{'  '}<Link href='https://localai.io/features/constrained_grammars/' target='_blank'>Constrained grammars</Link> (JSON output)<br />
        ✖️{'  '}Voice cloning 🆕
      </Typography>
    </ExpanderAccordion>

    <Typography level='body-sm' sx={{ whiteSpace: 'break-spaces', mt: 0.5, ml: 0.1 }}>
      This endpoint is generously provided by Luna Midori (<Link href='https://github.com/lunamidori5' target='_blank'>GitHub</Link>), a valued member of the community, 
      as part of her <Link href='https://io.midori-ai.xyz/subsystem/manager' target='_blank'>Midori AI Subsystem</Link>. <br /><br />

      Please use this link to get a API Key <br /> <Link href='https://tea-cup.midori-ai.xyz/stream-file/568fa97410b2770fe337c06e65a1ce2cdfb24e9cffb238e0ce2003d09b606cc110fe44d6b2fab803beb40f70c5b86ff4.txt' target='_blank'>Get API Key</Link><br /><br />
      

      Feel free to use it, but please note that it operates on Midori AI own local servers and may exhibit slower performance compared to cloud-based LLM routers. 
    </Typography>

    <FormInputKey
      autoCompleteId='localai-host' label='Midori AI URL'
      placeholder='e.g., http://127.0.0.1:8080'
      noKey
      required={userHostRequired}
      isError={userHostError}
      rightLabel={backendHasHost ? '✔️ already set in server' : <Link level='body-sm' href='https://localai.io' target='_blank'>Learn more</Link>}
      value={localAIHost} onChange={value => updateSetup({ localAIHost: value })}
    />

    <FormInputKey
      autoCompleteId='localai-key' label='API Key'
      placeholder='...'
      required={true}
      rightLabel={backendHasKey ? '✔️ already set in server' : undefined}
      value={localAIKey} onChange={value => updateSetup({ localAIKey: value })}
    />

    <SetupFormRefetchButton
      refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError}
    />

    {isError && <InlineError error={error} />}

  </>;
}
