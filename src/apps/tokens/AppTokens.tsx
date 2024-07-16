import * as React from 'react';

import { Box, FormControl, Textarea, Typography } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { preloadTiktokenLibrary, textTokensForEncodingId } from '~/common/tokens/tokens.text';
import { useTokenizerSelect } from '~/common/tokens/useTokenizerSelect';

import { AppSmallContainer } from '../AppSmallContainer';


function generateColor(index: number) {
  const hue = ((index + 1) * 137.508) % 360; // use golden angle approximation for color distribution
  return `hsl(${hue}, 80%, 80%)`;
}


export function AppTokens() {

  // Local state
  const [text, setText] = React.useState('');
  const [tokenizerId, _, tokenizerSelectComponent] = useTokenizerSelect('o200k_base');
  const [tokenDetails, setTokenDetails] = React.useState<{ token: number, chunk: string, bytes: string }[]>([]);


  // Ensure the Tiktoken library is preloaded
  React.useEffect(() => {
    preloadTiktokenLibrary().catch(console.error).then(() => setText('Welcome! Type or paste any text here to see the tokens.'));
  }, []);


  // If no text is set within 10 seconds, set a default text
  // React.useEffect(() => {
  //   if (text)
  //     return;
  //   const timer = setTimeout(() => {
  //     if (!text) {
  //       setText('Big-AGI\n\nIntelligence is a stream of tokens.');
  //     }
  //   }, 10000);
  //   return () => clearTimeout(timer);
  // }, [text]);


  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const updateTokenDetails = (text: string, encodingId: string | null) => {
    if (encodingId) {
      const details = textTokensForEncodingId(text, encodingId, 'AppTokens');
      setTokenDetails(details || []);
    }
  };

  // when the text or tokenizer changes, update the token details
  React.useEffect(() => {
    tokenizerId && updateTokenDetails(text, tokenizerId);
  }, [text, tokenizerId]);


  return (
    <AppSmallContainer
      title='Tokens'
      description='Developer tool to see how AI reads your prompts, word by word.'
    >

      <Box sx={{ display: 'flex' }}>
        {tokenizerSelectComponent}
      </Box>

      <FormControl>
        <FormLabelStart title='Text' />
        <Textarea
          placeholder='Paste or type here...'
          value={text}
          onChange={handleTextChange}
          minRows={5}
          maxRows={10}
          endDecorator={
            <Box sx={{
              backgroundColor: 'background.surface', px: 0.5, py: 0.25, borderRadius: 'xs',
              width: '100%', lineHeight: 'lg', fontSize: 'xs',
              display: 'flex', flexFlow: 'row wrap', gap: 1, justifyContent: 'space-between',
            }}>
              <div>Token Count: {tokenDetails?.length || 0}</div>
              <div>Character Count: {text.length}</div>
            </Box>
          }
          sx={{
            '&:focus-within': { backgroundColor: 'background.popup' },
            lineHeight: lineHeightTextareaMd,
            // boxShadow: 'none',
            mb: 1.5,
          }}
        />

      </FormControl>

      {tokenDetails.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 4 }}>
          <Box sx={{
            // looks
            fontFamily: 'code',
            // fontWeight: 400,
            whiteSpace: 'pre-wrap',
            // backgroundColor: 'background.surface',
            // py: 2,

            // layout
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: 0.25,
          }}>
            {tokenDetails.map((detail, index) => (
              <Box key={index} sx={{
                backgroundColor: generateColor(index),
                borderRadius: '0.2rem',
                padding: '0.1rem',
                boxShadow: 'xs',
              }}>
                {detail.chunk}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {tokenDetails.length > 0 && (
        <Box>
          <Typography level='title-lg' sx={{ mb: 1 }}>Token Details</Typography>
          <Box sx={{
            fontSize: 'sm',
            lineHeight: 'lg',

            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            columnGap: 2,
            rowGap: 0.25,
          }}>
            <div><b>Number</b></div>
            <div><b>Bytes</b></div>
            <div><b>Chunks</b></div>
            {tokenDetails.map((detail, index) => (
              <React.Fragment key={'t-' + detail.token + '-i-' + index}>
                <div style={{ textAlign: 'right' }}>{detail.token}</div>
                <div>{detail.bytes}</div>
                <div>
                  <span style={{
                    whiteSpace: 'pre-wrap',
                    background: generateColor(index),
                    display: 'inline-block',
                    padding: '1px 4px',
                    borderRadius: '2px',
                  }}>{detail.chunk}</span>
                </div>
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}

      <Typography level='body-sm'>
        Understanding tokenization helps create more effective AI prompts.
      </Typography>

    </AppSmallContainer>
  );
}