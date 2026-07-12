/**
 * T2IConfigureEngines - Image generation engine selection and configuration.
 *
 * Select-driven layout mirroring ASRxConfigureEngines: the Select doubles as
 * "active engine" and "configuration focus" - picking an engine switches both.
 * All engines are auto-linked from configured LLM services (no manual keys
 * yet), so the source indicator is always a link. Below the Select, the
 * vendor-specific configuration panel for the selected engine.
 */

import * as React from 'react';

import { Alert, Box, IconButton, ListItemDecorator, Option, Select } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';

import { llmsGetVendorIcon } from '~/modules/llms/components/LLMVendorIcon';

import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { useCapabilityTextToImage } from '~/common/components/useCapabilities';

import { DallESettings } from '../dalle/DallESettings';
import { OpenRouterT2ISettings } from '../openrouter/OpenRouterT2ISettings';
import { T2IConfigureEngineFull } from './T2IConfigureEngineFull';


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


/**
 * Vendor-specific configuration panel for a T2I engine, or null if the vendor
 * has none. Azure and LocalAI generate through the OpenAI/DALL·E path and read
 * the same settings store, so they share the DALL·E panel.
 */
export function t2iVendorConfigPanel(vendor: TextToImageProvider['vendor'] | undefined): React.FC | null {
  switch (vendor) {
    case 'azure':
    case 'localai':
    case 'openai':
      return DallESettings;
    case 'openrouter':
      return OpenRouterT2ISettings;
    default:
      return null;
  }
}


// Source indicator icon: LLM-service-linked engines show a link; future manual
// (api-key) engines show a key; future system-provided engines show none
function _sourceIcon(provider: TextToImageProvider): React.ElementType | null {
  if (provider.modelServiceId) return LinkIcon;
  return KeyIcon;
}


export function T2IConfigureEngines(props: { isMobile: boolean }) {

  // external state
  const { mayWork, providers, activeProviderId, setActiveProviderId } = useCapabilityTextToImage();


  // derived state
  const hasProviders = providers.length > 0;
  const activeProvider = providers.find(p => p.providerId === activeProviderId) ?? null;


  // handlers

  const handleSelectProvider = React.useCallback((_event: any, newValue: string | null) => {
    if (newValue)
      setActiveProviderId(newValue);
  }, [setActiveProviderId]);


  // empty state: no eligible LLM services at all
  if (!hasProviders)
    return (
      <Alert variant='soft'>
        There are no configured services for text-to-image generation.
        Please configure one service, such as an OpenAI LLM service, in the AI Models settings.
      </Alert>
    );


  return <>

    {/* Row: "Text-to-Image" label  +  Select + Linked indicator */}
    <Box sx={_styles.row}>

      <FormLabelStart
        title='Text-to-Image'
        description={
          !mayWork ? 'No models'
            : 'Active Engine'
        }
        tooltip={
          !mayWork ? 'The linked services have no models loaded yet. Refresh the models of a service in the AI Models settings.'
            : undefined
        }
        tooltipWarning={true}
      />

      <Box sx={_styles.selectGroup}>

        <Select
          placeholder='None'
          disabled={!mayWork}
          value={activeProviderId}
          onChange={handleSelectProvider}
          renderValue={(option) => {
            if (!option || Array.isArray(option)) return null;
            const provider = providers.find(p => p.providerId === option.value);
            if (!provider) return null;
            const VendorIcon = llmsGetVendorIcon(provider.vendor);
            const SourceIcon = _sourceIcon(provider);
            return (
              <Box sx={_styles.selectValue}>
                <VendorIcon />
                <Box sx={_styles.selectValueLabel}>{provider.label}</Box>
                {SourceIcon && <SourceIcon sx={_styles.selectValueSourceIcon} />}
              </Box>
            );
          }}
          sx={{
            minWidth: 192,
            ...props.isMobile && { flex: 1 },
          }}
        >
          {providers.map(provider => {
            const VendorIcon = llmsGetVendorIcon(provider.vendor);
            const SourceIcon = _sourceIcon(provider);
            return (
              <Option key={provider.providerId} value={provider.providerId} disabled={!provider.configured}>
                <Box sx={_styles.optionRow}>
                  <ListItemDecorator><VendorIcon /></ListItemDecorator>
                  {provider.label}
                  {SourceIcon && <SourceIcon sx={_styles.selectValueSourceIcon} />}
                </Box>
              </Option>
            );
          })}
        </Select>

        {/* Linked indicator (all engines are LLM-service-linked for now; manual
            engines will get a delete button here, as in ASRxConfigureEngines) */}
        {!!activeProvider?.modelServiceId && (
          <TooltipOutlined title='Linked - manage in Chat > AI Services'>
            <IconButton
              variant='plain'
              color='neutral'
              disabled
              sx={{ ml: 'auto' }}
            >
              <LinkIcon />
            </IconButton>
          </TooltipOutlined>
        )}

      </Box>

    </Box>

    {/* Source banner + Configuration panel for the active engine */}
    {!!activeProvider && (
      <T2IConfigureEngineFull
        provider={activeProvider}
        isMobile={props.isMobile}
      />
    )}

  </>;
}
