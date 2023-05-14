import * as React from 'react';

import { FormControl, FormHelperText, FormLabel, Input } from '@mui/joy';

import { Link } from '~/common/components/Link';

import { DModelSourceId } from '../llm.types';
import { normalizeSetup, SourceSetupLocalAI } from './vendor';
import { useSourceSetup } from '../llm.store';


export function LocalAISetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { normSetup: { hostUrl }, updateSetup } = useSourceSetup<SourceSetupLocalAI>(props.sourceId, normalizeSetup);

  return (

    <FormControl>
      <FormLabel>Server URL</FormLabel>
      <Input
        value={hostUrl}
        onChange={event => updateSetup({ hostUrl: event.target.value })}
        placeholder='e.g., http://localhost:8080'
      />
      <FormHelperText sx={{ display: 'block' }}>
        <Link level='body2' href='https://github.com/go-skynet/LocalAI' target='_blank'>Learn more</Link> about LocalAI
      </FormHelperText>
    </FormControl>

  );
}