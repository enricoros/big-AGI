import * as React from 'react';

import { FormControl } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { LanguageSelect } from '~/common/components/LanguageSelect';


export function VoiceSettings() {

  return <>

    {/*<FormHelperText>*/}
    {/*  📢 Hear AI responses, even in your own voice*/}
    {/*</FormHelperText>*/}

    {/* LanguageSelect: moved from the UI settings (where it logically belongs), just to group things better from an UX perspective */}
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Language'
                      description='ASR and TTS'
                      tooltip='Currently for Microphone input and Voice output. Microphone support varies by browser (iPhone/Safari lacks speech input). We will use the ElevenLabs MultiLanguage model if a language other than English is selected.' />
      <LanguageSelect />
    </FormControl>

  </>;
}