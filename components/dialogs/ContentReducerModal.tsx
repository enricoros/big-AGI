import * as React from 'react';

import { Alert, Badge, Box, Button, Divider, FormControl, FormHelperText, FormLabel, Modal, ModalClose, ModalDialog, Slider, Textarea, Typography } from '@mui/joy';

import { ChatModelId } from '@/lib/data';
import { Section } from '@/components/dialogs/SettingsModal';
import { countModelTokens } from '@/lib/tokens';


/**
 * Dialog to compress a PDF
 */
export function ContentReducerModal(props: {
  initialText: string,
  tokenBudget: number,
  chatModelId: ChatModelId,
  onClose: () => void,
  onReducedText: (text: string) => void,
}) {

  // state
  const [compressionLevel, setCompressionLevel] = React.useState(3);
  const [reducedText, setReducedText] = React.useState('');

  // external state
  // ...

  // derived state
  const reducedTokens = countModelTokens(reducedText, props.chatModelId);
  const remainingTokens = props.tokenBudget - reducedTokens;
  const budgetColor = remainingTokens < 1 ? 'danger' : 'primary';
  const budgetString = remainingTokens > 0
    ? `${reducedTokens.toLocaleString()} reduced tokens and ${remainingTokens.toLocaleString()} tokens remaining.`
    : `⚠️ These ${reducedTokens.toLocaleString()} tokens go over budget by ${(-remainingTokens).toLocaleString()} tokens.`;


  const handleCompressionLevelChange = (event: Event, newValue: number | number[]) =>
    setCompressionLevel(newValue as number);

  const handlePreviewClicked = () => {
    // just pass Input -> Output for now
    setReducedText(props.initialText);
  };

  const handleUseReducedTextClicked = () =>
    props.onReducedText(reducedText);


  return (
    <Modal open onClose={props.onClose}>

      <ModalDialog
        layout='center' variant='outlined' color='neutral'
        sx={{
          minWidth: 320,
        }}>

        <ModalClose />

        <Typography level='h5'>Content Reducer [Pre-Alpha]</Typography>

        <Divider sx={{ my: 2 }} />


        <Section title='Inputs'>

          <Typography>
            Text: {props.initialText.length.toLocaleString()} characters
          </Typography>
          <Typography>
            Budget: {props.tokenBudget.toLocaleString()} tokens
          </Typography>

        </Section>


        {/* Example User settings */}
        <Section title='Settings'>

          <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 120 }}>
              <FormLabel>Compression</FormLabel>
              <FormHelperText>{compressionLevel < 2 ? 'Low' : compressionLevel > 4 ? 'High' : 'Medium'}</FormHelperText>
            </Box>
            <Slider
              aria-label='Model Temperature' color='neutral'
              min={1} max={5} defaultValue={3}
              value={compressionLevel} onChange={handleCompressionLevelChange}
              valueLabelDisplay='auto'
              sx={{ py: 1, mt: 1.1 }}
            />
          </FormControl>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant='solid' color='primary' onClick={handlePreviewClicked}>
              Preview
            </Button>
          </Box>

        </Section>


        <Section title='Outputs'>

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

            <Badge
              size='md' variant='solid' max={65535} showZero={false}
              badgeContent={reducedTokens ? reducedTokens.toLocaleString() : 0} color={budgetColor}
              slotProps={{ badge: { sx: { position: 'static', transform: 'none' } } }}
              sx={{ position: 'absolute', bottom: 8, right: 8 }}
            />

          </Box>

          {!!reducedTokens && (
            <Alert variant='soft' color={budgetColor} sx={{ mt: 1 }}>
              {budgetString}
            </Alert>
          )}

        </Section>

        <Box sx={{ mt: 4, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant='soft' color='neutral' onClick={props.onClose}>
            Close
          </Button>
          <Button variant='solid' color={budgetColor} disabled={!reducedText} onClick={handleUseReducedTextClicked}>
            Use Reduced Text
          </Button>
        </Box>

      </ModalDialog>

    </Modal>
  );
}