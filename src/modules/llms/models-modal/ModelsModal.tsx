import * as React from 'react';

import { Box, Checkbox, Divider } from '@mui/joy';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { llmsStoreState } from '~/common/stores/llms/store-llms';
import { optimaActions, optimaOpenModels, useOptimaModelsModalsState } from '~/common/layout/optima/useOptima';
import { runWhenIdle } from '~/common/util/pwaUtils';
import { useLLMsCount, useModelsServices } from '~/common/stores/llms/llms.hooks';

import { LLMOptionsModal } from './LLMOptionsModal';
import { ModelsList } from './ModelsList';
import { ModelsServiceSelector } from './ModelsServiceSelector';
import { createModelsServiceForDefaultVendor } from '../vendors/vendor.helpers';
import { findModelVendor } from '../vendors/vendors.registry';


function VendorServiceSetup(props: { service: DModelsService }) {
  const vendor = findModelVendor(props.service.vId);
  if (!vendor)
    return 'Configuration issue: Vendor not found for Service ' + props.service.id;
  return <vendor.ServiceSetupComponent key={props.service.id} serviceId={props.service.id} />;
}


export function ModelsModal(props: { suspendAutoModelsSetup?: boolean }) {

  // local state
  const [_selectedServiceId, setSelectedServiceId] = React.useState<DModelsServiceId | null>(null);
  const [showAllServices, setShowAllServices] = React.useState<boolean>(false);

  // external state
  const { showModels, showModelOptions } = useOptimaModelsModalsState();
  const modelsServices = useModelsServices();
  const llmCount = useLLMsCount();

  // auto-select the first service - note: we could use a useEffect() here, but this is more efficient
  // also note that state-persistence is unneeded
  const selectedServiceId = _selectedServiceId ?? modelsServices[modelsServices.length - 1]?.id ?? null;

  const activeService = modelsServices.find(s => s.id === selectedServiceId);

  const multiService = modelsServices.length > 1;

  // Auto-open this dialog - anytime no service is selected
  const autoOpenTrigger = !selectedServiceId && !props.suspendAutoModelsSetup;
  React.useEffect(() => {
    if (autoOpenTrigger)
      return runWhenIdle(() => optimaOpenModels(), 2000);
  }, [autoOpenTrigger]);

  // Auto-add the default service - at boot, when no service is present
  const autoAddTrigger = showModels && !props.suspendAutoModelsSetup;
  React.useEffect(() => {
    // Note: we use the immediate version to not react to deletions
    const { addService, sources: modelsServices } = llmsStoreState();
    if (autoAddTrigger && !modelsServices.length)
      addService(createModelsServiceForDefaultVendor(modelsServices));
  }, [autoAddTrigger]);


  return <>

    {/* Services Setup */}
    {showModels && <GoodModal
      title={<>Configure <b>AI Models</b></>}
      open onClose={optimaActions().closeModels}
      animateEnter={llmCount === 0}
      unfilterBackdrop
      startButton={
        multiService ? <Checkbox
          label='All Services'
          sx={{ my: 'auto' }}
          checked={showAllServices} onChange={() => setShowAllServices(all => !all)}
        /> : undefined
      }
      sx={{
        // forces some shrinkage of the contents (ModelsList)
        overflow: 'auto',
      }}
    >

      <ModelsServiceSelector selectedServiceId={selectedServiceId} setSelectedServiceId={setSelectedServiceId} />

      {!!activeService && <Divider />}

      {!!activeService && (
        <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
          <VendorServiceSetup service={activeService} />
        </Box>
      )}

      {!!llmCount && <Divider />}

      {!!llmCount && (
        <ModelsList
          filterServiceId={showAllServices ? null : selectedServiceId}
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

      <Divider />

    </GoodModal>}

    {/* per-LLM options */}
    {!!showModelOptions && (
      <LLMOptionsModal id={showModelOptions} onClose={optimaActions().closeModelOptions} />
    )}

  </>;
}