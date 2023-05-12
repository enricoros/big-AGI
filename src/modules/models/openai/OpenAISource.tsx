import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormInputKey } from '@/common/components/FormInputKey';
import { Link } from '@/common/components/Link';
import { useSettingsStore } from '@/common/state/store-settings';

import { hasServerKeyOpenAI, isValidOpenAIApiKey } from '../../openai/openai.client';
import { OpenAIAdvancedSource } from '@/modules/models/openai/OpenAIAdvancedSource';


export function OpenAISource() {

  // external state
  const { apiKey, setApiKey } = useSettingsStore(state => ({ apiKey: state.apiKey, setApiKey: state.setApiKey }), shallow);

  const needsKey = !hasServerKeyOpenAI;

  const description = <>
    {needsKey
      ? <>
        <Link level='body2' href='https://platform.openai.com/account/api-keys' target='_blank'>Create Key</Link>, then apply to
        the <Link level='body2' href='https://openai.com/waitlist/gpt-4-api' target='_blank'>GPT-4 waitlist</Link>
      </>
      : `This key will take precedence over the server's.`} <Link level='body2' href='https://platform.openai.com/account/usage' target='_blank'>Check usage here</Link>.
  </>;

  return <>

    <FormInputKey
      label={'OpenAI API Key' + (needsKey ? '' : ' (not required)')}
      value={apiKey} onChange={setApiKey}
      required={needsKey} validate={isValidOpenAIApiKey}
      placeholder='sk-...' description={description}
    />

    <OpenAIAdvancedSource />

  </>;
}