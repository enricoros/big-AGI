//
// Application Routes
//
// We will centralize them here, for UI and routing purposes.
//

import { NextRouter } from 'next/router';

const APP_CHAT = '/';
const APP_SHARING = '/shared/:sharedId';


export const getSharingRelativePath = (sharedId: string) => APP_SHARING.replace(':sharedId', sharedId);

export const navigateToChat = async (next: NextRouter['push'] | NextRouter['replace']) =>
  next(APP_CHAT).then(() => null);