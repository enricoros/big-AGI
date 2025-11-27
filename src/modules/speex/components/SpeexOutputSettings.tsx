/**
 * SpeexOutputSettings - Voice output settings for the Settings Modal
 *
 * Provides:
 * - Chip-based engine selection with visual status
 * - Add Service dropdown menu
 * - Per-engine voice configuration in a Card
 * - Auto-speak toggle (from chat settings)
 */

import * as React from 'react';

import { Box, Card, Chip, Dropdown, IconButton, ListItemDecorator, Menu, MenuButton, MenuItem, Stack, SvgIconProps, Typography } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { useChatAutoAI } from '../../../apps/chat/store-app-chat';

import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { LocalAIIcon } from '~/common/components/icons/vendors/LocalAIIcon';
import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';

import type { DSpeexEngineAny, DSpeexVendorType } from '../speex.types';
import { SpeexEngineConfig } from './SpeexEngineConfig';
import { speexAreCredentialsValid, useSpeexEngines, useSpeexGlobalEngine, useSpeexStore } from '../store-module-speex';


const _style = {
  menu: {
    zIndex: themeZIndexOverMobileDrawer,
    minWidth: 220,
    '--List-padding': '0.75rem',
    borderRadius: 'xl',
    boxShadow: 'md',
  },
  menuButton: {
    // minWidth: 150,
    textWrap: 'nowrap',
    '&[aria-expanded="true"]': {
      borderBottomRightRadius: 0,
      borderBottomLeftRadius: 0,
      // color: 'neutral.softColor',
      // backgroundColor: 'neutral.softHoverBg',
    },
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
    borderRadius: 'md',
    // boxShadow: 'sm',
  },
  chipUnconfigured: {
    px: 1.5,
    minHeight: '2rem',
    borderRadius: 'md',
    // color: 'text.tertiary',
    opacity: 0.6,
  },
  chipSymbol: {
    ml: -0.75,
    mr: 0.5,
    width: 20,
    height: 20,
    borderRadius: 'sm',
    backgroundColor: 'background.surface',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
} as const;


const ADDABLE_VENDORS: { vendorType: DSpeexVendorType; label: string; description: string, icon?: React.FunctionComponent<SvgIconProps> }[] = [
  { vendorType: 'elevenlabs', label: 'ElevenLabs', description: 'Premium voice synthesis' },
  { vendorType: 'openai', label: 'OpenAI TTS', description: 'Fast and reliable', icon: OpenAIIcon },
  { vendorType: 'localai', label: 'LocalAI', description: 'Self-hosted TTS', icon: LocalAIIcon },
] as const;


export function SpeexOutputSettings() {

  // state
  const [confirmDeleteEngine, setConfirmDeleteEngine] = React.useState<DSpeexEngineAny | null>(null);

  // external state
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();

  // external state - module
  const engines = useSpeexEngines();
  const activeEngine = useSpeexGlobalEngine(); // auto-select the highest priority, if the user choice (active engine) is missing
  const activeEngineId = activeEngine?.engineId ?? null;


  // derived state
  const hasEngines = engines.length > 0;
  const canDeleteActiveEngine = activeEngine && !activeEngine.isAutoDetected && !activeEngine.isAutoLinked;


  // handlers

  const handleEngineSelect = React.useCallback((engineId: string | null) => {
    useSpeexStore.getState().setActiveEngineId(engineId);
  }, []);

  const handleEngineUpdate = React.useCallback((updates: Partial<DSpeexEngineAny>) => {
    if (activeEngineId)
      useSpeexStore.getState().updateEngine(activeEngineId, updates);
  }, [activeEngineId]);


  // Add engine handlers

  const handleAddEngine = React.useCallback((vendorType: DSpeexVendorType) => {
    const newEngineId = useSpeexStore.getState().createEngine(vendorType);
    useSpeexStore.getState().setActiveEngineId(newEngineId);
  }, []);


  // Delete engine handlers

  const handleDeleteClick = React.useCallback((event: React.MouseEvent) => {
    if (!activeEngine || !canDeleteActiveEngine) return;

    // Shift+click skips confirmation
    if (event.shiftKey) {
      useSpeexStore.getState().deleteEngine(activeEngine.engineId);
      // Auto-select next available engine
      const remaining = engines.filter(e => e.engineId !== activeEngine.engineId);
      useSpeexStore.getState().setActiveEngineId(remaining[0]?.engineId ?? null);
    } else {
      setConfirmDeleteEngine(activeEngine);
    }
  }, [activeEngine, canDeleteActiveEngine, engines]);

  const handleConfirmDelete = React.useCallback(() => {
    if (!confirmDeleteEngine) return;

    useSpeexStore.getState().deleteEngine(confirmDeleteEngine.engineId);
    // Auto-select next available engine
    const remaining = engines.filter(e => e.engineId !== confirmDeleteEngine.engineId);
    useSpeexStore.getState().setActiveEngineId(remaining[0]?.engineId ?? null);
    setConfirmDeleteEngine(null);
  }, [confirmDeleteEngine, engines]);

  const handleCancelDelete = React.useCallback(() => {
    setConfirmDeleteEngine(null);
  }, []);


  return <>

    {/* Auto-speak setting */}
    <FormRadioControl
      title='Speak Responses'
      description={autoSpeak === 'off' ? 'Off' : autoSpeak === 'firstLine' ? 'First paragraph' : 'Full response'}
      tooltip={!hasEngines ? 'No voice engines available. Configure a TTS service or use system voice.' : undefined}
      disabled={!hasEngines}
      options={[
        { value: 'off', label: 'Off' },
        { value: 'firstLine', label: 'Start' },
        { value: 'all', label: 'Full' },
      ]}
      value={autoSpeak} onChange={setAutoSpeak}
    />


    {/* Voice Engine label + Add Service dropdown */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

      {/* Voice Engine label */}
      <FormLabelStart
        title='Voice Engine'
        description={activeEngine ? activeEngine.label : 'Select a voice provider'}
      />

      {/* -> Add Service */}
      <Dropdown>
        <MenuButton size='sm' color='neutral' variant='solid' startDecorator={<AddRoundedIcon />} sx={_style.menuButton}>
          Add Service
        </MenuButton>
        <Menu placement='bottom' popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [-12, -2] } }] }} sx={_style.menu}>
          {ADDABLE_VENDORS.map(vendor => (
            <MenuItem key={vendor.vendorType} onClick={() => handleAddEngine(vendor.vendorType)} sx={_style.menuItem}>
              <ListItemDecorator>
                {vendor.icon ? <vendor.icon /> : null}
              </ListItemDecorator>
              <Box sx={_style.menuItemContent}>
                <Typography level='title-md' sx={_style.menuItemName}>{vendor.label}</Typography>
                <Typography level='body-sm' sx={_style.menuItemDescription}>{vendor.description}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>

      </Dropdown>
    </Box>


    {/* Engine Chips row */}
    {hasEngines && (
      <Box sx={_style.chipRow}>
        {engines.map(engine => {
          const isActive = engine.engineId === activeEngineId;
          const isConfigured = speexAreCredentialsValid(engine.credentials);

          return (
            <TooltipOutlined key={engine.engineId} title={isConfigured ? 'Click to activate' : 'Needs configuration'}>
              <Chip
                variant={isActive ? 'solid' : 'outlined'}
                color={!isActive ? 'neutral' : !isConfigured ? 'danger' : 'neutral'}
                startDecorator={isActive && <Box sx={_style.chipSymbol}>
                  <CheckRoundedIcon sx={{ fontSize: 16, color: 'text.primary' }} />
                </Box>}
                onClick={event => handleEngineSelect(event.shiftKey ? null : engine.engineId)}
                sx={isConfigured ? _style.chip : _style.chipUnconfigured}
              >
                {engine.label}
              </Chip>
            </TooltipOutlined>
          );
        })}
      </Box>
    )}


    {/* Active engine configuration Card */}
    {activeEngine && (
      <Card variant='outlined'>
        <Stack spacing={2}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level='title-sm' sx={{ flex: 1 }}>
              {activeEngine.label}
            </Typography>

            {/*{activeEngine.isAutoDetected && <Chip size='sm' variant='soft' color='primary'>System</Chip>}*/}
            {/*{activeEngine.isAutoLinked && <Chip size='sm' variant='soft'>Auto</Chip>}*/}
            <Chip size='sm' variant='soft'>
              {activeEngine.isAutoLinked ? 'Linked to AI Service' : activeEngine.isAutoDetected ? 'System' : 'Manual Config'}
            </Chip>

            {canDeleteActiveEngine && (
              <GoodTooltip title='Delete this service'>
                <IconButton
                  size='sm'
                  variant='plain'
                  color='danger'
                  onClick={handleDeleteClick}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </GoodTooltip>
            )}
          </Box>

          {/* Engine-specific configuration */}
          <SpeexEngineConfig
            engine={activeEngine}
            onUpdate={handleEngineUpdate}
            mode={activeEngine.isAutoLinked || activeEngine.isAutoDetected ? 'voice-only' : 'full'}
          />
        </Stack>
      </Card>
    )}

    {/* Empty state */}
    {!hasEngines && (
      <Typography level='body-sm' sx={{ color: 'text.tertiary' }}>
        No voice engines detected. Voice engines are auto-detected from your LLM services (OpenAI) or browser (System Voice).
        Click &quot;Add Service&quot; to manually configure a TTS provider.
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
