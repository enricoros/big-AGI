import * as React from 'react';
import type { FileWithHandle } from 'browser-fs-access';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Checkbox, ColorPaletteProp, Dropdown, IconButton, ListDivider, ListItem, ListItemDecorator, MenuButton } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddToDriveRoundedIcon from '@mui/icons-material/AddToDriveRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';

import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import { ButtonAttachFilesMemo, openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { RichMenu, RichMenuButton, RichMenuItem, richMenuItemSx } from '~/common/components/RichMenu';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { supportsClipboardRead } from '~/common/util/clipboardUtils';
import { takeScreenCapture } from '~/common/util/screenCaptureUtils';

import { ButtonAttachCameraMemo } from './ButtonAttachCamera';
import { ButtonAttachClipboardMemo } from './ButtonAttachClipboard';
import { ButtonAttachGoogleDriveMemo } from './ButtonAttachGoogleDrive';
import { ButtonAttachScreenCaptureMemo } from './ButtonAttachScreenCapture';
import { ButtonAttachWebMemo } from './ButtonAttachWeb';
import { hasGoogleDriveCapability } from './useGoogleDrivePicker';


const _style = {
  liveFeedButton: {
    ml: 1,
    // outline: '1px solid transparent',
    // '&:hover': {
    //   outlineColor: 'currentColor',
    // },
  },
} as const satisfies Record<string, SxProps>;


// Live feed record button - returns null if onClick is undefined
function LiveFeedButton(props: { isActive: boolean, tooltip: string, onClick: () => void }) {
  return (
    <TooltipOutlined title={props.tooltip} placement='top'>
      <IconButton
        size='sm'
        variant={props.isActive ? 'solid' : 'outlined'}
        color='danger'
        onClick={(e) => {
          e.stopPropagation();
          props.onClick();
        }}
        sx={_style.liveFeedButton}
      >
        <FiberManualRecordIcon sx={{ fontSize: 16 }} />
        {/*{props.isActive ? <AddRoundedIcon sx={{ fontSize: 18 }} /> : <FiberManualRecordIcon sx={{ fontSize: 16 }} />}*/}
      </IconButton>
    </TooltipOutlined>
  );
}


// Auto-download toggle (shown when browsing capability exists)
function AutoDownloadToggle() {

  // external state
  const enableComposerAttach = useBrowseStore(s => s.enableComposerAttach);

  const handleToggle = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    useBrowseStore.getState().setEnableComposerAttach(event.target.checked);
  }, []);

  return <>

    <ListDivider inset='gutter' sx={{ my: 1 }} />

    <ListItem sx={richMenuItemSx.item}>
      <ListItemDecorator>
        <Checkbox
          size='sm'
          color='neutral'
          checked={enableComposerAttach}
          onChange={handleToggle}
          onClick={(event) => event.stopPropagation()}
          sx={{ ml: 0.375 }}
        />
      </ListItemDecorator>
      <Box sx={richMenuItemSx.content}>
        <Box sx={{ typography: 'title-sm' }}>
          Attach pasted URLs
        </Box>
        <Box sx={richMenuItemSx.description}>
          Download and attach pasted web links
        </Box>
      </Box>
    </ListItem>
  </>;
}


/**
 * Portable attachment sources component.
 *
 * Three modes:
 * - **menu-compact**: Mobile-style - icon trigger, simple MenuItems (no descriptions/animations)
 * - **menu-rich**: Desktop-style - labeled button trigger, rich items with descriptions and animations
 * - **inline-buttons**: Individual source buttons rendered inline (no dropdown)
 */
export const AttachmentSourcesMemo = React.memo(AttachmentSources);

function AttachmentSources(props: {
  // mode
  mode: 'menu-compact' | 'menu-rich' | 'inline-buttons' | 'menu-message',
  color?: ColorPaletteProp, // menu-rich and inline-buttons
  richButtonStandOut?: boolean, // menu-rich only
  menuButton?: React.ReactNode, // custom MenuButton trigger for menu-compact/menu-message modes
  // source availability - note that hasGoogleDriveCapability is local
  canBrowse: boolean, // whether browsing is available (for Web button and showing the auto-attach toggle)
  hasCamera: boolean,
  // hasGoogleDrive: boolean, // it's now local: hasGoogleDriveCapability
  hasScreenCapture: boolean,
  // configuration
  onlyImages?: boolean, // makes clipboard/drive/web unavailable
  // callbacks
  onAttachClipboard: () => void,
  onAttachFiles: (files: FileWithHandle[], errorMessage: string | null) => void,
  onAttachScreenCapture: (file: File) => void,
  onOpenCamera: () => void,
  onOpenGoogleDrivePicker?: () => void, // optional because requires additional external setup (e.g. user-storage of tokens)
  onOpenWebInput: () => void,
  // live feeds - end action buttons (presence if the callback is set, active state if the boolean is true)
  hasActiveCameraFeed?: boolean,
  hasActiveScreenFeed?: boolean,
  onStartLiveCameraFeed?: () => void,
  onStartLiveScreenFeed?: () => void,
}) {

  // state (screen capture - used in menu modes where the component handles the capture)
  const [capturingScreen, setCapturingScreen] = React.useState(false);
  const [screenCaptureError, setScreenCaptureError] = React.useState<string | null>(null);


  // handlers

  const { onAttachFiles, onAttachScreenCapture } = props;

  const handleAttachFilePicker = React.useCallback(() => {
    return openFileForAttaching(true, onAttachFiles);
  }, [onAttachFiles]);

  const handleTakeScreenCapture = React.useCallback(async () => {
    setScreenCaptureError(null);
    setCapturingScreen(true);
    try {
      const file = await takeScreenCapture();
      file && onAttachScreenCapture(file);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      setScreenCaptureError(message);
    }
    setCapturingScreen(false);
  }, [onAttachScreenCapture]);


  // inline-buttons mode - individual buttons rendered flat (no dropdown)
  if (props.mode === 'inline-buttons')
    return <>

      {/* Files */}
      <ButtonAttachFilesMemo color={props.color} onAttachFiles={props.onAttachFiles} /*fullWidth*/ multiple />

      {/* Web */}
      {!props.onlyImages && <ButtonAttachWebMemo color={props.color} disabled={!props.canBrowse} onOpenWebInput={props.onOpenWebInput} />}

      {/* Google Drive */}
      {hasGoogleDriveCapability && !props.onlyImages && !!props.onOpenGoogleDrivePicker && (
        <ButtonAttachGoogleDriveMemo color={props.color} onOpenGoogleDrivePicker={props.onOpenGoogleDrivePicker} />
      )}

      {/* Clipboard */}
      {supportsClipboardRead() && !props.onlyImages && (
        <ButtonAttachClipboardMemo color={props.color} onAttachClipboard={props.onAttachClipboard} />
      )}

      {/* Screen Capture */}
      {props.hasScreenCapture && (
        <ButtonAttachScreenCaptureMemo color={props.color} onAttachScreenCapture={props.onAttachScreenCapture} />
      )}

      {/* Camera */}
      {props.hasCamera && (
        <ButtonAttachCameraMemo color={props.color} onOpenCamera={props.onOpenCamera} />
      )}

    </>;


  // menu-compact mode (mobile) - simple icon trigger with flat menu items
  if (props.mode === 'menu-compact' || props.mode === 'menu-message') {
    const isMessage = props.mode === 'menu-message';
    return <>

      <Dropdown>
        {props.menuButton ? props.menuButton : !isMessage ? (
          <RichMenuButton icon={<AddRoundedIcon />} />
        ) : (
          <MenuButton slots={{ root: Button }} slotProps={{
            root: {
              size: 'sm',
              variant: 'soft',
              color: 'warning',
              startDecorator: <AddRoundedIcon />,
              sx: { minHeight: '2.25rem', m: -0.25 /* absorb parent's padding */ },
            },
          } as const}>
            Attach
          </MenuButton>
        )}
        <RichMenu compact /* menu-compact or menu-message: above dialogs (default zIndex) */>

          {/* Files */}
          <RichMenuItem name={props.onlyImages ? 'Images' : 'Files'} description='PDF, DOCX, images, code' color={props.color} Icon={AttachFileRoundedIcon} onClick={handleAttachFilePicker} />

          {/* Web */}
          {!props.onlyImages && /*props.canBrowse &&*/ (
            <RichMenuItem name='Web' description='Import from web pages' color={props.color} Icon={LanguageRoundedIcon} onClick={props.onOpenWebInput} disabled={!props.canBrowse} />
          )}

          {/* Google Drive */}
          {!props.onlyImages && hasGoogleDriveCapability && !!props.onOpenGoogleDrivePicker && (
            <RichMenuItem name='Drive' description='Attach Google Drive files' color={props.color} Icon={AddToDriveRoundedIcon} onClick={props.onOpenGoogleDrivePicker} />
          )}

          {/* Clipboard */}
          {!props.onlyImages && supportsClipboardRead() && (
            <RichMenuItem name='Clipboard' description='Auto-convert to the best format' color={props.color} Icon={ContentPasteGoIcon} onClick={props.onAttachClipboard} />
          )}

          {/* Screen Capture */}
          {props.hasScreenCapture && (
            <RichMenuItem
              name='Screen'
              color={screenCaptureError ? 'danger' : props.color}
              description={screenCaptureError ? `Error: ${screenCaptureError}` : 'Capture tabs, apps, and screens'}
              Icon={ScreenshotMonitorIcon}
              disabled={capturingScreen}
              onClick={handleTakeScreenCapture}
              endAction={!isMessage && props.onStartLiveScreenFeed && <LiveFeedButton isActive={!!props.hasActiveScreenFeed} tooltip='Live Screen chat' onClick={props.onStartLiveScreenFeed} />}
            />
          )}

          {/* Camera */}
          {props.hasCamera && isMessage && (
            <RichMenuItem
              name='Camera'
              color={props.color}
              Icon={CameraAltOutlinedIcon}
              description='Capture photos with optional OCR'
              onClick={props.onOpenCamera}
              endAction={!isMessage && props.onStartLiveCameraFeed && <LiveFeedButton isActive={!!props.hasActiveCameraFeed} tooltip='Live Camera chat' onClick={props.onStartLiveCameraFeed} />}
            />
          )}

        </RichMenu>
      </Dropdown>

      {/* [mobile] Responsive Camera OCR button */}
      {props.hasCamera && !isMessage && <ButtonAttachCameraMemo isMobile color={props.color} onOpenCamera={props.onOpenCamera} />}

    </>;
  }


  // menu-rich mode (desktop) - labeled button trigger with animated, descriptive menu items
  return (
    <Dropdown>

      <RichMenuButton
        icon={<AddRoundedIcon />}
        label='Attach'
        color={props.color}
        standOut={props.richButtonStandOut}
      />

      <RichMenu stagger color={props.color}>

        {/* File Attachment */}
        <RichMenuItem
          name={props.onlyImages ? 'Images' : 'Files'}
          Icon={AttachFileRoundedIcon}
          description={props.onlyImages ? 'PNG, JPG, WEBP images to edit' : 'PDF, DOCX, images, code'}
          onClick={handleAttachFilePicker}
        />

        {/* Web/URL Attachment */}
        {!props.onlyImages && /*props.canBrowse &&*/ (
          <RichMenuItem
            name='Web'
            Icon={LanguageRoundedIcon}
            description='Import web pages, including screenshots'
            onClick={props.onOpenWebInput}
            disabled={!props.canBrowse}
          />
        )}

        {/* Google Drive Attachment */}
        {!props.onlyImages && hasGoogleDriveCapability && !!props.onOpenGoogleDrivePicker && (
          <RichMenuItem
            name='Drive'
            Icon={AddToDriveRoundedIcon}
            description='Attach Google Drive files'
            onClick={props.onOpenGoogleDrivePicker}
          />
        )}

        {/* Clipboard Attachment */}
        {!props.onlyImages && supportsClipboardRead() && (
          <RichMenuItem
            name='Clipboard'
            Icon={ContentPasteGoIcon}
            // description='Auto-converts images and text to the best format'
            description='Auto-adapts images and text'
            onClick={props.onAttachClipboard}
          />
        )}

        {/*{!props.onlyImages && props.canBrowse && (*/}
        {/*  <ListItem>*/}
        {/*    <ListItemDecorator />*/}
        {/*    <Checkbox*/}
        {/*      size='sm'*/}
        {/*      color='neutral'*/}
        {/*      // checked={enableComposerAttach}*/}
        {/*      // onChange={handleToggle}*/}
        {/*      onClick={(event) => event.stopPropagation()}*/}
        {/*      sx={{ ml: 0.375 }}*/}
        {/*      slotProps={{*/}
        {/*        label: {*/}
        {/*          sx: {*/}
        {/*            fontSize: 'sm',*/}
        {/*            fontWeight: 'md',*/}
        {/*          },*/}
        {/*        },*/}
        {/*      }}*/}
        {/*      label='Download and attach links'*/}
        {/*    />*/}
        {/*  </ListItem>*/}
        {/*)}*/}


        {/* Divider before labs features */}
        {(props.hasScreenCapture || props.hasCamera) && <ListDivider inset='gutter' sx={{ my: 1 }} />}

        {/* Screen Capture */}
        {props.hasScreenCapture && (
          <RichMenuItem
            name='Screen'
            Icon={ScreenshotMonitorIcon}
            description={screenCaptureError ? `Error: ${screenCaptureError}` : 'Capture tabs, apps, and screens'}
            onClick={handleTakeScreenCapture}
            disabled={capturingScreen}
            color={screenCaptureError ? 'danger' : undefined}
            endAction={props.onStartLiveScreenFeed && <LiveFeedButton isActive={!!props.hasActiveScreenFeed} tooltip='Live Screen chat' onClick={props.onStartLiveScreenFeed} />}
          />
        )}

        {/* Camera */}
        {props.hasCamera && (
          <RichMenuItem
            name='Camera'
            Icon={CameraAltOutlinedIcon}
            description='Capture photos with optional OCR'
            onClick={props.onOpenCamera}
            endAction={props.onStartLiveCameraFeed && <LiveFeedButton isActive={!!props.hasActiveCameraFeed} tooltip='Live Camera chat' onClick={props.onStartLiveCameraFeed} />}
          />
        )}

        {/* URL Auto-Download Toggle - only show when browse capability exists */}
        {!props.onlyImages && props.canBrowse && (
          <AutoDownloadToggle />
        )}

      </RichMenu>
    </Dropdown>
  );
}
