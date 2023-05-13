import * as React from 'react';

import { FormControl, FormHelperText, FormLabel, Input } from '@mui/joy';

import { DModelSourceId, useSourceConfigurator } from '../store-models';
import { normConfigLocalAI, SourceConfigLocalAI } from './vendor';
import { Link } from '@/common/components/Link';


export function SourceConfig(props: { sourceId: DModelSourceId }) {

  // external state
  const { config: { hostUrl }, update } = useSourceConfigurator<SourceConfigLocalAI>(props.sourceId, normConfigLocalAI);

  return (

    <FormControl>
      <FormLabel>Server URL</FormLabel>
      <Input
        value={hostUrl}
        onChange={event => update({ hostUrl: event.target.value })}
        placeholder='e.g., http://localhost:8080'
      />
      <FormHelperText sx={{ display: 'block' }}>
        <Link level='body2' href='https://github.com/go-skynet/LocalAI' target='_blank'>Learn more</Link> about LocalAI
      </FormHelperText>
    </FormControl>

  );
}