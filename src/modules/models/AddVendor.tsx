import * as React from 'react';

import { Box, Button, Option, Select, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import ComputerIcon from '@mui/icons-material/Computer';

import { hideOnMobile } from '@/common/theme';

import { DModelSource, DModelSourceId, ModelVendorId } from './store-models';


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


export function AddVendor(props: { llmSources: DModelSource[], onAddSource: (llmSource: DModelSource) => void }) {
  // state
  const [selectedVendorId, setSelectedVendorId] = React.useState<ModelVendorId | null>(DEFAULT_MODEL_VENDOR_ID);

  const vendorItems = React.useMemo(() => MODEL_VENDOR_DESCRIPTIONS.map(vendor => {
    const existingCount = props.llmSources.filter(source => source.vendorId === vendor.id).length;
    const disabled = !vendor.multiple && existingCount >= 1 || existingCount >= 2;
    return {
      vendor,
      disabled,
      component: <Option key={vendor.id} value={vendor.id} disabled={disabled}>{vendor.name}</Option>,
      existingCount,
    };
  }), [props.llmSources]);

  const selectedVendor = vendorItems.find(item => item.vendor.id === selectedVendorId);

  const handleAddSource = () => {
    if (!selectedVendor || selectedVendor.disabled)
      return;

    // create a unique DModelSourceId
    const vendorId = selectedVendor.vendor.id;
    let sourceId: DModelSourceId = vendorId;
    let suffix = 0;
    if (selectedVendor.existingCount > 0) {
      suffix += 2;
      while (props.llmSources.find(source => source.sourceId === `${sourceId}-${suffix}`))
        suffix++;
      sourceId = `${sourceId}-${suffix}`;
    }

    // add the new configuration
    props.onAddSource({
      sourceId,
      label: selectedVendor.vendor.name + (suffix > 0 ? ` #${suffix}` : ''),
      vendorId,
    });
  };

  // if there are no configs, add the default one
  React.useEffect(() => {
    if (!props.llmSources.length) {
      const vendorId = DEFAULT_MODEL_VENDOR_ID;
      props.onAddSource({
        sourceId: vendorId,
        label: MODEL_VENDOR_DESCRIPTIONS.find(vendor => vendor.id === vendorId)?.name || '',
        vendorId,
      });
    }
  }, [props, selectedVendorId]);

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