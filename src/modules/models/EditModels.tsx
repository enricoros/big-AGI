import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { IconButton, List, ListItem, ListItemContent, Sheet, Typography } from '@mui/joy';
import DeleteIcon from '@mui/icons-material/Delete';

import { useModelsStore } from './store-models';

export function EditModels() {
  const { models, removeModel } = useModelsStore(state => ({ models: state.llms, removeModel: state.removeLLM }), shallow);

  const handleDeleteModel = (modelId: string) => {
    removeModel(modelId);
  };

  return (
    <>
      <Sheet
        variant='solid'
        invertedColors
        sx={{ borderRadius: 'sm', p: 2 }}
      >
        <List>
          {models.map((model) => (
            <ListItem key={model.uid}>
              <ListItemContent>
                <Typography>{model.label}</Typography>
                <Typography level='body3'>{model.description}</Typography>
              </ListItemContent>
              <IconButton onClick={() => handleDeleteModel(model.uid)} sx={{ ml: 'auto' }}>
                <DeleteIcon />
              </IconButton>
            </ListItem>
          ))}
        </List>
      </Sheet>
    </>
  );
}