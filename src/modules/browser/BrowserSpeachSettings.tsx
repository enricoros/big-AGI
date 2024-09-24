import * as React from 'react';

import { FormControl } from '@mui/joy';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useVoiceCapability } from '~/common/components/useCapabilities';

import { useBrowserSpeachVoiceDropdown } from './useBrowserSpeachVoiceDropdown';


export function BrowserSpeachSettings() {

  const { voicesDropdown } = useBrowserSpeachVoiceDropdown(true);
  
  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Assistant Voice' />
      {voicesDropdown}
    </FormControl>

  </>;
}