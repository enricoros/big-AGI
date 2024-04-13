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

    <Typography level='body-sm' sx={{ whiteSpace: 'break-spaces', mt: 0.5, ml: 0.1 }}>
      This endpoint is generously provided by Luna Midori (<Link href='https://github.com/lunamidori5' target='_blank'>GitHub</Link>), a valued member of the community, 
      as part of her <Link href='https://io.midori-ai.xyz/subsystem/manager' target='_blank'>Midori AI Subsystem</Link>. <br /><br />

      Please use this link to get a API Key <br /><Link href='https://tea-cup.midori-ai.xyz/stream-file/568fa97410b2770fe337c06e65a1ce2cdfb24e9cffb238e0ce2003d09b606cc110fe44d6b2fab803beb40f70c5b86ff4.txt' target='_blank'>Get API Key</Link><br /><br />
      

      Feel free to use it, but please note that it operates on Midori AI own local servers and may exhibit slower performance compared to cloud-based LLM routers. 
    </Typography>

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
