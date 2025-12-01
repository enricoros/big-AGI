/**
 * SpeexEngineSettings - TTS engine selection and configuration
 *
 * Provides:
 * - Chip-based engine selection with visual status
 * - Add Service dropdown menu
 * - Per-engine voice configuration in a Card
 */

import * as React from 'react';

import { Box, Button, Chip, Dropdown, ListItemDecorator, Menu, MenuButton, MenuItem, SvgIconProps, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LinkIcon from '@mui/icons-material/Link';

import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ElevenLabsIcon } from '~/common/components/icons/vendors/ElevenLabsIcon';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { LocalAIIcon } from '~/common/components/icons/vendors/LocalAIIcon';
import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';

import type { DSpeexEngineAny, DSpeexVendorType } from '../speex.types';
import { SpeexConfigureEngineFull } from './SpeexConfigureEngineFull';
import { speexAreCredentialsValid, useSpeexEngines, useSpeexGlobalEngine, useSpeexStore } from '../store-module-speex';


const _styles = {
  menu: {
    zIndex: themeZIndexOverMobileDrawer,
    minWidth: 220,
    '--List-padding': '0.75rem',
    borderRadius: 'xl',
    boxShadow: 'md',
  },
  menuButton: {
    ml: 'auto',
    // borderRadius: '1.5rem',
    // borderColor: 'neutral.outlinedBorder', // like ModeServiceSelector's Add button
    // minWidth: 150,
    textWrap: 'nowrap',
    // '&[aria-expanded="true"]': {
    //   borderBottomRightRadius: 0,
    //   borderBottomLeftRadius: 0,
    //   // color: 'neutral.softColor',
    //   // backgroundColor: 'neutral.softHoverBg',
    // },
  },
  menuItem: {
    py: 1,
    px: 1,
    borderRadius: 'md',
    minHeight: 56,
  },
  menuItemContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.125,
  },
  menuItemName: {
    fontWeight: 600,
  },
  menuItemDescription: {
    fontWeight: 400,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
  },
  chip: {
    px: 1.5,
    minHeight: '2rem',
    // borderRadius: 'md',
    // boxShadow: 'sm',
  },
  chipUnconfigured: {
    px: 1.5,
    minHeight: '2rem',
    // borderRadius: 'md',
    // color: 'text.tertiary',
    opacity: 0.6,
  },
  chipSymbol: {
    ml: -0.75,
    mr: 0.5,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: 'background.surface',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
} as const;


const ADDABLE_VENDORS: { vendorType: DSpeexVendorType; label: string; description: string, icon?: React.FunctionComponent<SvgIconProps> }[] = [
  { vendorType: 'elevenlabs', label: 'ElevenLabs', description: 'Premium voices', icon: ElevenLabsIcon },
  { vendorType: 'localai', label: 'LocalAI', description: 'Self-hosted TTS', icon: LocalAIIcon },
  { vendorType: 'openai', label: 'OpenAI TTS', description: 'Reliable', icon: OpenAIIcon },
] as const;


export function SpeexConfigureEngines(_props: { isMobile: boolean }) {

  // state
  const [isEditing, setIsEditing] = React.useState(false);
  const [confirmDeleteEngine, setConfirmDeleteEngine] = React.useState<DSpeexEngineAny | null>(null);

  // external state - module
  const engines = useSpeexEngines();
  const activeEngine = useSpeexGlobalEngine(); // auto-select the highest priority, if the user choice (active engine) is missing
  const activeEngineId = activeEngine?.engineId ?? null;
  const activeEngineValid = !activeEngine ? false : speexAreCredentialsValid(activeEngine.credentials);


  // derived state
  const hasEngines = engines.length > 0;
  const canDeleteActiveEngine = activeEngine && !activeEngine.isAutoDetected && !activeEngine.isAutoLinked;


  // handlers

  const handleEngineSelect = React.useCallback((engineId: string | null) => {
    setIsEditing(true);
    useSpeexStore.getState().setActiveEngineId(engineId);
  }, []);

  const handleEngineUpdate = React.useCallback((updates: Partial<DSpeexEngineAny>) => {
    if (activeEngineId)
      useSpeexStore.getState().updateEngine(activeEngineId, updates);
  }, [activeEngineId]);

  const handleAddEngine = React.useCallback((vendorType: DSpeexVendorType) => {
    const newEngineId = useSpeexStore.getState().createEngine(vendorType);
    useSpeexStore.getState().setActiveEngineId(newEngineId);
  }, []);

  const handleDeleteClick = React.useCallback((event: React.MouseEvent) => {
    if (!activeEngine || !canDeleteActiveEngine) return;

    // shift+click skips confirmation
    if (event.shiftKey)
      return useSpeexStore.getState().deleteEngine(activeEngine.engineId);

    setConfirmDeleteEngine(activeEngine);
  }, [activeEngine, canDeleteActiveEngine]);

  const handleConfirmDelete = React.useCallback(() => {
    if (!confirmDeleteEngine) return;

    useSpeexStore.getState().deleteEngine(confirmDeleteEngine.engineId);

    setConfirmDeleteEngine(null);
  }, [confirmDeleteEngine]);

  const handleCancelDelete = React.useCallback(() => {
    setConfirmDeleteEngine(null);
  }, []);


  return <>

    {/* "Voice Engine" + Add Service dropdown */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

      <FormLabelStart
        // title='Voice Engine'
        title='Active Engine'
        description={activeEngine ? activeEngine.label : 'Select a voice provider'}
      />


      {/* -> Add Service */}
      <Dropdown>
        <MenuButton size='sm' variant={!activeEngine ? 'solid' : 'outlined'} startDecorator={<AddIcon />} sx={_styles.menuButton}>
          Add
          {/*  Add Service*/}
        </MenuButton>
        {/*<MenuButton size='sm' color='primary' variant={!activeEngine ? 'solid' : 'outlined'} startDecorator={<AddIcon />} sx={_styles.menuButton}>*/}
        {/*  Add*/}
        {/*  /!*  Add Service*!/*/}
        {/*</MenuButton>*/}
        <Menu placement='bottom' popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [-12, -2] } }] }} sx={_styles.menu}>
          {ADDABLE_VENDORS.map(vendor => (
            <MenuItem key={vendor.vendorType} onClick={() => handleAddEngine(vendor.vendorType)} sx={_styles.menuItem}>
              <ListItemDecorator>
                {vendor.icon ? <vendor.icon /> : null}
              </ListItemDecorator>
              <Box sx={_styles.menuItemContent}>
                <Typography level='title-md' sx={_styles.menuItemName}>{vendor.label}</Typography>
                <Typography level='body-sm' sx={_styles.menuItemDescription}>{vendor.description}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </Dropdown>

    </Box>

    {/* Engine Chips row */}
    {hasEngines && (
      <Box sx={_styles.chipRow}>
        {engines.map(engine => {
          const isActive = engine.engineId === activeEngineId;
          const isConfigured = speexAreCredentialsValid(engine.credentials);

          return (
            <TooltipOutlined key={engine.engineId} title={isActive ? 'Global application voice' : isConfigured ? 'Click to activate' : 'Needs configuration'}>
              <Chip
                variant={isActive ? 'solid' : 'outlined'}
                color={!isActive ? 'neutral' : !isConfigured ? 'danger' : 'neutral'}
                // startDecorator={isActive && <Box sx={_styles.chipSymbol}>
                //   <CheckRoundedIcon sx={{ fontSize: 16, color: 'text.primary' }} />
                // </Box>}
                endDecorator={engine.isAutoLinked && <LinkIcon sx={{ fontSize: 16 }} />}
                onClick={event => {
                  handleEngineSelect(event.shiftKey ? null : engine.engineId);
                  event.shiftKey && setIsEditing(false);
                }}
                sx={isConfigured ? _styles.chip : _styles.chipUnconfigured}
              >
                {engine.label}
              </Chip>
            </TooltipOutlined>
          );
        })}

        {/* Editing: just a way to remove clutter */}
        {!!engines.length && !isEditing && (
          <Button
            size='sm'
            variant='plain'
            color='neutral'
            startDecorator={<EditRoundedIcon />}
            onClick={() => setIsEditing(true)}
            sx={{ ml: 'auto' }}
          >
            {_props.isMobile ? 'Edit' : 'Edit Engine'}
          </Button>
        )}

      </Box>
    )}

    {/* Active engine (specific) full configuration */}
    {activeEngine && isEditing && (
      <SpeexConfigureEngineFull
        engine={activeEngine}
        isMobile={_props.isMobile}
        mode={activeEngine.isAutoLinked || activeEngine.isAutoDetected ? 'voice-only' : 'full'}
        bottomStart={
          !canDeleteActiveEngine ? (
            <Chip size='sm' color={!activeEngineValid ? 'danger' : undefined} variant='soft' sx={{ px: 1.5, py: 0.5 }} startDecorator={activeEngineValid && activeEngine.isAutoLinked && <LinkIcon sx={{ fontSize: 14 }} />}>
              {!activeEngineValid ? (activeEngine.isAutoLinked ? 'Linked to AI Service' : 'Invalid Configuration')
                : activeEngine.isAutoLinked ? 'Linked to AI Service'
                  : activeEngine.isAutoDetected ? 'System'
                    : 'Configured Manually'}
            </Chip>
          ) : (
            // <GoodTooltip title='Delete this service'>
            <Button
              size='sm'
              color='neutral'
              variant='plain'
              onClick={handleDeleteClick}
              startDecorator={<DeleteOutlineIcon />}
              // sx={{ minWidth: 120 }}
            >
              Delete
            </Button>
            // </GoodTooltip>
          )}
        onUpdate={handleEngineUpdate}
      />
    )}

    {/* Empty state */}
    {!hasEngines && (
      <Typography level='body-sm' sx={{ color: 'text.tertiary' }}>
        No voice engines available. Configure an OpenAI-compatible AI service to auto-link TTS, or add ElevenLabs for premium voices.
      </Typography>
    )}

    {/* Delete Confirmation Modal */}
    {!!confirmDeleteEngine && (
      <ConfirmationModal
        open
        onClose={handleCancelDelete}
        onPositive={handleConfirmDelete}
        lowStakes
        noTitleBar
        confirmationText={<>Remove <strong>{confirmDeleteEngine.label}</strong>? This cannot be undone.</>}
        positiveActionText='Remove'
      />
    )}

  </>;
}
