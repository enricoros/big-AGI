import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Badge, Box, Button, IconButton, ListItemDecorator, MenuItem, Option, Select, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';
import { useIsMobile } from '~/common/components/useMatchMedia';

import type { IModelVendor } from '../vendors/IModelVendor';
import { DModelSourceId, useModelsStore } from '../store-llms';
import { createModelSourceForVendor, findAllVendors, findVendorById, ModelVendorId } from '../vendors/vendors.registry';
import { vendorHasBackendCap } from '../vendors/useSourceSetup';


/*function locationIcon(vendor?: IModelVendor | null) {
  if (vendor && vendor.id === 'openai' && vendorHasBackendCap(...))
    return <CloudDoneOutlinedIcon />;
  return !vendor ? null : vendor.location === 'local' ? <ComputerIcon /> : <CloudOutlinedIcon />;
}*/

function vendorIcon(vendor: IModelVendor | null, greenMark: boolean) {
  let icon: React.JSX.Element | null = null;
  if (vendor?.Icon)
    icon = <vendor.Icon />;
  return (greenMark && icon)
    ? <Badge size='sm' badgeContent='' slotProps={{ badge: { sx: { backgroundColor: 'lime', boxShadow: 'none', border: '1px solid gray', p: 0 } } }}>{icon}</Badge>
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
  const vendorComponents = React.useMemo(() => {

    // prepare the items
    const vendorItems = findAllVendors()
      .filter(v => !!v.instanceLimit)
      .sort((a, b) => {
        // sort first by 'cloud' on top (vs. 'local'), then by name
        // if (a.location !== b.location)
        //   return a.location === 'cloud' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(vendor => {
          const sourceInstanceCount = modelSources.filter(source => source.vId === vendor.id).length;
          const enabled = vendor.instanceLimit > sourceInstanceCount;
          const backendCaps = getBackendCapabilities();
          return {
            vendor,
            enabled,
            component: (
              <MenuItem key={vendor.id} disabled={!enabled} onClick={() => handleAddSourceFromVendor(vendor.id)}>
                <ListItemDecorator>
                  {vendorIcon(vendor, vendorHasBackendCap(vendor, backendCaps))}
                </ListItemDecorator>
                {vendor.name}

                {/*{sourceInstanceCount > 0 && ` (added)`}*/}

                {/* Free indication */}
                {/*{!!vendor.hasFreeModels && ` 🎁`}*/}

                {/* Multiple instance hint */}
                {vendor.instanceLimit > 1 && !!sourceInstanceCount && enabled && (
                  <Typography component='span' level='body-sm'>
                    #{sourceInstanceCount + 1}
                    {/*/{vendor.instanceLimit}*/}
                  </Typography>
                )}

                {/* Local chip */}
                {/*{vendor.location === 'local' && (*/}
                {/*  <Chip variant='solid' size='sm'>*/}
                {/*    local*/}
                {/*  </Chip>*/}
                {/*)}*/}
              </MenuItem>
            ),
          };
        },
      );

    // prepend headers
    // const components: React.ReactNode[] = [];
    // let lastLocation: 'cloud' | 'local' | null = null;
    // vendorItems.forEach(item => {
    //   if (item.vendor.location !== lastLocation) {
    //     lastLocation = item.vendor.location;
    //     components.push(
    //       <Typography key={lastLocation} level='body-xs' sx={{
    //         color: 'text.tertiary',
    //         mx: 1.5,
    //         mt: 1,
    //         mb: 1,
    //       }}>
    //         {lastLocation === 'cloud' ? 'Cloud Services' : 'Local Services'}
    //       </Typography>,
    //     );
    //   }
    //   components.push(item.component);
    // });
    // return components;

    return vendorItems.map(item => item.component);
  }, [handleAddSourceFromVendor, modelSources]);

  // source items
  const sourceItems = React.useMemo(() => modelSources
      .map(source => {
        const icon = vendorIcon(findVendorById(source.vId), false);
        return {
          source,
          icon,
          component: (
            <Option key={source.id} value={source.id}>
              {/*<ListItemDecorator>{icon}</ListItemDecorator>*/}
              {source.label}
            </Option>
          ),
        };
      })
      .sort((a, b) => a.source.label.localeCompare(b.source.label))
    , [modelSources]);

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
        placement='bottom-start' zIndex={themeZIndexOverMobileDrawer}
        open={!!vendorsMenuAnchor} anchorEl={vendorsMenuAnchor} onClose={closeVendorsMenu}
        sx={{ minWidth: 200 }}
      >
        {vendorComponents}
      </CloseableMenu>

      {/* source delete confirmation */}
      <ConfirmationModal
        open={!!confirmDeletionSourceId} onClose={() => setConfirmDeletionSourceId(null)} onPositive={handleDeleteSourceConfirmed}
        confirmationText={'Are you sure you want to remove these models? The configuration data will be lost and you may have to enter it again.'} positiveActionText={'Remove'}
      />

    </Box>
  );
}