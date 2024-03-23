import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';


import { Box, Button, DialogTitle, Dropdown, FormControl, FormLabel, IconButton, Input, ListDivider, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, Modal, ModalClose, ModalDialog, Typography } from '@mui/joy';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';

import type { DLLMId } from '~/modules/llms/store-llms';

import { addSnackbar } from '~/common/components/useSnackbarsStore';

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
      presets: [...state.presets, { id: uuidv4(), name, scatterLlmIds }],
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


/// Naming Dialog ///

function DialogNamePreset(props: {
  open: boolean,
  onClose: () => void,
  onStore: (name: string) => void,
}) {

  // state
  const [name, setName] = React.useState('');

  const handleClose = () => {
    setName('');
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={handleClose}>
      <ModalDialog>
        <ModalClose />
        <DialogTitle>Store Preset</DialogTitle>
        {/*<DialogContent>Store the Models configuration.</DialogContent>*/}
        <form onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          if (name.trim())
            props.onStore(name);
          handleClose();
        }}>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <FormControl>
              <FormLabel>Name</FormLabel>
              <Input autoFocus required value={name} onChange={event => setName(event.target.value)} />
            </FormControl>
            <Button type='submit'>Save</Button>
          </Box>
        </form>
      </ModalDialog>
    </Modal>
  );
}


export function BeamScatterDropdown(props: {
  beamStore: BeamStoreApi,
  onExplainerShow: () => any,
}) {

  // state
  const [namingOpened, setNamingOpened] = React.useState(false);

  // external state
  const { presets, addPreset, deletePreset } = useFeatureBeamStore();


  // handlers - load/save presets

  const handleClosePresetNaming = React.useCallback(() => setNamingOpened(false), []);

  const handlePresetSave = React.useCallback((presetName: string) => {
    const { rays, gatherLlmId } = props.beamStore.getState();
    addPreset(presetName, rays.map(ray => ray.scatterLlmId || gatherLlmId).filter(Boolean) as DLLMId[]);
    handleClosePresetNaming();
  }, [addPreset, handleClosePresetNaming, props.beamStore]);

  const handlePresetLoad = React.useCallback((presetId: string) => {
    const { presets } = useFeatureBeamStore.getState();
    const preset = presets.find(preset => preset.id === presetId);
    if (preset && preset.scatterLlmIds.length) {
      props.beamStore.getState().setScatterLLMIds(preset.scatterLlmIds);
      addSnackbar({
        key: 'beam-preset-loaded',
        message: `Preset "${preset.name}" loaded.`,
        type: 'success',
      });
    }
  }, [props.beamStore]);


  return <>

    {/* Scatter Dropdown */}
    <Dropdown>
      <MenuButton
        aria-label='Beam Options'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm', sx: { my: -0.5 } } }}
      >
        <MoreHorizRoundedIcon />
      </MenuButton>

      <Menu placement='right-end' sx={{ minWidth: 200 }}>
        <ListItem>
          <Typography level='body-sm'>Beam Presets</Typography>
        </ListItem>

        {/* Save New */}
        <MenuItem onClick={() => setNamingOpened(true)}>
          <ListItemDecorator>
            <DriveFileRenameOutlineRoundedIcon />
          </ListItemDecorator>
          Save ...
        </MenuItem>

        {/* Load any preset */}
        {presets.map(preset =>
          <MenuItem key={preset.id}>
            <ListItemDecorator />
            <Typography onClick={() => handlePresetLoad(preset.id)}>
              Load &quot;{preset.name}&quot; <span style={{ opacity: 0.5, marginRight: '1rem' }}>(x{preset.scatterLlmIds.length})</span>
            </Typography>
            <IconButton
              size='sm'
              variant='outlined'
              onClick={(event) => {
                event.stopPropagation();
                deletePreset(preset.id);
              }}
              sx={{ ml: 'auto' }}
            >
              <DeleteOutlineRoundedIcon />
            </IconButton>
          </MenuItem>,
        )}

        <ListDivider inset='startContent' />

        {/* Tutorial */}
        <MenuItem onClick={props.onExplainerShow}>
          <ListItemDecorator>
            <SchoolRoundedIcon />
          </ListItemDecorator>
          Tutorial
        </MenuItem>

      </Menu>
    </Dropdown>

    {/* Options dialog */}
    <DialogNamePreset open={namingOpened} onClose={handleClosePresetNaming} onStore={handlePresetSave} />

  </>;
}