import { SpeexConfigureEngines } from '~/modules/speex/components/SpeexConfigureEngines';
import { useSpeexEngines, useSpeexTtsCharLimit } from '~/modules/speex/store-module-speex';

import { ChatAutoSpeakType, useChatAutoAI } from '../chat/store-app-chat';

import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormRadioOption } from '~/common/components/forms/FormRadioControl';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';


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
  const { ttsCharLimit, setTtsCharLimit } = useSpeexTtsCharLimit();

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

    {/* TTS character limit toggle */}
    <FormSwitchControl
      title='Speak Cost Guard'
      description={ttsCharLimit !== null ? 'Max ~3 min' : 'Unlimited'}
      tooltip='Limits text sent to TTS providers, helping prevent unexpected costs with cloud services. By default the limit is 4096 characters (~3 minutes of speech).'
      checked={ttsCharLimit !== null}
      onChange={(checked) => setTtsCharLimit(checked ? 4096 : null)}
    />

    {/* Engine configuration */}
    <SpeexConfigureEngines isMobile={props.isMobile} />

  </>;
}
