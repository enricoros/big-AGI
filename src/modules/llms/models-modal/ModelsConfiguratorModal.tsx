import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Checkbox, CircularProgress, Divider, Dropdown, IconButton, ListDivider, ListItemDecorator, Menu, MenuButton, MenuItem, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { CloseablePopup, joyKeepPopup } from '~/common/components/CloseablePopup';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { PhGift } from '~/common/components/icons/phosphor/PhGift';
import { isLLMChatFree_cached } from '~/common/stores/llms/llms.pricing';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';
import { optimaActions } from '~/common/layout/optima/useOptima';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';
import { useAllServicesDCStatus } from '~/common/stores/llms/hooks/useModelServiceClientSideFetch';
import { useHasFreeLLMs, useHasLLMs } from '~/common/stores/llms/llms.hooks';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useModelsZeroState } from '~/common/stores/llms/hooks/useModelsZeroState';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { useUICounter, useUIPreferencesStore } from '~/common/stores/store-ui';

import { LLMVendorSetup } from '../components/LLMVendorSetup';
import { ModelsList } from './ModelsList';
import { ModelsServiceSelector } from './ModelsServiceSelector';
import { ModelsWizard } from './ModelsWizard';
import { useLlmUpdateModels } from '../llm.client.hooks';


// configuration
const MODELS_WIZARD_ENABLE_INITIALLY = true;


type TabValue = 'wizard' | 'setup' | 'defaults';

/**
 * Note: the reason for this component separation from the parent state, is delayed state initialization.
 */
export function ModelsConfiguratorModal(props: {
  modelsServices: DModelsService[],
  confServiceId: string | null,
  setConfServiceId: (serviceId: string | null) => void,
  // allowAutoTrigger: boolean,
}) {

  const { modelsServices, confServiceId, setConfServiceId } = props;

  // state
  // const [showAllServices, setShowAllServices] = React.useState<boolean>(false);
  const [tab, setTab] = React.useState<TabValue>(MODELS_WIZARD_ENABLE_INITIALLY && !modelsServices.length ? 'wizard' : 'setup');
  const [unsavedWizardProviders, setUnsavedWizardProviders] = React.useState<Set<string>>(new Set());
  const showAllServices = false;

  // state - menus
  const [mainMenuOpen, setMainMenuOpen] = React.useState(false);
  const [dcMenuAnchor, setDcMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [visMenuAnchor, setVisMenuAnchor] = React.useState<HTMLElement | null>(null);

  // external state
  const isMobile = useIsMobile();
  const hasLLMs = useHasLLMs();
  const { showPromisedOverlay } = useOverlayComponents();
  const { showModelsHidden, setShowModelsHidden, starredOnTop, setStarredOnTop } = useUIPreferencesStore(useShallow(state => ({
    showModelsHidden: state.showModelsHidden,
    setShowModelsHidden: state.setShowModelsHidden,
    starredOnTop: state.modelsStarredOnTop,
    setStarredOnTop: state.setModelsStarredOnTop,
  })));
  const { dcStatus, dcHasEligible, dcAllEnabled, dcNoneEnabled, handleEnableAllDC, handleDisableAllDC } = useAllServicesDCStatus(modelsServices);


  // active service with fallback to the last added service
  const activeServiceId: string | null = confServiceId
    ?? modelsServices[modelsServices.length - 1]?.id
    ?? null;

  const activeService = modelsServices.find(s => s.id === activeServiceId);
  // const hasClones = useModelsStore(({ llms }) => llms.some(llm => llm.sId === activeServiceId && llm.isUserClone));

  const hasAnyServices = !!modelsServices.length;
  const isTabWizard = tab === 'wizard';
  const isTabSetup = tab === 'setup';
  const activeHasFreeLLMs = useHasFreeLLMs(activeServiceId);
  // const isTabDefaults = tab === 'defaults';


  // Auto-add the default service - at boot, when no service is present
  // const autoAddTrigger = !showWizard && props.allowAutoTrigger;
  // React.useEffect(() => {
  //   // Note: we use the immediate version to not react to deletions
  //   const { createModelsService, sources: modelsServices } = llmsStoreState();
  //   if (autoAddTrigger && !modelsServices.length)
  //     createModelsService(getDefaultModelVendor());
  // }, [autoAddTrigger]);

  // [effect] Re-trigger easy mode when going back to 0 services
  const triggerWizard = !modelsServices.length;
  React.useEffect(() => {
    if (triggerWizard)
      setTab('wizard');
  }, [triggerWizard]);


  // handlers
  const handleShowAdvanced = React.useCallback(() => setTab('setup'), []);
  const handleShowWizard = React.useCallback(() => setTab('wizard'), []);
  // const handleToggleDefaults = React.useCallback(() => setTab(tab => tab === 'defaults' ? 'setup' : 'defaults'), []);

  // callback for wizard to report unsaved provider changes
  const handleWizardProviderUnsavedChange = React.useCallback((providerId: string, hasUnsaved: boolean) => {
    setUnsavedWizardProviders(prev => {
      const next = new Set(prev);
      if (hasUnsaved) next.add(providerId);
      else next.delete(providerId);
      // only update if actually changed
      return next.size !== prev.size || (hasUnsaved && !prev.has(providerId)) ? next : prev;
    });
  }, []);


  // Menu handlers

  const handleMainMenuOpenChange = React.useCallback((_event: React.SyntheticEvent | null, newOpen: boolean) => {
    // submenu is open, stay open
    if (!newOpen && (dcMenuAnchor || visMenuAnchor)) return;
    setMainMenuOpen(newOpen);
    // close submenus when main closes
    if (!newOpen) {
      setDcMenuAnchor(null);
      setVisMenuAnchor(null);
    }
  }, [dcMenuAnchor, visMenuAnchor]);

  const { isFetching: isRefreshing, refetch: handleRefreshModels } = useLlmUpdateModels(false, activeService ?? null);

  const handleResetAllParameters = React.useCallback(() => {
    showPromisedOverlay('llms-reset-parameters', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText={`Reset all user-customized model parameters and names for ${activeService?.label ?? 'this service'}? All settings such as temperature, reasoning effort, etc. will be reverted to defaults.`}
        positiveActionText='Reset'
      />,
    ).then(() => llmsStoreActions().resetServiceUserParameters(activeServiceId)).catch(() => null /* ignore closure */);
  }, [activeService?.label, activeServiceId, showPromisedOverlay]);

  const handleResetVisibility = React.useCallback(() => {
    showPromisedOverlay('llms-reset-visibility', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText={`Reset visibility for all models in ${activeService?.label ?? 'this service'}? Models will revert to their default visibility.`}
        positiveActionText='Reset'
      />,
    ).then(() => llmsStoreActions().resetServiceVisibility(activeServiceId)).catch(() => null /* ignore closure */);
  }, [activeService?.label, activeServiceId, showPromisedOverlay]);

  const handleHideAllModels = React.useCallback(() => {
    llmsStoreActions().setServiceModelsHidden(activeServiceId, true);
  }, [activeServiceId]);

  const handleShowAllModels = React.useCallback(() => {
    llmsStoreActions().setServiceModelsHidden(activeServiceId, false);
  }, [activeServiceId]);

  const handleShowOnlyFree = React.useCallback(() => {
    const updates = llmsStoreState().llms
      .filter(llm => llm.sId === activeServiceId)
      .map(llm => ({ id: llm.id, partial: { userHidden: !isLLMChatFree_cached(llm) } }));
    llmsStoreActions().updateLLMs(updates);
  }, [activeServiceId]);

  const handleShowOnlyPaid = React.useCallback(() => {
    const updates = llmsStoreState().llms
      .filter(llm => llm.sId === activeServiceId)
      .map(llm => ({ id: llm.id, partial: { userHidden: isLLMChatFree_cached(llm) } }));
    llmsStoreActions().updateLLMs(updates);
  }, [activeServiceId]);

  const handleRemoveClones = React.useCallback(() => {
    showPromisedOverlay('llms-remove-clones', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText={`Remove all user-cloned models from ${activeService?.label ?? 'this service'}?`}
        positiveActionText='Remove'
      />,
    ).then(() => llmsStoreActions().removeCustomModels(activeServiceId)).catch(() => null /* ignore closure */);
  }, [activeService?.label, activeServiceId, showPromisedOverlay]);

  const handleDeleteService = React.useCallback((serviceId: DModelsServiceId, skipConfirmation: boolean) => {
    const targetService = modelsServices.find(s => s.id === serviceId);
    if (!targetService) return;

    const doDelete = () => {
      // select the next service
      setConfServiceId(modelsServices.find(s => s.id !== serviceId)?.id ?? null);
      // remove the service
      llmsStoreActions().removeService(serviceId);
    };

    // [shift] to delete without confirmation
    if (skipConfirmation) return doDelete();

    showPromisedOverlay('llms-service-remove', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText={`Remove ${targetService.label} and all its models?`}
        positiveActionText='Remove'
      />,
    ).then(doDelete).catch(() => null /* ignore closure */);
  }, [modelsServices, setConfServiceId, showPromisedOverlay]);


  // start button
  const startButton = React.useMemo(() => {
    if (isTabWizard)
      return undefined;

    // return <Badge size='sm' badgeContent='14 Services' color='neutral' variant='outlined'><Button variant='outlined' color='neutral' onClick={handleShowAdvanced}>{isMobile ? 'Advanced' : 'Switch to Advanced'}</Button></Badge>;
    if (!hasAnyServices)
      return <Button variant='outlined' color='neutral' onClick={handleShowWizard} sx={{ backgroundColor: 'background.popup' }}>{isMobile ? 'Quick Setup' : 'Quick Setup'}</Button>;

    // Service-level 3-dots menu when we have LLMs
    if (isTabSetup && hasLLMs)
      return (
        <Box sx={{ flex: 1, display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Dropdown open={mainMenuOpen} onOpenChange={handleMainMenuOpenChange}>
            <MenuButton slots={{ root: IconButton }} /* slotProps={{ root: { variant: 'plain' } }} */>
              <MoreVertIcon sx={{ fontSize: 'xl' }} />
            </MenuButton>
            <Menu placement='bottom-start' disablePortal sx={{ minWidth: 280 }}>

              {/*{dcHasEligible && <Typography level='body-sm' textAlign='center' my={1}>All services</Typography>}*/}
              {dcHasEligible && (
                <MenuItem onClick={joyKeepPopup((event) => setDcMenuAnchor(dcMenuAnchor ? null : event.currentTarget))}>
                  <ListItemDecorator />
                  {/*<ListItemDecorator><ArrowForwardRoundedIcon /></ListItemDecorator>*/}
                  All Services
                  {/*<Box sx={{ color: 'text.tertiary' }}>({modelsServices.length})</Box>*/}
                  <KeyboardArrowRightIcon sx={{ ml: 'auto' }} />
                </MenuItem>
              )}

              {/* X Models */}
              <ListDivider />
              {/*<Typography level='body-sm' textAlign='center' my={2}>{activeService?.label ?? 'Service'} models</Typography>*/}

              {/* Refresh Models */}
              <MenuItem disabled={isRefreshing} onClick={handleRefreshModels}>
                <ListItemDecorator>
                  {isRefreshing ? <CircularProgress size='sm' /> : <RefreshIcon />}
                </ListItemDecorator>
                {isRefreshing ? 'Refreshing...' : <>Update {activeService?.label ?? ''} Models</>}
              </MenuItem>

              {/* Reset All Parameters */}
              <MenuItem onClick={handleResetAllParameters}>
                <ListItemDecorator><RestoreIcon /></ListItemDecorator>
                Remove Customizations
              </MenuItem>

              {/* Remove Cloned Models */}
              <MenuItem onClick={handleRemoveClones}>
                <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
                Remove Duplicated Models
              </MenuItem>

              <MenuItem onClick={joyKeepPopup((event: any) => setVisMenuAnchor(visMenuAnchor ? null : event.currentTarget))}>
                <ListItemDecorator />
                Visibility
                <KeyboardArrowRightIcon sx={{ ml: 'auto' }} />
              </MenuItem>

              <ListDivider />

              {/* View toggles */}
              <MenuItem onClick={joyKeepPopup(() => setShowModelsHidden(!showModelsHidden))}>
                <ListItemDecorator><Checkbox color='neutral' checked={showModelsHidden} /></ListItemDecorator>
                View Hidden Models
              </MenuItem>
              <MenuItem onClick={joyKeepPopup(() => setStarredOnTop(!starredOnTop))}>
                <ListItemDecorator><Checkbox color='neutral' checked={starredOnTop} /></ListItemDecorator>
                View Starred on Top
              </MenuItem>

            </Menu>
          </Dropdown>

          {/* DC submenu */}
          {!!dcMenuAnchor && <CloseablePopup menu anchorEl={dcMenuAnchor} onClose={() => setDcMenuAnchor(null)} placement='right-start' zIndex={themeZIndexOverMobileDrawer} minWidth={220}>
            <ListDivider>Direct Connection {dcStatus.enabled}/{dcStatus.eligible}</ListDivider>
            <MenuItem disabled={dcAllEnabled} onClick={handleEnableAllDC}>
              {/*<ListItemDecorator><VisibilityIcon /></ListItemDecorator>*/}
              Enable for all
            </MenuItem>
            <MenuItem disabled={dcNoneEnabled} onClick={handleDisableAllDC}>
              {/*<ListItemDecorator><VisibilityOffIcon /></ListItemDecorator>*/}
              Disable for all
            </MenuItem>
          </CloseablePopup>}

          {/* Visibility submenu */}
          {!!visMenuAnchor && <CloseablePopup menu anchorEl={visMenuAnchor} onClose={() => setVisMenuAnchor(null)} placement='right-start' zIndex={themeZIndexOverMobileDrawer}>
            <MenuItem onClick={handleShowAllModels}>
              <ListItemDecorator><VisibilityIcon /></ListItemDecorator>
              Show All
            </MenuItem>
            <MenuItem onClick={handleHideAllModels}>
              <ListItemDecorator><VisibilityOffIcon /></ListItemDecorator>
              Hide All
            </MenuItem>
            {activeHasFreeLLMs && <ListDivider />}
            {activeHasFreeLLMs && <MenuItem onClick={handleShowOnlyFree}>
              <ListItemDecorator><PhGift /></ListItemDecorator>
              Only Free
            </MenuItem>}
            {activeHasFreeLLMs && <MenuItem onClick={handleShowOnlyPaid}>
              <ListItemDecorator />
              Only Paid
            </MenuItem>}
            <ListDivider />
            <MenuItem onClick={handleResetVisibility}>
              <ListItemDecorator><RestoreIcon /></ListItemDecorator>
              Reset Default Visibility
            </MenuItem>
          </CloseablePopup>}

        </Box>
      );

    return undefined;
  }, [activeHasFreeLLMs, activeService?.label, dcAllEnabled, dcHasEligible, dcMenuAnchor, dcNoneEnabled, dcStatus.eligible, dcStatus.enabled, handleDisableAllDC, handleEnableAllDC, handleHideAllModels, handleMainMenuOpenChange, handleRefreshModels, handleRemoveClones, handleResetAllParameters, handleResetVisibility, handleShowAllModels, handleShowOnlyFree, handleShowOnlyPaid, handleShowWizard, hasAnyServices, hasLLMs, isMobile, isRefreshing, isTabSetup, isTabWizard, mainMenuOpen, setShowModelsHidden, setStarredOnTop, showModelsHidden, starredOnTop, visMenuAnchor]);


  // custom done button for wizard mode (combines start and close buttons)

  const wizardButtons = React.useMemo(() => {
    if (!isTabWizard) return undefined;

    const hasUnsavedChanges = unsavedWizardProviders.size > 0;
    // const tooltipTitle = !hasLLMs ? 'Please save at least one API key to continue'
    //   : hasUnsavedChanges ? 'You have unsaved changes - click Save first'
    //     : '';

    return (
      <Box sx={{ display: 'flex', width: '100%', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
        {/* more services */}
        <Button variant='outlined' color='neutral' onClick={handleShowAdvanced} sx={{ backgroundColor: 'background.popup' }}>
          {isMobile ? 'More Services' : 'More Services'}
        </Button>

        {/* unsaved warning */}
        {hasUnsavedChanges && (
          <Typography color='warning' level='body-sm' ml='auto'>
            {isMobile ? 'Unsaved' : `You have ${unsavedWizardProviders.size} unsaved change${unsavedWizardProviders.size > 1 ? 's' : ''}`}
          </Typography>
        )}

        {/* "Done" button */}
        <Button
          variant='solid'
          color='neutral'
          disabled={!hasLLMs || hasUnsavedChanges}
          onClick={optimaActions().closeModels}
          sx={{ ml: 'auto', minWidth: 100 }}
        >
          Done
        </Button>
      </Box>
    );
  }, [hasLLMs, unsavedWizardProviders, isMobile, isTabWizard, handleShowAdvanced]);


  // Explainer section
  const isMissingModels = useModelsZeroState();
  const { novel: isFirstVisit, touch: markVisited } = useUICounter('models-setup-first-visit', 1);
  const [showExplainer, setShowExplainer] = React.useState(isMissingModels && isFirstVisit); // show the explainer only if we don't have models and it's the first visit

  const handleShowExplainerAgain = React.useCallback(() => {
    setShowExplainer(true);
  }, []);

  const handleDismissExplainer = React.useCallback((_event: React.BaseSyntheticEvent, reason: 'backdropClick' | 'escapeKeyDown' | 'closeClick') => {
    // hide for both the 'x' button and close
    setShowExplainer(false);

    // mark as visited on close only
    if (reason === 'closeClick')
      markVisited();
  }, [markVisited]);

  if (showExplainer) {
    return (
      <GoodModal
        title={
          <AppBreadcrumbs size='md' rootTitle='Welcome'>
            <AppBreadcrumbs.Leaf>Notice on linking AI services</AppBreadcrumbs.Leaf>
            {/*<AppBreadcrumbs.Leaf>Important <b>AI Models</b> Notice</AppBreadcrumbs.Leaf>*/}
          </AppBreadcrumbs>
        }
        open
        onClose={handleDismissExplainer}
        disableBackdropClose
        animateEnter
        unfilterBackdrop
        sx={{ maxWidth: '28rem' }}
        // closeText='Got It'
        closeText='I understand'
      >
        <Box sx={{
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          // justifyContent: 'center',
          gap: 3,
          // textAlign: 'center',
          maxWidth: '500px',
          minHeight: '14rem',
          m: 'auto',
        }}>
          {/*<Typography level='title-md' mb={1}>*/}
          {/*  Bring your own AI Keys*/}
          {/*</Typography>*/}
          <Typography level='body-md' lineHeight='lg'>
            You&#39;ll need to <strong>provide your API credentials</strong> to use AI services.
          </Typography>
          <Typography level='body-sm' textColor='text.secondary' lineHeight='lg'>
            Big-AGI connects directly to the latest AI models using your API keys.{' '}
            {/*Big-AGI is a local App running on your computer.{' '}*/}
            {/*We want you to have access to the top models. */}
            We don&#39;t limit or bill your usage, giving you full control,
            privacy, freedom of choice and unparalleled speed.
          </Typography>
          <Typography level='body-sm' textColor='text.secondary' lineHeight='lg'>
            You get the cleanest AI experience.
            {/*You want the cleanest AI experience possible.*/}
          </Typography>
        </Box>
      </GoodModal>
    );
  }


  return (
    <GoodModal
      title={isTabWizard ? (
        <AppBreadcrumbs size='md' rootTitle='Welcome'>
          <AppBreadcrumbs.Leaf><b>Setup AI Models</b></AppBreadcrumbs.Leaf>
          {/*<AppBreadcrumbs.Leaf>Setup <b>AI Models</b></AppBreadcrumbs.Leaf>*/}
        </AppBreadcrumbs>
      ) : (
        // <>Configure <b>AI Models</b></>
        <AppBreadcrumbs size='md' rootTitle='Configure'>
          <AppBreadcrumbs.Leaf><b>AI Models</b></AppBreadcrumbs.Leaf>
          {/*<Box sx={{ display: 'flex', gap: 1 }}>*/}
          {/*  {!hasLLMs ? <AppBreadcrumbs.Leaf>Setup</AppBreadcrumbs.Leaf> : <>*/}
          {/*    <Chip size='lg' variant={isTabSetup ? 'solid' : 'outlined'} color='neutral' onClick={isTabSetup ? undefined : handleToggleDefaults} sx={{}}>*/}
          {/*      Setup*/}
          {/*    </Chip>*/}
          {/*    <Chip size='lg' variant={isTabDefaults ? 'solid' : 'outlined'} color='neutral' onClick={isTabDefaults ? undefined : handleToggleDefaults} sx={{}}>*/}
          {/*      Defaults*/}
          {/*    </Chip>*/}
          {/*  </>}*/}
          {/*</Box>*/}
        </AppBreadcrumbs>
      )}
      open onClose={optimaActions().closeModels}
      // darkBottomClose={!isTabWizard}
      hideBottomClose={isTabWizard}
      startButton={isTabWizard ? wizardButtons : startButton}
      closeText={isTabWizard ? 'Done' : undefined}
      animateEnter={!hasLLMs}
      unfilterBackdrop
      autoOverflow={true /* forces some shrinkage of the contents (ModelsList) */}
      fullscreen={isMobile ? 'button' : undefined} // NOTE: was disabled because on mobile there's one screen with a stretch issue - but can't reproduce
    >

      {isTabWizard && (
        <ModelsWizard
          isMobile={isMobile}
          onSkip={optimaActions().closeModels}
          onSwitchToAdvanced={handleShowAdvanced}
          onSwitchToWhy={handleShowExplainerAgain}
          onProviderUnsavedChange={handleWizardProviderUnsavedChange}
        />
      )}

      {isTabSetup && <ModelsServiceSelector modelsServices={modelsServices} selectedServiceId={activeServiceId} setSelectedServiceId={setConfServiceId} onDeleteService={handleDeleteService} onSwitchToWizard={handleShowWizard} />}
      {isTabSetup && <Divider sx={activeService ? undefined : { visibility: 'hidden' }} />}
      {isTabSetup && (
        <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
          {activeService
            ? <LLMVendorSetup service={activeService} />
            : <Box sx={{ minHeight: '7.375rem' }} />
          }
        </Box>
      )}

      {isTabSetup && hasLLMs && (
        <ModelsList
          filterServiceId={showAllServices ? null : activeServiceId}
          showHiddenModels={showModelsHidden}
          onOpenLLMOptions={optimaActions().openModelOptions}
          sx={{
            // works in tandem with the parent (GoodModal > Dialog) overflow: 'auto'
            minHeight: '10rem',
            overflowY: 'auto',

            // bottom border
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',

            // style: edge-to-edge band (negative margin pattern, like ModelsWizard)
            // '--ListItem-paddingY': '0rem', // items are smaller
            backgroundColor: 'rgb(var(--joy-palette-neutral-lightChannel) / 20%)',
            // borderRadius: 'md',
            // boxShadow: 'inset 0px 2px 2px -2px rgba(0, 0, 0, 0.2)',

            // absorb the card pad
            mx: 'calc(-1 * var(--Card-padding, 1rem))',
            // py: 1,
            '--ListItem-paddingLeft': '1.25rem',
            '--ListItem-paddingRight': '1rem',

            // [mobile] a bit less padding
            // '@media (max-width: 900px)': {
            //   '--ListItem-paddingLeft': '0.5rem',
            //   '--ListItem-paddingRight': '0.25rem',
            // },
          }}
        />
      )}

    </GoodModal>
  );
}
