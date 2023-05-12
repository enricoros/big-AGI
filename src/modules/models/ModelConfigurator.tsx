import * as React from 'react';

import { Divider } from '@mui/joy';
import { AddVendor } from '@/modules/models/AddVendor';
import { DModelSource, DModelSourceId } from '@/modules/models/store-models';
import { ConfigureSources } from '@/modules/models/ConfigureSources';


export function ModelConfigurator() {
  const [modelSources, setModelSources] = React.useState<DModelSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(null);

  console.log('modelSources', modelSources);

  const handleAddSource = (newSource: DModelSource) => {
    setModelSources([...modelSources, newSource]);
    setSelectedSourceId(newSource.sourceId);
  };

  const handleDeleteSourceId = (sourceId: DModelSourceId) => {
    setModelSources(modelSources.filter(source => source.sourceId !== sourceId));
    setSelectedSourceId(null);
  };

  return <>

    {/* Instantiating Vendors */}
    <AddVendor />

    <Divider />

    {/* Configuration for this vendor */}
    <ConfigureSources
      llmSources={modelSources}
      selectedSourceId={selectedSourceId}
      setSelectedSourceId={setSelectedSourceId}
      onDeleteSourceId={handleDeleteSourceId}
    />

    {/*<Divider />*/}

    {/* Models List */}
    {/*<Sheet*/}
    {/*  variant='solid'*/}
    {/*  invertedColors*/}
    {/*  sx={{ borderRadius: 'sm', p: 2 }}*/}
    {/*>*/}
    {/*  <div>Model 1</div>*/}
    {/*  <div>Model 2</div>*/}
    {/*  <div>Model 3</div>*/}
    {/*  <div>Model 4</div>*/}
    {/*</Sheet>*/}

  </>;
}