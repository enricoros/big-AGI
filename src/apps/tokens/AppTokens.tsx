import * as React from 'react';

import { Box, Container, FormControl, Textarea, Typography } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { countTokenizerTokens, preloadTiktokenLibrary } from '~/common/util/token-counter';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { useTokenizerSelect } from '~/common/components/forms/useTokenizerSelect';


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
    preloadTiktokenLibrary().catch(console.error);
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
      const details = countTokenizerTokens(text, encodingId, 'AppTokens');
      setTokenDetails(details || []);
    }
  };

  // when the text or tokenizer changes, update the token details
  React.useEffect(() => {
    tokenizerId && updateTokenDetails(text, tokenizerId);
  }, [text, tokenizerId]);


  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 3, md: 6 } }}>

      <Container disableGutters maxWidth='md' sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        <Box sx={{ mb: 2 }}>
          <Typography level='h1' sx={{ mb: 1 }}>Tokens</Typography>
          <Typography>Developer tool to check your prompts with different tokenizers.</Typography>
        </Box>

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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography level='title-lg'>Tokens details</Typography>
            <Box sx={{ lineHeight: 'lg', fontSize: 'sm' }}>
              {tokenDetails.map((detail, index) => (
                <Box key={'t-' + detail.token + '-i-' + index} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <span>[{detail.token?.toLocaleString()}]: {detail.bytes}</span>
                  <span style={{ whiteSpace: 'pre-wrap', background: generateColor(index) }}>{detail.chunk}</span>
                </Box>
              ))}
            </Box>
          </Box>
        )}

      </Container>
    </Box>
  );
}