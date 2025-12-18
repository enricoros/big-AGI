import { SpeexConfigureEngines } from '~/modules/speex/components/SpeexConfigureEngines';
import { useSpeexEngines } from '~/modules/speex/store-module-speex';

import { ChatAutoSpeakType, useChatAutoAI } from '../chat/store-app-chat';

import { FormRadioOption } from '~/common/components/forms/FormRadioControl';
import { FormChipControl } from '~/common/components/forms/FormChipControl';


const _autoSpeakOptions: FormRadioOption<ChatAutoSpeakType>[] = [
  { value: 'off', label: 'No', description: 'Off' },
  { value: 'firstLine', label: 'Start', description: 'First paragraph' },
  { value: 'all', label: 'Full', description: 'Complete response' },
] as const;


/**
 * Voice output settings - Auto-speak mode and TTS engine configuration
 */
export function VoiceOutSettings(props: { isMobile: boolean }) {

  // external state
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();

  // external state - module
  const hasEngines = useSpeexEngines().length > 0;

  return <>

    {/* Auto-speak setting */}
    <FormChipControl
      title='Speak Chats'
      size='md'
      // color='primary'
      tooltip={!hasEngines ? 'No voice engines available. Configure a TTS service or use system voice.' : undefined}
      disabled={!hasEngines}
      options={_autoSpeakOptions}
      value={autoSpeak}
      onChange={setAutoSpeak}
    />

    {/* Engine configuration */}
    <SpeexConfigureEngines isMobile={props.isMobile} />

  </>;
}
