import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { List, Sheet, Typography } from '@mui/joy';

import { LLMListItem } from './LLMListItem';
import { findVendorById } from '../vendors/vendor.registry';
import { useModelsStore } from '../llm.store';


export function LLMList() {

  // external state
  const llms = useModelsStore(state => state.llms, shallow);

  // find out if there's more than 1 sourceLabel in the llms array
  const singleOrigin = llms.length < 2 || !llms.find(llm => llm._source !== llms[0]._source);
  let lastGroupLabel = '';
  let labelsCount = 0;

  // generate the list items, prepending headers when necessary
  const items: React.JSX.Element[] = [];
  for (const llm of llms) {

    // prepend label if changing source
    const groupLabel = llm._source.label;
    if (!singleOrigin && groupLabel !== lastGroupLabel) {
      lastGroupLabel = groupLabel;
      items.push(<Typography key={'lab-' + labelsCount++} level='body2' sx={{ my: 1 }}>{groupLabel}</Typography>);
    }

    // for safety, ensure the vendor exists
    const vendor = findVendorById(llm._source.vId);
    if (vendor)
      items.push(<LLMListItem key={'llm-' + llm.id} llm={llm} vendor={vendor} />);
  }

  return (

    <Sheet
      variant='soft' color='neutral' invertedColors
      sx={{
        borderRadius: 'sm',
        p: { xs: 0, md: 1 },
      }}>
      <List size='sm'>
        {items}
      </List>
    </Sheet>

  );
}