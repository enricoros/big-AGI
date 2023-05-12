import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Chip, IconButton, Radio, RadioGroup } from '@mui/joy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { DModelSourceId, useModelsStore } from './store-models';
import { OpenAISource } from './openai/OpenAISource';
import { LocalAISource } from './localai/LocalAISource';


export function ConfigureSources() {
  // external state
  const { modelSources, removeModelSource } = useModelsStore((state) => ({
    modelSources: state.modelSources, removeModelSource: state.removeModelSource,
  }), shallow);

  // state
  const [selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(modelSources?.[0]?.sourceId ?? null);

  // when nothing is selected, select the first available source
  React.useEffect(() => {
    if (!selectedSourceId && modelSources.length > 0)
      setSelectedSourceId(modelSources[0].sourceId);
  }, [modelSources, selectedSourceId]);


  // derived state
  const sourceItems = React.useMemo(() => modelSources.map(source => {
    const checked = source.sourceId === selectedSourceId;
    return {
      source,
      component: (
        <Chip
          key={source.sourceId}
          variant={checked ? 'soft' : 'plain'}
          color={checked ? 'primary' : 'neutral'}
          size='lg'
          startDecorator={
            checked && <CheckIcon sx={{ zIndex: 1, pointerEvents: 'none' }} />
            // configured
            //   ? <CheckIcon sx={{ zIndex: 1, pointerEvents: 'none' }} />
            //   : <CheckBoxOutlineBlankOutlinedIcon sx={{ zIndex: 1, pointerEvents: 'none' }} />
          }
        >
          <Radio
            variant='outlined'
            checked={checked}
            // color={checked ? 'danger' : 'warning'}
            disableIcon
            overlay
            label={source.label}
            value={source.sourceId}
          />
        </Chip>
      ),
    };
  }), [modelSources, selectedSourceId]);

  const selectedSource = sourceItems.find(item => item.source.sourceId === selectedSourceId);


  const enableDeleteButton = !!setSelectedSourceId && sourceItems.length >= 2;

  const handleDeleteSourceId = (sourceId: DModelSourceId) => {
    removeModelSource(sourceId);
    if (selectedSourceId === sourceId) {
      setSelectedSourceId(null);
    }
  };


  let vendorConfigComponent: React.JSX.Element | null = null;
  if (selectedSource) {
    switch (selectedSource.source.vendorId) {
      case 'openai':
        vendorConfigComponent = <OpenAISource />;
        break;
      case 'google_vertex':
        break;
      case 'anthropic':
        break;
      case 'localai':
        vendorConfigComponent = <LocalAISource />;
        break;
    }
  }


  return <>

    {/* Configuration Items */}
    <RadioGroup
      overlay
      value={selectedSourceId}
      onChange={event => setSelectedSourceId(event.target.value)}
      sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
    >
      {/* All the Source items */}
      {sourceItems.map(item => item.component)}

      {/* Delete Configuration Button */}
      <IconButton
        variant='plain' color='neutral'
        disabled={!enableDeleteButton}
        onClick={() => handleDeleteSourceId(selectedSourceId!)}
        sx={{ ml: 'auto' }}
      >
        <DeleteOutlineIcon />
      </IconButton>
    </RadioGroup>

    {/*<Divider />*/}

    {/* Selected Item Configuration */}
    {vendorConfigComponent}

  </>;
}