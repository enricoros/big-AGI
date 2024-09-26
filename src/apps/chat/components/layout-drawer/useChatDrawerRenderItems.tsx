import * as React from 'react';

import type { DFolder } from '~/common/state/store-folders';
import { DMessage, DMessageUserFlag, MESSAGE_FLAG_STARRED, messageFragmentsReduceText, messageHasUserFlag, messageUserFlagToEmoji } from '~/common/stores/chat/chat.message';
import { conversationTitle, DConversationId } from '~/common/stores/chat/chat.conversation';
import { getLocalMidnightInUTCTimestamp, getTimeBucketEn } from '~/common/util/timeUtils';
import { isAttachmentFragment, isContentOrAttachmentFragment, isDocPart, isImageRefPart } from '~/common/stores/chat/chat.fragments';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';
import { useChatStore } from '~/common/stores/chat/store-chats';

import type { ChatNavigationItemData } from './ChatDrawerItem';


// configuration
const SEARCH_MIN_CHARS = 3;


interface ChatDrawerRenderItems {
  renderNavItems: (ChatNavigationItemData | ChatNavigationGroupData | ChatNavigationInfoMessage)[];
  filteredChatIDs: DConversationId[];
  filteredChatsCount: number;
  filteredChatsAreEmpty: boolean;
  filteredChatsBarBasis: number;
  filteredChatsIncludeActive: boolean;
}

interface ChatNavigationGroupData {
  type: 'nav-item-group',
  title: string,
}

interface ChatNavigationInfoMessage {
  type: 'nav-item-info-message',
  message: string,
}

export type ChatNavGrouping = false | 'date' | 'persona' | 'dimension';

export type ChatSearchSorting = 'frequency' | 'date';


// Returns a string with the pane indices where the conversation is also open, or false if it's not
function findOpenInViewNumbers(chatPanesConversationIds: DConversationId[], ourId: DConversationId): string | false {
  if (chatPanesConversationIds.length <= 1) return false;
  return chatPanesConversationIds.reduce((acc: string[], id, idx) => {
    if (id === ourId)
      acc.push((idx + 1).toString());
    return acc;
  }, []).join(', ') || false;
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
): ChatDrawerRenderItems {

  const stabilizeRenderItems = React.useRef<ChatDrawerRenderItems>();

  return useChatStore(({ conversations }) => {

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
      let renderNavItems: ChatDrawerRenderItems['renderNavItems'] = chatNavItems;

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

        const midnightTime = getLocalMidnightInUTCTimestamp();
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

      // stabilize individual renderNavItems (only if in the same place)
      const prev = stabilizeRenderItems.current;
      // Update: we don't need this as <ChatDrawerItem> is already memoed
      // if (prev && renderNavItems.length === prev.renderNavItems.length)
      //   renderNavItems = renderNavItems.map((item, index) => {
      //     if (index < prev.renderNavItems.length && shallowEquals(item, prev.renderNavItems[index]))
      //       return prev.renderNavItems[index];
      //     return item;
      //   });

      // next state
      const next: ChatDrawerRenderItems = {
        renderNavItems,
        filteredChatIDs,
        filteredChatsCount,
        filteredChatsAreEmpty,
        filteredChatsBarBasis,
        filteredChatsIncludeActive,
      };

      // stabilize the render items
      if (prev
        && prev.renderNavItems.length === next.renderNavItems.length
        && prev.renderNavItems.every((_a, i) => shallowEquals(_a, next.renderNavItems[i]))
        && shallowEquals(prev.filteredChatIDs, next.filteredChatIDs)
        && prev.filteredChatsCount === next.filteredChatsCount
        && prev.filteredChatsAreEmpty === next.filteredChatsAreEmpty
        && prev.filteredChatsBarBasis === next.filteredChatsBarBasis
        && prev.filteredChatsIncludeActive === next.filteredChatsIncludeActive
      ) return prev;
      return stabilizeRenderItems.current = next;
    },
  );
}