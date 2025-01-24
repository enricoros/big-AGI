import * as React from 'react';

import { Box, Button, Divider } from '@mui/joy';

import type { DModelsService } from '~/common/stores/llms/modelsservice.types';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { llmsStoreState } from '~/common/stores/llms/store-llms';
import { optimaActions, optimaOpenModels, useOptimaModelsModalsState } from '~/common/layout/optima/useOptima';
import { runWhenIdle } from '~/common/util/pwaUtils';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useHasLLMs, useModelsServices } from '~/common/stores/llms/llms.hooks';

import { LLMOptionsModal } from './LLMOptionsModal';
import { ModelsList } from './ModelsList';
import { ModelsServiceSelector } from './ModelsServiceSelector';
import { ModelsWizard } from './ModelsWizard';
import { findModelVendor, getDefaultModelVendor } from '../vendors/vendors.registry';


// configuration
const MODELS_WIZARD_ENABLE_INITIALLY = true;


function VendorServiceSetup(props: { service: DModelsService }) {
  const vendor = findModelVendor(props.service.vId);
  if (!vendor)
    return 'Configuration issue: Vendor not found for Service ' + props.service.id;
  return <vendor.ServiceSetupComponent key={props.service.id} serviceId={props.service.id} />;
}


/**
 * Note: the reason for this component separation from the parent state, is delayed state intitialization.
 */
function ModelsConfiguratorModal(props: {
  modelsServices: DModelsService[],
  confServiceId: string | null,
  setConfServiceId: (serviceId: string | null) => void,
  allowAutoTrigger: boolean,
}) {

  const { modelsServices, confServiceId, setConfServiceId } = props;

  // state
  // const [showAllServices, setShowAllServices] = React.useState<boolean>(false);
  const [showWizard, setShowWizard] = React.useState<boolean>(MODELS_WIZARD_ENABLE_INITIALLY && !modelsServices.length);
  const showAllServices = false;

  // external state
  const isMobile = useIsMobile();
  const hasLLMs = useHasLLMs();


  // active service with fallback to the last added service
  const activeServiceId = confServiceId
    ?? modelsServices[modelsServices.length - 1]?.id
    ?? null;

  const activeService = modelsServices.find(s => s.id === activeServiceId);

  const isMultiServices = modelsServices.length > 1;


  // Auto-add the default service - at boot, when no service is present
  const autoAddTrigger = !showWizard && props.allowAutoTrigger;
  React.useEffect(() => {
    // Note: we use the immediate version to not react to deletions
    const { createModelsService, sources: modelsServices } = llmsStoreState();
    if (autoAddTrigger && !modelsServices.length)
      createModelsService(getDefaultModelVendor());
  }, [autoAddTrigger]);


  // handlers
  const handleShowAdvanced = React.useCallback(() => {
    setShowWizard(false);
  }, []);

  const handleShowWizard = React.useCallback(() => {
    setShowWizard(true);
  }, []);


  // start button
  const startButton = React.useMemo(() => {
    if (showWizard)
      return <Button variant='outlined' color='neutral' onClick={handleShowAdvanced}>{isMobile ? 'Advanced' : 'Switch to Advanced'}</Button>;
    // return <Badge size='sm' badgeContent='14 Services' color='neutral' variant='outlined'><Button variant='outlined' color='neutral' onClick={handleShowAdvanced}>{isMobile ? 'Advanced' : 'Switch to Advanced'}</Button></Badge>;
    if (!isMultiServices)
      return <Button variant='outlined' color='neutral' onClick={handleShowWizard}>{isMobile ? 'Easy Mode' : 'Easy Mode'}</Button>;
    return undefined;
    // if (isMultiServices) {
    //   return (
    //     <Checkbox
    //       label='All Services'
    //       sx={{ my: 'auto' }}
    //       checked={showAllServices} onChange={() => setShowAllServices(all => !all)}
    //     />
    //   );
    // }
  }, [handleShowAdvanced, handleShowWizard, isMobile, isMultiServices, showWizard]);

  return (
    <GoodModal
      title={<>{showWizard ? 'Welcome · Setup' : 'Configure'} <b>AI Models</b></>}
      open onClose={optimaActions().closeModels}
      darkBottomClose
      closeText={showWizard ? 'Done' : undefined}
      animateEnter={!hasLLMs}
      unfilterBackdrop
      startButton={startButton}
      sx={{
        // forces some shrinkage of the contents (ModelsList)
        overflow: 'auto',
      }}
    >

      {!showWizard && <ModelsServiceSelector modelsServices={modelsServices} selectedServiceId={activeServiceId} setSelectedServiceId={setConfServiceId} />}

      <Divider />

      {showWizard && <ModelsWizard isMobile={isMobile} onSkip={optimaActions().closeModels} onSwitchToAdvanced={handleShowAdvanced} />}

      {!showWizard && !!activeService && (
        <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
          <VendorServiceSetup service={activeService} />
        </Box>
      )}

      {!showWizard && hasLLMs && <Divider />}

      {!showWizard && hasLLMs && (
        <ModelsList
          filterServiceId={showAllServices ? null : activeServiceId}
          onOpenLLMOptions={optimaActions().openModelOptions}
          sx={{
            // works in tandem with the parent (GoodModal > Dialog) overflow: 'auto'
            minHeight: '6rem',
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

      <Divider sx={{ background: 'transparent' }} />

    </GoodModal>
  );
}


export function ModelsModal(props: { suspendAutoModelsSetup?: boolean }) {

  // external state
  const { showModels, showModelOptions } = useOptimaModelsModalsState();
  const { modelsServices, confServiceId, setConfServiceId } = useModelsServices();


  // [effect] Auto-open the configurator - anytime no service is selected
  const hasNoServices = !modelsServices.length;
  const autoOpenTrigger = hasNoServices && !props.suspendAutoModelsSetup;
  React.useEffect(() => {
    if (autoOpenTrigger)
      return runWhenIdle(() => optimaOpenModels(), 2000);
  }, [autoOpenTrigger]);


  return <>

    {/* Services Setup */}
    {showModels && (
      <ModelsConfiguratorModal
        modelsServices={modelsServices}
        confServiceId={confServiceId}
        setConfServiceId={setConfServiceId}
        allowAutoTrigger={!props.suspendAutoModelsSetup}
      />
    )}

    {/* per-LLM options */}
    {!!showModelOptions && (
      <LLMOptionsModal id={showModelOptions} onClose={optimaActions().closeModelOptions} />
    )}

  </>;
}