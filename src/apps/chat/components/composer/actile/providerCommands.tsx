import { ActileItem, ActileProvider } from './ActileProvider';
import { findAllChatCommands } from '../../../commands/commands.registry';


export const providerCommands = (onItemSelect: (item: ActileItem) => void): ActileProvider => ({
  id: 'actile-commands',
  title: 'Chat Commands',
  searchPrefix: '/',

  checkTriggerText: (trailingText: string) =>
    trailingText.trim() === '/',

  fetchItems: async () => {
    return findAllChatCommands().map((cmd) => ({
      id: cmd.primary,
      label: cmd.primary,
      argument: cmd.arguments?.join(' ') ?? undefined,
      description: cmd.description,
      Icon: cmd.Icon,
    }));
  },

  onItemSelect,
});