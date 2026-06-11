/**
 * ASRxConfigureEngines - Transcription engine selection and configuration.
 *
 * Select-driven layout: the Select doubles as "active engine" and
 * "configuration focus" - picking an engine switches both. Below the Select,
 * a Source banner explains where the credentials come from (manual key vs
 * LLM-service link) and hosts the credentials inputs / delete button. Below
 * the banner, a Divider + engine-specific parameters panel.
 */

import * as React from 'react';

import { Box, IconButton, ListItemDecorator, MenuItem, Option, Select, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';

import { ButtonServiceAdd } from '~/common/components/ButtonServiceAdd';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';

import type { DASRxEngineAny, DASRxVendorType } from '../asrx.types';
import { ASRxConfigureEngineFull } from './ASRxConfigureEngineFull';
import { asrxAreCredentialsValid, useASRxEngines, useASRxGlobalEngine, useASRxStore } from '../store-module-asrx';


const VENDOR_INFO: { [key in DASRxVendorType]: { label: string; description: string; icon: React.ElementType } } = {
  deepgram: {
    label: 'Deepgram',
    description: 'Specialized ASR, fast',
    icon: GraphicEqRoundedIcon,
  },
  openai: {
    label: 'OpenAI',
    description: 'Whisper / GPT-4o transcribe',
    icon: OpenAIIcon,
  },
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
  optionSourceIcon: {
    ml: 'auto',
    fontSize: 16,
    color: 'text.tertiary',
  },
  optionSuffixWarning: {
    ml: 'auto',
    fontSize: 'xs',
    color: 'warning.plainColor',
    fontWeight: 500,
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
function _sourceIcon(engine: DASRxEngineAny): React.ElementType | null {
  if (engine.isAutoLinked) return LinkIcon;
  if (engine.isAutoDetected) return null;
  return KeyIcon;
}


export function ASRxConfigureEngines(props: { isMobile: boolean }) {

  // state
  const [confirmDeleteEngine, setConfirmDeleteEngine] = React.useState<DASRxEngineAny | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = React.useState<HTMLElement | null>(null);

  // external state - module
  const engines = useASRxEngines();
  const activeEngine = useASRxGlobalEngine(); // active selection, or priority-ranked fallback
  const activeEngineId = activeEngine?.engineId ?? null;


  // derived state
  const hasEngines = engines.length > 0;
  const warnInvalidConfig = !!activeEngine && !asrxAreCredentialsValid(activeEngine.credentials);


  // handlers

  const handleSelectEngine = React.useCallback((_event: any, newValue: string | null) => {
    useASRxStore.getState().setActiveEngineId(newValue);
  }, []);

  const handleOpenAddMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAddMenuAnchor(event.currentTarget);
  }, []);

  const handleCloseAddMenu = React.useCallback(() => {
    setAddMenuAnchor(null);
  }, []);

  const handleAddEngine = React.useCallback((vendorType: DASRxVendorType) => {
    setAddMenuAnchor(null);
    const newEngineId = useASRxStore.getState().createEngine(vendorType);
    useASRxStore.getState().setActiveEngineId(newEngineId);
  }, []);

  const handleEngineUpdate = React.useCallback((updates: Partial<DASRxEngineAny>) => {
    if (activeEngineId)
      useASRxStore.getState().updateEngine(activeEngineId, updates);
  }, [activeEngineId]);

  const handleDeleteActive = React.useCallback((event: React.MouseEvent) => {
    if (!activeEngine || activeEngine.isAutoDetected || activeEngine.isAutoLinked) return;

    // shift+click skips confirmation
    if (event.shiftKey)
      return useASRxStore.getState().deleteEngine(activeEngine.engineId);

    setConfirmDeleteEngine(activeEngine);
  }, [activeEngine]);

  const handleConfirmDelete = React.useCallback(() => {
    if (!confirmDeleteEngine) return;
    useASRxStore.getState().deleteEngine(confirmDeleteEngine.engineId);
    setConfirmDeleteEngine(null);
  }, [confirmDeleteEngine]);

  const handleCancelDelete = React.useCallback(() => {
    setConfirmDeleteEngine(null);
  }, []);


  return <>

    {/* Row: "Active Engine" label  +  Select + Add dropdown */}
    <Box sx={_styles.row}>

      <FormLabelStart
        title='Transcription'
        description={
          !activeEngine ? 'Please add engine'
            : warnInvalidConfig ? 'Incomplete'
              : 'Active Engine'
        }
        tooltip={
          !activeEngine ? 'Transcription service required. Start by adding one with the "+" button.'
            : warnInvalidConfig ? 'Credentials are invalid or incomplete'
              : undefined
        }
        tooltipWarning={true}
      />
      {/*<Box sx={{ mr: 1 }}>Active Service:</Box>*/}

      <Box sx={_styles.selectGroup}>

        <Select
          placeholder='None'
          disabled={!hasEngines}
          value={activeEngineId}
          onChange={handleSelectEngine}
          color={warnInvalidConfig ? 'danger' : 'neutral'}
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
          // const isInvalid = !asrxAreCredentialsValid(engine.credentials);
          return (
            <Option key={engine.engineId} value={engine.engineId}>
              <Box sx={_styles.optionRow}>
                <ListItemDecorator><VendorIcon /></ListItemDecorator>
                {engine.label}
                {SourceIcon && <SourceIcon sx={_styles.selectValueSourceIcon} />}
                {/*{isInvalid ? (*/}
                {/*  <Typography level='body-xs' sx={_styles.optionSuffixWarning}>Needs key</Typography>*/}
                {/*) : SourceIcon ? (*/}
                {/*  <SourceIcon sx={_styles.optionSourceIcon} />*/}
                {/*) : null}*/}
              </Box>
            </Option>
          );
        })}
        </Select>

        {/* Add */}
        <ButtonServiceAdd
          isMobile={props.isMobile}
          isEmpty={!hasEngines}
          emptyHint='' // was 'Add your transcription engine'
          menuOpen={!!addMenuAnchor}
          onClick={handleOpenAddMenu}
        />

        {/* Delete (manual) or Linked indicator (auto-linked/system, disabled) */}
        {activeEngine && (() => {
          const canDelete = !activeEngine.isAutoLinked && !activeEngine.isAutoDetected;
          const tooltip = canDelete
            ? `Remove ${activeEngine.label}`
            : activeEngine.isAutoLinked
              ? 'Linked - manage in Chat > AI Services'
              : 'System service - not removable';
          return (
            <TooltipOutlined title={tooltip}>
              <IconButton
                variant='plain'
                color='neutral'
                disabled={!canDelete}
                onClick={canDelete ? handleDeleteActive : undefined}
                sx={{ ml: 'auto' }}
              >
                {canDelete ? <DeleteOutlineIcon /> : <LinkIcon />}
              </IconButton>
            </TooltipOutlined>
          );
        })()}

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
      {(Object.entries(VENDOR_INFO) as [DASRxVendorType, typeof VENDOR_INFO[DASRxVendorType]][]).map(([vendorType, info]) => {
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

    {/* Source banner + Configuration panel for the active engine */}
    {activeEngine && (
      <ASRxConfigureEngineFull
        engine={activeEngine}
        isMobile={props.isMobile}
        onUpdate={handleEngineUpdate}
      />
    )}

    {/* Empty state */}
    {/*{!hasEngines && (*/}
    {/*  <Typography level='body-sm' sx={{ color: 'text.tertiary' }}>*/}
    {/*    No services configured.*/}
    {/*  </Typography>*/}
    {/*)}*/}

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

  </>;
}
