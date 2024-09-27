import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, ButtonGroup, Divider, FormControl, Input, Switch, Tooltip, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import type { DChatGeneratePricing } from '~/common/stores/llms/llms.pricing';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useDefaultLLMIDs, useLLM } from '~/common/stores/llms/llms.hooks';

import { findModelVendor } from '../vendors/vendors.registry';


function VendorLLMOptionsComponent(props: { llmId: DLLMId }) {
  // get LLM (warning: this will refresh all children components on every change of any LLM field)
  const llm = useLLM(props.llmId);
  if (!llm)
    return 'Options issue: LLM not found for id ' + props.llmId;

  // get vendor
  const vendor = findModelVendor(llm.vId);
  if (!vendor)
    return `Options issue: Vendor not found for LLM ${props.llmId}, service ${llm.sId}, vendor ${llm.vId}`;

  return <vendor.LLMOptionsComponent llm={llm} />;
}


function prettyPricingComponent(chatPricing: DChatGeneratePricing): React.ReactNode {
  if (!chatPricing) return 'Pricing not available';

  const formatPrice = (price: DChatGeneratePricing['input']): string => {
    if (!price) return 'N/A';
    if (price === 'free') return 'Free';
    if (typeof price === 'number') return `$${price.toFixed(4)}`;
    if (Array.isArray(price))
      return price.map(bp => `${bp.upTo === null ? '>' : '<='} ${bp.upTo} tokens: ${formatPrice(bp.price)}`).join(', ');
    return 'Unknown';
  };

  const inputPrice = formatPrice(chatPricing.input);
  const outputPrice = formatPrice(chatPricing.output);

  let cacheInfo = '';
  if (chatPricing.cache) {
    const { read, write, duration } = chatPricing.cache;
    cacheInfo = `Cache: Read ${formatPrice(read)}, Write ${formatPrice(write)}, Duration: ${duration}s`;
  }

  return (
    <Typography level='body-sm'>
      <strong>Pricing ($/M tokens):</strong><br />
      Input: {inputPrice}<br />
      Output: {outputPrice}<br />
      {cacheInfo && <>{cacheInfo}<br /></>}
    </Typography>
  );
}


export function LLMOptionsModal(props: { id: DLLMId, onClose: () => void }) {

  // state
  const [showDetails, setShowDetails] = React.useState(false);

  // external state
  const llm = useLLM(props.id);
  const { chatLLMId, fastLLMId, funcLLMId } = useDefaultLLMIDs();
  const { removeLLM, updateLLM, setChatLLMId, setFastLLMId, setFuncLLMId } = llmsStoreActions();

  if (!llm)
    return <>Options issue: LLM not found for id {props.id}</>;

  const isChatLLM = chatLLMId === props.id;
  const isFastLLM = fastLLMId === props.id;
  const isFuncLLM = funcLLMId === props.id;

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
        <VendorLLMOptionsComponent llmId={props.id} />
      </Box>

      <Divider />

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Name' sx={{ minWidth: 80 }} />
        <Input variant='outlined' value={llm.label} onChange={handleLlmLabelSet} />
      </FormControl>

      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FormLabelStart title='Defaults' sx={{ minWidth: 80 }} />
        <ButtonGroup orientation='horizontal' size='sm' variant='outlined'>
          {/* Note: use Tooltip instead of GoodTooltip here, because GoodTooltip is not working well with ButtonGroup */}
          <Tooltip title={isChatLLM ? 'Default model for new Chats' : 'Make this model the default Chat model'}>
            <Button variant={isChatLLM ? 'solid' : undefined} onClick={() => setChatLLMId(isChatLLM ? null : props.id)}>Chat</Button>
          </Tooltip>
          <Tooltip title='Use this Model for "fast" features, such as Auto-Title, Summarize, etc.'>
            <Button variant={isFastLLM ? 'solid' : undefined} onClick={() => setFastLLMId(isFastLLM ? null : props.id)}>Fast</Button>
          </Tooltip>
          <Tooltip title='Use this Model for "function calling" and other structured features, such as Auto-Chart, Auto-Follow-ups, etc.'>
            <Button variant={isFuncLLM ? 'solid' : undefined} onClick={() => setFuncLLMId(isFuncLLM ? null : props.id)}>Func</Button>
          </Tooltip>
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

      {/*<FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>*/}
      {/* <FormLabelStart title='Flags' sx={{ minWidth: 80 }} /> >*/}
      {/*  <Checkbox color='neutral' checked={llm.tags?.includes('chat')} readOnly disabled label='Chat' sx={{ ml: 4 }} />*/}
      {/*  <Checkbox color='neutral' checked={llm.tags?.includes('stream')} readOnly disabled label='Stream' sx={{ ml: 4 }} />*/}
      {/*</FormControl>*/}

      <FormControl orientation='horizontal' sx={{ flexWrap: 'nowrap' }}>
        <FormLabelStart title='Details' sx={{ minWidth: 80 }} onClick={() => setShowDetails(!showDetails)} />
        {showDetails && <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
            config: {JSON.stringify(llm.options)}
          </Typography>
        </Box>}
      </FormControl>

    </GoodModal>

  );
}