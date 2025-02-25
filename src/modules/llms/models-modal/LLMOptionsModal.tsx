import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, ButtonGroup, Divider, FormControl, Input, Switch, Tooltip, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DPricingChatGenerate } from '~/common/stores/llms/llms.pricing';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { ModelDomainsList, ModelDomainsRegistry } from '~/common/stores/llms/model.domains.registry';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useModelDomains } from '~/common/stores/llms/hooks/useModelDomains';
import { useLLM } from '~/common/stores/llms/llms.hooks';

import { LLMOptionsGlobal } from './LLMOptionsGlobal';


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

  // state
  const [showDetails, setShowDetails] = React.useState(false);

  // external state
  const llm = useLLM(props.id);
  const domainAssignments = useModelDomains();
  const { removeLLM, updateLLM, assignDomainModelId } = llmsStoreActions();

  if (!llm)
    return <>Options issue: LLM not found for id {props.id}</>;

  const handleLlmLabelSet = (event: React.ChangeEvent<HTMLInputElement>) => updateLLM(llm.id, { label: event.target.value || '' });

  const handleLlmVisibilityToggle = () => updateLLM(llm.id, { hidden: !llm.hidden });

  const handleLlmDelete = () => {
    removeLLM(llm.id);
    props.onClose();
  };

  return (

    <GoodModal
      title={<><b>{llm.label}</b> options</>}
      open={!!props.id} onClose={props.onClose}
      startButton={
        <Button variant='plain' color='neutral' onClick={handleLlmDelete} startDecorator={<DeleteOutlineIcon />}>
          Delete
        </Button>
      }
    >

      <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
        <LLMOptionsGlobal llm={llm} />
      </Box>

      <Divider />

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Name' sx={{ minWidth: 80 }} />
        <Input variant='outlined' value={llm.label} onChange={handleLlmLabelSet} />
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Assignment' description='Default model' sx={{ minWidth: 80 }} />
        <ButtonGroup orientation='horizontal' size='sm' variant='outlined'>
          {ModelDomainsList.map(domainId => {
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

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Visible' sx={{ minWidth: 80 }} />
        <Tooltip title={!llm.hidden ? 'Show this model in the list of Chat models' : 'Hide this model from the list of Chat models'}>
          <Switch checked={!llm.hidden} onChange={handleLlmVisibilityToggle}
                  endDecorator={!llm.hidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
                  slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
        </Tooltip>
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'nowrap' }}>
        <FormLabelStart title='Details' sx={{ minWidth: 80 }} onClick={() => setShowDetails(!showDetails)} />
        {showDetails && <Box sx={{ display: 'flex', flexDirection: 'column', wordBreak: 'break-word', gap: 1 }}>
          {!!llm.description && <Typography level='body-sm'>
            {llm.description}
          </Typography>}
          {!!llm.pricing?.chat?._isFree && <Typography level='body-xs'>
            🎁 Free model - note: refresh models to check for updates in pricing
          </Typography>}
          <Typography level='body-xs'>
            llm id: {llm.id}<br />
            context tokens: <b>{llm.contextTokens ? llm.contextTokens.toLocaleString() : 'not provided'}</b>{` · `}
            max output tokens: <b>{llm.maxOutputTokens ? llm.maxOutputTokens.toLocaleString() : 'not provided'}</b><br />
            {!!llm.created && <>created: <TimeAgo date={new Date(llm.created * 1000)} /><br /></>}
            {/*· tags: {llm.tags.join(', ')}*/}
            {!!llm.pricing?.chat && prettyPricingComponent(llm.pricing.chat)}
            {/*{!!llm.benchmark && <>benchmark: <b>{llm.benchmark.cbaElo?.toLocaleString() || '(unk) '}</b> CBA Elo<br /></>}*/}
            {llm.parameterSpecs?.length > 0 && <>options: {llm.parameterSpecs.map(ps => ps.paramId).join(', ')}<br /></>}
            {Object.keys(llm.initialParameters || {}).length > 0 && <>initial parameters: {JSON.stringify(llm.initialParameters, null, 2)}<br /></>}
            {Object.keys(llm.userParameters || {}).length > 0 && <>user parameters: {JSON.stringify(llm.userParameters, null, 2)}<br /></>}
          </Typography>
        </Box>}
      </FormControl>

    </GoodModal>

  );
}