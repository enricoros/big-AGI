import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Chip, IconButton, Radio, RadioGroup } from '@mui/joy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { DModelSourceId, useModelsStore } from '../store-models';
import { configureVendorSource } from '../vendors-registry';


export function SourceEdit() {
  // external state
  const { modelSources, removeModelSource } = useModelsStore((state) => ({
    modelSources: state.sources, removeModelSource: state.removeSource,
  }), shallow);

  // state
  const [selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(modelSources?.[0]?.sourceId ?? null);


  // when nothing is selected, select the first available source
  React.useEffect(() => {
    if (!selectedSourceId && modelSources.length > 0)
      setSelectedSourceId(modelSources[0].sourceId);
  }, [modelSources, selectedSourceId]);


  // derived state
  const sourceComponents: React.JSX.Element[] = React.useMemo(() => modelSources.map(source => {
    const checked = source.sourceId === selectedSourceId;
    return (
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
    );
  }), [modelSources, selectedSourceId]);


  const enableDeleteButton = !!setSelectedSourceId && modelSources.length >= 2;

  const handleDeleteSourceId = (sourceId: DModelSourceId) => {
    removeModelSource(sourceId);
    if (selectedSourceId === sourceId) {
      setSelectedSourceId(null);
    }
  };


  const activeSource = modelSources.find(source => source.sourceId === selectedSourceId);
  const vendorConfigComponent = selectedSourceId ? configureVendorSource(activeSource?.vendorId, selectedSourceId) : null;

  return <>

    {/* Configuration Items */}
    <RadioGroup
      overlay
      value={selectedSourceId}
      onChange={event => setSelectedSourceId(event.target.value)}
      sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
    >
      {/* Chips */}
      {sourceComponents}

      {/* Delete Configuration Button */}
      <IconButton
        variant='plain' color='neutral'
        disabled={!enableDeleteButton}
        onClick={() => selectedSourceId && handleDeleteSourceId(selectedSourceId)}
        sx={{ ml: 'auto' }}
      >
        <DeleteOutlineIcon />
      </IconButton>
    </RadioGroup>

    {/* Selected Item Configuration */}
    {vendorConfigComponent && (
      <Box>
        {vendorConfigComponent}
      </Box>
    )}

  </>;
}