/**
 * SpeexConfigureEngines - Speech generation engine selection and configuration.
 *
 * Select-driven layout mirroring ASRxConfigureEngines: the Select doubles as
 * "active engine" and "configuration focus" - picking an engine switches both.
 * Below the Select, the per-engine configuration panel (voice parameters +
 * service access expanders) for the selected engine.
 */

import * as React from 'react';

import { Box, IconButton, ListItemDecorator, MenuItem, Option, Select, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';

import { ButtonServiceAdd } from '~/common/components/ButtonServiceAdd';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ElevenLabsIcon } from '~/common/components/icons/vendors/ElevenLabsIcon';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { InworldIcon } from '~/common/components/icons/vendors/InworldIcon';
import { LocalAIIcon } from '~/common/components/icons/vendors/LocalAIIcon';
import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';

import type { DSpeexEngineAny, DSpeexVendorType } from '../speex.types';
import { SpeexConfigureEngineFull } from './SpeexConfigureEngineFull';
import { SpeexSystemTest } from './SpeexSystemTest';
import { speexAreCredentialsValid, useSpeexEngines, useSpeexGlobalEngine, useSpeexStore } from '../store-module-speex';


const VENDOR_INFO: { [key in DSpeexVendorType]: { label: string; description: string; icon: React.ElementType; addable?: boolean } } = {
  elevenlabs: { label: 'ElevenLabs', description: 'Premium voices', icon: ElevenLabsIcon, addable: true },
  inworld: { label: 'Inworld', description: 'Expressive AI voices', icon: InworldIcon, addable: true },
  localai: { label: 'LocalAI', description: 'Self-hosted TTS', icon: LocalAIIcon, addable: true },
  openai: { label: 'OpenAI', description: 'Reliable', icon: OpenAIIcon, addable: true },
  webspeech: { label: 'System Voice', description: 'Browser built-in', icon: RecordVoiceOverRoundedIcon },
} as const;


const _styles = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectGroup: {
    flex: { xs: 1, sm: 0 },
    display: 'flex',
    gap: 1,
    alignItems: 'center',
  },
  addMenu: {
    zIndex: themeZIndexOverMobileDrawer,
    minWidth: 220,
    '--List-padding': '0.75rem',
    borderRadius: 'xl',
    boxShadow: 'md',
  },
  addMenuItem: {
    py: 1,
    px: 1,
    borderRadius: 'md',
    minHeight: 56,
  },
  addMenuItemContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.125,
  },
  addMenuItemName: {
    fontWeight: 600,
  },
  addMenuItemDescription: {
    fontWeight: 400,
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    width: '100%',
  },
  selectValue: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },
  selectValueLabel: {
    fontWeight: 500,
  },
  selectValueSourceIcon: {
    ml: 0.5,
    fontSize: 16,
    color: 'text.tertiary',
  },
} as const;


// Source indicator icon (or null for "system" - no icon needed)
function _sourceIcon(engine: DSpeexEngineAny): React.ElementType | null {
  if (engine.isAutoLinked) return LinkIcon;
  if (engine.isAutoDetected) return null;
  return KeyIcon;
}


export function SpeexConfigureEngines(props: { isMobile: boolean }) {

  // state
  const [confirmDeleteEngine, setConfirmDeleteEngine] = React.useState<DSpeexEngineAny | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [showSystemTest, setShowSystemTest] = React.useState(false);

  // external state - module
  const engines = useSpeexEngines();
  const activeEngine = useSpeexGlobalEngine(); // active selection, or priority-ranked fallback
  const activeEngineId = activeEngine?.engineId ?? null;


  // derived state
  const hasEngines = engines.length > 0;
  const warnInvalidConfig = !!activeEngine && !speexAreCredentialsValid(activeEngine.credentials);


  // handlers

  const handleSelectEngine = React.useCallback((_event: any, newValue: string | null) => {
    useSpeexStore.getState().setActiveEngineId(newValue);
  }, []);

  // TEMP (testing): shift+click the closed Select resets to auto-selection
  const handleSelectMouseDown = React.useCallback((event: React.MouseEvent) => {
    if (!event.shiftKey) return;
    (event as any).defaultMuiPrevented = true; // don't open the listbox
    useSpeexStore.getState().setActiveEngineId(null);
  }, []);

  const handleOpenAddMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAddMenuAnchor(event.currentTarget);
  }, []);

  const handleCloseAddMenu = React.useCallback(() => {
    setAddMenuAnchor(null);
  }, []);

  const handleAddEngine = React.useCallback((vendorType: DSpeexVendorType) => {
    setAddMenuAnchor(null);
    const newEngineId = useSpeexStore.getState().createEngine(vendorType);
    useSpeexStore.getState().setActiveEngineId(newEngineId);
  }, []);

  const handleEngineUpdate = React.useCallback((updates: Partial<DSpeexEngineAny>) => {
    if (activeEngineId)
      useSpeexStore.getState().updateEngine(activeEngineId, updates);
  }, [activeEngineId]);

  const handleDeleteActive = React.useCallback((event: React.MouseEvent) => {
    if (!activeEngine || activeEngine.isAutoDetected || activeEngine.isAutoLinked) return;

    // shift+click skips confirmation
    if (event.shiftKey)
      return useSpeexStore.getState().deleteEngine(activeEngine.engineId);

    setConfirmDeleteEngine(activeEngine);
  }, [activeEngine]);

  const handleConfirmDelete = React.useCallback(() => {
    if (!confirmDeleteEngine) return;

    useSpeexStore.getState().deleteEngine(confirmDeleteEngine.engineId);

    setConfirmDeleteEngine(null);
  }, [confirmDeleteEngine]);

  const handleCancelDelete = React.useCallback(() => {
    setConfirmDeleteEngine(null);
  }, []);


  return <>

    {/* Row: "Speech Generation" label  +  Select + Add dropdown */}
    <Box sx={_styles.row}>

      <Box onClick={event => event.shiftKey && setShowSystemTest(on => !on)}>
        <FormLabelStart
          title='Voice generation'
          description={
            !activeEngine ? 'Please add engine'
              : warnInvalidConfig ? 'Incomplete'
                : 'Active Engine'
          }
          tooltip={
            !activeEngine ? 'Voice service required. Start by adding one with the "+" button.'
              : warnInvalidConfig ? 'Credentials are invalid or incomplete'
                : undefined
          }
          tooltipWarning={true}
        />
      </Box>

      <Box sx={_styles.selectGroup}>

        {/* Delete - only shown for manually-added engines */}
        {activeEngine && !activeEngine.isAutoLinked && !activeEngine.isAutoDetected && (
          <TooltipOutlined title={`Remove ${activeEngine.label}`}>
            <IconButton
              variant='plain'
              color='neutral'
              onClick={handleDeleteActive}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </TooltipOutlined>
        )}

        <Select
          placeholder='None'
          disabled={!hasEngines}
          value={activeEngineId}
          onChange={handleSelectEngine}
          color={warnInvalidConfig ? 'danger' : 'neutral'}
          slotProps={{ button: { onMouseDown: handleSelectMouseDown } }}
          renderValue={(option) => {
            if (!option || Array.isArray(option)) return null;
            const engine = engines.find(e => e.engineId === option.value);
            if (!engine) return null;
            const { icon: VendorIcon } = VENDOR_INFO[engine.vendorType];
            const SourceIcon = _sourceIcon(engine);
            return (
              <Box sx={_styles.selectValue}>
                <VendorIcon fontSize='small' />
                <Box sx={_styles.selectValueLabel}>{engine.label}</Box>
                {SourceIcon && <SourceIcon sx={_styles.selectValueSourceIcon} />}
              </Box>
            );
          }}
          sx={{
            minWidth: 192,
            ...props.isMobile && { flex: 1 },
          }}
        >
          {engines.map(engine => {
            const { icon: VendorIcon } = VENDOR_INFO[engine.vendorType];
            const SourceIcon = _sourceIcon(engine);
            return (
              <Option key={engine.engineId} value={engine.engineId}>
                <Box sx={_styles.optionRow}>
                  <ListItemDecorator><VendorIcon /></ListItemDecorator>
                  {engine.label}
                  {SourceIcon && <SourceIcon sx={_styles.selectValueSourceIcon} />}
                </Box>
              </Option>
            );
          })}
        </Select>

        {/* Add */}
        <ButtonServiceAdd
          isMobile={props.isMobile}
          isEmpty={!hasEngines}
          emptyHint=''
          menuOpen={!!addMenuAnchor}
          onClick={handleOpenAddMenu}
        />

      </Box>

    </Box>

    {/* Vendor picker popup anchored to the Add button */}
    <CloseablePopup
      menu
      anchorEl={addMenuAnchor}
      onClose={handleCloseAddMenu}
      placement='bottom-end'
      zIndex={themeZIndexOverMobileDrawer}
      sx={_styles.addMenu}
    >
      {(Object.entries(VENDOR_INFO) as [DSpeexVendorType, typeof VENDOR_INFO[DSpeexVendorType]][])
        .filter(([, info]) => info.addable)
        .map(([vendorType, info]) => {
          const { icon: VendorIcon } = info;
          return (
            <MenuItem key={vendorType} onClick={() => handleAddEngine(vendorType)} sx={_styles.addMenuItem}>
              <ListItemDecorator>
                <VendorIcon />
              </ListItemDecorator>
              <Box sx={_styles.addMenuItemContent}>
                <Typography level='title-md' sx={_styles.addMenuItemName}>{info.label}</Typography>
                <Typography level='body-sm' sx={_styles.addMenuItemDescription}>{info.description}</Typography>
              </Box>
            </MenuItem>
          );
        })}
    </CloseablePopup>

    {/* Voice parameters + Service access panels for the active engine */}
    {activeEngine && (
      <SpeexConfigureEngineFull
        engine={activeEngine}
        isMobile={props.isMobile}
        onUpdate={handleEngineUpdate}
      />
    )}

    {/* Delete confirmation */}
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

    {/* TTS System Test (inline, dev mode only) */}
    {showSystemTest && <SpeexSystemTest />}

  </>;
}
