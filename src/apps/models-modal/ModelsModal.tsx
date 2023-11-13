import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Checkbox, Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { closeLayoutModelsSetup, openLayoutModelsSetup, useLayoutModelsSetup } from '~/common/layout/store-applayout';
import { useGlobalShortcut } from '~/common/components/useGlobalShortcut';

import { DModelSourceId, useModelsStore } from '~/modules/llms/store-llms';
import { createModelSourceForDefaultVendor } from '~/modules/llms/vendors/vendor.registry';

import { LLMOptionsModal } from './LLMOptionsModal';
import { ModelsList } from './ModelsList';
import { ModelsSourceSelector } from './ModelsSourceSelector';
import { VendorSourceSetup } from './VendorSourceSetup';


export function ModelsModal(props: { suspendAutoModelsSetup?: boolean }) {

  // local state
  const [_selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(null);
  const [showAllSources, setShowAllSources] = React.useState<boolean>(false);

  // external state
  const [modelsSetupOpen, llmOptionsId] = useLayoutModelsSetup();
  const { modelSources, llmCount } = useModelsStore(state => ({
    modelSources: state.sources,
    llmCount: state.llms.length,
  }), shallow);
  useGlobalShortcut('m', true, true, false, openLayoutModelsSetup);

  // auto-select the first source - note: we could use a useEffect() here, but this is more efficient
  // also note that state-persistence is unneeded
  const selectedSourceId = _selectedSourceId ?? modelSources[0]?.id ?? null;

  const activeSource = modelSources.find(source => source.id === selectedSourceId);

  const multiSource = modelSources.length > 1;

  // if no sources at startup, open the modal
  React.useEffect(() => {
    if (!selectedSourceId && !props.suspendAutoModelsSetup)
      openLayoutModelsSetup();
  }, [selectedSourceId, props.suspendAutoModelsSetup]);

  // add the default source on cold - will require setup
  React.useEffect(() => {
    const { addSource, sources } = useModelsStore.getState();
    if (!sources.length && !props.suspendAutoModelsSetup)
      addSource(createModelSourceForDefaultVendor(sources));
  }, [props.suspendAutoModelsSetup]);


  return <>

    {/* Sources Setup */}
    {modelsSetupOpen && <GoodModal
      title={<>Configure <b>AI Models</b></>}
      startButton={
        multiSource ? <Checkbox
          label='all vendors' sx={{ my: 'auto' }}
          checked={showAllSources} onChange={() => setShowAllSources(all => !all)}
        /> : undefined
      }
      open onClose={closeLayoutModelsSetup}
    >

      <ModelsSourceSelector selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId} />

      {!!activeSource && <Divider />}

      {!!activeSource && <VendorSourceSetup source={activeSource} />}

      {!!llmCount && <Divider />}

      {!!llmCount && <ModelsList filterSourceId={showAllSources ? null : selectedSourceId} />}

      <Divider />

    </GoodModal>}

    {/* per-LLM options */}
    {!!llmOptionsId && <LLMOptionsModal id={llmOptionsId} />}

  </>;
}