import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, IconButton, ListItemDecorator, MenuItem, Option, Select, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import ComputerIcon from '@mui/icons-material/Computer';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { DModelSourceId, ModelVendor, ModelVendorId } from '~/modules/llms/llm.types';
import { createModelSourceForVendor, findAllVendors, findVendorById } from '~/modules/llms/vendor.registry';
import { hasServerKeyOpenAI } from '~/modules/llms/openai/openai.vendor';
import { useModelsStore } from '~/modules/llms/store-llms';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { hideOnDesktop, hideOnMobile } from '~/common/theme';


function locationIcon(vendor?: ModelVendor | null) {
  if (vendor && vendor.id === 'openai' && hasServerKeyOpenAI)
    return <CloudDoneOutlinedIcon />;
  return !vendor ? null : vendor.location === 'local' ? <ComputerIcon /> : <CloudOutlinedIcon />;
}

function vendorIcon(vendor?: ModelVendor | null) {
  const Icon = !vendor ? null : vendor.Icon;
  return Icon ? <Icon /> : null;
}


export function ModelsSourceSelector(props: {
  selectedSourceId: DModelSourceId | null, setSelectedSourceId: (sourceId: DModelSourceId | null) => void,
}) {

  // state
  const [vendorsMenuAnchor, setVendorsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [confirmDeletionSourceId, setConfirmDeletionSourceId] = React.useState<DModelSourceId | null>(null);

  // external state
  const { modelSources, addModelSource, removeModelSource } = useModelsStore(state => ({
    modelSources: state.sources,
    addModelSource: state.addSource, removeModelSource: state.removeSource,
  }), shallow);

  const handleShowVendors = (event: React.MouseEvent<HTMLElement>) => setVendorsMenuAnchor(event.currentTarget);

  const closeVendorsMenu = () => setVendorsMenuAnchor(null);

  const handleAddSourceFromVendor = React.useCallback((vendorId: ModelVendorId) => {
    closeVendorsMenu();
    const { sources: modelSources } = useModelsStore.getState();
    const modelSource = createModelSourceForVendor(vendorId, modelSources);
    if (modelSource) {
      addModelSource(modelSource);
      props.setSelectedSourceId(modelSource.id);
    }
  }, [addModelSource, props]);


  const enableDeleteButton = !!props.selectedSourceId && (modelSources.length > 1 /*|| (process.env.NODE_ENV === 'development')*/);

  const handleDeleteSource = (id: DModelSourceId) => setConfirmDeletionSourceId(id);

  const handleDeleteSourceConfirmed = React.useCallback(() => {
    if (confirmDeletionSourceId) {
      props.setSelectedSourceId(modelSources.find(source => source.id !== confirmDeletionSourceId)?.id ?? null);
      removeModelSource(confirmDeletionSourceId);
      setConfirmDeletionSourceId(null);
    }
  }, [confirmDeletionSourceId, modelSources, props, removeModelSource]);


  // vendor list items
  const vendorItems = React.useMemo(() => findAllVendors().filter(v => !!v.instanceLimit).map(vendor => {
    const sourceCount = modelSources.filter(source => source.vId === vendor.id).length;
    const enabled = vendor.instanceLimit > sourceCount;
    return {
      vendor,
      enabled,
      sourceCount,
      component: (
        <MenuItem key={vendor.id} disabled={!enabled} onClick={() => handleAddSourceFromVendor(vendor.id)}>
          <ListItemDecorator>
            {vendorIcon(vendor)}
          </ListItemDecorator>
          {vendor.name}{/*{sourceCount > 0 && ` (added)`}*/}
        </MenuItem>
      ),
    };
  }), [handleAddSourceFromVendor, modelSources]);


  // source items
  const sourceItems = React.useMemo(() => modelSources.map(source => {
    return {
      source,
      icon: locationIcon(findVendorById(source.vId)),
      component: <Option key={source.id} value={source.id}>{source.label}</Option>,
    };
  }), [modelSources]);

  const selectedSourceItem = sourceItems.find(item => item.source.id === props.selectedSourceId);
  const noSources = !sourceItems.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>

      {/* Models: [Select] Add Delete */}
      <Typography sx={{ mr: 1, ...hideOnMobile }}>
        Vendor:
      </Typography>

      <Select
        variant='outlined'
        value={props.selectedSourceId}
        disabled={noSources}
        onChange={(_event, value) => value && props.setSelectedSourceId(value)}
        startDecorator={selectedSourceItem?.icon}
        slotProps={{
          root: { sx: { minWidth: 190 } },
          indicator: { sx: { opacity: 0.5 } },
        }}
      >
        {sourceItems.map(item => item.component)}
      </Select>

      <IconButton variant={noSources ? 'solid' : 'plain'} color='primary' onClick={handleShowVendors} disabled={!!vendorsMenuAnchor} sx={{ ...hideOnDesktop }}>
        <AddIcon />
      </IconButton>
      <Button variant={noSources ? 'solid' : 'plain'} onClick={handleShowVendors} disabled={!!vendorsMenuAnchor} startDecorator={<AddIcon />} sx={{ ...hideOnMobile }}>
        Add
      </Button>

      <IconButton
        variant='plain' color='neutral' disabled={!enableDeleteButton} sx={{ ml: 'auto' }}
        onClick={() => props.selectedSourceId && handleDeleteSource(props.selectedSourceId)}
      >
        <DeleteOutlineIcon />
      </IconButton>


      {/* vendors popup, for adding */}
      <CloseableMenu
        placement='bottom-start' zIndex={10000} sx={{ minWidth: 280 }}
        open={!!vendorsMenuAnchor} anchorEl={vendorsMenuAnchor} onClose={closeVendorsMenu}
      >
        {vendorItems.map(item => item.component)}
      </CloseableMenu>

      {/* source delete confirmation */}
      <ConfirmationModal
        open={!!confirmDeletionSourceId} onClose={() => setConfirmDeletionSourceId(null)} onPositive={handleDeleteSourceConfirmed}
        confirmationText={'Are you sure you want to remove these models? The configuration data will be lost and you may have to enter it again.'} positiveActionText={'Remove'}
      />

    </Box>
  );
}