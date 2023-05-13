import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { IconButton, List, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Sheet, Typography } from '@mui/joy';
import DeleteIcon from '@mui/icons-material/Delete';

import { useModelsStore } from './store-models';

export function EditModels() {
  const { models, removeModel } = useModelsStore(state => ({ models: state.models, removeModel: state.removeModel }), shallow);

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
            <ListItem key={model.modelId}>
              <ListItemDecorator>
                X
              </ListItemDecorator>
              <ListItemButton>
                test
              </ListItemButton>
              <ListItemContent>
                {model.label}
                <Typography level={'body2'}>{model.description}</Typography>
              </ListItemContent>
              <IconButton onClick={() => handleDeleteModel(model.modelId)} sx={{ ml: 'auto' }}>
                <DeleteIcon />
              </IconButton>
            </ListItem>
          ))}
        </List>
      </Sheet>
    </>
  );
}