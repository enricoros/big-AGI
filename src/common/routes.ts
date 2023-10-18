//
// Application Routes
//
// We will centralize them here, for UI and routing purposes.
//

import { NextRouter } from 'next/router';

const APP_CHAT = '/';
const APP_LINK_CHAT = '/link/chat/:linkId';


export const getChatLinkRelativePath = (chatLinkId: string) => APP_LINK_CHAT.replace(':linkId', chatLinkId);

export const navigateToChat = async (next: NextRouter['push'] | NextRouter['replace']) =>
  next(APP_CHAT).then(() => null);