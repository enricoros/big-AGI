import * as React from 'react';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import { GoodModal } from '~/common/components/GoodModal';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIContentScaling } from '~/common/state/store-ui';


const shortcutsMd = platformAwareKeystrokes(`

| Shortcut         | Description                             |
|------------------|-----------------------------------------|
| **Edit**         |                                         |
| Shift + Enter    | Newline                                 |
| Alt + Enter      | Append (no response)                    |
| Ctrl + Shift + B | **Beam** last message                   |
| Ctrl + Shift + Z | **REgenerate** last message             |
| Ctrl + Shift + V | Attach clipboard (better than Ctrl + V) |
| Ctrl + M         | Microphone (voice typing)               |
| **Chats**        |                                         |
| Ctrl + O         | Open Chat ...                           |
| Ctrl + S         | Save Chat ...                           |
| Ctrl + Shift + N | **New** chat                            |
| Ctrl + Shift + X | **Reset** chat                          |
| Ctrl + Shift + D | **Delete** chat                         |
| Ctrl + [         | **Previous** chat (in history)          |
| Ctrl + ]         | **Next** chat (in history)              |
| **Settings**     |                                         |
| Ctrl + ,         | ⚙️ Preferences                          |
| Ctrl + Shift + M | 🧠 Models                               |
| Ctrl + Shift + O | 💬 Options (current Chat Model)         |
| Ctrl + Shift + + | Increase Text Size                      |
| Ctrl + Shift + - | Decrease Text Size                      |
| Ctrl + Shift + / | Shortcuts                               |

`).trim();


export function ShortcutsModal(props: { onClose: () => void }) {

  // external state
  const isMobile = useIsMobile();
  const contentScaling = useUIContentScaling();

  return (
    <GoodModal open title='Desktop Shortcuts' onClose={props.onClose}>
      <AutoBlocksRenderer
        text={shortcutsMd}
        fromRole='assistant'
        contentScaling={contentScaling}
        fitScreen={isMobile}
        isMobile={isMobile}
        textRenderVariant='markdown'
      />
    </GoodModal>
  );
}
