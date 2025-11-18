import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Checkbox, Divider } from '@mui/joy';

import type { DModelsService } from '~/common/stores/llms/llms.service.types';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { optimaActions } from '~/common/layout/optima/useOptima';
import { useHasLLMs } from '~/common/stores/llms/llms.hooks';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { LLMVendorSetup } from '../components/LLMVendorSetup';
import { ModelsList } from './ModelsList';
import { ModelsServiceSelector } from './ModelsServiceSelector';
import { ModelsWizard } from './ModelsWizard';


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
  const showAllServices = false;

  // external state
  const isMobile = useIsMobile();
  const hasLLMs = useHasLLMs();
  const [showModelsHidden, setShowModelsHidden] = useUIPreferencesStore(useShallow((state) => [state.showModelsHidden, state.setShowModelsHidden]));


  // active service with fallback to the last added service
  const activeServiceId = confServiceId
    ?? modelsServices[modelsServices.length - 1]?.id
    ?? null;

  const activeService = modelsServices.find(s => s.id === activeServiceId);

  const hasAnyServices = !!modelsServices.length;
  const isTabWizard = tab === 'wizard';
  const isTabSetup = tab === 'setup';
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


  // start button
  const startButton = React.useMemo(() => {
    if (isTabWizard)
      return <Button variant='outlined' color='neutral' onClick={handleShowAdvanced} sx={{ backgroundColor: 'background.popup' }}>{isMobile ? 'More Services' : 'More Services'}</Button>;
    // return <Badge size='sm' badgeContent='14 Services' color='neutral' variant='outlined'><Button variant='outlined' color='neutral' onClick={handleShowAdvanced}>{isMobile ? 'Advanced' : 'Switch to Advanced'}</Button></Badge>;
    if (!hasAnyServices)
      return <Button variant='outlined' color='neutral' onClick={handleShowWizard} sx={{ backgroundColor: 'background.popup' }}>{isMobile ? 'Quick Setup' : 'Quick Setup'}</Button>;

    // Show checkbox for filtering hidden models when we have LLMs
    if (isTabSetup && hasLLMs)
      return (
        <TooltipOutlined title='Show hidden models - some may be experimental, deprecated, or just not recommended.' placement='top'>
          <Checkbox
            // size='sm'
            color='neutral'
            // variant='outlined'
            label='Include Hidden'
            checked={showModelsHidden}
            onChange={(e) => setShowModelsHidden(e.target.checked)}
            sx={{ my: 'auto', fontSize: 'sm' }}
          />
        </TooltipOutlined>
      );

    return undefined;
  }, [handleShowAdvanced, handleShowWizard, hasAnyServices, hasLLMs, isMobile, isTabSetup, isTabWizard, setShowModelsHidden, showModelsHidden]);


  return (
    <GoodModal
      title={isTabWizard ? (
        <AppBreadcrumbs size='md' rootTitle='Welcome'>
          <AppBreadcrumbs.Leaf>Setup <b>AI Models</b></AppBreadcrumbs.Leaf>
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
      darkBottomClose={!isTabWizard}
      closeText={isTabWizard ? 'Done' : undefined}
      animateEnter={!hasLLMs}
      unfilterBackdrop
      startButton={startButton}
      autoOverflow={true /* forces some shrinkage of the contents (ModelsList) */}
      fullscreen={isMobile ? 'button' : undefined} // NOTE: was disabled because on mobile there's one screen with a stretch issue - but can't reproduce
    >

      {isTabWizard && <Divider />}
      {isTabWizard && <ModelsWizard isMobile={isMobile} onSkip={optimaActions().closeModels} onSwitchToAdvanced={handleShowAdvanced} />}

      {isTabSetup && <ModelsServiceSelector modelsServices={modelsServices} selectedServiceId={activeServiceId} setSelectedServiceId={setConfServiceId} onSwitchToWizard={handleShowWizard} />}
      {isTabSetup && <Divider sx={activeService ? undefined : { visibility: 'hidden' }} />}
      {isTabSetup && (
        <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
          {activeService
            ? <LLMVendorSetup service={activeService} />
            : <Box sx={{ minHeight: '7.375rem' }} />
          }
        </Box>
      )}

      {isTabSetup && hasLLMs && <Divider />}
      {isTabSetup && hasLLMs && (
        <ModelsList
          filterServiceId={showAllServices ? null : activeServiceId}
          showHiddenModels={showModelsHidden}
          onOpenLLMOptions={optimaActions().openModelOptions}
          sx={{
            // works in tandem with the parent (GoodModal > Dialog) overflow: 'auto'
            minHeight: '8rem',
            overflowY: 'auto',

            // style (list variant=outlined)
            '--ListItem-paddingY': '0rem',
            '--ListItem-paddingRight': '0.5rem', // instead of 0.75
            backgroundColor: 'rgb(var(--joy-palette-neutral-lightChannel) / 20%)',
            borderRadius: 'md',

            // [mobile] a bit less padding
            '@media (max-width: 900px)': {
              '--ListItem-paddingLeft': '0.5rem',
              '--ListItem-paddingRight': '0.25rem',
            },
          }}
        />
      )}

      <Divider sx={{ visibility: 'hidden', height: 0 }} />

    </GoodModal>
  );
}
