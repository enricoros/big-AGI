import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { IconButton, List, ListItem, ListItemContent, ListItemDecorator, Sheet, Tooltip, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { findVendorById } from '../vendors/vendor.registry';
import { useModelsStore } from '../llm.store';


export function ListLLMs() {

  // external state
  const llms = useModelsStore(state => state.llms, shallow);

  const handleDeleteModel = (modelId: string) => useModelsStore.getState().removeLLM(modelId);

  // find out if there's more than 1 sourceLabel in the llms array
  const singleOrigin = llms.length < 2 || !llms.find(llm => llm._source !== llms[0]._source);
  let lastGroupLabel = '';
  let labelsCount = 0;

  return (

    <Sheet variant='soft' color='info' invertedColors sx={{ borderRadius: 'sm', pl: { xs: 1, md: 2 }, pr: { xs: 0, md: 1 }, py: { xs: 0, md: 1 } }}>

      <List size='sm'>
        {llms.map(llm => {
          // group labeling as a prepended component
          const groupLabel = llm._source.label;
          let labelComponent: React.JSX.Element | null = null;
          if (!singleOrigin && groupLabel !== lastGroupLabel) {
            lastGroupLabel = groupLabel;
            labelComponent = <Typography key={'lab-' + labelsCount++} level='body2' sx={{ my: 1 }}>{groupLabel}</Typography>;
          }
          const vendor = findVendorById(llm._source.vId);
          return <React.Fragment key={llm.id}>
            {labelComponent}
            <ListItem>
              {!!vendor?.icon && (
                <ListItemDecorator sx={{ justifyContent: 'start' }}>
                  {vendor.icon}
                </ListItemDecorator>
              )}
              <ListItemContent>
                <Tooltip title={`${llm._source.label} - ${llm.description}`}>
                  <Typography sx={{ display: 'inline' }}>
                    {llm.label}
                  </Typography>
                </Tooltip>
              </ListItemContent>
              <IconButton variant='plain' onClick={() => handleDeleteModel(llm.id)} sx={{ ml: 'auto' }}>
                <DeleteOutlineIcon />
              </IconButton>
            </ListItem>
          </React.Fragment>;
        })}
      </List>

    </Sheet>

  );
}