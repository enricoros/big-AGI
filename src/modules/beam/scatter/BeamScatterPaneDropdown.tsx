import * as React from 'react';

import { Box, Button, DialogContent, DialogTitle, Dropdown, FormControl, FormLabel, IconButton, Input, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, Modal, ModalClose, ModalDialog, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { BeamStoreApi } from '../store-beam.hooks';
import { useModuleBeamStore } from '../store-module-beam';


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
        <DialogTitle>Save Preset</DialogTitle>
        <DialogContent>Store the Models configuration.</DialogContent>
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
  const {
    scatterPresets, addScatterPreset, deleteScatterPreset,
    cardScrolling, toggleCardScrolling,
    scatterShowLettering, toggleScatterShowLettering,
  } = useModuleBeamStore();


  // handlers - load/save presets

  const handleClosePresetNaming = React.useCallback(() => setNamingOpened(false), []);

  const handlePresetSave = React.useCallback((presetName: string) => {
    const { rays } = props.beamStore.getState();
    addScatterPreset(presetName, rays.map(ray => ray.rayLlmId).filter(Boolean) as DLLMId[]);
    handleClosePresetNaming();
  }, [addScatterPreset, handleClosePresetNaming, props.beamStore]);

  const handlePresetLoad = React.useCallback((presetId: string) => {
    const { scatterPresets } = useModuleBeamStore.getState();
    const preset = scatterPresets.find(preset => preset.id === presetId);
    if (preset && preset.rayLlmIds?.length)
      props.beamStore.getState().setRayLlmIds(preset.rayLlmIds);
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

      <Menu placement='right-end' sx={{ minWidth: 200, zIndex: 'var(--joy-zIndex-modal)' /* on top of its own modal in FS */ }}>
        <ListItem>
          <Typography level='body-sm'>Model Presets</Typography>
        </ListItem>

        {/* Save New */}
        <MenuItem onClick={() => setNamingOpened(true)}>
          <ListItemDecorator>
            <DriveFileRenameOutlineRoundedIcon />
          </ListItemDecorator>
          Save new ...
        </MenuItem>

        {/* Load any preset */}
        {scatterPresets.map(preset =>
          <MenuItem key={preset.id}>
            <ListItemDecorator />
            <Typography onClick={() => handlePresetLoad(preset.id)}>
              Load &quot;{preset.name}&quot; &nbsp;<span style={{ opacity: 0.5, marginRight: '2rem' }}>x{preset.rayLlmIds?.length}</span>
            </Typography>
            <IconButton
              size='sm'
              variant='outlined'
              onClick={(event) => {
                event.stopPropagation();
                deleteScatterPreset(preset.id);
              }}
              sx={{ ml: 'auto' }}
            >
              <DeleteOutlineRoundedIcon />
            </IconButton>
          </MenuItem>,
        )}

        {/*<ListDivider inset='startContent' />*/}

        <ListItem>
          <Typography level='body-sm'>View</Typography>
        </ListItem>

        <MenuItem onClick={toggleCardScrolling}>
          <ListItemDecorator>{cardScrolling && <CheckRoundedIcon />}</ListItemDecorator>
          Fit Messages
        </MenuItem>

        <MenuItem onClick={toggleScatterShowLettering}>
          <ListItemDecorator>{scatterShowLettering && <CheckRoundedIcon />}</ListItemDecorator>
          Response Numbers
        </MenuItem>

        <MenuItem onClick={props.onExplainerShow}>
          <ListItemDecorator>
            <SchoolRoundedIcon />
          </ListItemDecorator>
          Tutorial ...
        </MenuItem>

      </Menu>
    </Dropdown>

    {/* Options dialog */}
    <DialogNamePreset open={namingOpened} onClose={handleClosePresetNaming} onStore={handlePresetSave} />

  </>;
}