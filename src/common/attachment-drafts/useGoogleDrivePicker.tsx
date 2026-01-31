import * as React from 'react';
import type { OAuthResponseEvent, PickerCanceledEvent, PickerPickedEvent } from '@googleworkspace/drive-picker-element';
import { DrivePicker, DrivePickerDocsView } from '@googleworkspace/drive-picker-react';

import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';

import type { AttachmentStoreCloudInput } from './useAttachmentDrafts';


// configuration
const GOOGLE_DRIVE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || '';
const MAX_FILE_SIZE_MB = 10; // skip files larger than this; 0 = no limit; note: Google Workspace files report 0 bytes
const MAX_PICKER_FILES = 8; // max files per picker session; 0 = unlimited

export const hasGoogleDriveCapability = !!GOOGLE_DRIVE_CLIENT_ID;


// Token provider interface, simple get/set
export interface ICloudProviderTokenValue {
  get: () => string | null;
  set: (token: string) => void;
}

// in-memory token storage as default
let _inMemoryToken: string | null = null;
const _inMemoryTokenStorage: ICloudProviderTokenValue = {
  get: () => _inMemoryToken,
  set: (token: string) => _inMemoryToken = token,
};


export function useGoogleDrivePicker(
  onCloudFileSelected: (cloudFile: AttachmentStoreCloudInput) => void,
  isMobile: boolean,
  tokenStorage: ICloudProviderTokenValue = _inMemoryTokenStorage,
  loginHint?: string,
) {

  // state
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);


  const openGoogleDrivePicker = React.useCallback(() => setIsPickerOpen(true), []);


  const handleOAuthResponse = React.useCallback((e: OAuthResponseEvent) => {
    if (e.detail?.access_token)
      tokenStorage.set(e.detail.access_token);
  }, [tokenStorage]);

  const handleOAuthError = React.useCallback(() => {
    setIsPickerOpen(false);
    addSnackbar({ key: 'gdrive-oauth-error', message: 'Google Drive authentication failed.', type: 'issue' });
  }, []);


  const handleCanceled = React.useCallback((_e: PickerCanceledEvent) => {
    setIsPickerOpen(false);
  }, []);

  const handlePicked = React.useCallback((e: PickerPickedEvent) => {
    setIsPickerOpen(false);

    const docs = e.detail?.docs;
    if (!docs?.length) return;

    // read token, probably just set by handleOAuthResponse
    const currentToken = tokenStorage.get();
    if (!currentToken)
      return addSnackbar({ key: 'gdrive-no-token', message: 'Unable to access Google Drive.', type: 'issue' });

    // convert picker docs to cloud file metadata for the attachment system
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    const skippedFiles: string[] = [];

    for (const doc of docs) {
      // skip files that are too large (note: Google Workspace files report 0 bytes)
      if (MAX_FILE_SIZE_MB && doc.sizeBytes && doc.sizeBytes > maxBytes) {
        skippedFiles.push(doc.name);
        continue;
      }
      onCloudFileSelected({
        accessToken: currentToken,
        provider: 'gdrive',
        fileId: doc.id,
        mimeType: doc.mimeType,
        fileName: doc.name,
        fileSize: doc.sizeBytes,
        webViewLink: doc.url,
      });
    }

    if (skippedFiles.length)
      addSnackbar({ key: 'gdrive-size-limit', message: `Skipped ${skippedFiles.length} file(s) over ${MAX_FILE_SIZE_MB} MB: ${skippedFiles.join(', ')}`, type: 'issue' });

  }, [onCloudFileSelected, tokenStorage]);


  const googleDrivePickerComponent = React.useMemo(() => !isPickerOpen || !GOOGLE_DRIVE_CLIENT_ID ? null : (
    <DrivePicker
      app-id={GOOGLE_DRIVE_CLIENT_ID.split('-')[0] || ''}
      client-id={GOOGLE_DRIVE_CLIENT_ID}
      title='Attach files from Google Drive'
      multiselect={true}
      hide-title-bar='true'
      // nav-hidden={true /* disables the 'Google Drive' nav */}
      // mine-only={true}
      login-hint={loginHint}
      max-items={MAX_PICKER_FILES || undefined}
      oauth-token={tokenStorage.get() || undefined}
      onOauthResponse={handleOAuthResponse}
      onOauthError={handleOAuthError}
      onPicked={handlePicked}
      onCanceled={handleCanceled}
    >

      <DrivePickerDocsView
        // file-ids='id1,id2,id3'
        // include-folders='default'
        // mime-types=
        mode={isMobile ? 'LIST' : undefined /* LIST, GRID - if set hides the switch */}
        // owned-by-me='default'
        // select-folder-enabled='default' // does not work, while the one in DrivePicker does
        // starred=
      />

    </DrivePicker>
  ), [handleCanceled, handleOAuthError, handleOAuthResponse, handlePicked, isMobile, isPickerOpen, loginHint, tokenStorage]);

  return {
    openGoogleDrivePicker,
    googleDrivePickerComponent,
  };
}
