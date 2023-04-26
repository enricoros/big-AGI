import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, FormHelperText, FormLabel, IconButton, Input } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { Link } from '@/common/components/Link';
import { Section } from '@/common/components/Section';
import { useSettingsStore } from '@/common/state/store-settings';

import { isValidOpenAIApiKey, requireUserKeyOpenAI } from './openai.client';


export function OpenAISettings() {
  // state
  const [showApiKeyValue, setShowApiKeyValue] = React.useState(false);

  // external state
  const { apiKey, setApiKey } = useSettingsStore(state => ({ apiKey: state.apiKey, setApiKey: state.setApiKey }), shallow);

  const handleApiKeyChange = (e: React.ChangeEvent) => setApiKey((e.target as HTMLInputElement).value);

  const handleToggleApiKeyVisibility = () => setShowApiKeyValue(!showApiKeyValue);

  const needsKey = requireUserKeyOpenAI;
  const validKey = isValidOpenAIApiKey(apiKey);

  return (
    <Section>
      <FormControl>
        <FormLabel>
          OpenAI API Key {needsKey ? '' : '(optional)'}
        </FormLabel>

        <Input
          variant='outlined' type={showApiKeyValue ? 'text' : 'password'}
          placeholder={needsKey ? 'required' : 'sk-...'}
          error={needsKey && !validKey}
          value={apiKey} onChange={handleApiKeyChange}
          startDecorator={<KeyIcon />}
          endDecorator={!!apiKey && (
            <IconButton variant='plain' color='neutral' onClick={handleToggleApiKeyVisibility}>
              {showApiKeyValue ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </IconButton>
          )}
        />

        <FormHelperText sx={{ display: 'block', lineHeight: 1.75 }}>
          {needsKey
            ? <><Link level='body2' href='https://platform.openai.com/account/api-keys' target='_blank'>Create Key</Link>, then apply to
              the <Link level='body2' href='https://openai.com/waitlist/gpt-4-api' target='_blank'>GPT-4 waitlist</Link></>
            : `This key will take precedence over the server's.`} <Link level='body2' href='https://platform.openai.com/account/usage' target='_blank'>Check usage here</Link>.
        </FormHelperText>

      </FormControl>
    </Section>
  );
}