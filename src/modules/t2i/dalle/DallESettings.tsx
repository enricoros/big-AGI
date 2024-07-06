import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, Option, Select, Switch, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { Link } from '~/common/components/Link';
import { useToggleableBoolean } from '~/common/util/useToggleableBoolean';

import { DALLE_DEFAULT_IMAGE_SIZE, DalleImageSize, useDalleStore } from './store-module-dalle';
import { openAIImageModelsPricing } from './openaiGenerateImages';


export function DallESettings() {

  // state
  const advanced = useToggleableBoolean(false, 'DallESettings');

  // external state
  const { dalleModelId, setDalleModelId, dalleQuality, setDalleQuality, dalleSize, setDalleSize, dalleStyle, setDalleStyle, dalleNoRewrite, setDalleNoRewrite } = useDalleStore(state => ({
    dalleModelId: state.dalleModelId, setDalleModelId: state.setDalleModelId,
    dalleQuality: state.dalleQuality, setDalleQuality: state.setDalleQuality,
    dalleSize: state.dalleSize, setDalleSize: state.setDalleSize,
    dalleStyle: state.dalleStyle, setDalleStyle: state.setDalleStyle,
    dalleNoRewrite: state.dalleNoRewrite, setDalleNoRewrite: state.setDalleNoRewrite,
  }), shallow);

  const handleDalleQualityChange = (event: React.ChangeEvent<HTMLInputElement>) => setDalleQuality(event.target.checked ? 'hd' : 'standard');

  const handleDalleNoRewriteChange = (event: React.ChangeEvent<HTMLInputElement>) => setDalleNoRewrite(!event.target.checked);

  const handleResolutionChange = (_event: any, value: DalleImageSize | null) => value && setDalleSize(value);

  const isDallE3 = dalleModelId === 'dall-e-3';
  const isHD = dalleQuality === 'hd' && isDallE3;

  const resolutions: DalleImageSize[] = dalleModelId === 'dall-e-2'
    ? ['256x256', '512x512', '1024x1024']
    : ['1024x1024', '1792x1024', '1024x1792'];
  const hasResolution = resolutions.includes(dalleSize);

  const costPerImage = openAIImageModelsPricing(dalleModelId, dalleQuality, dalleSize);

  return <>

    <FormRadioControl
      title='Model'
      description={dalleModelId === 'dall-e-2' ? 'Older' : 'Newer'}
      options={[
        { value: 'dall-e-2', label: 'DALL·E 2' },
        { value: 'dall-e-3', label: 'DALL·E 3' },
      ]}
      value={dalleModelId} onChange={setDalleModelId}
    />

    {isDallE3 && <FormRadioControl
      title='Style'
      description={(isDallE3 && dalleStyle === 'vivid') ? 'Hyper-Real' : 'Realistic'}
      disabled={!isDallE3}
      options={[
        { value: 'natural', label: 'Natural' },
        { value: 'vivid', label: 'Vivid' },
      ]}
      value={isDallE3 ? dalleStyle : 'natural'} onChange={setDalleStyle}
    />}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Resolution'
                      description={!hasResolution
                        ? 'Unsupported'
                        : dalleSize === DALLE_DEFAULT_IMAGE_SIZE ? 'Default' : 'Custom'
                      } />
      <Select
        variant='outlined'
        value={dalleSize} onChange={handleResolutionChange}
        startDecorator={hasResolution ? undefined : <WarningRoundedIcon color='warning' />}
        slotProps={{
          root: { sx: { minWidth: '140px' } },
          indicator: { sx: { opacity: 0.5 } },
          button: { sx: { whiteSpace: 'inherit' } },
        }}
      >
        {resolutions.map((resolution) =>
          <Option key={'dalle-res-' + resolution} value={resolution}>
            {resolution.replace('x', ' x ')}
          </Option>,
        )}
      </Select>
    </FormControl>

    {isDallE3 && <FormControl orientation='horizontal' disabled={!isDallE3} sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Quality'
                      description={isHD ? 'Detailed' : 'Default'} />
      <Switch checked={isHD} onChange={handleDalleQualityChange}
              startDecorator={isHD ? 'HD' : 'Standard'} />
    </FormControl>}

    {advanced.on && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Better Prompt'
                      description={dalleNoRewrite ? 'No Rewrite' : 'Default'}
                      tooltip={<>
                        OpenAI improves the prompt by rewriting it by default.
                        This can be disabled to get more control over the prompt.
                        See <Link href='https://platform.openai.com/docs/guides/images/prompting' target='_blank'>
                        This OpenAI document </Link>
                      </>}
      />
      <Switch checked={!dalleNoRewrite} onChange={handleDalleNoRewriteChange}
              startDecorator={dalleNoRewrite ? 'No' : 'Improve'} />
    </FormControl>}

    {advanced.on && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Cost per Image'
                      description={<Link href='https://openai.com/pricing' target='_blank' noLinkStyle sx={{ textDecoration: 'none' }}>OpenAI Pricing </Link>} />
      <Typography>$ {costPerImage}</Typography>
    </FormControl>}


    <FormLabelStart title={advanced.on ? 'Hide Advanced' : 'Advanced'} onClick={advanced.toggle} />

  </>;
}
