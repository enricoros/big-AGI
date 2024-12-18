import { findAllChatCommands } from '../../../commands/commands.registry';

import type { ActileItem, ActileProvider, ActileProviderItems } from './ActileProvider';


export const providerCommands = (
  onCommandSelect: (item: ActileItem, searchPrefix: string) => void,
): ActileProvider => ({

  key: 'pcmd',

  get label() {
    return 'Chat Commands';
  },

  fastCheckTriggerText: (trailingText: string) => {
    // only the literal '/' is a trigger
    return trailingText === '/';
  },

  fetchItems: async (): ActileProviderItems => ({
    searchPrefix: '/',
    items: findAllChatCommands().map((cmd) => ({
      key: cmd.primary,
      providerKey: 'pcmd',
      label: cmd.primary,
      argument: cmd.arguments?.join(' ') ?? undefined,
      description: cmd.description,
      Icon: cmd.Icon,
    } satisfies ActileItem)),
  }),

  onItemSelect: (item) => onCommandSelect(item as ActileItem, '/'),

});