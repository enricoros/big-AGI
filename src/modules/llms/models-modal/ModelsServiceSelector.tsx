import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Badge, Box, IconButton, ListDivider, MenuItem, Option, Select, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { ButtonServiceAdd } from '~/common/components/ButtonServiceAdd';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { PhGift } from '~/common/components/icons/phosphor/PhGift';
import { Release } from '~/common/app.release';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';
import { useIsMobile } from '~/common/components/useMatchMedia';

import type { IModelVendor } from '../vendors/IModelVendor';
import { LLMVendorIconSprite } from '../components/LLMVendorIconSprite';
import { findAllModelVendors, findModelVendor, type ModelVendorId } from '../vendors/vendors.registry';
import { vendorHasServerConf } from '../vendors/vendor.helpers';
// import { MODELS_WIZARD_OPTION_ID } from '~/modules/llms/models-modal/ModelsModal';


// configuration
const ENABLE_DELETE_LAST = true; // This will fall the menu back to the 'Quick Setup' mode. was: Release.IsNodeDevBuild;

export const ALL_SERVICES_OPTION_ID = '*'; // pseudo-service in the selector: the Updates screen (never a real service id)

// Cloud priority: editorial, most relevant first (vendors not listed come last). It only picks which vendors show while
// collapsed: configured ones always, then by priority up to CLOUD_COLLAPSED_COUNT, next to a 'Show more' tile (8 tiles, 4 full
// rows of the 2-column grid). The section always lists alphabetically, collapsed or expanded, so a vendor is easy to find.
const CLOUD_PRIORITY: ReadonlyArray<ModelVendorId> = [
  'deepseek', 'nvidianim', 'groq', 'xai', 'mistral', 'zai', 'bedrock',
  'azure', 'cohere', 'metaai', 'sakanaai', 'alibaba', 'moonshot', 'modular', 'togetherai', 'perplexity', 'cerebras',
];
const CLOUD_COLLAPSED_COUNT = 7;


const _styles = {
  popup: {
    p: { xs: 1.5, md: 2 },
    // border: 'none',
    borderRadius: 'xl',
    boxShadow: '0 8px 48px rgba(0,0,0,0.2)',
    // boxShadow: 'xl',

    // never taller than the viewport (mobile: anchored below the Add button) - scrolls inside
    maxHeight: { xs: 'calc(100dvh - 8rem)', md: 'calc(100dvh - 4rem)' },
    overflowY: 'auto',

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
  headerToggle: {
    minHeight: 'auto',
    justifyContent: 'space-between',
    alignItems: 'baseline', // 'Show more' sits on the title's baseline (the expanded chevron re-centers itself)
  },
  toggleTileSpacer: {
    width: '2rem', // = vendorItemIcon: keeps the text in line with the vendor names
    flexShrink: 0,
  },
  headerToggleHint: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.25,
    fontSize: 'xs',
    fontWeight: 'md',
    textTransform: 'uppercase',
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
  if (vendor && vendor.id === 'openai' && vendorHasServerConf(...))
    return <CloudDoneOutlinedIcon />;
  return !vendor ? null : vendor.location === 'local' ? <ComputerIcon /> : <CloudOutlinedIcon />;
}*/

function vendorIconWithMark(vendor: IModelVendor | null, greenMark: boolean) {
  const icon = !vendor?.id ? null : <LLMVendorIconSprite vendorId={vendor.id} />;
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

// a section header that also toggles the section: 'Cloud ... SHOW MORE v' collapsed, 'Cloud ^' expanded
function _renderSectionHeaderToggle(title: string, expanded: boolean, onToggle: () => void) {
  return (
    <MenuItem key={`header-${title}`} variant='plain' aria-expanded={expanded} onClick={onToggle} sx={{ ..._styles.header, ..._styles.headerToggle }}>
      {title}
      <Box sx={expanded ? { ..._styles.headerToggleHint, alignSelf: 'center' } : _styles.headerToggleHint}>
        {!expanded && 'Show more'}
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>
    </MenuItem>
  );
}

// the last tile of a collapsed section: a plain text link, no icon or background (expanded, the header collapses it)
function _renderShowMoreTile(onExpand: () => void) {
  return (
    <MenuItem key='show-more-tile' variant='plain' color='neutral' aria-expanded={false} onClick={onExpand} sx={{ ..._styles.vendorItem, fontSize: 'sm' }}>
      <Box sx={_styles.toggleTileSpacer} />
      Show more…
    </MenuItem>
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
      {/*  {vendorIconWithMark(vendor, !vendorInstancesCount && vendorHasServerConf(vendor))}*/}
      {/*  /!*</Box>*!/*/}
      {/*</ListItemDecorator>*/}

      <Box sx={_styles.vendorItemIcon}>
        {/*<Box >*/}
        {vendorInstancesCount ? <CheckRoundedIcon /> : vendorIconWithMark(vendor, !Release.IsNodeDevBuild && !vendorInstancesCount && vendorHasServerConf(vendor))}
        {/*</Box>*/}
      </Box>

      {/*<Box sx={{ borderRadius: '1rem', backgroundColor: 'background.popup', boxShadow: 'none', height: '2rem', width: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>*/}
      {/*<Box >*/}
      {/*{vendorIconWithMark(vendor, !vendorInstancesCount && vendorHasServerConf(vendor))}*/}
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
        <PhGift sx={{ color: 'primary.softColor', fontSize: 'lg' }} />
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
  onDeleteService: (serviceId: DModelsServiceId, skipConfirmation: boolean) => void,
  onSwitchToWizard: () => void,
  allServicesControl?: React.ReactNode, // shown in place of the delete button while 'All services' is selected
}) {

  // state
  const [vendorsMenuAnchor, setVendorsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [showMoreVendors, setShowMoreVendors] = React.useState(false);

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

  const isAllServices = props.selectedServiceId === ALL_SERVICES_OPTION_ID;
  const enableDeleteButton = !!props.selectedServiceId && !isAllServices && (ENABLE_DELETE_LAST || modelsServices.length > 1);


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

    // cloud vendors, alphabetical; collapsed: the configured ones, then by priority, an odd count so that with the toggle tile
    // the rows are full; collapsible only when it hides at least 2 (the toggle tile takes a slot)
    const _byName = (a: VendorItemData, b: VendorItemData) => a.vendor.name.localeCompare(b.vendor.name);
    const _cloudRank = (id: ModelVendorId) => { const i = CLOUD_PRIORITY.indexOf(id); return i === -1 ? CLOUD_PRIORITY.length : i; };
    const cloudItems = vendorItems.filter(v => v.vendor.displayGroup === 'cloud').sort(_byName);
    const collapsedIds = new Set(cloudItems.filter(v => v.vendorInstancesCount > 0).map(v => v.vendor.id));
    const collapsedTarget = Math.max(CLOUD_COLLAPSED_COUNT, collapsedIds.size) | 1;
    for (const v of [...cloudItems].sort((a, b) => _cloudRank(a.vendor.id) - _cloudRank(b.vendor.id) || _byName(a, b)))
      if (collapsedIds.size < collapsedTarget) collapsedIds.add(v.vendor.id);
    const cloudCollapsible = cloudItems.length - collapsedIds.size >= 2;
    const toggleCloud = () => setShowMoreVendors(show => !show);

    // rendered components split by display groups
    const components: React.ReactNode[] = [

      _renderSectionHeader('Featured', true),
      ...vendorItems
        .filter(v => v.vendor.displayGroup === 'popular')
        .sort((a, b) => a.vendor.name.localeCompare(b.vendor.name))
        // .sort((a, b) => a.vendor.displayRank - b.vendor.displayRank)
        .map(item => _renderVendorItem(item, isMobile, handleAddServiceForVendor)),

      ...(!cloudCollapsible ? [
        _renderSectionHeader('Cloud'),
        ...cloudItems.map(item => _renderVendorItem(item, isMobile, handleAddServiceForVendor)),
      ] : [
        _renderSectionHeaderToggle('Cloud', showMoreVendors, toggleCloud),
        ...(showMoreVendors ? cloudItems : cloudItems.filter(v => collapsedIds.has(v.vendor.id))).map(item => _renderVendorItem(item, isMobile, handleAddServiceForVendor)),
        ...(!showMoreVendors ? [_renderShowMoreTile(toggleCloud)] : []),
      ]),

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
  }, [handleAddServiceForVendor, modelsServices, isMobile, showMoreVendors]);


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
        startDecorator={isAllServices ? <RefreshIcon /> : selectedServiceItem?.icon}
        slotProps={{
          root: { sx: { minWidth: 180 } },
          indicator: { sx: { opacity: 0.5 } },
        }}
      >
        {/* the Updates screen, as a pseudo-service */}
        {!noServices && <Option value={ALL_SERVICES_OPTION_ID}>All services</Option>}
        {!noServices && <ListDivider role='none' />}

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

      <ButtonServiceAdd
        isMobile={isMobile}
        isEmpty={noServices}
        emptyHint='Add your first AI service'
        menuOpen={!!vendorsMenuAnchor}
        onClick={handleShowVendors}
      />

      {isAllServices && props.allServicesControl}

      {enableDeleteButton && (
        <TooltipOutlined title={`Remove ${selectedServiceItem?.service.label || 'Service'}`}>
          <IconButton
            variant='plain' color='neutral' disabled={!enableDeleteButton} sx={{ ml: 'auto' }}
            onClick={(event) => props.selectedServiceId && props.onDeleteService(props.selectedServiceId, event.shiftKey)}
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
        {/* the one question a user has before picking a provider; spans the popup's 2-column grid */}
        {/*<Box sx={{ gridColumn: '1 / -1', px: 1.5, py: 1 }}>*/}
        {/*  <ExternalDocsLink level='body-sm' docPage='connect-models'>Which provider should I use?</ExternalDocsLink>*/}
        {/*</Box>*/}
      </CloseablePopup>

    </Box>
  );
}