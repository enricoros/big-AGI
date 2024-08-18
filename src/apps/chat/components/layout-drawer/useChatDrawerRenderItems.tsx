import { useStoreWithEqualityFn } from 'zustand/traditional';

import type { DFolder } from '~/common/state/store-folders';
import { DMessage, DMessageUserFlag, MESSAGE_FLAG_STARRED, messageFragmentsReduceText, messageHasUserFlag, messageUserFlagToEmoji } from '~/common/stores/chat/chat.message';
import { conversationTitle, DConversationId } from '~/common/stores/chat/chat.conversation';
import { isAttachmentFragment, isContentOrAttachmentFragment, isDocPart, isImageRefPart } from '~/common/stores/chat/chat.fragments';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';
import { useChatStore } from '~/common/stores/chat/store-chats';

import type { ChatNavigationItemData } from './ChatDrawerItem';


// configuration
const SEARCH_MIN_CHARS = 3;


export type ChatNavGrouping = false | 'date' | 'persona' | 'dimension';

export type ChatSearchSorting = 'frequency' | 'date';

interface ChatNavigationGroupData {
  type: 'nav-item-group',
  title: string,
}

interface ChatNavigationInfoMessage {
  type: 'nav-item-info-message',
  message: string,
}

type ChatRenderItemData = ChatNavigationItemData | ChatNavigationGroupData | ChatNavigationInfoMessage;


// Returns a string with the pane indices where the conversation is also open, or false if it's not
function findOpenInViewNumbers(chatPanesConversationIds: DConversationId[], ourId: DConversationId): string | false {
  if (chatPanesConversationIds.length <= 1) return false;
  return chatPanesConversationIds.reduce((acc: string[], id, idx) => {
    if (id === ourId)
      acc.push((idx + 1).toString());
    return acc;
  }, []).join(', ') || false;
}

function getNextMidnightTime(): number {
  const midnight = new Date();
  // midnight.setDate(midnight.getDate() - 1);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

function getTimeBucketEn(currentTime: number, midnightTime: number): string {
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = oneDay * 7;
  const oneMonth = oneDay * 30; // approximation

  const diff = midnightTime - currentTime;

  if (diff < oneDay) {
    return 'Today';
  } else if (diff < oneDay * 2) {
    return 'Yesterday';
  } else if (diff < oneWeek) {
    return 'This Week';
  } else if (diff < oneWeek * 2) {
    return 'Last Week';
  } else if (diff < oneMonth) {
    return 'This Month';
  } else if (diff < oneMonth * 2) {
    return 'Last Month';
  } else {
    return 'Older';
  }
}

export function isDrawerSearching(filterByQuery: string): { isSearching: boolean, lcTextQuery: string } {
  const lcTextQuery = filterByQuery.trim().toLowerCase();
  return {
    isSearching: lcTextQuery.length >= SEARCH_MIN_CHARS,
    lcTextQuery,
  };
}


/*
 * Optimization: return a reduced version of the DConversation object for 'Drawer Items' purposes,
 * to avoid unnecessary re-renders on each new character typed by the assistant
 */
export function useChatDrawerRenderItems(
  activeConversationId: DConversationId | null,
  chatPanesConversationIds: DConversationId[],
  filterByQuery: string,
  activeFolder: DFolder | null,
  allFolders: DFolder[],
  filterHasStars: boolean,
  filterHasImageAssets: boolean,
  filterHasDocFragments: boolean,
  grouping: ChatNavGrouping,
  searchSorting: ChatSearchSorting,
  showRelativeSize: boolean,
): {
  renderNavItems: ChatRenderItemData[],
  filteredChatIDs: DConversationId[],
  filteredChatsCount: number,
  filteredChatsAreEmpty: boolean,
  filteredChatsBarBasis: number,
  filteredChatsIncludeActive: boolean,
} {
  return useStoreWithEqualityFn(useChatStore, ({ conversations }) => {

      // filter 1: select all conversations or just the ones in the active folder
      const selectedConversations = !activeFolder ? conversations : conversations.filter(_c => activeFolder.conversationIds.includes(_c.id));

      // filter 2: preparation: lowercase the query
      const { isSearching, lcTextQuery } = isDrawerSearching(filterByQuery);

      function messageHasDocAttachmentFragments(message: DMessage): boolean {
        return message.fragments.some(fragment => isAttachmentFragment(fragment) && isDocPart(fragment.part));
      }

      function messageHasImageFragments(message: DMessage): boolean {
        return message.fragments.some(fragment => isContentOrAttachmentFragment(fragment) && isImageRefPart(fragment.part) /*&& fragment.part.dataRef.reftype === 'dblob'*/);
      }

      // transform (the conversations into ChatNavigationItemData) + filter2 (if searching)
      const chatNavItems = selectedConversations
        .filter(_c => !filterHasStars || _c.messages.some(m => messageHasUserFlag(m, MESSAGE_FLAG_STARRED)))
        .filter(_c => !filterHasImageAssets || _c.messages.some(messageHasImageFragments))
        .filter(_c => !filterHasDocFragments || _c.messages.some(messageHasDocAttachmentFragments))
        .map((_c): ChatNavigationItemData => {
          // rich properties
          const title = conversationTitle(_c);
          const isAlsoOpen = findOpenInViewNumbers(chatPanesConversationIds, _c.id);

          // set the frequency counters if filtering is enabled
          let searchFrequency: number = 0;
          if (isSearching) {
            const titleFrequency = title.toLowerCase().split(lcTextQuery).length - 1;
            const messageFrequency = _c.messages.reduce((count, message) => {
              return count + messageFragmentsReduceText(message.fragments).toLowerCase().split(lcTextQuery).length - 1;
            }, 0);
            searchFrequency = titleFrequency + messageFrequency;
          }

          // union of message flags -> emoji string
          const allFlags = new Set<DMessageUserFlag>();
          _c.messages.forEach(_m => _m.userFlags?.forEach(flag => allFlags.add(flag)));
          const userFlagsSummary = !allFlags.size ? undefined : Array.from(allFlags).map(messageUserFlagToEmoji).join('');
          const containsDocAttachments = filterHasDocFragments || _c.messages.some(messageHasDocAttachmentFragments);
          const containsImageAssets = filterHasImageAssets || _c.messages.some(messageHasImageFragments);

          // create the ChatNavigationData
          return {
            type: 'nav-item-chat-data',
            conversationId: _c.id,
            isActive: _c.id === activeConversationId,
            isAlsoOpen,
            isEmpty: !_c.messages.length && !_c.userTitle,
            title,
            userSymbol: _c.userSymbol || undefined,
            userFlagsSummary,
            containsDocAttachments: containsDocAttachments && filterHasDocFragments, // special case: only show this icon when filtering - too many icons otherwise
            containsImageAssets,
            folder: !allFolders.length
              ? undefined                             // don't show folder select if folders are disabled
              : _c.id === activeConversationId        // only show the folder for active conversation(s)
                ? allFolders.find(folder => folder.conversationIds.includes(_c.id)) ?? null
                : null,
            updatedAt: _c.updated || _c.created || 0,
            messageCount: _c.messages.length,
            beingGenerated: !!_c._abortController, // FIXME: when the AbortController is moved at the message level, derive the state in the conv
            systemPurposeId: _c.systemPurposeId,
            searchFrequency,
          };
        })
        .filter(item => !isSearching || item.searchFrequency > 0);

      // check if the active conversation has an item in the list
      const filteredChatsIncludeActive = chatNavItems.some(_c => _c.conversationId === activeConversationId);


      // [sort by frequency, don't group] if there's a search query
      if (isSearching && searchSorting === 'frequency')
        chatNavItems.sort((a, b) => b.searchFrequency - a.searchFrequency);

      // Render List
      let renderNavItems: ChatRenderItemData[] = chatNavItems;

      // [search] add a header if searching
      if (isSearching) {

        // only prepend a 'Results' group if there are results
        if (chatNavItems.length)
          renderNavItems = [{ type: 'nav-item-group', title: 'Search results' }, ...chatNavItems];

      }
      // [grouping] group by date or persona
      else if (grouping) {

        switch (grouping) {
          // [grouping/date or persona]: sort by last updated
          case 'date':
          case 'persona':
            chatNavItems.sort((a, b) => b.updatedAt - a.updatedAt);
            break;
          // [grouping/dimension]: sort by message count
          case 'dimension':
            chatNavItems.sort((a, b) => b.messageCount - a.messageCount);
            break;
        }

        const midnightTime = getNextMidnightTime();
        const grouped = chatNavItems.reduce((acc, item) => {

          // derive the bucket name
          let bucket: string;
          switch (grouping) {
            case 'date':
              bucket = getTimeBucketEn(item.updatedAt || midnightTime, midnightTime);
              break;
            case 'persona':
              bucket = item.systemPurposeId;
              break;
            case 'dimension':
              if (item.messageCount > 20)
                bucket = 'Large chats';
              else if (item.messageCount > 10)
                bucket = 'Medium chats';
              else if (item.messageCount > 5)
                bucket = 'Small chats';
              else if (item.messageCount > 1)
                bucket = 'Tiny chats';
              else if (item.messageCount === 1)
                bucket = 'Single message';
              else
                bucket = 'Empty chats';
              break;
          }

          if (!acc[bucket])
            acc[bucket] = [];
          acc[bucket].push(item);
          return acc;
        }, {} as { [groupName: string]: ChatNavigationItemData[] });

        // prepend group names as special items
        renderNavItems = Object.entries(grouped).flatMap(([groupName, items]) => [
          { type: 'nav-item-group', title: groupName },
          ...items,
        ]);
      }

      // [zero state] searching & filtering
      if (!renderNavItems.length) {
        renderNavItems.push({
          type: 'nav-item-info-message',
          message: (filterHasStars && (filterHasImageAssets || filterHasDocFragments)) ? 'No results'
            : filterHasDocFragments ? 'No attachment results'
              : filterHasImageAssets ? 'No image results'
                : filterHasStars ? 'No starred results'
                  : isSearching ? 'Text not found'
                    : 'No conversations in folder',
        });
      } else {
        // filtering reminder (will be rendered with a clear button too)
        if (filterHasStars || filterHasImageAssets || filterHasDocFragments) {
          renderNavItems.unshift({
            type: 'nav-item-info-message',
            message: `Filtering by ${filterHasStars ? 'stars' : ''}${filterHasStars && filterHasImageAssets ? ', ' : ''}${filterHasImageAssets ? 'images' : ''}${(filterHasStars || filterHasImageAssets) && filterHasDocFragments ? ', ' : ''}${filterHasDocFragments ? 'attachments' : ''}`,
          });
        }
      }

      // other derived state
      const filteredChatIDs = chatNavItems.map(_c => _c.conversationId);
      const filteredChatsCount = chatNavItems.length;
      const filteredChatsAreEmpty = !filteredChatsCount || (filteredChatsCount === 1 && chatNavItems[0].isEmpty);
      const filteredChatsBarBasis = ((showRelativeSize && filteredChatsCount >= 2) || isSearching)
        ? chatNavItems.reduce((longest, _c) => Math.max(longest, isSearching ? _c.searchFrequency : _c.messageCount), 1)
        : 0;

      return {
        renderNavItems,
        filteredChatIDs,
        filteredChatsCount,
        filteredChatsAreEmpty,
        filteredChatsBarBasis,
        filteredChatsIncludeActive,
      };
    },
    (a, b) => {
      // we only compare the renderNavItems array, which shall be changed if the rest changes
      return a.renderNavItems.length === b.renderNavItems.length
        && a.renderNavItems.every((_a, i) => shallowEquals(_a, b.renderNavItems[i]))
        && shallowEquals(a.filteredChatIDs, b.filteredChatIDs)
        && a.filteredChatsCount === b.filteredChatsCount
        && a.filteredChatsAreEmpty === b.filteredChatsAreEmpty
        && a.filteredChatsBarBasis === b.filteredChatsBarBasis
        && a.filteredChatsIncludeActive === b.filteredChatsIncludeActive;
    },
  );
}