import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormControl, Switch } from '@mui/joy';
import { useVoiceInjectPrompt } from '../../chat/store-app-chat';
import React from 'react';

export const GeneralVoiceSettings = () => {
  const [voiceInjectPrompt, setVoiceInjectPrompt] = useVoiceInjectPrompt();

  const handleVoiceInjectPromptChange = (event: React.ChangeEvent<HTMLInputElement>) => setVoiceInjectPrompt(event.target.checked);

  return (
    <>
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Inject voice prompt'
                        description={voiceInjectPrompt ? "On" : "Off"} />
        <Switch checked={voiceInjectPrompt} onChange={handleVoiceInjectPromptChange}
                endDecorator={voiceInjectPrompt ? 'On' : 'Off'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>
    </>
  )
}