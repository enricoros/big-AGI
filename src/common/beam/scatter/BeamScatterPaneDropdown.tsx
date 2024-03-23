import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Dropdown, IconButton, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, Typography } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { BeamStoreApi } from '../store-beam.hooks';


/// Presets (persistes as zustand store) ///

interface BeamModelsPreset {
  id: string;
  name: string;
  scatterLlmIds: DLLMId[];
}

interface FeatureBeamStore {
  // state
  presets: BeamModelsPreset[];

  // actions
  addPreset: (name: string, scatterLlmIds: DLLMId[]) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
}

export const useFeatureBeamStore = create<FeatureBeamStore>()(persist(
  (_set, _get) => ({

    presets: [],

    addPreset: (name, scatterLlmIds) => _set(state => ({
      presets: [...state.presets, { id: Math.random().toString(), name, scatterLlmIds }],
    })),

    deletePreset: (id) => _set(state => ({
      presets: state.presets.filter(preset => preset.id !== id),
    })),

    renamePreset: (id, name) => _set(state => ({
      presets: state.presets.map(preset => preset.id === id ? { ...preset, name } : preset),
    })),

  }), {
    name: 'app-feature-beam',
  },
));


export function BeamScatterDropdown(props: {
  beamStore: BeamStoreApi,
}) {

  // external state
  const { presets, addPreset, deletePreset, renamePreset } = useFeatureBeamStore();


  const [presetName, setPresetName] = React.useState('');

  const handleSavePreset = () => {

    // snapshot
    const scatterLLMIDs = props.beamStore.getState().rays.map(ray => ray.scatterLlmId || null);

  };

  return (
    <Dropdown>
      <MenuButton
        aria-label='Merge Options'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm', sx: { my: -0.5 /* to not disrupt the layouting */ } } }}
      >
        <MoreHorizRoundedIcon />
      </MenuButton>
      <Menu placement='right-end' sx={{ minWidth: 250 }}>
        <ListItem>
          <Typography level='body-sm'>Beam Models</Typography>
        </ListItem>
        <MenuItem>
          <ListItemDecorator>
            <AddRoundedIcon />
          </ListItemDecorator>
          Save Preset
        </MenuItem>
        {/*<ListDivider inset='startContent' />*/}
        <ListItem>
          <ListItemDecorator />
          No presets saved
        </ListItem>

      </Menu>
    </Dropdown>
  );
}