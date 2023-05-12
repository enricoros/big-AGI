import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Option, Select, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import ComputerIcon from '@mui/icons-material/Computer';

import { hideOnMobile } from '@/common/theme';

import { DModelSourceId, ModelVendorId, useModelsStore } from './store-models';


interface ModelVendorDescription {
  id: ModelVendorId;
  name: string;
  multiple: boolean;
  icon: React.ReactNode;
}

const MODEL_VENDOR_DESCRIPTIONS: ModelVendorDescription[] = [
  { id: 'openai', name: 'OpenAI', multiple: false, icon: <CloudOutlinedIcon /> },
  { id: 'localai', name: 'LocalAI', multiple: true, icon: <ComputerIcon /> },
  { id: 'google_vertex', name: 'Google Vertex', multiple: false, icon: <CloudOutlinedIcon /> },
  { id: 'azure_openai', name: 'Azure OpenAI', multiple: false, icon: <CloudOutlinedIcon /> },
  { id: 'anthropic', name: 'Anthropic', multiple: false, icon: <CloudOutlinedIcon /> },
];

const DEFAULT_MODEL_VENDOR_ID: ModelVendorId = 'openai';


export function AddVendor() {
  // state
  const [selectedVendorId, setSelectedVendorId] = React.useState<ModelVendorId | null>(null);

  // external state
  const { modelSources, addModelSource } = useModelsStore(state => ({
    modelSources: state.modelSources, addModelSource: state.addModelSource,
  }), shallow);


  const vendorItems = React.useMemo(() => MODEL_VENDOR_DESCRIPTIONS.map(vendor => {
    const existingCount = modelSources.filter(source => source.vendorId === vendor.id).length;
    const disabled = !vendor.multiple && existingCount >= 1 || existingCount >= 2;
    return {
      vendor,
      disabled,
      component: <Option key={vendor.id} value={vendor.id} disabled={disabled}>{vendor.name}</Option>,
      existingCount,
    };
  }), [modelSources]);

  const selectedVendor = vendorItems.find(item => item.vendor.id === selectedVendorId);


  const handleAddSource = React.useCallback(() => {
    if (!selectedVendor || selectedVendor.disabled)
      return;

    // create a unique DModelSourceId
    const vendorId = selectedVendor.vendor.id;
    let sourceId: DModelSourceId = vendorId;
    let suffix = 0;
    if (selectedVendor.existingCount > 0) {
      suffix += 2;
      while (modelSources.find(source => source.sourceId === `${sourceId}-${suffix}`))
        suffix++;
      sourceId = `${sourceId}-${suffix}`;
    }

    // add the new configuration
    addModelSource({
      sourceId,
      label: selectedVendor.vendor.name + (suffix > 0 ? ` #${suffix}` : ''),
      vendorId,
    });
  }, [addModelSource, modelSources, selectedVendor]);


  // select the default option if none is selected
  React.useEffect(() => {
    if (!selectedVendorId)
      setSelectedVendorId(DEFAULT_MODEL_VENDOR_ID);
  }, [selectedVendorId]);

  // if there are no sources, click on 'Add'
  const hasSources = modelSources.length;
  React.useEffect(() => {
    if (selectedVendorId && !hasSources)
      handleAddSource();
  }, [handleAddSource, hasSources, selectedVendorId]);


  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>

      <Typography sx={{ mr: 1, ...hideOnMobile }}>
        Source
      </Typography>

      <Select
        variant='outlined'
        value={selectedVendorId}
        onChange={(event, value) => setSelectedVendorId(value)}
        startDecorator={selectedVendor?.vendor?.icon}
        // endDecorator={selectedVendor?.existingCount ? <CheckOutlinedIcon /> : null}
        slotProps={{
          root: { sx: { minWidth: 190 } },
          indicator: { sx: { opacity: 0.5 } },
        }}
      >
        {vendorItems.map(option => option.component)}
      </Select>

      <Button variant='plain' disabled={!!selectedVendor?.disabled} onClick={handleAddSource} startDecorator={<AddIcon />}>
        Add
      </Button>

    </Box>
  );
}