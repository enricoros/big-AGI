import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, ButtonGroup, Divider, FormControl, Grid, IconButton, Input, Link, Switch, Tooltip, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import type { DPricingChatGenerate } from '~/common/stores/llms/llms.pricing';
import { DLLMId, getLLMContextTokens, getLLMMaxOutputTokens, getLLMPricing, isLLMVisible } from '~/common/stores/llms/llms.types';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { ModelDomainsList, ModelDomainsRegistry } from '~/common/stores/llms/model.domains.registry';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useModelDomains } from '~/common/stores/llms/hooks/useModelDomains';
import { useLLM } from '~/common/stores/llms/llms.hooks';

import { LLMOptionsGlobal } from './LLMOptionsGlobal';


// configuration
export const ENABLE_STARRING_ICON = true;
const ENABLE_HIDING_ICON = false;


function prettyPricingComponent(pricingChatGenerate: DPricingChatGenerate): React.ReactNode {
  if (!pricingChatGenerate) return 'Pricing not available';

  const formatPrice = (price: DPricingChatGenerate['input']): string => {
    if (!price) return 'N/A';
    if (price === 'free') return 'Free';
    if (typeof price === 'number') return `$${price.toFixed(2)}`;
    if (Array.isArray(price))
      return price.map(bp => `${bp.upTo === null ? '>' : '<='} ${bp.upTo || ''} tokens: ${formatPrice(bp.price)}`).join(', ');
    return 'Unknown';
  };

  const inputPrice = formatPrice(pricingChatGenerate.input);
  const outputPrice = formatPrice(pricingChatGenerate.output);

  let cacheInfo = '';
  if (pricingChatGenerate.cache) {
    switch (pricingChatGenerate.cache.cType) {
      case 'ant-bp': {
        const { read, write, duration } = pricingChatGenerate.cache;
        cacheInfo = `Cache: Read ${formatPrice(read)}, Write ${formatPrice(write)}, Duration: ${duration}s`;
        break;
      }
      case 'oai-ac': {
        const { read } = pricingChatGenerate.cache;
        cacheInfo = `Cache: Read ${formatPrice(read)}`;
        break;
      }
      default:
        throw new Error('LLMOptionsModal: Unknown cache type');
    }
  }

  return (
    <div>
      <span>pricing ($/M tokens):</span><br />
      &nbsp;- Input: {inputPrice}<br />
      &nbsp;- Output: {outputPrice}<br />
      {cacheInfo && <>&nbsp;- {cacheInfo}<br /></>}
    </div>
  );
}


export function LLMOptionsModal(props: { id: DLLMId, onClose: () => void }) {

  // external state
  const isMobile = useIsMobile();
  const llm = useLLM(props.id);

  // state - auto-open details if user has customized pricing or token limits
  const [showDetails, setShowDetails] = React.useState(
    !!llm?.userPricing || llm?.userContextTokens !== undefined || llm?.userMaxOutputTokens !== undefined,
  );
  const domainAssignments = useModelDomains();
  const { removeLLM, updateLLM, assignDomainModelId, resetLLMUserParameters } = llmsStoreActions();

  const handleResetParameters = React.useCallback(() => llm?.id && resetLLMUserParameters(llm?.id), [llm?.id, resetLLMUserParameters]);

  if (!llm)
    return <>Options issue: LLM not found for id {props.id}</>;

  const handleLlmLabelSet = (event: React.ChangeEvent<HTMLInputElement>) => updateLLM(llm.id, { label: event.target.value || '' });

  const handleLlmVisibilityToggle = () => updateLLM(llm.id, { userHidden: isLLMVisible(llm) });

  const handleLlmStarredToggle = () => updateLLM(llm.id, { userStarred: !llm.userStarred });


  // Advanced > user Context/MaxOutput

  const handleContextTokensChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateLLM(llm.id, { userContextTokens: value ? parseInt(value, 10) : undefined });
  };

  const handleContextTokensReset = () => updateLLM(llm.id, { userContextTokens: undefined });

  const handleMaxOutputTokensChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateLLM(llm.id, { userMaxOutputTokens: value ? parseInt(value, 10) : undefined });
  };

  const handleMaxOutputTokensReset = () => updateLLM(llm.id, { userMaxOutputTokens: undefined });


  // Advanced > user Pricing

  const handleInputPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numValue = value ? parseFloat(value) : undefined;
    updateLLM(llm.id, {
      userPricing: {
        chat: {
          ...llm.userPricing?.chat,
          input: numValue,
          // output: llm.userPricing?.chat?.output,
        },
      },
    });
  };

  const handleInputPriceReset = () => {
    const newPricing = { ...llm.userPricing };
    if (newPricing.chat) {
      delete newPricing.chat.input;
      // If no other pricing fields are set, clear userPricing entirely
      if (!newPricing.chat.output && !newPricing.chat.cache) {
        updateLLM(llm.id, { userPricing: undefined });
      } else {
        updateLLM(llm.id, { userPricing: newPricing });
      }
    }
  };

  const handleOutputPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numValue = value ? parseFloat(value) : undefined;
    updateLLM(llm.id, {
      userPricing: {
        chat: {
          ...llm.userPricing?.chat,
          // input: llm.userPricing?.chat?.input,
          output: numValue,
        },
      },
    });
  };

  const handleOutputPriceReset = () => {
    const newPricing = { ...llm.userPricing };
    if (newPricing.chat) {
      delete newPricing.chat.output;
      // If no other pricing fields are set, clear userPricing entirely
      if (!newPricing.chat.input && !newPricing.chat.cache) {
        updateLLM(llm.id, { userPricing: undefined });
      } else {
        updateLLM(llm.id, { userPricing: newPricing });
      }
    }
  };


  const handleLlmDelete = () => {
    removeLLM(llm.id);
    props.onClose();
  };


  const visible = isLLMVisible(llm);

  const hasUserParameters = llm.userParameters && Object.keys(llm.userParameters).length > 0;
  const resetButton = !hasUserParameters ? null : (
    <Link
      component='button'
      color='neutral'
      level='body-sm'
      onClick={handleResetParameters}
    >
      Reset to defaults ...
    </Link>
  );

  return (

    <GoodModal
      autoOverflow
      // strongerTitle
      title={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1, md: 3 } }}>

          {/* Star + Model Name */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, md: 1 } }}>
            {ENABLE_STARRING_ICON && <TooltipOutlined title={llm.userStarred ? 'Unstar this model' : 'Star this model for quick access'}>
              <IconButton size='sm' onClick={handleLlmStarredToggle} sx={{ ml: -0.5 }}>
                {llm.userStarred ? <StarIcon sx={{ color: '#fad857', fontSize: 'xl2' }} /> : <StarBorderIcon />}
              </IconButton>
            </TooltipOutlined>}
            {ENABLE_HIDING_ICON && <TooltipOutlined title={visible ? 'Show this model in the app' : 'Hide this model from the app'}>
              <IconButton size='sm' onClick={handleLlmVisibilityToggle} sx={{ ml: -0.5 }}>
                {visible ? <VisibilityIcon sx={{ fontSize: 'xl' }} /> : <VisibilityOffIcon />}
              </IconButton>
            </TooltipOutlined>}
            <span><b>{llm.label}</b> options</span>
          </Box>

          {/* [Desktop] Reset to default - show only when user has customized parameters */}
          {!isMobile && resetButton}
        </Box>
      }
      open={!!props.id} onClose={props.onClose}
      startButton={
        <Button variant='plain' color='neutral' onClick={handleLlmDelete} startDecorator={<DeleteOutlineIcon />}>
          Delete
        </Button>
      }
    >

      <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
        <LLMOptionsGlobal llm={llm} />
        {/* On Mobile, display the button below the settings */}
        {isMobile && resetButton}
      </Box>

      <Divider />

      <Grid container spacing={2} alignItems='center'>

        <Grid xs={12} md={8}>
          <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <FormLabelStart title='Name' sx={{ minWidth: 80 }} />
            <Input variant='outlined' value={llm.label} onChange={handleLlmLabelSet} />
          </FormControl>
        </Grid>

        <Grid xs={12} md={4}>
          {!ENABLE_HIDING_ICON && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <FormLabelStart title='Visible' sx={{ minWidth: 80 }} />
            <Tooltip title={visible ? 'Show this model in the list of Chat models' : 'Hide this model from the list of Chat models'}>
              <Switch checked={visible} onChange={handleLlmVisibilityToggle}
                      endDecorator={visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                      slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
            </Tooltip>
          </FormControl>}
        </Grid>

      </Grid>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Assignment' description='Default model' sx={{ minWidth: 80 }} />
        <ButtonGroup orientation='horizontal' size='sm' variant='outlined'>
          {ModelDomainsList.filter(dId => !['imageCaption'].includes(dId)).map(domainId => {
            const domainSpec = ModelDomainsRegistry[domainId];
            const domainModelId = domainAssignments[domainId]?.modelId;
            const isActive = domainModelId === llm.id;
            return (
              // Note: use Tooltip instead of GoodTooltip here, because GoodTooltip is not working well with ButtonGroup
              <Tooltip arrow placement='top' key={domainId} title={domainSpec.confTooltip}>
                <Button variant={isActive ? 'solid' : undefined} onClick={() => assignDomainModelId(domainId, isActive ? null : llm.id)}>{domainSpec.confLabel}</Button>
              </Tooltip>
            );
          })}
        </ButtonGroup>
      </FormControl>

      {!ENABLE_STARRING_ICON && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Starred' sx={{ minWidth: 80 }} />
        <Tooltip title={llm.userStarred ? 'Unstar this model' : 'Star this model for quick access'}>
          <Switch checked={!!llm.userStarred} onChange={handleLlmStarredToggle}
                  endDecorator={llm.userStarred ? <StarIcon sx={{ color: '#fad857' }} /> : <StarBorderIcon />}
                  slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
          />
        </Tooltip>
      </FormControl>}

      <FormControl orientation='horizontal' sx={{ flexWrap: 'nowrap', gap: 1 }}>

        <Link
          component='button'
          color='neutral'
          level='title-sm'
          onClick={() => setShowDetails(!showDetails)}
          sx={{ color: 'text.primary', whiteSpace: 'nowrap', mb: 'auto', textDecoration: 'underline' }}
        >
          {showDetails ? 'Details:' : 'Details...'}
        </Link>

        {showDetails && <Box sx={{ display: 'flex', flexDirection: 'column', wordBreak: 'break-word', gap: 1 }}>
          {!!llm.description && <Typography level='title-sm'>
            {llm.description}
          </Typography>}

          {!!getLLMPricing(llm)?.chat?._isFree && <Typography level='body-xs'>
            🎁 Free model - note: refresh models to check for updates in pricing
          </Typography>}

          <Typography level='body-xs'>
            llm id: {llm.id}<br />
            context tokens: <b>{getLLMContextTokens(llm)?.toLocaleString() ?? 'not provided'}</b>{` · `}
            max output tokens: <b>{getLLMMaxOutputTokens(llm)?.toLocaleString() ?? 'not provided'}</b><br />
            {!!llm.created && <>created: <TimeAgo date={new Date(llm.created * 1000)} /><br /></>}
            {/*· tags: {llm.tags.join(', ')}*/}
            {!!getLLMPricing(llm)?.chat && prettyPricingComponent(getLLMPricing(llm)!.chat!)}
            {/*{!!llm.benchmark && <>benchmark: <b>{llm.benchmark.cbaElo?.toLocaleString() || '(unk) '}</b> CBA Elo<br /></>}*/}
            {llm.parameterSpecs?.length > 0 && <>options: {llm.parameterSpecs.map(ps => ps.paramId).join(', ')}<br /></>}
            {Object.keys(llm.initialParameters || {}).length > 0 && <>initial parameters: {JSON.stringify(llm.initialParameters, null, 2)}<br /></>}
            {Object.keys(llm.userParameters || {}).length > 0 && <>user parameters: {JSON.stringify(llm.userParameters, null, 2)}<br /></>}
          </Typography>

          {/* Advanced: Token Overrides */}
          <Grid container spacing={2} alignItems='center' sx={{ mt: 0.5 }}>
            <Grid xs={12} md={6}>
              <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <FormLabelStart title='Context Window' description='Tokens Override' sx={{ minWidth: 120 }} />
                <Input
                  type='number'
                  variant='outlined'
                  placeholder={
                    // NOTE: direct access to the underlying, instead of via getLLMContextTokens
                    llm.contextTokens?.toLocaleString() ?? 'default'
                  }
                  value={llm.userContextTokens ?? ''}
                  onChange={handleContextTokensChange}
                  endDecorator={llm.userContextTokens !== undefined && (
                    <Button size='sm' variant='plain' onClick={handleContextTokensReset}>Reset</Button>
                  )}
                  slotProps={{ input: { min: 1 } }}
                  sx={{ flex: 1 }}
                />
              </FormControl>
            </Grid>

            <Grid xs={12} md={6}>
              <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <FormLabelStart title='Max Output' description='Tokens Override' sx={{ minWidth: 120 }} />
                <Input
                  type='number'
                  variant='outlined'
                  placeholder={
                    // NOTE: direct access to the underlying, instead of via getLLMMaxOutputTokens
                    llm.maxOutputTokens?.toLocaleString() ?? 'default'
                  }
                  value={llm.userMaxOutputTokens ?? ''}
                  onChange={handleMaxOutputTokensChange}
                  slotProps={{ input: { min: 1 } }}
                  endDecorator={llm.userMaxOutputTokens !== undefined && (
                    <Button size='sm' variant='plain' onClick={handleMaxOutputTokensReset}>Reset</Button>
                  )}
                  sx={{ flex: 1 }}
                />
              </FormControl>
            </Grid>
          </Grid>

          {/* Advanced: Pricing Overrides */}
          <Grid container spacing={2} alignItems='center' sx={{ mt: 1 }}>
            <Grid xs={12}>
              <Typography level='title-sm'>
                Pricing Override (for hypothetical cost tracking)
              </Typography>
            </Grid>

            <Grid xs={12} md={6}>
              <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <FormLabelStart title='Input Price' description='$/Million Tokens' sx={{ minWidth: 120 }} />
                <Input
                  type='number'
                  variant='outlined'
                  placeholder={
                    // NOTE: direct access to the underlying, instead of via getLLMPricing
                    typeof llm.pricing?.chat?.input === 'number' ? llm.pricing.chat.input.toString() : 'not set'
                  }
                  value={
                    typeof llm.userPricing?.chat?.input === 'number' ? llm.userPricing.chat.input ?? '' : ''
                  }
                  onChange={handleInputPriceChange}
                  endDecorator={llm.userPricing?.chat?.input !== undefined && (
                    <Button size='sm' variant='plain' onClick={handleInputPriceReset}>Reset</Button>
                  )}
                  slotProps={{ input: { min: 0, step: 0.01 } }}
                  sx={{ flex: 1 }}
                />
              </FormControl>
            </Grid>

            <Grid xs={12} md={6}>
              <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <FormLabelStart title='Output Price' description='$/Million Tokens' sx={{ minWidth: 120 }} />
                <Input
                  type='number'
                  variant='outlined'
                  placeholder={
                    // NOTE: direct access to the underlying, instead of via getLLMPricing
                    typeof llm.pricing?.chat?.output === 'number' ? llm.pricing.chat.output.toString() : 'not set'
                  }
                  value={
                    typeof llm.userPricing?.chat?.output === 'number' ? llm.userPricing.chat.output ?? '' : ''
                  }
                  onChange={handleOutputPriceChange}
                  slotProps={{ input: { min: 0, step: 0.01 } }}
                  endDecorator={llm.userPricing?.chat?.output !== undefined && (
                    <Button size='sm' variant='plain' onClick={handleOutputPriceReset}>Reset</Button>
                  )}
                  sx={{ flex: 1 }}
                />
              </FormControl>
            </Grid>
          </Grid>

        </Box>}
      </FormControl>

    </GoodModal>

  );
}