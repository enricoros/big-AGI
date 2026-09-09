import * as React from 'react';

import { Box, FormControl, Link, Option, Select, Slider, Switch, Typography } from '@mui/joy';

import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSelectControl } from '~/common/components/forms/FormSelectControl';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import type { DalleModelSelection, DalleSizeGI, DProfileDalle } from '../t2i.types';
import { DALLE_DEFAULT_IMAGE_SIZE, clampGPTImageQuality, isGPTImage25ModelId, resolveDalleModelId, t2iDefaultDalleProfile } from '../t2i.config';
import { openAIImageModelsPricing } from './openaiGenerateImages';


const CONF = {

  MODEL_OPTS: [
    { value: 'gpt-image-2.5-flare', label: 'GPT Image 2.5 Flare' },
    { value: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst', description: 'Edit precision, slower' },
    { value: 'gpt-image-2', label: 'GPT Image 2' },
    { value: 'gpt-image-1.5', label: 'GPT Image 1.5' },
    { value: 'gpt-image-1', label: 'GPT Image 1' },
    { value: 'gpt-image-1-mini', label: 'GPT Image Mini' },
    { value: null, label: 'Auto' },
  ] as { value: DalleModelSelection; label: string, description?: string }[],

  RES_GI: ['1024x1024', '1536x1024', '1024x1536'] as DalleSizeGI[],

  QUALITY_GI: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ],
  QUALITY_GI_25: [ // gpt-image-2.5 adds two tiers
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'XHigh' },
    { value: 'max', label: 'Max' },
  ],
  BACKGROUND_GI: [
    // { value: 'opaque', label: 'Opaque' },
    { value: 'transparent', label: 'Transparent' },
    { value: 'auto', label: 'Auto' },
  ],
  OUT_FORMAT_GI: [
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
  ],

} as const;


export function DallESettings(props: {
  profile: DProfileDalle;
  onUpdateProfile: (update: Partial<DProfileDalle>) => void;
}) {

  // state
  const advanced = useToggleableBoolean(false, 'DallESettings');

  // external state - the engine's profile
  const { profile, onUpdateProfile } = props;
  const {
    dalleModelId,
    dalleQualityGI,
    dalleSizeGI,
    dalleBackgroundGI,
    dalleOutputFormatGI,
    dalleOutputCompressionGI,
    dalleModerationGI,
  } = profile;


  const handleResolutionGIChange = (_event: any, value: DalleSizeGI | null) =>
    value && onUpdateProfile({ dalleSizeGI: value });

  const handleCompressionChange = (_event: Event, newValue: number | number[]) =>
    onUpdateProfile({ dalleOutputCompressionGI: newValue as number });

  const handleModerationGIChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    onUpdateProfile({ dalleModerationGI: !event.target.checked ? 'low' : 'auto' });


  // derived state
  const resolvedDalleModelId = resolveDalleModelId(dalleModelId);
  const isGI25 = isGPTImage25ModelId(resolvedDalleModelId);
  const effectiveQualityGI = clampGPTImageQuality(resolvedDalleModelId, dalleQualityGI); // what the request will send

  const isGICompressible = dalleOutputFormatGI === 'webp' || dalleOutputFormatGI === 'jpeg';

  const showTransparencyWarning = dalleBackgroundGI === 'transparent'
    && dalleOutputFormatGI !== 'png'
    && dalleOutputFormatGI !== 'webp';

  const costPerImage = openAIImageModelsPricing(resolvedDalleModelId, effectiveQualityGI, dalleSizeGI);

  // any parameter off its default - the footer offers a reset
  const defaultProfile = t2iDefaultDalleProfile();
  const hasUserParameters = (Object.keys(defaultProfile) as (keyof DProfileDalle)[]).some(key => profile[key] !== defaultProfile[key]);
  const handleResetParameters = React.useCallback(() => onUpdateProfile(t2iDefaultDalleProfile()), [onUpdateProfile]);


  return <>

    <FormSelectControl
      title='Model'
      options={CONF.MODEL_OPTS.map(opt => ({ ...opt, value: opt.value || 'auto', description: opt.description ?? '' }))}
      value={dalleModelId || 'auto'}
      onChange={(value) => onUpdateProfile({ dalleModelId: value === 'auto' ? null : value as DalleModelSelection })}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Resolution'
                      description={dalleSizeGI === DALLE_DEFAULT_IMAGE_SIZE ? 'Default' : 'Custom'} />
      <Select
        variant='outlined'
        value={dalleSizeGI}
        onChange={handleResolutionGIChange}
        slotProps={{
          root: { sx: { minWidth: '120px' } },
          indicator: { sx: { opacity: 0.5 } },
          button: { sx: { whiteSpace: 'inherit' } },
        }}
      >
        {CONF.RES_GI.map((resolution) =>
          <Option key={'res-' + resolution} value={resolution}>
            {resolution.replace('x', ' x ')}
          </Option>,
        )}
      </Select>
    </FormControl>

    <FormChipControl
      title='Quality'
      description={effectiveQualityGI !== dalleQualityGI ? `'${dalleQualityGI}' unsupported, using '${effectiveQualityGI}'` : 'Higher quality takes longer'}
      options={isGI25 ? CONF.QUALITY_GI_25 : CONF.QUALITY_GI}
      value={effectiveQualityGI} onChange={value => onUpdateProfile({ dalleQualityGI: value })}
    />

    <FormChipControl
      title='Background'
      description={
        !showTransparencyWarning
          ? 'Transparency'
          : <Typography level='body-xs' color='warning'>
            Transparent background requires PNG or WebP format
          </Typography>
      }
      options={CONF.BACKGROUND_GI}
      value={dalleBackgroundGI} onChange={value => onUpdateProfile({ dalleBackgroundGI: value })}
    />

    {advanced.on && <FormChipControl
      title='File Format'
      description='File format for the generated image'
      options={CONF.OUT_FORMAT_GI}
      value={dalleOutputFormatGI} onChange={value => onUpdateProfile({ dalleOutputFormatGI: value })}
    />}

    {advanced.on && (
      <FormControl disabled={!isGICompressible} orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='File Quality'
                        description={(isGICompressible && dalleOutputCompressionGI !== 100) ? `${100 - dalleOutputCompressionGI}% compression` : 'Uncompressed'} />
        <Slider
          aria-label='File Quality'
          color='neutral'
          disabled={!isGICompressible}
          value={!isGICompressible ? 0 : dalleOutputCompressionGI}
          onChange={handleCompressionChange}
          min={5}
          max={100}
          step={5}
          sx={{ width: '180px', mr: 1 }}
        />
      </FormControl>
    )}

    {advanced.on && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Moderation' description='Content filter strictness' />
      <Switch checked={dalleModerationGI === 'auto'} onChange={handleModerationGIChange}
              startDecorator={dalleModerationGI === 'low' ? 'Less Strict' : 'Standard'} />
    </FormControl>}

    {advanced.on && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Cost per Image' tooltip='Output image tokens only - input text and image tokens are billed on top' />
      <Typography>{costPerImage}</Typography>
    </FormControl>}


    {/* footer: 'Advanced...' toggle left, 'Reset to defaults' right when off-default - same chrome as the ASRx/Speex panels */}
    <Box sx={_styles.bottomRow}>
      <Typography level='body-xs' onClick={advanced.toggle} sx={_styles.advancedToggle}>
        {advanced.on ? 'Hide Advanced' : 'Advanced...'}
      </Typography>
      {hasUserParameters && (
        <Link component='button' color='neutral' level='body-xs' onClick={handleResetParameters}>
          Reset to defaults ...
        </Link>
      )}
    </Box>

  </>;
}


const _styles = {
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  advancedToggle: {
    lineHeight: 2, // makes the whole line be 24px
    textDecoration: 'underline',
    cursor: 'pointer',
    color: 'text.tertiary',
  },
} as const;
