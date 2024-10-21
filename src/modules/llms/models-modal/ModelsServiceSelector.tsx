import * as React from 'react';

import { Badge, Box, Button, IconButton, ListItemDecorator, MenuItem, Option, Select, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useModelsServices } from '~/common/stores/llms/llms.hooks';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import type { IModelVendor } from '../vendors/IModelVendor';
import { createModelsServiceForVendor, vendorHasBackendCap } from '../vendors/vendor.helpers';
import { findAllModelVendors, findModelVendor, ModelVendorId } from '../vendors/vendors.registry';


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


export function ModelsServiceSelector(props: {
  selectedServiceId: DModelsServiceId | null, setSelectedServiceId: (serviceId: DModelsServiceId | null) => void,
}) {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const [vendorsMenuAnchor, setVendorsMenuAnchor] = React.useState<HTMLElement | null>(null);

  // external state
  const isMobile = useIsMobile();
  const modelsServices = useModelsServices();

  const handleShowVendors = (event: React.MouseEvent<HTMLElement>) => setVendorsMenuAnchor(event.currentTarget);

  const closeVendorsMenu = () => setVendorsMenuAnchor(null);


  // handlers

  const { setSelectedServiceId } = props;

  const handleAddServiceForVendor = React.useCallback((vendorId: ModelVendorId) => {
    closeVendorsMenu();
    const { sources: modelsServices, addService } = llmsStoreState();
    const modelsService = createModelsServiceForVendor(vendorId, modelsServices);
    if (modelsService) {
      addService(modelsService);
      setSelectedServiceId(modelsService.id);
    }
  }, [setSelectedServiceId]);

  const enableDeleteButton = !!props.selectedServiceId && modelsServices.length > 1;

  const handleDeleteService = React.useCallback(async (serviceId: DModelsServiceId) => {
    showPromisedOverlay('llms-service-remove', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText='Are you sure you want to remove these models? The configuration data will be lost and you may have to enter it again.'
        positiveActionText='Remove'
      />,
    ).then(() => {
      // select the next service
      setSelectedServiceId(modelsServices.find(s => s.id !== serviceId)?.id ?? null);
      // remove the service
      llmsStoreActions().removeService(serviceId);
    }).catch(() => null /* ignore closure */);
  }, [modelsServices, setSelectedServiceId, showPromisedOverlay]);


  // vendor list items
  const vendorComponents = React.useMemo(() => {

    // prepare the items
    const vendorItems = findAllModelVendors()
      .filter(v => v.instanceLimit !== 0)
      .sort((a, b) => {
        // sort first by 'cloud' on top (vs. 'local'), then by name
        // if (a.location !== b.location)
        //   return a.location === 'cloud' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(vendor => {
          const vendorInstancesCount = modelsServices.filter(s => s.vId === vendor.id).length;
          const enabled = (vendor.instanceLimit ?? 1) > vendorInstancesCount;
          return {
            vendor,
            enabled,
            component: (
              <MenuItem key={vendor.id} disabled={!enabled} onClick={() => handleAddServiceForVendor(vendor.id)}>
                <ListItemDecorator>
                  {vendorIcon(vendor, vendorHasBackendCap(vendor))}
                </ListItemDecorator>
                {vendor.name}

                {/*{vendorInstancesCount > 0 && ` (added)`}*/}

                {/* Free indication */}
                {/*{!!vendor.hasFreeModels && ` 🎁`}*/}

                {/* Multiple instance hint */}
                {(vendor.instanceLimit ?? 1) > 1 && !!vendorInstancesCount && enabled && (
                  <Typography component='span' level='body-sm'>
                    #{vendorInstancesCount + 1}
                    {/*/{vendor.instanceLimit ?? 1}*/}
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
  }, [handleAddServiceForVendor, modelsServices]);

  // service items
  const serviceItems: { service: DModelsService, icon: React.ReactNode, component: React.ReactNode }[] = React.useMemo(() =>
      modelsServices.map(service => {
        const icon = vendorIcon(findModelVendor(service.vId), false);
        return {
          service,
          icon,
          component: (
            <Option key={service.id} value={service.id}>
              {/*<ListItemDecorator>{icon}</ListItemDecorator>*/}
              {service.label}
            </Option>
          ),
        };
      }).sort((a, b) => a.service.label.localeCompare(b.service.label))
    , [modelsServices]);

  const selectedServiceItem = serviceItems.find(item => item.service.id === props.selectedServiceId);
  const noServices = !serviceItems.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>

      {/* Models: [Select] Add Delete */}
      {!isMobile && <Typography sx={{ mr: 1 }}>
        Service:
      </Typography>}

      <Select
        variant='outlined'
        value={props.selectedServiceId}
        disabled={noServices}
        onChange={(_event, value) => value && props.setSelectedServiceId(value)}
        startDecorator={selectedServiceItem?.icon}
        slotProps={{
          root: { sx: { minWidth: 190 } },
          indicator: { sx: { opacity: 0.5 } },
        }}
      >
        {serviceItems.map(item => item.component)}
      </Select>

      {isMobile ? (
        <IconButton variant={noServices ? 'solid' : 'plain'} color='primary' onClick={handleShowVendors} disabled={!!vendorsMenuAnchor}>
          <AddIcon />
        </IconButton>
      ) : (
        <Button variant={noServices ? 'solid' : 'plain'} onClick={handleShowVendors} disabled={!!vendorsMenuAnchor} startDecorator={<AddIcon />}>
          Add
        </Button>
      )}

      <IconButton
        variant='plain' color='neutral' disabled={!enableDeleteButton} sx={{ ml: 'auto' }}
        onClick={() => props.selectedServiceId && handleDeleteService(props.selectedServiceId)}
      >
        <DeleteOutlineIcon />
      </IconButton>


      {/* vendors popup, for adding */}
      <CloseablePopup
        menu anchorEl={vendorsMenuAnchor} onClose={closeVendorsMenu}
        minWidth={200}
        placement='auto-end'
        zIndex={themeZIndexOverMobileDrawer}
      >
        {vendorComponents}
      </CloseablePopup>

    </Box>
  );
}