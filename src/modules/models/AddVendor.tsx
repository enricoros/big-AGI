import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Option, Select, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import ComputerIcon from '@mui/icons-material/Computer';

import { hideOnMobile } from '@/common/theme';

import { DModelSourceId, useModelsStore } from './store-models';
import { defaultVendorId, ModelVendorId, rankedVendors } from './vendors-registry';


export function AddVendor() {
  // state
  const [selectedVendorId, setSelectedVendorId] = React.useState<ModelVendorId | null>(null);

  // external state
  const { modelSources, addModelSource } = useModelsStore(state => ({
    modelSources: state.modelSources, addModelSource: state.addModelSource,
  }), shallow);


  // map vendors to options
  const { vendorItems, selectedVendorItem } = React.useMemo(() => {
    // create side objects for all vendors
    const vendorItems = rankedVendors().map(vendor => {
      const existingCount = modelSources.filter(source => source.vendorId === vendor.id).length;
      const disabled = !vendor.multiple && existingCount >= 1 || existingCount >= 2;
      return {
        vendor,
        disabled,
        component: <Option key={vendor.id} value={vendor.id} disabled={disabled}>{vendor.name}</Option>,
        existingCount,
      };
    });
    // find the selected item
    const selectedVendorItem = vendorItems.find(item => item.vendor.id === selectedVendorId);
    return { vendorItems, selectedVendorItem };
  }, [modelSources, selectedVendorId]);


  const handleAddSource = React.useCallback(() => {
    if (!selectedVendorItem || selectedVendorItem.disabled)
      return;

    // create a unique DModelSourceId
    const vendorId = selectedVendorItem.vendor.id;
    let sourceId: DModelSourceId = vendorId;
    let suffix = 0;
    if (selectedVendorItem.existingCount > 0) {
      suffix += 2;
      while (modelSources.find(source => source.sourceId === `${sourceId}-${suffix}`))
        suffix++;
      sourceId = `${sourceId}-${suffix}`;
    }

    // add the new configuration
    addModelSource({
      sourceId,
      label: selectedVendorItem.vendor.name + (suffix > 0 ? ` #${suffix}` : ''),
      vendorId,
      configured: false,
    });
  }, [addModelSource, modelSources, selectedVendorItem]);


  // select the default option if none is selected
  React.useEffect(() => {
    if (!selectedVendorId)
      setSelectedVendorId(defaultVendorId());
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
        startDecorator={selectedVendorItem?.vendor?.location === 'local' ? <ComputerIcon /> : <CloudOutlinedIcon />}
        // endDecorator={selectedVendor?.existingCount ? <CheckOutlinedIcon /> : null}
        slotProps={{
          root: { sx: { minWidth: 190 } },
          indicator: { sx: { opacity: 0.5 } },
        }}
      >
        {vendorItems.map(option => option.component)}
      </Select>

      <Button variant='plain' disabled={!!selectedVendorItem?.disabled} onClick={handleAddSource} startDecorator={<AddIcon />}>
        Add
      </Button>

    </Box>
  );
}