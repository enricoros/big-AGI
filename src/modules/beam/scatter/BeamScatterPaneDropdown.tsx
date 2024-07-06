import * as React from 'react';

import { Box, Button, DialogContent, DialogTitle, Dropdown, FormControl, FormLabel, IconButton, Input, ListDivider, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, Modal, ModalClose, ModalDialog, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';

import { DEV_MODE_SETTINGS } from '../../../apps/settings-modal/UxLabsSettings';

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
    presets, addPreset, deletePreset,
    cardScrolling, toggleCardScrolling,
    scatterShowPrevMessages, toggleScatterShowPrevMessages,
    scatterShowLettering, toggleScatterShowLettering,
    gatherAutoStartAfterScatter, toggleGatherAutoStartAfterScatter,
    gatherShowAllPrompts, toggleGatherShowAllPrompts,
  } = useModuleBeamStore();


  // handlers - load/save presets

  const handleClosePresetNaming = React.useCallback(() => setNamingOpened(false), []);

  const handlePresetSave = React.useCallback((presetName: string) => {
    const { rays, currentGatherLlmId, currentFactoryId } = props.beamStore.getState();
    const rayLlmIds = rays.map(ray => ray.rayLlmId).filter(Boolean) as DLLMId[];
    addPreset(presetName, rayLlmIds, currentGatherLlmId, currentFactoryId);
    handleClosePresetNaming();
  }, [addPreset, handleClosePresetNaming, props.beamStore]);

  const handlePresetLoad = React.useCallback((presetId: string) => {
    const preset = useModuleBeamStore.getState().presets.find(preset => preset.id === presetId);
    preset && props.beamStore.getState().loadBeamConfig(preset);
  }, [props.beamStore]);

  // NOTE: DEVS only - DEBUG only
  const handleClearLastConfig = React.useCallback(() => {
    // this is used to debug the heuristics for model selection
    useModuleBeamStore.getState().deleteLastConfig();
  }, []);


  return <>

    {/* Scatter Dropdown */}
    <Dropdown>
      <MenuButton
        aria-label='Beam Options'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm', sx: { my: -0.25 } } }}
      >
        <MoreVertIcon />
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
        {presets.map(preset =>
          <MenuItem key={preset.id} onClick={() => handlePresetLoad(preset.id)}>
            <ListItemDecorator />
            <Typography>
              Load &quot;{preset.name}&quot; &nbsp;<span style={{ opacity: 0.5, marginRight: '2rem' }}>x{preset.rayLlmIds?.length}</span>
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

        {/*<ListDivider inset='startContent' />*/}

        <ListItem>
          <Typography level='body-sm'>View</Typography>
        </ListItem>

        <MenuItem onClick={toggleScatterShowPrevMessages}>
          <ListItemDecorator>{scatterShowPrevMessages && <CheckRoundedIcon />}</ListItemDecorator>
          History
        </MenuItem>

        <MenuItem onClick={toggleCardScrolling}>
          <ListItemDecorator>{cardScrolling && <CheckRoundedIcon />}</ListItemDecorator>
          Resize Beams
        </MenuItem>

        <MenuItem onClick={toggleScatterShowLettering}>
          <ListItemDecorator>{scatterShowLettering && <CheckRoundedIcon />}</ListItemDecorator>
          Response Numbers
        </MenuItem>

        <ListItem onClick={DEV_MODE_SETTINGS ? () => handleClearLastConfig() : undefined}>
          <Typography level='body-sm'>Advanced</Typography>
        </ListItem>

        <MenuItem onClick={toggleGatherAutoStartAfterScatter}>
          <ListItemDecorator>{gatherAutoStartAfterScatter && <CheckRoundedIcon />}</ListItemDecorator>
          Auto-Merge
        </MenuItem>

        <MenuItem onClick={toggleGatherShowAllPrompts}>
          <ListItemDecorator>{gatherShowAllPrompts && <CheckRoundedIcon />}</ListItemDecorator>
          Detailed Custom Merge
        </MenuItem>

        <ListDivider inset='gutter' />

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