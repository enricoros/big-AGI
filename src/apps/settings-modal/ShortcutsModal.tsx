import * as React from 'react';

import { BlocksRenderer } from '../chat/components/message/blocks/BlocksRenderer';

import { GoodModal } from '~/common/components/GoodModal';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';


const shortcutsMd = platformAwareKeystrokes(`

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
| Ctrl + Shift + O    | 💬 Options (current Chat Model)                 |
| Ctrl + Shift + +    | Increase Text Size                              |
| Ctrl + Shift + -    | Decrease Text Size                              |
| Ctrl + Shift + ?    | Shortcuts                                       |

`).trim();


export function ShortcutsModal(props: { onClose: () => void }) {
  return (
    <GoodModal open title='Desktop Shortcuts' onClose={props.onClose}>
      <BlocksRenderer text={shortcutsMd} fromRole='assistant' renderTextAsMarkdown />
    </GoodModal>
  );
}