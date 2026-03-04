import * as React from 'react';
import { keyframes } from '@emotion/react';
import type { FileWithHandle } from 'browser-fs-access';

import { Box, Button, Checkbox, ColorPaletteProp, Divider, Dropdown, IconButton, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddToDriveRoundedIcon from '@mui/icons-material/AddToDriveRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';

import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import { ButtonAttachFilesMemo, openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { supportsClipboardRead } from '~/common/util/clipboardUtils';
import { takeScreenCapture } from '~/common/util/screenCaptureUtils';

import { ButtonAttachCameraMemo } from './ButtonAttachCamera';
import { ButtonAttachClipboardMemo } from './ButtonAttachClipboard';
import { ButtonAttachGoogleDriveMemo } from './ButtonAttachGoogleDrive';
import { ButtonAttachScreenCaptureMemo } from './ButtonAttachScreenCapture';
import { ButtonAttachWebMemo } from './ButtonAttachWeb';
import { hasGoogleDriveCapability } from './useGoogleDrivePicker';


// configuration
export const ATTACH_BUTTON_RADIUS = '18px'; // for the rich (non-compact) menu button


// animations for the rich (non-compact) menu
const animationMenu = keyframes` from {opacity: 0;} to {opacity: 1;}`;
const animationMenuItem = keyframes` from {opacity: 0;transform: translateY(-6px);} to {opacity: 1;transform: translateY(0);}`;

const _style = {
  menuItem: {
    py: 1,
    // pl: 3,
    // pr: 2,
    minHeight: 60,
  } as const,
  menuItemContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.125,
  } as const,
  menuItemName: {
    typography: 'title-sm',
    fontWeight: 600,
    // fontSize: '15px',
  } as const,
  menuItemDescription: {
    fontSize: 'xs',
    color: 'text.tertiary',
    fontWeight: 400,
  } as const,
};


// Rich menu item (used in menu-rich mode)
function RichMenuItem(props: {
  name: React.ReactNode;
  description: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  delay?: number;
  disabled?: boolean;
  color?: ColorPaletteProp;
}) {
  return (
    <MenuItem
      onClick={props.onClick}
      disabled={props.disabled}
      color={props.color}
      sx={!props.delay ? _style.menuItem : {
        ..._style.menuItem,
        animation: `${animationMenuItem} 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${props.delay}s both`,
      }}
    >
      <ListItemDecorator>
        {props.icon}
      </ListItemDecorator>
      <Box sx={_style.menuItemContent}>
        <Box sx={_style.menuItemName}>
          {props.name}
        </Box>
        <Box sx={_style.menuItemDescription}>
          {props.description}
        </Box>
      </Box>
    </MenuItem>
  );
}


// Auto-download toggle (shown when browsing capability exists)
function AutoDownloadToggle(props: { delay?: number }) {

  // external state
  const enableComposerAttach = useBrowseStore(s => s.enableComposerAttach);

  const handleToggle = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    useBrowseStore.getState().setEnableComposerAttach(event.target.checked);
  }, []);

  return <>

    <Divider sx={{ my: 0.5 }} />

    <ListItem
      sx={{
        ..._style.menuItem,
        animation: `${animationMenuItem} 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${props.delay}s both`,
      }}
      // onClick={(event) => {
      //   event.preventDefault();
      //   event.stopPropagation();
      //   setEnableComposerAttach(!enableComposerAttach);
      // }}
    >
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
      <Box sx={_style.menuItemContent}>
        <Box sx={{ typography: 'title-sm' }}>
          Attach pasted URLs
        </Box>
        <Box sx={_style.menuItemDescription}>
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
 * - **menu-compact**: Mobile-style — icon trigger, simple MenuItems (no descriptions/animations)
 * - **menu-rich**: Desktop-style — labeled button trigger, rich items with descriptions and animations
 * - **inline-buttons**: Individual source buttons rendered inline (no dropdown)
 */
export const AttachmentSourcesMemo = React.memo(AttachmentSources);

function AttachmentSources(props: {
  // mode
  mode: 'menu-compact' | 'menu-rich' | 'inline-buttons' | 'menu-message',
  color?: ColorPaletteProp, // menu-rich and inline-buttons
  richButtonStandOut?: boolean, // menu-rich only
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
}) {

  // state (screen capture — used in menu modes where the component handles the capture)
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


  // inline-buttons mode — individual buttons rendered flat (no dropdown)
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


  // menu-compact mode (mobile) — simple icon trigger with flat menu items
  if (props.mode === 'menu-compact' || props.mode === 'menu-message') {
    const isMessage = props.mode === 'menu-message';
    return <>

      <Dropdown>
        {!isMessage ? (
          <MenuButton slots={{ root: IconButton }}>
            <AddRoundedIcon />
          </MenuButton>
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
        <Menu sx={{ '--List-padding': '0.5rem' }}>

          {/* Files */}
          {/*<MenuItem onClick={handleAttachFilePicker}>*/}
          {/*  <ListItemDecorator><AttachFileRoundedIcon /></ListItemDecorator>*/}
          {/*  {props.onlyImages ? 'Images' : 'File'}*/}
          {/*</MenuItem>*/}
          <RichMenuItem name={props.onlyImages ? 'Images' : 'Files'} description='PDF, DOCX, images, code' color={props.color} icon={<AttachFileRoundedIcon />} onClick={handleAttachFilePicker} />

          {/* Web */}
          {!props.onlyImages && /*props.canBrowse &&*/ (
            // <MenuItem onClick={props.onOpenWebInput} disabled={!props.canBrowse}>
            //   <ListItemDecorator><LanguageRoundedIcon /></ListItemDecorator>
            //   Web
            // </MenuItem>
            <RichMenuItem name='Web' description='Import from web pages' color={props.color} icon={<LanguageRoundedIcon />} onClick={props.onOpenWebInput} disabled={!props.canBrowse} />
          )}

          {/* Google Drive */}
          {!props.onlyImages && hasGoogleDriveCapability && !!props.onOpenGoogleDrivePicker && (
            // <MenuItem onClick={props.onOpenGoogleDrivePicker}>
            //   <ListItemDecorator><AddToDriveRoundedIcon /></ListItemDecorator>
            //   Drive
            // </MenuItem>
            <RichMenuItem name='Drive' description='Attach Google Drive files' color={props.color} icon={<AddToDriveRoundedIcon />} onClick={props.onOpenGoogleDrivePicker} />
          )}

          {/* Clipboard */}
          {!props.onlyImages && supportsClipboardRead() && (
            // <MenuItem onClick={props.onAttachClipboard}>
            //   <ListItemDecorator><ContentPasteGoIcon /></ListItemDecorator>
            //   Paste
            // </MenuItem>
            <RichMenuItem name='Clipboard' description='Auto-convert to the best format' color={props.color} icon={<ContentPasteGoIcon />} onClick={props.onAttachClipboard} />
          )}

          {/* Screen Capture */}
          {props.hasScreenCapture && (
            // <MenuItem onClick={handleTakeScreenCapture} disabled={capturingScreen}>
            //   <ListItemDecorator><ScreenshotMonitorIcon /></ListItemDecorator>
            //   Screen
            // </MenuItem>
            <RichMenuItem name='Screen' description={screenCaptureError ? `Error: ${screenCaptureError}` : 'Capture windows, tabs, or screens'} color={screenCaptureError ? 'danger' : props.color} icon={<ScreenshotMonitorIcon />} onClick={handleTakeScreenCapture} disabled={capturingScreen} />
          )}

          {/* Camera */}
          {props.hasCamera && isMessage && (
            // <MenuItem onClick={props.onOpenCamera}>
            //   <ListItemDecorator><CameraAltOutlinedIcon /></ListItemDecorator>
            //   Camera
            // </MenuItem>
            <RichMenuItem name='Camera' description='Capture photos and optional OCR' color={props.color} icon={<CameraAltOutlinedIcon />} onClick={props.onOpenCamera} />
          )}

        </Menu>
      </Dropdown>

      {/* [mobile] Responsive Camera OCR button */}
      {props.hasCamera && !isMessage && <ButtonAttachCameraMemo isMobile color={props.color} onOpenCamera={props.onOpenCamera} />}

    </>;
  }


  // menu-rich mode (desktop) — labeled button trigger with animated, descriptive menu items
  return (
    <Dropdown>
      <MenuButton
        slots={{ root: Button }}
        slotProps={{
          root: {
            // size: 'sm',
            variant: 'plain',
            color: props.color,
            startDecorator: <AddRoundedIcon />,
            fullWidth: true, // to match other buttons in the col
            sx: {
              minWidth: 100,
              justifyContent: 'flex-start',
              borderRadius: ATTACH_BUTTON_RADIUS,
              textWrap: 'nowrap',
              ...(props.richButtonStandOut && {
                backgroundColor: 'background.popup',
                border: '1px solid',
                borderColor: `${props.color || 'neutral'}.outlinedBorder`,
              }),
              // when aria-expanded is true (menu open), remove top border radius
              '&[aria-expanded="true"]': {
                borderTopRightRadius: 0,
                borderTopLeftRadius: 0,
                backgroundColor: `${props.color || 'neutral'}.softHoverBg`,
              },
            },
          },
        }}
      >
        Attach
      </MenuButton>

      <Menu
        // variant='soft'
        color={props.color}
        placement='top-start'
        popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [-10 /* 62 */, -2] } }] }}
        sx={{
          minWidth: 280,
          '--List-padding': '0.5rem',
          animation: `${animationMenu} 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          // boxShadow: '0 16px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
          boxShadow: 'md',
          borderRadius: ATTACH_BUTTON_RADIUS,
          border: '1px solid',
          borderColor: `${props.color || 'neutral'}.outlinedBorder`,
          backgroundColor: 'background.popup',
          overflow: 'hidden',
        }}
      >

        {/* File Attachment */}
        <RichMenuItem
          name={props.onlyImages ? 'Images' : 'Files'}
          icon={<AttachFileRoundedIcon />}
          description={props.onlyImages ? 'PNG, JPG, WEBP images to edit' : 'PDF, DOCX, images, code'}
          onClick={handleAttachFilePicker}
          delay={0}
        />

        {/* Web/URL Attachment */}
        {!props.onlyImages && /*props.canBrowse &&*/ (
          <RichMenuItem
            name='Web'
            icon={<LanguageRoundedIcon />}
            description='Import from websites, including screenshots'
            onClick={props.onOpenWebInput}
            disabled={!props.canBrowse}
            delay={0.02}
          />
        )}

        {/* Google Drive Attachment */}
        {!props.onlyImages && hasGoogleDriveCapability && !!props.onOpenGoogleDrivePicker && (
          <RichMenuItem
            name='Drive'
            icon={<AddToDriveRoundedIcon />}
            description='Attach Google Drive files'
            onClick={props.onOpenGoogleDrivePicker}
            delay={0.04}
          />
        )}

        {/* Clipboard Attachment */}
        {!props.onlyImages && supportsClipboardRead() && (
          <RichMenuItem
            name='Clipboard'
            icon={<ContentPasteGoIcon />}
            description='Auto-converts images and text to the best format'
            onClick={props.onAttachClipboard}
            delay={0.06}
          />
        )}

        {/* Divider before labs features */}
        {(props.hasScreenCapture || props.hasCamera) && <Divider sx={{ my: 0.5 }} />}

        {/* Screen Capture */}
        {props.hasScreenCapture && (
          <RichMenuItem
            name='Screen'
            icon={<ScreenshotMonitorIcon />}
            description={screenCaptureError ? `Error: ${screenCaptureError}` : 'Capture windows, tabs, or screens'}
            onClick={handleTakeScreenCapture}
            disabled={capturingScreen}
            color={screenCaptureError ? 'danger' : undefined}
            delay={0.08}
          />
        )}

        {/* Camera */}
        {props.hasCamera && (
          <RichMenuItem
            name='Camera'
            icon={<CameraAltOutlinedIcon />}
            description='Capture photos with optional text recognition'
            onClick={props.onOpenCamera}
            delay={0.1}
          />
        )}

        {/* URL Auto-Download Toggle - only show when browse capability exists */}
        {!props.onlyImages && props.canBrowse && (
          <AutoDownloadToggle delay={0.12} />
        )}

      </Menu>
    </Dropdown>
  );
}
