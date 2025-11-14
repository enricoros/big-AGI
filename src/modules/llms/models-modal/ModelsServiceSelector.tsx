import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Badge, Box, Button, IconButton, MenuItem, Option, Select, Tooltip, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { PhGift } from '~/common/components/icons/phosphor/PhGift';
import { Release } from '~/common/app.release';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import type { IModelVendor } from '../vendors/IModelVendor';
import { LLMVendorIcon } from '../components/LLMVendorIcon';
import { findAllModelVendors, findModelVendor } from '../vendors/vendors.registry';
import { vendorHasBackendCap } from '../vendors/vendor.helpers';
// import { MODELS_WIZARD_OPTION_ID } from '~/modules/llms/models-modal/ModelsModal';


// configuration
const ENABLE_DELETE_LAST = true; // This will fall the menu back to the 'Quick Setup' mode. was: Release.IsNodeDevBuild;


const _styles = {
  popup: {
    p: { xs: 1.5, md: 2 },
    // border: 'none',
    borderRadius: 'xl',
    boxShadow: '0 8px 48px rgba(0,0,0,0.2)',
    // boxShadow: 'xl',

    // display
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: { xs: 0.5, md: 1 },
    // rowGap: { xs: 0.25, md: 0.75 },
    // columnGap: { xs: 0.25, md: 2 },
  },

  header: {
    gridColumn: '1 / -1',
    mt: 2,
    '&:first-of-type': { marginTop: 0 },
    mb: 0.5,
    px: 1.5,
    py: 0.5,
    borderRadius: 'md',

    color: 'text.secondary',
    fontSize: 'sm',
    fontWeight: 'lg',
    // textTransform: 'uppercase',
    letterSpacing: '0.05em',

    // display: 'flex',
    // alignItems: 'center',
  },

  vendorItem: {
    // border: 'none',
    // borderRadius: '2rem',
    borderRadius: 'md',
    py: 0.5,
    pl: 0.5,
  },
  vendorItemIcon: {
    // borderRadius: '1rem',
    borderRadius: 'sm',
    backgroundColor: 'background.popup',
    boxShadow: 'xs',
    height: '2rem',
    width: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubButton: {
    px: 1,
    py: 0.5,
    outline: '1px solid',
    outlineColor: 'primary.outlinedBorder',
    minWidth: 'auto',
    minHeight: 'auto',
    fontSize: 'xs',
    mr: -0.25,
  },
} as const satisfies Record<string, SxProps>;


/*function locationIcon(vendor?: IModelVendor | null) {
  if (vendor && vendor.id === 'openai' && vendorHasBackendCap(...))
    return <CloudDoneOutlinedIcon />;
  return !vendor ? null : vendor.location === 'local' ? <ComputerIcon /> : <CloudOutlinedIcon />;
}*/

function vendorIconWithMark(vendor: IModelVendor | null, greenMark: boolean) {
  const icon = !vendor?.id ? null : <LLMVendorIcon vendorId={vendor.id} />;
  return (greenMark && icon)
    ? <Badge size='sm' badgeContent='' slotProps={{ badge: { sx: { backgroundColor: 'lime', boxShadow: 'none', border: '1px solid gray', p: 0 } } }}>{icon}</Badge>
    : icon;
}

type VendorItemData = {
  vendor: IModelVendor;
  vendorInstancesCount: number;
  canAdd: boolean;
};


function _renderSectionHeader(title: string, isFirst: boolean = false) {
  return (
    <Box key={`header-${title}`} sx={_styles.header}>
      {title}
      {/*<Box ml='auto' sx={{ color: 'text.tertiary', opacity: 0.5, letterSpacing: 'normal', fontWeight: 'normal' }}>*/}
      {/*  Full Support*/}
      {/*</Box>*/}
    </Box>
  );
}

function _renderVendorItem({ vendor, canAdd, vendorInstancesCount }: VendorItemData, isMobile: boolean, onAddServiceForVendor: (vendor: IModelVendor, forceAdd?: boolean) => void) {

  const isMultiInstance = (vendor.instanceLimit ?? 1) > 1;
  const hasInstances = vendorInstancesCount > 0;

  return (
    <MenuItem
      key={vendor.id}
      variant='soft'
      color={hasInstances ? 'neutral' : canAdd ? 'primary' : /*vendor.hasFreeModels ? 'success' :*/ 'neutral'}
      // disabled={!canAdd}
      onClick={() => onAddServiceForVendor(vendor)}
      sx={_styles.vendorItem}
    >
      {/*<ListItemDecorator>*/}
      {/*  /!*<Box sx={{ display: 'flex', aspectRatio: 1, borderRadius: 'xl', backgroundColor: 'background.popup', boxShadow: 'none', width: '32px', m: -1, p: 0.75 }}>*!/*/}
      {/*  {vendorIconWithMark(vendor, !vendorInstancesCount && vendorHasBackendCap(vendor))}*/}
      {/*  /!*</Box>*!/*/}
      {/*</ListItemDecorator>*/}

      <Box sx={_styles.vendorItemIcon}>
        {/*<Box >*/}
        {vendorInstancesCount ? <CheckRoundedIcon /> : vendorIconWithMark(vendor, !Release.IsNodeDevBuild && !vendorInstancesCount && vendorHasBackendCap(vendor))}
        {/*</Box>*/}
      </Box>

      {/*<Box sx={{ borderRadius: '1rem', backgroundColor: 'background.popup', boxShadow: 'none', height: '2rem', width: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>*/}
      {/*<Box >*/}
      {/*{vendorIconWithMark(vendor, !vendorInstancesCount && vendorHasBackendCap(vendor))}*/}
      {/*</Box>*/}
      {/*</Box>*/}

      <Box className={isMobile ? 'agi-ellipsize' : undefined} sx={{
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {vendor.name}
        {/*{(vendor.instanceLimit ?? 1) > 1 && !!vendorInstancesCount && canAdd && <span style={{ fontSize: 'smaller' }}>*/}
        {/*  &nbsp; (#{vendorInstancesCount + 1})*/}
        {/*  /!*&nbsp; +{vendorInstancesCount}*!/*/}
        {/*  /!*&nbsp; #{vendorInstancesCount + 1}*!/*/}
        {/*</span>}*/}
      </Box>

      {/* Free tier badge */}
      {vendor.hasFreeModels && canAdd && (
        <PhGift sx={{ color: 'success.solidBg', fontSize: 'lg' }} />
      )}
      {/*{vendor.hasFreeModels && (*/}
      {/*  <Chip*/}
      {/*    size='sm'*/}
      {/*    variant='soft'*/}
      {/*    color='success'*/}
      {/*    startDecorator={<PhGift sx={{ fontSize: 'xs' }} />}*/}
      {/*    sx={{*/}
      {/*      '--Chip-minHeight': '1.25rem',*/}
      {/*      fontSize: '0.625rem',*/}
      {/*      px: 0.5,*/}
      {/*      py: 0.25,*/}
      {/*      fontWeight: 'md',*/}
      {/*      ...(isMobile && { display: 'none' }), // Hide on mobile to save space*/}
      {/*    }}*/}
      {/*  >*/}
      {/*    Free*/}
      {/*  </Chip>*/}
      {/*)}*/}

      {/* Multiple instance hint */}
      {/*{(vendor.instanceLimit ?? 1) > 1 && !!vendorInstancesCount && canAdd && (*/}
      {/*  <Typography level='body-xs' sx={{ color: 'text.secondary', fontWeight: 'md' }}>*/}
      {/*#{vendorInstancesCount + 1}*/}
      {/*</Typography>*/}
      {/*)}*/}

      {/* Add IconButton for adding additional instances */}
      {isMultiInstance && hasInstances && canAdd && (
        <GoodTooltip title={`Add another ${vendor.name.replace('OpenAI', 'OpenAI-compatible')} service`} placement='top' arrow>
          <IconButton
            size='sm'
            color='primary'
            variant='soft'
            tabIndex={0}
            aria-label={`Add another ${vendor.name} service`}
            onClick={(e) => {
              e.stopPropagation();
              onAddServiceForVendor(vendor, true);
            }}
            sx={_styles.addSubButton}
          >
            Add
          </IconButton>
        </GoodTooltip>
      )}
    </MenuItem>
  );
}


export function ModelsServiceSelector(props: {
  modelsServices: DModelsService[],
  selectedServiceId: DModelsServiceId | null,
  setSelectedServiceId: (serviceId: DModelsServiceId | null) => void,
  onSwitchToWizard: () => void,
}) {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const [vendorsMenuAnchor, setVendorsMenuAnchor] = React.useState<HTMLElement | null>(null);

  // external state
  const isMobile = useIsMobile();

  const { onSwitchToWizard } = props;

  const handleShowVendors = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (event.shiftKey) onSwitchToWizard();
    else setVendorsMenuAnchor(event.currentTarget);
  }, [onSwitchToWizard]);

  const closeVendorsMenu = () => setVendorsMenuAnchor(null);


  // handlers

  const { modelsServices, setSelectedServiceId } = props;

  const handleAddServiceForVendor = React.useCallback((vendor: IModelVendor, forceNewInstance?: boolean) => {
    closeVendorsMenu();

    // check if we can add more instances of this vendor
    const vendorInstancesCount = modelsServices.filter(s => s.vId === vendor.id).length;
    const canAdd = (vendor.instanceLimit ?? 1) > vendorInstancesCount;

    // if at limit, or newInstance is not forced, switch to the first existing service of this vendor
    if (!canAdd || (!forceNewInstance && vendorInstancesCount > 0)) {
      const existingService = modelsServices.find(s => s.vId === vendor.id);
      if (existingService) {
        setSelectedServiceId(existingService.id);
        return;
      }
    }

    // otherwise create a new service
    const modelsService = llmsStoreActions().createModelsService(vendor);
    setSelectedServiceId(modelsService.id);
  }, [setSelectedServiceId, modelsServices]);

  const enableDeleteButton = !!props.selectedServiceId && (ENABLE_DELETE_LAST || modelsServices.length > 1);

  const handleDeleteService = React.useCallback(async (serviceId: DModelsServiceId, skipConfirmation: boolean) => {
    // [shift] to delete without confirmation
    if (skipConfirmation) {
      // select the next service
      setSelectedServiceId(modelsServices.find(s => s.id !== serviceId)?.id ?? null);
      // remove the service
      llmsStoreActions().removeService(serviceId);
      return;
    }
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


  // memo popup 'vendor' items
  const vendorComponents = React.useMemo(() => {

    // prepare the items
    const vendorItems = findAllModelVendors()
      .filter(v => v.instanceLimit !== 0)
      .map(vendor => {
        const vendorInstancesCount = modelsServices.filter(s => s.vId === vendor.id).length;
        return {
          vendor,
          vendorInstancesCount,
          canAdd: (vendor.instanceLimit ?? 1) > vendorInstancesCount,
        };
      });

    // rendered components split by display groups
    const components: React.ReactNode[] = [

      _renderSectionHeader('Featured', true),
      ...vendorItems
        .filter(v => v.vendor.displayGroup === 'popular')
        .sort((a, b) => a.vendor.name.localeCompare(b.vendor.name))
        // .sort((a, b) => a.vendor.displayRank - b.vendor.displayRank)
        .map(item => _renderVendorItem(item, isMobile, handleAddServiceForVendor)),

      _renderSectionHeader('Cloud'),
      ...vendorItems
        .filter(v => v.vendor.displayGroup === 'cloud')
        .sort((a, b) => a.vendor.name.localeCompare(b.vendor.name))
        .map(item => _renderVendorItem(item, isMobile, handleAddServiceForVendor)),

      _renderSectionHeader('Local'),
      ...vendorItems
        .filter(v => v.vendor.displayGroup === 'local')
        .sort((a, b) => {
          // LocalAI first, then alphabetically
          if (a.vendor.id === 'localai') return -1;
          if (b.vendor.id === 'localai') return 1;
          return a.vendor.name.localeCompare(b.vendor.name);
        })
        .map(item => _renderVendorItem(item, isMobile, handleAddServiceForVendor)),
    ];
    return components;
  }, [handleAddServiceForVendor, modelsServices, isMobile]);


  // memo deployed services items
  const serviceItems: { service: DModelsService, icon: React.ReactNode, component: React.ReactNode }[] = React.useMemo(() =>
      modelsServices
        .map(service => {
          const icon = vendorIconWithMark(findModelVendor(service.vId), false);
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
        })
        .sort((a, b) => a.service.label.localeCompare(b.service.label))
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
          root: { sx: { minWidth: 180 } },
          indicator: { sx: { opacity: 0.5 } },
        }}
      >
        {serviceItems.map(item => item.component)}

        {/* Add Service button */}
        {/*<ListDivider />*/}
        {/*<ListItem onClick={handleShowVendors}>*/}
        {/*  <ListItemButton>*/}
        {/*    <ListItemDecorator>*/}
        {/*      <AddIcon />*/}
        {/*    </ListItemDecorator>*/}
        {/*    Add Service*/}
        {/*  </ListItemButton>*/}
        {/*</ListItem>*/}
      </Select>

      {(isMobile && !noServices) ? (
        <IconButton variant={noServices ? 'solid' : 'outlined'} color='primary' onClick={handleShowVendors} disabled={!!vendorsMenuAnchor} sx={{ borderColor: 'neutral.outlinedBorder' }}>
          <AddIcon />
        </IconButton>
      ) : (
        <Tooltip open={noServices && !vendorsMenuAnchor} variant='outlined' color='primary' size='md' placement={isMobile ? 'bottom-end' : 'top-start'} arrow title='Add your first AI service'>
          <Button variant={noServices ? 'solid' : 'outlined'} onClick={handleShowVendors} disabled={!!vendorsMenuAnchor} startDecorator={<AddIcon />} sx={{ borderColor: 'neutral.outlinedBorder' }}>
            Add
          </Button>
        </Tooltip>
      )}

      {enableDeleteButton && (
        <TooltipOutlined title={`Remove ${selectedServiceItem?.service.label || 'Service'}`}>
          <IconButton
            variant='plain' color='neutral' disabled={!enableDeleteButton} sx={{ ml: 'auto' }}
            onClick={(event) => props.selectedServiceId && handleDeleteService(props.selectedServiceId, event.shiftKey)}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </TooltipOutlined>
      )}


      {/* vendors popup, for adding */}
      <CloseablePopup
        menu
        anchorEl={vendorsMenuAnchor} onClose={closeVendorsMenu}
        placement={isMobile ? 'bottom' : 'auto-end'}
        zIndex={themeZIndexOverMobileDrawer}
        sx={_styles.popup}
      >
        {vendorComponents}
      </CloseablePopup>

    </Box>
  );
}