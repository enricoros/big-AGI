import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Typography } from '@mui/joy';

import { Link } from '~/common/components/Link';

import { PersonaPromptCard } from './Creator';
import { useSimplePersona } from '../store-app-personas';


export function Viewer(props: { selectedSimplePersonaId: string }) {

  // external state
  const { simplePersona } = useSimplePersona(props.selectedSimplePersonaId);

  if (!simplePersona)
    return <Typography level='body-sm'>Loading Persona...</Typography>;

  return <>

    <Typography level='title-sm'>
      This <em>System Prompt</em> was created <TimeAgo date={simplePersona.creationDate} />
      using the <strong>{simplePersona.llmLabel}</strong> model.
    </Typography>

    <PersonaPromptCard content={simplePersona.systemPrompt || ''} />

    {/* tell about the Provenances */}
    <Typography level='body-sm' sx={{ mt: 3 }}>
      {simplePersona.inputProvenance?.type === 'youtube' && <>The source was this YouTube video: <Link href={simplePersona.inputProvenance.url} target='_blank'>{simplePersona.inputProvenance.title}</Link>.</>}
      {simplePersona.inputProvenance?.type === 'text' && <>The source was a text snippet of {simplePersona.inputText?.length.toLocaleString()} characters.</>}
    </Typography>

  </>;
}