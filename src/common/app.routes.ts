//
// Application Routes
//
// We will centralize them here, for UI and routing purposes.
//

import Router from 'next/router';

import type { DConversationId } from '~/common/state/store-chats';


export const ROUTE_INDEX = '/';
export const ROUTE_APP_CHAT = '/';
export const ROUTE_APP_LINK_CHAT = '/link/chat/:linkId';
export const ROUTE_APP_NEWS = '/news';

export const getIndexLink = () => ROUTE_INDEX;

export const getChatLinkRelativePath = (chatLinkId: string) => ROUTE_APP_LINK_CHAT.replace(':linkId', chatLinkId);

const navigateFn = (path: string) => (replace?: boolean): Promise<boolean> =>
  Router[replace ? 'replace' : 'push'](path);

export const navigateToIndex = navigateFn(ROUTE_INDEX);
export const navigateToChat = async (conversationId?: DConversationId) => {
  if (conversationId) {
    await Router.push(
      {
        pathname: ROUTE_APP_CHAT,
        query: {
          conversationId,
        },
      },
      ROUTE_APP_CHAT,
    );
  } else {
    await Router.push(ROUTE_APP_CHAT, ROUTE_APP_CHAT);
  }
};
export const navigateToNews = navigateFn(ROUTE_APP_NEWS);

export const navigateBack = Router.back;

export interface AppCallQueryParams {
  conversationId: string;
  personaId: string;
}

export function launchAppCall(conversationId: string, personaId: string) {
  void Router.push(
    {
      pathname: `/call`,
      query: {
        conversationId,
        personaId,
      } satisfies AppCallQueryParams,
    },
    // '/call',
  ).then();
}