import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';

import type { ActileItem, ActileProvider, ActileProviderItems } from './ActileProvider';
import { filterMentionItems } from './providerMentions.utils';


export const providerMentions = (
  participants: DConversationParticipant[],
  onMentionSelect: (item: ActileItem, searchPrefix: string) => void,
): ActileProvider => ({

  key: 'pmention',

  get label() {
    return 'Agents';
  },

  fastCheckTriggerText: (trailingText: string) => /(^|\s)@[\w-]*$/i.test(trailingText),

  fetchItems: async (): ActileProviderItems => ({
    searchPrefix: '@',
    items: [
      {
        key: 'all-agents',
        providerKey: 'pmention',
        label: '@all',
        description: 'Mention all agents',
        Icon: SmartToyOutlinedIcon as never,
      } satisfies ActileItem,
      ...participants
        .filter(participant => participant.kind === 'assistant' && !!participant.name?.trim())
        .map(participant => ({
          key: participant.id,
          providerKey: 'pmention',
          label: `@${participant.name.trim()}`,
          description: participant.speakWhen === 'when-mentioned' ? 'Mention-only agent' : 'Agent',
          Icon: SmartToyOutlinedIcon as never,
        } satisfies ActileItem)),
    ],
  }),

  filterItems: (items, search) => filterMentionItems(items, search),

  onItemSelect: (item) => onMentionSelect(item as ActileItem, '@'),

});
