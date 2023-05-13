import * as React from 'react';

import { IconButton, List, ListItem, ListItemContent, ListItemDecorator, Sheet, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { ModelVendorId } from '../vendors-registry';
import { OpenAIIcon } from '../openai/OpenAIIcon';
import { useJoinedLLMs, useModelsStore } from '../store-models';


function iconForVendor(vendorId: ModelVendorId) {
  switch (vendorId) {
    case 'openai':
      return <OpenAIIcon />;
    default:
      return null;
  }
}


export function LLMList() {

  // external state
  const llms = useJoinedLLMs();

  const handleDeleteModel = (modelId: string) => useModelsStore.getState().removeLLM(modelId);

  // find out if there's more than 1 sourceLabel in the llms array
  const moreVendors = llms.length >= 2 && !!llms.find(llm => llm.sourceLabel !== llms[0].sourceLabel);
  let lastSourceLabel = '';

  return (

    <Sheet variant='soft' invertedColors sx={{ borderRadius: 'sm', p: { xs: 1, md: 2 } }}>

      <List size='sm'>
        {llms.map(({ model, sourceLabel, vendorId }) => {
          let labelComponent: React.JSX.Element | null = null;
          if (moreVendors && sourceLabel !== lastSourceLabel) {
            labelComponent = <Typography level='body2' sx={{ mb: 1 }}>{sourceLabel}</Typography>;
            lastSourceLabel = sourceLabel;
          }
          return <>
            {labelComponent}
            <ListItem key={model.uid}>
              {!!vendorId && (
                <ListItemDecorator>
                  {iconForVendor(vendorId)}
                </ListItemDecorator>
              )}
              <ListItemContent>
                <Typography>{model.label}</Typography>
                <Typography level='body3'>{model.description}</Typography>
              </ListItemContent>
              <IconButton variant='plain' onClick={() => handleDeleteModel(model.uid)} sx={{ ml: 'auto' }}>
                <DeleteOutlineIcon />
              </IconButton>
            </ListItem>
          </>;
        })}
      </List>

    </Sheet>

  );
}