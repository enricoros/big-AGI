import * as React from 'react';

import { ChatMessage } from '../chat/components/message/ChatMessage';

import { GoodModal } from '~/common/components/GoodModal';
import { createDMessage } from '~/common/state/store-chats';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';


const shortcutsMd = `

| Shortcut         | Description                                     |
|------------------|-------------------------------------------------|
| **Edit**         |                                                 | 
| Shift + Enter    | Newline (don't send)                            |
| Alt + Enter      | Append message (don't send)                     |
| Ctrl + Shift + R | Regenerate answer                               |
| Ctrl + Shift + V | Attach clipboard (better than Ctrl + V)         |
| Ctrl + M         | Microphone (voice typing)                       |
| **Chats**        |                                                 | 
| Ctrl + Alt + N   | **New** chat                                    |
| Ctrl + Alt + X   | **Reset** chat                                  |
| Ctrl + Alt + D   | **Delete** chat                                 |
| Ctrl + Alt + F   | **Clone** chat                                  |
| **Settings**     |                                                 |
| Ctrl + Shift + M | 🧠 Models                                       |
| Ctrl + Shift + P | ⚙️ Preferences                                  |

`.trim();

const shortcutsMessage = createDMessage('assistant', platformAwareKeystrokes(shortcutsMd));


export const ShortcutsModal = (props: { onClose: () => void }) =>
  <GoodModal
    open title='Desktop Shortcuts' 
    onClose={props.onClose}
  >
    <ChatMessage message={shortcutsMessage} hideAvatars noBottomBorder sx={{ p: 0, m: 0 }} />
  </GoodModal>;