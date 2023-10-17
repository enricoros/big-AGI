//
// Application Routes
//
// We will centralize them here, for UI and routing purposes.
//

const APP_SHARING = '/shared/:sharedId';


export const getSharingRelativePath = (sharedId: string) => APP_SHARING.replace(':sharedId', sharedId);
