import * as React from 'react';

import { ChatMessage } from '../chat/components/message/ChatMessage';

import { GoodModal } from '~/common/components/GoodModal';
import { createDMessage } from '~/common/state/store-chats';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';


const shortcutsMd = `

| Shortcut            | Description                                     |
|---------------------|-------------------------------------------------|
| **Edit**            |                                                 | 
| Shift + Enter       | Newline                                         |
| Alt + Enter         | Append (no response)                            |
| Ctrl + Shift + R    | Regenerate answer                               |
| Ctrl + Shift + V    | Attach clipboard (better than Ctrl + V)         |
| Ctrl + M            | Microphone (voice typing)                       |
| **Chats**           |                                                 | 
| Ctrl + Alt + Left   | **Previous** chat (in history)                  |
| Ctrl + Alt + Right  | **Next** chat (in history)                      |
| Ctrl + Alt + N      | **New** chat                                    |
| Ctrl + Alt + X      | **Reset** chat                                  |
| Ctrl + Alt + D      | **Delete** chat                                 |
| Ctrl + Alt + B      | **Branch** chat                                 |
| **Settings**        |                                                 |
| Ctrl + Shift + P    | ⚙️ Preferences                                  |
| Ctrl + Shift + M    | 🧠 Models                                       |
| Ctrl + Shift + O    | Options (current Chat Model)                    |
| Ctrl + Shift + ?    | Shortcuts                                       |

`.trim();

const shortcutsMessage = createDMessage('assistant', platformAwareKeystrokes(shortcutsMd));


export function ShortcutsModal(props: { onClose: () => void }) {
  return (
    <GoodModal open title='Desktop Shortcuts' onClose={props.onClose}>
      <ChatMessage message={shortcutsMessage} hideAvatars noBottomBorder sx={{ p: 0, m: 0 }} />
    </GoodModal>
  );
}