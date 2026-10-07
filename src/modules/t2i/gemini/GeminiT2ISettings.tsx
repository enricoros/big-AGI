import * as React from 'react';

import { Box, FormControl, Link, Option, Select } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';

import type { DProfileGeminiImages } from '../t2i.types';
import { useGeminiImageModels } from './geminiImageModels';


const _AUTO = 'auto' as const;

const _selectSx = { minWidth: '10rem' } as const;
const _selectSlotProps = { button: { sx: { whiteSpace: 'inherit' } } } as const;


export function GeminiT2ISettings(props: {
  profile: DProfileGeminiImages;
  serviceId: DModelsServiceId | null;
  onUpdateProfile: (update: Partial<DProfileGeminiImages>) => void;
}) {

  const { profile, serviceId, onUpdateProfile } = props;

  // the service's image models; the options below follow the resolved (selected or auto) model
  const { models, resolved } = useGeminiImageModels(serviceId, profile.imageModelRef);

  // a stored option the resolved model lacks is dropped at generation time - show it as auto here too
  const aspectRatio = profile.aspectRatio && resolved.aspectRatios.includes(profile.aspectRatio) ? profile.aspectRatio : _AUTO;
  const imageSize = profile.imageSize && resolved.imageSizes.includes(profile.imageSize) ? profile.imageSize : _AUTO;

  // any option off its default - the footer offers a reset
  const hasUserParameters = profile.imageModelRef !== null || profile.aspectRatio !== undefined || profile.imageSize !== undefined;
  const handleResetParameters = React.useCallback(() => onUpdateProfile({ imageModelRef: null, aspectRatio: undefined, imageSize: undefined }), [onUpdateProfile]);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Model' description={profile.imageModelRef ? undefined : resolved.label} />
      <Select
        value={profile.imageModelRef && profile.imageModelRef === resolved.modelRef ? profile.imageModelRef : _AUTO /* gone from the service: Auto */}
        onChange={(_event, value) => value && onUpdateProfile({ imageModelRef: value === _AUTO ? null : value })}
        slotProps={_selectSlotProps}
        sx={_selectSx}
      >
        {models.map(model => (
          <Option key={model.modelRef} value={model.modelRef}>
            {model.label}
          </Option>
        ))}
        {/* null selection - resolved at generation time, floats with the service's models */}
        <Option value={_AUTO}>Auto</Option>
      </Select>
    </FormControl>

    {resolved.aspectRatios.length > 0 && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Aspect Ratio' />
        <Select
          value={aspectRatio}
          onChange={(_event, value) => value && onUpdateProfile({ aspectRatio: value === _AUTO ? undefined : value })}
          slotProps={_selectSlotProps}
          sx={_selectSx}
        >
          <Option value={_AUTO}>Auto</Option>
          {resolved.aspectRatios.map(ar => (
            <Option key={ar} value={ar}>{ar}</Option>
          ))}
        </Select>
      </FormControl>
    )}

    {resolved.imageSizes.length > 1 && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Size' />
        <Select
          value={imageSize}
          onChange={(_event, value) => value && onUpdateProfile({ imageSize: value === _AUTO ? undefined : value })}
          slotProps={_selectSlotProps}
          sx={_selectSx}
        >
          <Option value={_AUTO}>Default (1K)</Option>
          {resolved.imageSizes.map(size => (
            <Option key={size} value={size}>{size}</Option>
          ))}
        </Select>
      </FormControl>
    )}

    {/* footer: 'Reset to defaults' when off-default - same chrome as the DALL-E/ASRx/Speex panels */}
    {hasUserParameters && (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link component='button' color='neutral' level='body-xs' onClick={handleResetParameters}>
          Reset to defaults ...
        </Link>
      </Box>
    )}

  </>;
}
