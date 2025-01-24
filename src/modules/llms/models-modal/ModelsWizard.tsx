import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Avatar, Badge, Box, Button, CircularProgress, Input, Sheet, Typography } from '@mui/joy';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';
import { useShallowStabilizer } from '~/common/util/hooks/useShallowObject';

import type { IModelVendor } from '../vendors/IModelVendor';
import { ModelVendorAnthropic } from '../vendors/anthropic/anthropic.vendor';
import { ModelVendorGemini } from '../vendors/gemini/gemini.vendor';
import { ModelVendorOpenAI } from '../vendors/openai/openai.vendor';
import { llmsUpdateModelsForServiceOrThrow } from '../llm.client';


// configuration
const WizardVendors = [
  { vendor: ModelVendorOpenAI, apiKeyField: 'oaiKey' },
  { vendor: ModelVendorAnthropic, apiKeyField: 'anthropicKey' },
  { vendor: ModelVendorGemini, apiKeyField: 'geminiKey' },
  // { vendor: ModelVendorOpenRouter, apiKeyField: 'oaiKey' },
] as const;


const wizardContainerSx = {
  margin: 'calc(-1 * var(--Card-padding, 1rem))',
  padding: 'var(--Card-padding)',
  // background: 'linear-gradient(135deg, var(--joy-palette-primary-500), var(--joy-palette-primary-700))',
  background: 'linear-gradient(135deg, var(--joy-palette-background-level1), var(--joy-palette-background-level1))',
  display: 'grid',
  gap: 'var(--Card-padding)',
};


function WizardProviderSetup(props: {
  apiKeyField: string,
  isFirst: boolean,
  vendor: IModelVendor<Record<string, any>, Record<string, any>>,
}) {

  const { id: vendorId, name: vendorName, Icon: VendorIcon } = props.vendor;

  // state
  const [localKey, setLocalKey] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [updateError, setUpdateError] = React.useState<string | null>(null);

  // external state
  const stabilizeTransportAccess = useShallowStabilizer<Record<string, any>>();
  const { serviceAPIKey, serviceLLMsCount } = useModelsStore(useShallow(({ llms, sources }) => {

    // find the service | null
    const vendorService = sources.find(s => s.vId === vendorId) ?? null;

    // (safe) service-derived properties
    const serviceLLMsCount = !vendorService ? null : llms.filter(llm => llm.sId === vendorService.id).length;
    const serviceAccess = stabilizeTransportAccess(props.vendor.getTransportAccess(vendorService?.setup));
    const serviceAPIKey = !serviceAccess ? null : serviceAccess[props.apiKeyField] ?? null;

    return {
      serviceAPIKey,
      serviceLLMsCount,
    };
  }));

  // [effect] initialize the local key
  React.useEffect(() => {
    if (localKey === null)
      setLocalKey(serviceAPIKey || '');
  }, [localKey, serviceAPIKey]);


  // handlers

  const handleTextChanged = React.useCallback((e: React.ChangeEvent) => {
    setLocalKey((e.target as HTMLInputElement).value);
  }, []);

  const handleSetServiceKey = React.useCallback(async () => {

    // create the service if missing
    const { sources: llmsServices, createModelsService, updateServiceSettings, setLLMs } = llmsStoreState();
    const vendorService = llmsServices.find(s => s.vId === vendorId) || createModelsService(props.vendor);
    const vendorServiceId = vendorService.id;

    // set the key
    const newKey = localKey?.trim() ?? '';
    updateServiceSettings(vendorServiceId, { [props.apiKeyField]: newKey });

    // if the key is empty, remove the models
    if (!newKey) {
      setUpdateError(null);
      setLLMs([], vendorServiceId, true, false);
      return;
    }

    // update the models
    setUpdateError(null);
    setIsLoading(true);
    try {
      await llmsUpdateModelsForServiceOrThrow(vendorService.id, true);
    } catch (error: any) {
      let errorText = error.message || 'An error occurred';
      if (errorText.includes('Incorrect API key'))
        errorText = '[OpenAI issue] Unauthorized: Incorrect API key.';
      setUpdateError(errorText);
      setLLMs([], vendorServiceId, true, false);
    }
    setIsLoading(false);

  }, [localKey, props.apiKeyField, props.vendor, vendorId]);


  // memoed components

  const endButtons = React.useMemo(() => ((localKey || '') === (serviceAPIKey || '')) ? null : (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/*<TooltipOutlined title='Clear Key'>*/}
      {/*  <IconButton variant='outlined' color='neutral' onClick={handleClear}>*/}
      {/*    <ClearIcon />*/}
      {/*  </IconButton>*/}
      {/*</TooltipOutlined>*/}
      {/*<TooltipOutlined title='Confirm'>*/}
      <Button
        variant='solid' color='primary'
        onClick={handleSetServiceKey}
        // endDecorator={<CheckRoundedIcon />}
      >
        {!serviceAPIKey ? 'Confirm' : !localKey?.trim() ? 'Clear' : 'Update'}
      </Button>
      {/*</TooltipOutlined>*/}
    </Box>
  ), [handleSetServiceKey, localKey, serviceAPIKey]);


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>

        {/* Left Icon */}
        <TooltipOutlined title={serviceLLMsCount ? `${serviceLLMsCount} ${vendorName} models available` : `${vendorName} API Key`} placement='top'>
          <Badge
            size='md' color='primary' variant='solid' badgeInset='12%'
            badgeContent={serviceLLMsCount} showZero={false}
            slotProps={{ badge: { sx: { boxShadow: 'xs', border: 'none' } } }}
          >
            <Avatar sx={{ height: '100%', aspectRatio: 1, backgroundColor: 'transparent' }}>
              {isLoading ? <CircularProgress color='primary' variant='solid' size='sm' /> : <VendorIcon />}
            </Avatar>
          </Badge>
        </TooltipOutlined>

        {/* Main key inputs */}
        <Box sx={{ flex: 1, display: 'grid' }}>

          {/* Line 1 */}
          {/*{!!props.serviceLabel && (*/}
          {/*  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>*/}
          {/*    /!*<props.vendorIcon />*!/*/}
          {/*    <Box>{props.serviceLabel}</Box>*/}
          {/*  </Box>*/}
          {/*)}*/}

          {/* Line 2 */}
          <Input
            fullWidth
            name={`wizard-api-key-${vendorId}`}
            autoComplete='off'
            variant='outlined'
            value={localKey ?? ''}
            onChange={handleTextChanged}
            placeholder={`${vendorName} API Key`}
            type='password'
            // error={!isValidKey}
            // startDecorator={<props.vendorIcon />}
            endDecorator={endButtons}
          />

        </Box>

      </Box>

      {/*{isLoading && <Typography level='body-xs' sx={{ ml: 7, px: 0.5 }}>Loading your models...</Typography>}*/}
      {/*{!isLoading && !updateError && !!llmsCount && (*/}
      {/*  <Typography level='body-xs' sx={{ ml: 7, px: 0.5 }}>{llmsCount} models added.</Typography>*/}
      {/*)}*/}
      {!isLoading && !updateError && !serviceLLMsCount && !!serviceAPIKey && (
        <Typography level='body-xs' color='warning' sx={{ ml: 7, px: 0.5 }}>No models found.</Typography>
      )}
      {!!updateError && <Typography level='body-xs' color='danger' sx={{ ml: 7, px: 0.5 }}>{updateError}</Typography>}

    </Box>
  );
}


export function ModelsWizard(props: {
  isMobile: boolean,
  onSkip?: () => void,
  onSwitchToAdvanced?: () => void,
}) {
  return (
    <Sheet variant='soft' sx={wizardContainerSx}>

      <Box sx={{ ml: 7.25, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {/*<Typography level='title-sm'>*/}
        {/*  Quick Start*/}
        {/*</Typography>*/}
        <Typography level='body-sm'>
          Enter API keys to connect Big-AGI to your AI providers.{' '}
          {/*{!props.isMobile && <>Switch to <Box component='a' onClick={props.onSwitchToAdvanced} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>Advanced</Box> for more options.</>}*/}
        </Typography>
      </Box>

      {WizardVendors.map(({ vendor, apiKeyField }, index) => (
        <WizardProviderSetup key={vendor.id} apiKeyField={apiKeyField} isFirst={!index} vendor={vendor} />
      ))}

      <Box sx={{ ml: 7.25, color: 'text.tertiary', fontSize: 'sm' }}>
        {/*{!props.isMobile && <>Switch to <Box component='a' onClick={props.onSwitchToAdvanced} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>Advanced</Box> to choose between {getModelVendorsCount()} services.</>}{' '}*/}
        {!props.isMobile && <>Switch to <Box component='a' onClick={props.onSwitchToAdvanced} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>Advanced</Box> for more services.</>}{' '}
        Or <Box component='a' onClick={props.onSkip} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>skip</Box> for now and do it later.
      </Box>

    </Sheet>
  );
}