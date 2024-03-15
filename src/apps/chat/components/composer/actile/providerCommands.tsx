import { ActileItem, ActileProvider } from './ActileProvider';
import { findAllChatCommands } from '../../../commands/commands.registry';


export function providerCommands(onCommandSelect: (item: ActileItem) => void): ActileProvider {
  return {

    // only the literal '/' is a trigger
    fastCheckTriggerText: (trailingText: string) => trailingText === '/',

    // no real need to be async
    fetchItems: async () => ({
      title: 'Chat Commands',
      searchPrefix: '/',
      items: findAllChatCommands().map((cmd) => ({
        key: cmd.primary,
        label: cmd.primary,
        argument: cmd.arguments?.join(' ') ?? undefined,
        description: cmd.description,
        Icon: cmd.Icon,
      } satisfies ActileItem)),
    }),

    onItemSelect: onCommandSelect,
  };
}