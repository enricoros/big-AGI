import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Avatar, Badge, Box, Button, Chip, CircularProgress, Sheet, Typography } from '@mui/joy';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { llmsStoreActions, llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';
import { useShallowStabilizer } from '~/common/util/hooks/useShallowObject';

import type { IModelVendor } from '../vendors/IModelVendor';
import { LLMVendorIcon } from '../components/LLMVendorIcon';
import { ModelVendorAnthropic } from '../vendors/anthropic/anthropic.vendor';
import { ModelVendorGemini } from '../vendors/gemini/gemini.vendor';
import { ModelVendorLMStudio } from '../vendors/lmstudio/lmstudio.vendor';
import { ModelVendorLocalAI } from '../vendors/localai/localai.vendor';
import { ModelVendorOllama } from '../vendors/ollama/ollama.vendor';
import { ModelVendorOpenAI } from '../vendors/openai/openai.vendor';
import { llmsUpdateModelsForServiceOrThrow } from '../llm.client';


// configuration
const WizardProviders: ReadonlyArray<WizardProvider> = [
  { cat: 'popular', vendor: ModelVendorOpenAI, settingsKey: 'oaiKey' } as const,
  { cat: 'popular', vendor: ModelVendorAnthropic, settingsKey: 'anthropicKey' } as const,
  { cat: 'popular', vendor: ModelVendorGemini, settingsKey: 'geminiKey' } as const,
  { cat: 'local', vendor: ModelVendorLocalAI, settingsKey: 'localAIHost' } as const,
  { cat: 'local', vendor: ModelVendorOllama, settingsKey: 'ollamaHost' } as const,
  { cat: 'local', vendor: ModelVendorLMStudio, settingsKey: 'oaiHost', omit: true } as const,
  // { vendor: ModelVendorOpenRouter, settingsKey: 'oaiKey' } as const,
] as const;

type VendorCategory = 'popular' | 'local';

interface WizardProvider {
  cat: VendorCategory,
  vendor: IModelVendor<Record<string, any>, Record<string, any>>,
  settingsKey: string,
  omit?: boolean,
}


const _styles = {

  container: {
    margin: 'calc(-1 * var(--Card-padding, 1rem))',
    padding: 'var(--Card-padding)',
    // paddingRight: 'calc(1.5 * var(--Card-padding))',
    // background: 'linear-gradient(135deg, var(--joy-palette-primary-500), var(--joy-palette-primary-700))',
    // background: 'linear-gradient(135deg, var(--joy-palette-background-level1), var(--joy-palette-background-level1))',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: 'calc(0.75 * var(--Card-padding))',
  } as const,

  text1: {
    my: 1,
    ml: 7.25,
    display: 'flex',
    flexDirection: 'column',
    gap: 0.25,
  } as const,

  text1Mobile: {
    mb: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 0.25,
  } as const,

  text2: {
    my: 1,
    ml: 7.25,
    color: 'text.tertiary',
    fontSize: 'sm',
  } as const,

  text2Mobile: {
    mt: 2,
    color: 'text.tertiary',
    fontSize: 'sm',
  } as const,

} as const;


function WizardProviderSetup(props: {
  provider: WizardProvider,
  isFirst: boolean,
  isHidden: boolean,
}) {

  const { cat: providerCat, vendor: providerVendor, settingsKey: providerSettingsKey, omit: providerOmit } = props.provider;

  // state
  const [localValue, setLocalValue] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [updateError, setUpdateError] = React.useState<string | null>(null);

  // external state
  const stabilizeTransportAccess = useShallowStabilizer<Record<string, any>>();
  const { serviceKeyValue, serviceLLMsCount } = useModelsStore(useShallow(({ llms, sources }) => {

    // find the service | null
    const vendorService = sources.find(s => s.vId === providerVendor.id) ?? null;

    // (safe) service-derived properties
    const serviceLLMsCount = !vendorService ? null : llms.filter(llm => llm.sId === vendorService.id).length;
    const serviceAccess = stabilizeTransportAccess(providerVendor.getTransportAccess(vendorService?.setup));
    const serviceKeyValue = !serviceAccess ? null : vendorService?.setup[providerSettingsKey] ?? null;

    return {
      serviceKeyValue,
      serviceLLMsCount,
    };
  }));

  // [effect] initialize the local key
  const triggerValueLoad = localValue === null;
  React.useEffect(() => {
    if (triggerValueLoad)
      setLocalValue(serviceKeyValue || '');
  }, [serviceKeyValue, triggerValueLoad]);


  // derived
  const isLocal = providerCat === 'local';
  const valueName = isLocal ? 'server' : 'API Key';
  const { name: vendorName } = providerVendor;

  // use consistent autoCompleteId pattern: vendor-key for API keys, vendor-host for servers
  const autoCompleteId = isLocal ? `${providerVendor.id}-host` : `${providerVendor.id}-key`;


  // handlers


  const handleSetServiceKeyValue = React.useCallback(async () => {

    // create the service if missing
    const { sources: llmsServices } = llmsStoreState();
    const { createModelsService, updateServiceSettings, setServiceLLMs } = llmsStoreActions();
    const vendorService = llmsServices.find(s => s.vId === providerVendor.id) || createModelsService(providerVendor);
    const vendorServiceId = vendorService.id;

    // set the key
    const newKey = localValue?.trim() ?? '';
    updateServiceSettings(vendorServiceId, { [providerSettingsKey]: newKey });

    // if the key is empty, remove the models
    if (!newKey) {
      setUpdateError(null);
      setServiceLLMs(vendorServiceId, [], false, false);
      return;
    }

    // update the models
    setUpdateError(null);
    setIsLoading(true);
    try {
      await llmsUpdateModelsForServiceOrThrow(vendorService.id, true);
    } catch (error: any) {
      let errorText = error.message || `An error occurred. Please check your ${valueName}.`;
      if (errorText.includes('Incorrect API key'))
        errorText = '[OpenAI issue] Unauthorized: Incorrect API key.';
      setUpdateError(errorText);
      setServiceLLMs(vendorServiceId, [], false, false);
    }
    setIsLoading(false);

  }, [localValue, providerSettingsKey, providerVendor, valueName]);


  // memoed components

  const endButtons = React.useMemo(() => ((localValue || '') === (serviceKeyValue || '')) ? null : (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/*<TooltipOutlined title='Clear Key'>*/}
      {/*  <IconButton variant='outlined' color='neutral' onClick={handleClear}>*/}
      {/*    <ClearIcon />*/}
      {/*  </IconButton>*/}
      {/*</TooltipOutlined>*/}
      {/*<TooltipOutlined title='Confirm'>*/}
      <Button
        color='primary'
        variant='solid'
        onClick={handleSetServiceKeyValue}
        // endDecorator={<CheckRoundedIcon />}
      >
        {!serviceKeyValue ? 'Save' : !localValue?.trim() ? 'Delete' : 'Update'}
      </Button>
      {/*</TooltipOutlined>*/}
    </Box>
  ), [handleSetServiceKeyValue, localValue, serviceKeyValue]);


  // heuristics for warnings
  const isOnLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  return props.isHidden ? null : providerOmit ? (
    <Box sx={{ ..._styles.text1, my: 0, minHeight: '2.5rem' /* to mimic the other items */ }}>
      {!isOnLocalhost && <Typography level='body-xs'>
        Please make sure the addresses can be reached from &quot;{typeof window !== 'undefined' ? window.location.hostname : 'this server'}&quot;. If you are using a local service, you may need to use a public URL.
      </Typography>}
    </Box>
  ) : (
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
              {isLoading ? <CircularProgress color='primary' variant='solid' size='sm' /> : <LLMVendorIcon vendorId={providerVendor.id} />}
            </Avatar>
          </Badge>
        </TooltipOutlined>

        {/* Main key inputs */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 0.5 }}>

          <Box sx={{ flex: 1 }}>
            <FormInputKey
              noKey={isLocal}
              autoCompleteId={autoCompleteId}
              value={localValue ?? ''}
              placeholder={`${vendorName} ${valueName}`}
              onChange={setLocalValue}
              required={false}
            />
          </Box>

          {endButtons}

        </Box>

      </Box>

      {/*{isLoading && <Typography level='body-xs' sx={{ ml: 7, px: 0.5 }}>Loading your models...</Typography>}*/}
      {/*{!isLoading && !updateError && !!llmsCount && (*/}
      {/*  <Typography level='body-xs' sx={{ ml: 7, px: 0.5 }}>{llmsCount} models added.</Typography>*/}
      {/*)}*/}
      {!isLoading && !updateError && !serviceLLMsCount && !!serviceKeyValue && (
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

  // state
  const [activeCategory, setActiveCategory] = React.useState<VendorCategory>('popular');

  // derived
  const isLocal = activeCategory === 'local';

  return (
    <Sheet variant='soft' sx={_styles.container}>

      <Box sx={props.isMobile ? _styles.text1Mobile : _styles.text1}>
        <Typography component='div' level='title-sm'>
          Enter {isLocal ? 'the addresses of ' : 'your API keys for '}
          <Chip variant={!isLocal ? 'solid' : 'outlined'} sx={{ mx: 0.25 }} onClick={() => setActiveCategory('popular')}>
            Popular
          </Chip>
          <Chip variant={isLocal ? 'solid' : 'outlined'} sx={{ mx: 0.25 }} onClick={() => setActiveCategory('local')}>
            Local
          </Chip>
          {' '}AI services below.
        </Typography>
        {/*<Box sx={{ fontSize: 'sm', color: 'text.primary' }}>*/}
        {/*  Enter API keys to connect your AI services.{' '}*/}
        {/*  {!props.isMobile && <>Switch to <Box component='a' onClick={props.onSwitchToAdvanced} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>Advanced</Box> for more options.</>}*/}
        {/*</Box>*/}
      </Box>

      {WizardProviders.map((provider, index) => (
        <WizardProviderSetup
          key={provider.vendor.id}
          provider={provider}
          isFirst={!index}
          isHidden={provider.cat !== activeCategory}
        />
      ))}

      <Box sx={props.isMobile ? _styles.text2Mobile : _styles.text2}>
        {/*{!props.isMobile && <>Switch to <Box component='a' onClick={props.onSwitchToAdvanced} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>Advanced</Box> to choose between {getModelVendorsCount()} services.</>}{' '}*/}
        {!props.isMobile && <>
          Switch to{' '}
          <Box component='a' onClick={props.onSwitchToAdvanced} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>advanced configuration</Box>
          {/*<Chip variant={isLocal ? 'solid' : 'outlined'} sx={{ ml: 0.25 }} onClick={props.onSwitchToAdvanced}>*/}
          {/*  more services*/}
          {/*</Chip>*/}
          {' '}for more services,
        </>}{' '}
        or <Box component='a' onClick={props.onSkip} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>skip</Box> for now and do it later.
      </Box>

    </Sheet>
  );
}