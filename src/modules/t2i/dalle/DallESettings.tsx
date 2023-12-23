import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, Option, Select, Switch } from '@mui/joy';
import WarningIcon from '@mui/icons-material/Warning';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { Link } from '~/common/components/Link';

import { DALLE_DEFAULT_IMAGE_SIZE, DalleImageSize, useDalleStore } from './store-module-dalle';


export function DallESettings() {

  // state
  // const advanced = useToggleableBoolean();

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

  const resolutions: DalleImageSize[] = dalleModelId === 'dall-e-2'
    ? ['256x256', '512x512', '1024x1024']
    : ['1024x1024', '1792x1024', '1024x1792'];
  const hasResolution = resolutions.includes(dalleSize);

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

    <FormRadioControl
      title='Style'
      description={dalleStyle === 'vivid' ? 'Hyper-Real' : 'Relistic'}
      options={[
        { value: 'natural', label: 'Natural' },
        { value: 'vivid', label: 'Vivid' },
      ]}
      value={dalleStyle} onChange={setDalleStyle}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Quality'
                      description={dalleQuality === 'hd' ? 'Finer Details' : 'Default'} />
      <Switch checked={dalleQuality === 'hd'} onChange={handleDalleQualityChange}
              startDecorator={dalleQuality === 'hd' ? 'HD' : 'Standard'} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Resolution'
                      description={!hasResolution
                        ? 'Unsupported'
                        : dalleSize === DALLE_DEFAULT_IMAGE_SIZE ? 'Default' : 'Custom'
                      } />
      <Select
        variant='outlined'
        value={dalleSize} onChange={handleResolutionChange}
        startDecorator={hasResolution ? undefined : <WarningIcon color='warning' />}
        slotProps={{
          root: { sx: { minWidth: '160px' } },
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

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Improve Prompt'
                      description={dalleNoRewrite ? 'Do Not Rewrite' : 'Default'}
                      tooltip={<>
                        OpenAI improves the prompt by rewriting it. Default: On.
                        See <Link href='https://platform.openai.com/docs/guides/images/prompting' target='_blank'>
                        This OpenAI document </Link>
                      </>}
      />
      <Switch checked={!dalleNoRewrite} onChange={handleDalleNoRewriteChange}
              startDecorator={dalleNoRewrite ? 'RAW' : 'Improve'} />
    </FormControl>

    {/*<FormLabelStart title={advanced.on ? 'Hide Advanced' : 'Advanced'} onClick={advanced.toggle} />*/}

  </>;
}