import * as React from 'react';
import { z } from 'zod';

import { Button, Typography } from '@mui/joy';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';

import { ExpanderAccordion } from '~/common/components/ExpanderAccordion';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../useLlmUpdateModels';
import { useSourceSetup } from '../useSourceSetup';

import { LocalAIAdmin } from './LocalAIAdmin';
import { ModelVendorLocalAI } from './localai.vendor';


export function LocalAISourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const [adminOpen, setAdminOpen] = React.useState(false);

  // external state
  const { source, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorLocalAI);

  // derived state
  const { oaiHost } = access;

  // validate if url is a well formed proper url with zod
  const urlSchema = z.string().url().startsWith('http');
  const { success: isValidHost } = urlSchema.safeParse(oaiHost);
  const shallFetchSucceed = isValidHost;

  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(ModelVendorLocalAI, access, false /* !sourceHasLLMs && shallFetchSucceed */, source);

  return <>

    {/* from: https://raw.githubusercontent.com/mudler/LocalAI/master/docs/content/docs/overview.md */}
    <ExpanderAccordion
      title={<Typography level='title-sm' sx={{ mr: 'auto' }}>LocalAI integration</Typography>}
      icon={<CheckBoxOutlinedIcon />}
      expandedVariant='soft'
      startCollapsed
    >
      <Typography level='body-sm' sx={{ whiteSpace: 'break-spaces', mt: 0.5, ml: 0.1 }}>
        ✅{'  '}<Link href='https://localai.io/features/text-generation/' target='_blank'>Text generation</Link> with GPTs<br />
        ✅{'  '}<Link href='https://localai.io/features/openai-functions/' target='_blank'>Function calling</Link> by GPTs 🆕<br />
        ❌{'  '}<Link href='https://localai.io/features/gpt-vision/' target='_blank'>Vision API</Link> for image chats<br />
        ❌{'  '}<Link href='https://localai.io/features/image-generation' target='_blank'>Image generation</Link> with stable diffusion<br />
        ❌{'  '}<Link href='https://localai.io/features/audio-to-text/' target='_blank'>Audio to Text</Link><br />
        ❌{'  '}<Link href='https://localai.io/features/text-to-audio/' target='_blank'>Text to Audio</Link><br />
        ❌{'  '}<Link href='https://localai.io/features/embeddings/' target='_blank'>Embeddings generation</Link><br />
        ❌{'  '}<Link href='https://localai.io/features/constrained_grammars/' target='_blank'>Constrained grammars</Link> (JSON output)<br />
        ❌{'  '}Voice cloning 🆕
      </Typography>
    </ExpanderAccordion>

    <Typography level='body-sm'>
      Please ensure your <Link href='https://localai.io' target='_blank'>LocalAI.io</Link> instance is correctly configured.
      Visit the <Link href='https://localai.io/basics/getting_started/' target='_blank'>LocalAI website</Link> for detailed setup instructions,
      and then input the address below.
    </Typography>

    <FormInputKey
      id='localai-key' label='LocalAI URL'
      required noKey
      rightLabel={<Link level='body-sm' href='https://localai.io' target='_blank'>Learn more</Link>}
      placeholder='e.g., http://127.0.0.1:8080'
      value={oaiHost} onChange={value => updateSetup({ oaiHost: value })}
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

    {adminOpen && <LocalAIAdmin access={access} onClose={() => setAdminOpen(false)} />}

  </>;
}
