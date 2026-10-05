import * as React from 'react';

import { FormSelectControl, type FormSelectOption } from '~/common/components/forms/FormSelectControl';

import { type ChatMessageTimestampMode, useChatMessageTimestampMode } from '../../chat/store-app-chat';


const timestampOptions: FormSelectOption<ChatMessageTimestampMode>[] = [
  { value: 'off', label: 'Off', description: 'Hidden' },
  { value: 'auto', label: 'Auto', description: 'First and last' },
  { value: 'all', label: 'All', description: 'Every message' },
];

export function SettingUIMessageTimestamps() {
  const [mode, setMode] = useChatMessageTimestampMode();

  return (
    <FormSelectControl
      title='Timestamps'
      options={timestampOptions}
      value={mode}
      onChange={setMode}
    />
  );
}
