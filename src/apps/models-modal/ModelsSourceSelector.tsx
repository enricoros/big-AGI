import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Avatar, Badge, Box, Button, IconButton, ListItemDecorator, MenuItem, Option, Select, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { type DModelSourceId, useModelsStore } from '~/modules/llms/store-llms';
import { type IModelVendor, type ModelVendorId } from '~/modules/llms/vendors/IModelVendor';
import { createModelSourceForVendor, findAllVendors, findVendorById } from '~/modules/llms/vendors/vendors.registry';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { useIsMobile } from '~/common/components/useMatchMedia';


/*function locationIcon(vendor?: IModelVendor | null) {
  if (vendor && vendor.id === 'openai' && ModelVendorOpenAI.hasBackendCap?.())
    return <CloudDoneOutlinedIcon />;
  return !vendor ? null : vendor.location === 'local' ? <ComputerIcon /> : <CloudOutlinedIcon />;
}*/

function vendorIcon(vendor: IModelVendor | null, greenMark: boolean) {
  let icon: React.JSX.Element | null = null;
  if (vendor?.Icon) {
    if (typeof vendor.Icon === 'string')
      icon = <Avatar sx={{ width: 24, height: 24 }}>{vendor.Icon}</Avatar>;
    else
      icon = <vendor.Icon />;
  }
  return (greenMark && icon)
    ? <Badge color='success' size='sm' badgeContent=''>{icon}</Badge>
    : icon;
}


export function ModelsSourceSelector(props: {
  selectedSourceId: DModelSourceId | null, setSelectedSourceId: (sourceId: DModelSourceId | null) => void,
}) {

  // state
  const [vendorsMenuAnchor, setVendorsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [confirmDeletionSourceId, setConfirmDeletionSourceId] = React.useState<DModelSourceId | null>(null);

  // external state
  const isMobile = useIsMobile();
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


  const enableDeleteButton = !!props.selectedSourceId && modelSources.length > 1;

  const handleDeleteSource = (id: DModelSourceId) => setConfirmDeletionSourceId(id);

  const handleDeleteSourceConfirmed = React.useCallback(() => {
    if (confirmDeletionSourceId) {
      props.setSelectedSourceId(modelSources.find(source => source.id !== confirmDeletionSourceId)?.id ?? null);
      removeModelSource(confirmDeletionSourceId);
      setConfirmDeletionSourceId(null);
    }
  }, [confirmDeletionSourceId, modelSources, props, removeModelSource]);


  // vendor list items
  const vendorItems = React.useMemo(() => findAllVendors()
    .filter(v => !!v.instanceLimit)
    .map(vendor => {
        const sourceCount = modelSources.filter(source => source.vId === vendor.id).length;
        const enabled = vendor.instanceLimit > sourceCount;
        return {
          vendor,
          enabled,
          sourceCount,
          component: (
            <MenuItem key={vendor.id} disabled={!enabled} onClick={() => handleAddSourceFromVendor(vendor.id)}>
              <ListItemDecorator>
                {vendorIcon(vendor, !!vendor.hasBackendCap && vendor.hasBackendCap())}
              </ListItemDecorator>
              {vendor.name}
              {/*{sourceCount > 0 && ` (added)`}*/}
              {!!vendor.hasFreeModels && ` 🎁`}
              {/*{!!vendor.instanceLimit && ` (${sourceCount}/${vendor.instanceLimit})`}*/}
              {vendor.location === 'local' && <span style={{ opacity: 0.5 }}>local</span>}
            </MenuItem>
          ),
        };
      },
    ), [handleAddSourceFromVendor, modelSources]);


  // source items
  const sourceItems = React.useMemo(() => modelSources.map(source => {
    return {
      source,
      icon: vendorIcon(findVendorById(source.vId), false),
      component: <Option key={source.id} value={source.id}>{source.label}</Option>,
    };
  }), [modelSources]);

  const selectedSourceItem = sourceItems.find(item => item.source.id === props.selectedSourceId);
  const noSources = !sourceItems.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>

      {/* Models: [Select] Add Delete */}
      {!isMobile && <Typography sx={{ mr: 1 }}>
        Service:
      </Typography>}

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

      {isMobile ? (
        <IconButton variant={noSources ? 'solid' : 'plain'} color='primary' onClick={handleShowVendors} disabled={!!vendorsMenuAnchor}>
          <AddIcon />
        </IconButton>
      ) : (
        <Button variant={noSources ? 'solid' : 'plain'} onClick={handleShowVendors} disabled={!!vendorsMenuAnchor} startDecorator={<AddIcon />}>
          Add
        </Button>
      )}

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