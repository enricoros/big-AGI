import * as React from 'react';

import { FormControl, Option, Select } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';

import type { DProfileOpenRouterImages } from '../t2i.types';
import { OPENROUTER_IMAGE_MODELS } from '../t2i.config';


export function OpenRouterT2ISettings(props: {
  profile: DProfileOpenRouterImages;
  onUpdateProfile: (update: Partial<DProfileOpenRouterImages>) => void;
}) {

  const { profile, onUpdateProfile } = props;

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart
        title='Model'
        description={<Link level='body-sm' href='https://openrouter.ai/models?fmt=cards&output_modalities=image' target='_blank'>Image models</Link>}
      />
      <Select
        value={profile.imageModelId || 'auto'}
        onChange={(_event, value) => value && onUpdateProfile({ imageModelId: value === 'auto' ? null : value })}
        slotProps={{ button: { sx: { whiteSpace: 'inherit' } } }}
        sx={{ minWidth: '10rem' }}
      >
        {OPENROUTER_IMAGE_MODELS.map(option => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
        {/* null selection - resolved at generation time, floats with the catalog */}
        <Option value='auto'>Auto</Option>
      </Select>
    </FormControl>

  </>;
}
