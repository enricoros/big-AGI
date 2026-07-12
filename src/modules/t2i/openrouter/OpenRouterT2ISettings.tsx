import * as React from 'react';

import { FormControl, Option, Select } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';

import { OPENROUTER_IMAGE_MODELS, resolveOpenRouterImageModelId, useOpenRouterT2IStore } from './store-module-openrouter';


export function OpenRouterT2ISettings() {

  // external state
  const { orImageModelId, setOrImageModelId } = useOpenRouterT2IStore();

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart
        title='Model'
        description={<Link level='body-sm' href='https://openrouter.ai/models?fmt=cards&output_modalities=image' target='_blank'>Image models</Link>}
      />
      <Select
        value={resolveOpenRouterImageModelId(orImageModelId)}
        onChange={(_event, value) => value && setOrImageModelId(value)}
        slotProps={{ button: { sx: { whiteSpace: 'inherit' } } }}
        sx={{ minWidth: '10rem' }}
      >
        {OPENROUTER_IMAGE_MODELS.map(option => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </Select>
    </FormControl>

  </>;
}
