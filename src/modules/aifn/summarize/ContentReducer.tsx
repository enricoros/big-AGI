import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Alert, Box, Button, CircularProgress, Divider, FormControl, FormHelperText, FormLabel, Modal, ModalClose, ModalDialog, Option, Select, Slider, Stack, Textarea, Typography } from '@mui/joy';

import { DLLM, DLLMId } from '~/modules/llms/llm.types';
import { summerizeToFitContextBudget } from '~/modules/aifn/summarize/summerize';
import { useModelsStore } from '~/modules/llms/store-llms';

import { Section } from '~/common/components/Section';
import { countModelTokens } from '~/common/util/token-counter';

import { TokenBadge } from '../../../apps/chat/components/composer/TokenBadge';


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
  const { llms, fastLLMId } = useModelsStore(state => ({ llms: state.llms, fastLLMId: state.fastLLMId }), shallow);

  // state
  const [reducerModelId, setReducerModelId] = React.useState<DLLMId | null>(fastLLMId);
  const [compressionLevel, setCompressionLevel] = React.useState(3);
  const [reducedText, setReducedText] = React.useState('');
  const [processing, setProcessing] = React.useState(false);

  // derived state
  const reducedTokens = reducerModelId ? countModelTokens(reducedText, reducerModelId, 'content reducer reduce') : 0;
  const remainingTokens = props.tokenLimit - reducedTokens;


  const handleReducerModelChange = (event: any, value: DLLMId | null) => value && setReducerModelId(value);

  const handleCompressionLevelChange = (event: Event, newValue: number | number[]) => setCompressionLevel(newValue as number);

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
    <Modal open onClose={props.onClose}>

      <ModalDialog
        layout='center' variant='outlined' color='neutral'
        sx={{
          minWidth: 320,
        }}>

        <ModalClose />

        <Typography level='title-lg'>Content Reducer (preview)</Typography>

        <Divider sx={{ my: 2 }} />


        {/* Settings */}
        <Section>
          <Stack direction='column' sx={{ gap: 2 }}>

            <Typography level='body-sm'>
              Input: <b>{props.initialTokens.toLocaleString()}</b> tokens · Limit: <b>{props.tokenLimit.toLocaleString()}</b> tokens
              <br />
              compression needed ≥ <b>{props.tokenLimit ? Math.round(100 * props.initialTokens / props.tokenLimit) : 0}</b> %
            </Typography>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 120 }}>
                <FormLabel>Reducer model</FormLabel>
                <FormHelperText>{llms.find(llm => llm.id === reducerModelId)?.description?.slice(0, 10) ?? null}</FormHelperText>
              </Box>
              {reducerModelId && <Select value={reducerModelId} onChange={handleReducerModelChange} sx={{ minWidth: 140 }}>
                {llms.map((llm: DLLM) => (
                  <Option key={llm.id} value={llm.id}>
                    {llm.label} {llm.id === fastLLMId && '*'}
                  </Option>
                ))}
              </Select>}
            </FormControl>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 120 }}>
                <FormLabel>Compression</FormLabel>
                <FormHelperText>{compressionLevel < 2 ? 'Low' : compressionLevel > 4 ? 'High' : 'Medium'}</FormHelperText>
              </Box>
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
                fontSize: '14px',
                lineHeight: 1.75,
              }} />

            <TokenBadge directTokens={reducedTokens} tokenLimit={props.tokenLimit} absoluteBottomRight />

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

        <Box sx={{ mt: 4, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant='soft' color='neutral' onClick={props.onClose}>
            Close
          </Button>
          <Button variant='solid' color={remainingTokens >= 1 ? 'primary' : 'danger'} disabled={!reducedText} onClick={handleUseReducedTextClicked}>
            Use Reduced Text
          </Button>
        </Box>

      </ModalDialog>

    </Modal>
  );
}