import * as React from 'react';

import { FormControl } from '@mui/joy';

import { useChatMicTimeoutMs } from '../chat/store-app-chat';

import type { FormRadioOption } from '~/common/components/forms/FormRadioControl';
import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { LanguageSelect } from '~/common/components/LanguageSelect';


const _minTimeouts: ReadonlyArray<FormRadioOption<string>> = [
  { value: '600', label: '0.6s', description: 'Best for quick calls' },
  { value: '2000', label: '2s', description: 'Standard' },
  { value: '5000', label: '5s', description: 'Breathe' },
  { value: '15000', label: '15s', description: 'Best for thinking' },
] as const;


export function VoiceInSettings(props: { isMobile: boolean }) {

  // external state
  const [chatTimeoutMs, setChatTimeoutMs] = useChatMicTimeoutMs();

  // derived - converts from string keys to numbers and vice versa
  const chatTimeoutValue: string = '' + chatTimeoutMs;
  const setChatTimeoutValue = React.useCallback((value: string) => {
    value && setChatTimeoutMs(parseInt(value));
  }, [setChatTimeoutMs]);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart
        title='Language'
        description='Mic and voice'
        // tooltip='For Microphone input and Voice output. Microphone support varies by browser (iPhone/Safari lacks speech input).'
      />
      <LanguageSelect />
    </FormControl>

    {!props.isMobile && (
      <FormChipControl
        title='Timeout'
        // color='primary'
        options={_minTimeouts}
        value={chatTimeoutValue}
        onChange={setChatTimeoutValue}
      />
    )}

  </>;
}
