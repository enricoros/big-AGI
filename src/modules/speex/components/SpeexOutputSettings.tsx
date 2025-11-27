/**
 * SpeexOutputSettings - Voice output settings for the Settings Modal
 *
 * Provides:
 * - Engine selection dropdown with Add/Delete controls
 * - Per-engine voice configuration
 * - Auto-speak toggle (from chat settings)
 */

import * as React from 'react';

import { Box, Button, FormControl, FormHelperText, IconButton, ListItemDecorator, MenuItem, Option, Select, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { useChatAutoAI } from '../../../apps/chat/store-app-chat';

import { CloseablePopup } from '~/common/components/CloseablePopup';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';

import type { DSpeexEngineAny, DSpeexVendorType } from '../speex.types';
import { SpeexEngineConfig } from './SpeexEngineConfig';
import { useSpeexActiveEngineId, useSpeexEngines, useSpeexStore } from '../store-module-speex';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';


// Vendor options for the Add menu
const ADDABLE_VENDORS: { vendorType: DSpeexVendorType; label: string; description: string }[] = [
  { vendorType: 'elevenlabs', label: 'ElevenLabs', description: 'High-quality voices' },
  { vendorType: 'openai', label: 'OpenAI TTS', description: 'Fast and reliable' },
  { vendorType: 'localai', label: 'LocalAI', description: 'Self-hosted TTS' },
];


export function SpeexOutputSettings() {

  // state
  const [addMenuAnchor, setAddMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [confirmDeleteEngine, setConfirmDeleteEngine] = React.useState<DSpeexEngineAny | null>(null);

  // external state
  const { autoSpeak, setAutoSpeak } = useChatAutoAI();

  // external state - module
  const engines = useSpeexEngines();
  const activeEngineId = useSpeexActiveEngineId();


  // derived state
  const hasEngines = engines.length > 0;
  const activeEngine = engines.find(e => e.engineId === activeEngineId);
  const canDeleteActiveEngine = activeEngine && !activeEngine.isAutoDetected && !activeEngine.isAutoLinked;


  // handlers

  const handleEngineChange = React.useCallback((_: unknown, value: string | null) => {
    useSpeexStore.getState().setActiveEngineId(value || null);
  }, []);

  const handleEngineUpdate = React.useCallback((updates: Partial<DSpeexEngineAny>) => {
    if (activeEngineId)
      useSpeexStore.getState().updateEngine(activeEngineId, updates);
  }, [activeEngineId]);


  // Add engine handlers

  const handleOpenAddMenu = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setAddMenuAnchor(event.currentTarget);
  }, []);

  const handleCloseAddMenu = React.useCallback(() => {
    setAddMenuAnchor(null);
  }, []);

  const handleAddEngine = React.useCallback((vendorType: DSpeexVendorType) => {
    handleCloseAddMenu();
    const newEngineId = useSpeexStore.getState().createEngine(vendorType);
    useSpeexStore.getState().setActiveEngineId(newEngineId);
  }, [handleCloseAddMenu]);


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

    {/* Voice Engine label + Add button */}
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice Engine' description='TTS provider' />
      <Button
        size='sm'
        variant='outlined'
        color='neutral'
        startDecorator={<AddIcon />}
        onClick={handleOpenAddMenu}
      >
        Add
      </Button>
    </FormControl>

    {/* Add Engine Popup Menu */}
    <CloseablePopup
      menu
      anchorEl={addMenuAnchor}
      onClose={handleCloseAddMenu}
      placement='bottom-end'
      minWidth={200}
      zIndex={themeZIndexOverMobileDrawer}
    >
      {ADDABLE_VENDORS.map(vendor => (
        <MenuItem key={vendor.vendorType} onClick={() => handleAddEngine(vendor.vendorType)}>
          <ListItemDecorator />
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography level='title-sm'>{vendor.label}</Typography>
            <Typography level='body-xs'>{vendor.description}</Typography>
          </Box>
        </MenuItem>
      ))}
    </CloseablePopup>

    {/* Engine selection + Delete button */}
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Select
        value={activeEngineId || ''}
        onChange={handleEngineChange}
        placeholder={hasEngines ? 'Select engine' : 'No engines available'}
        disabled={!hasEngines}
        sx={{ flex: 1, minWidth: 200 }}
      >
        {engines.map(engine => (
          <Option key={engine.engineId} value={engine.engineId}>
            {engine.label}
            {engine.isAutoLinked && <Typography level='body-xs' sx={{ ml: 1, opacity: 0.6 }}>(linked)</Typography>}
          </Option>
        ))}
      </Select>

      <IconButton
        size='sm'
        variant='plain'
        color='neutral'
        disabled={!canDeleteActiveEngine}
        onClick={handleDeleteClick}
        sx={{ opacity: canDeleteActiveEngine ? 1 : 0.4 }}
      >
        <DeleteOutlineIcon />
      </IconButton>
    </Box>

    {/* Engine-specific configuration */}
    {activeEngine ? (
      <SpeexEngineConfig
        engine={activeEngine}
        onUpdate={handleEngineUpdate}
        mode={activeEngine.isAutoLinked || activeEngine.isAutoDetected ? 'voice-only' : 'full'}
      />
    ) : (
      <FormHelperText>
        {hasEngines
          ? 'Select a voice engine to configure its voice settings.'
          : 'No voice engines detected. Voice engines are auto-detected from your LLM services (OpenAI) or browser (System Voice).'}
      </FormHelperText>
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
