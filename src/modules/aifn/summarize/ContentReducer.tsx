import * as React from 'react';

import { Alert, Box, Button, CircularProgress, Divider, FormControl, Option, Select, Slider, Stack, Textarea, Typography } from '@mui/joy';

import type { DLLM, DLLMId } from '~/common/stores/llms/llms.types';

import { TokenBadgeMemo } from '../../../apps/chat/components/composer/tokens/TokenBadge';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { Section } from '~/common/components/Section';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { useDefaultLLMIDs, useNonHiddenLLMs } from '~/common/stores/llms/llms.hooks';

import { summerizeToFitContextBudget } from './summerize';


function TokenUsageAlert({ usedTokens, tokenLimit }: { usedTokens: number, tokenLimit: number }) {
  const remainingTokens = tokenLimit - usedTokens;

  const message = remainingTokens >= 1
    ? `${usedTokens.toLocaleString()} reduced tokens and ${remainingTokens.toLocaleString()} tokens remaining.`
    : `⚠️ These ${usedTokens.toLocaleString()} tokens go over budget by ${(-remainingTokens).toLocaleString()} tokens.`;

  return <Alert variant='soft' color={remainingTokens >= 1 ? 'primary' : 'danger'} sx={{ mt: 1 }}>{message}</Alert>;
}


/**
 * Dialog to compress a PDF
 */
export function ContentReducer(props: {
  initialText: string,
  initialTokens: number,
  tokenLimit: number,
  onClose: () => void,
  onReducedText: (text: string) => void,
}) {

  // external state
  const llms = useNonHiddenLLMs();
  const { fastLLMId } = useDefaultLLMIDs();

  // state
  const [reducerModelId, setReducerModelId] = React.useState<DLLMId | null>(fastLLMId);
  const [compressionLevel, setCompressionLevel] = React.useState(3);
  const [reducedText, setReducedText] = React.useState('');
  const [processing, setProcessing] = React.useState(false);

  // derived state
  // const reducedTokens = reducerModelId ? estimateTextTokens(reducedText, reducerModel, 'content reducer reduce') ?? 0 : 0;
  const reducedTokens = 0; // DISABLED the line above, not ported to estimateTextTokens yet
  const remainingTokens = props.tokenLimit - reducedTokens;


  const handleReducerModelChange = (_event: any, value: DLLMId | null) => value && setReducerModelId(value);

  const handleCompressionLevelChange = (_event: Event, newValue: number | number[]) => setCompressionLevel(newValue as number);

  const handlePreviewClicked = async () => {
    setProcessing(true);
    if (reducerModelId) {
      const reducedText = await summerizeToFitContextBudget(props.initialText, props.tokenLimit, reducerModelId);
      setReducedText(reducedText);
    }
    setProcessing(false);
  };

  const handleUseReducedTextClicked = () => props.onReducedText(reducedText);

  // DISABLED: user shall select the model and compression level first
  // upon load, click the preview button
  // React.useEffect(() => {
  //   // noinspection JSIgnoredPromiseFromCall
  //   handlePreviewClicked();
  // }, [handlePreviewClicked]);

  return (
    <GoodModal
      open title='Content Reducer (preview)'
      onClose={props.onClose}
      startButton={
        <Button variant='solid' color={remainingTokens >= 1 ? 'primary' : 'danger'} disabled={!reducedText} onClick={handleUseReducedTextClicked}>
          Use Reduced Text
        </Button>
      }>

      <Divider />

      {/* Settings */}
      <Section>
        <Stack direction='column' sx={{ gap: 2 }}>

          <Typography level='body-sm'>
            Input: <b>{props.initialTokens.toLocaleString()}</b> tokens · Limit: <b>{props.tokenLimit.toLocaleString()}</b> tokens
            <br />
            compression needed ≥ <b>{props.tokenLimit ? Math.round(100 * props.initialTokens / props.tokenLimit) : 0}</b> %
          </Typography>

          <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <FormLabelStart title='Reducer model'
                            description={llms.find(llm => llm.id === reducerModelId)?.description?.slice(0, 10) ?? '[select]'} />
            {reducerModelId && <Select value={reducerModelId} onChange={handleReducerModelChange} sx={{ minWidth: 140 }}>
              {llms.map((llm: DLLM) => (
                <Option key={llm.id} value={llm.id}>
                  {llm.label} {llm.id === fastLLMId && '*'}
                </Option>
              ))}
            </Select>}
          </FormControl>

          <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
            <FormLabelStart title='Compression'
                            description={compressionLevel < 2 ? 'Low' : compressionLevel > 4 ? 'High' : 'Medium'} />
            <Slider
              color='neutral' disabled
              min={1} max={5} defaultValue={3}
              value={compressionLevel} onChange={handleCompressionLevelChange}
              valueLabelDisplay='auto'
              sx={{ py: 1, mt: 1.1 }}
            />
          </FormControl>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant='solid' color='primary' onClick={handlePreviewClicked} disabled={processing}>
              Preview
            </Button>
          </Box>

        </Stack>
      </Section>


      {/* Outputs */}
      <Section title='Compressed content'>

        {/* Readonly output and token counter */}
        <Box sx={{ flexGrow: 1, position: 'relative', minWidth: '30vw' }}>

          <Textarea
            readOnly
            variant='soft' autoFocus
            minRows={4} maxRows={8}
            value={reducedText}
            sx={{
              lineHeight: lineHeightTextareaMd,
            }} />

          <TokenBadgeMemo direct={reducedTokens} limit={props.tokenLimit} absoluteBottomRight />

          {/* indicator we're processing */}
          {processing && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <CircularProgress />
              <Typography level='body-sm' sx={{ mt: 1 }}>Reduction in progress.</Typography>
              <Typography level='body-xs'>This can take a few minutes</Typography>
            </Box>
          )}

        </Box>

        {!!reducedTokens && <TokenUsageAlert usedTokens={reducedTokens} tokenLimit={props.tokenLimit} />}

      </Section>

    </GoodModal>
  );
}