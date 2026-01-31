import * as React from 'react';
import { createPortal } from 'react-dom';

import type { PickerCanceledEvent, PickerPickedEvent } from '@googleworkspace/drive-picker-element';
import { DrivePicker, DrivePickerDocsView } from '@googleworkspace/drive-picker-react';

import { IconButton } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';

import type { AttachmentStoreCloudInput } from './useAttachmentDrafts';


// configuration
const GOOGLE_DRIVE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || '';
const MAX_FILE_SIZE_MB = 10; // skip files larger than this; 0 = no limit; note: Google Workspace files report 0 bytes
const MAX_PICKER_FILES = 8; // max files per picker session; 0 = unlimited

export const hasGoogleDriveCapability = !!GOOGLE_DRIVE_CLIENT_ID;


// Token provider interface, simple get/set
export interface ICloudProviderTokenAccessor {
  get: () => string | null;
  set: (token: string | null) => void;
}

// in-memory token storage as default
let _inMemoryToken: string | null = null;
const _inMemoryTokenStorage: ICloudProviderTokenAccessor = {
  get: () => _inMemoryToken,
  set: (token: string | null) => _inMemoryToken = token,
};


type _OauthResponseEvent = {
  detail?: {
    access_token: string; // xxxx.yyyyy....
    expires_in: string | number; // 3599
    scope: string; // 'https://www.googleapis.com/auth/drive.file'
    token_type: string; // 'Bearer
  };
}

type _OauthErrorEvent = {
  detail?: object | {
    type?: string; // 'popup_closed'
    message?: string; // 'Popup window closed'
    // stack?: string;
  };
}

export function useGoogleDrivePicker(
  onCloudFileSelected: (cloudFile: AttachmentStoreCloudInput) => void,
  isMobile: boolean,
  tokenStorage: ICloudProviderTokenAccessor = _inMemoryTokenStorage,
  loginHint?: string,
) {

  // state
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);


  const openGoogleDrivePicker = React.useCallback(() => setIsPickerOpen(true), []);


  const handleOAuthResponse = React.useCallback((e: _OauthResponseEvent) => {
    if (e.detail?.access_token)
      tokenStorage.set(e.detail.access_token);
  }, [tokenStorage]);

  const handleOAuthError = React.useCallback((e: _OauthErrorEvent) => {
    setIsPickerOpen(false);
    if (!e?.detail || !('type' in e?.detail) || e.detail.type !== 'popup_closed')
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


  const handleCloseClick = React.useCallback(() => {
    setIsPickerOpen(false);
    tokenStorage.set('');
  }, [tokenStorage]);

  const googleDrivePickerComponent = React.useMemo(() => !isPickerOpen || !GOOGLE_DRIVE_CLIENT_ID ? null : <>

    {/* Top-level close button - portaled to body, above the Google Drive picker */}
    {createPortal(
      <TooltipOutlined title='Close and change account' placement='bottom'>
        <IconButton
          onClick={handleCloseClick}
          sx={{
            '--IconButton-size': '2.75rem',

            backgroundColor: 'background.popup',
            borderRadius: '50%',
            boxShadow: 'lg',

            position: 'fixed',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2002, // above the Drive Picker (2001+)
          }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </TooltipOutlined>,
      document.body,
    )}


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
  </>, [handleCanceled, handleCloseClick, handleOAuthError, handleOAuthResponse, handlePicked, isMobile, isPickerOpen, loginHint, tokenStorage]);

  return {
    openGoogleDrivePicker,
    googleDrivePickerComponent,
  };
}
