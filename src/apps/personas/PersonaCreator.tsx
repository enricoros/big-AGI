import * as React from 'react';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid, LinearProgress, Tab, TabList, TabPanel, Tabs, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsAccessibilityIcon from '@mui/icons-material/SettingsAccessibility';

import { RenderMarkdown } from '../chat/components/message/RenderMarkdown';

import { GoodModal } from '~/common/components/GoodModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useFormRadioLlmType } from '~/common/components/forms/useFormRadioLlmType';

import { LLMChainStep, useLLMChain } from './useLLMChain';
import { TabFromText } from './TabFromText';
import { TabFromYouTube } from './TabFromYouTube';


const PersonaCreationSteps: LLMChainStep[] = [
  {
    name: 'Analyzing the transcript / text',
    setSystem: 'You are skilled in analyzing and embodying diverse characters. You meticulously study transcripts to capture key attributes, draft comprehensive character sheets, and refine them for authenticity. Feel free to make assumptions without hedging, be concise and be creative.',
    addUserInput: true,
    addUser: 'Conduct comprehensive research on the provided transcript. Identify key characteristics of the speaker, including age, professional field, distinct personality traits, style of communication, narrative context, and self-awareness. Additionally, consider any unique aspects such as their use of humor, their cultural background, core values, passions, fears, personal history, and social interactions. Your output for this stage is an in-depth written analysis that exhibits an understanding of both the superficial and more profound aspects of the speaker\'s persona.',
  },
  {
    name: 'Defining the character',
    addPrevAssistant: true,
    addUser: 'Craft your documented analysis into a draft of the \'You are a...\' character sheet. It should encapsulate all crucial personality dimensions, along with the motivations and aspirations of the persona. Keep in mind to balance succinctness and depth of detail for each dimension. The deliverable here is a comprehensive draft of the character sheet that captures the speaker\'s unique essence.',
  },
  {
    name: 'Crossing the t\'s',
    addPrevAssistant: true,
    addUser: 'Compare the draft character sheet with the original transcript, validating its content and ensuring it captures both the speaker’s overt characteristics and the subtler undertones. Omit unknown information, fine-tune any areas that require clarity, have been overlooked, or require more authenticity. Use clear and illustrative examples from the transcript to refine your sheet and offer meaningful, tangible reference points. Your output is a coherent, comprehensive, and nuanced instruction that begins with \'You are a...\' and  serves as a go-to guide for an actor recreating the persona.',
  },
  // {
  //   name: 'Shrink',
  //   addPrevAssistant: true,
  //   addUser: 'Now remove all the uncertain information, omit unknown information, Your output is a coherent, comprehensive, and nuanced instruction that begins with \'You are a...\' and serves as a go-to guide for a recreating the persona.',
  // },
];


export function PersonaCreator() {

  // state
  const [selectedTab, setSelectedTab] = React.useState(0);
  const [chainInputText, setChainInputText] = React.useState<string | null>(null);
  const [_inputTitle, setInputTitle] = React.useState<string | null>(null);

  // external state
  const [personaLlm, llmComponent] = useFormRadioLlmType('Creation Model');


  // chain to convert a text input string (e.g. youtube transcript) into a persona prompt
  const creationChainSteps = React.useMemo((): LLMChainStep[] => {
    return [...PersonaCreationSteps];
  }, []);

  const savePersona = React.useCallback((_personaPrompt: string) => {
    // TODO.. save the persona prompt here
  }, []);

  const {
    isFinished,
    isTransforming,
    chainProgress,
    chainIntermediates,
    chainStepName,
    chainStepInterimChars,
    chainOutput,
    chainError,
    abortChain,
  } = useLLMChain(creationChainSteps, personaLlm?.id, chainInputText ?? undefined, savePersona);


  // Reset the relevant state when the selected tab changes
  React.useEffect(() => {
    setChainInputText(null);
  }, [selectedTab]);


  const handleCreate = React.useCallback((text: string, title: string | null) => {
    setChainInputText(text);
    setInputTitle(title);
  }, []);


  return <>

    <Typography level='title-sm' mb={3}>
      Create the <em>System Prompt</em> of an AI Persona from YouTube or Text.
    </Typography>


    {/* Inputs */}
    <Tabs
      variant='outlined'
      defaultValue={0}
      value={selectedTab}
      onChange={(_event, newValue) => setSelectedTab(newValue as number)}
      sx={{ borderRadius: 'md' }}
    >
      <TabList sx={{ minHeight: '3rem' }}>
        <Tab>From YouTube Video</Tab>
        <Tab>From Text</Tab>
      </TabList>
      <TabPanel keepMounted value={0} sx={{ p: 3 }}>
        <TabFromYouTube isTransforming={isTransforming} onCreate={handleCreate} />
      </TabPanel>
      <TabPanel keepMounted value={1} sx={{ p: 3 }}>
        <TabFromText isCreating={isTransforming} onCreate={handleCreate} />
      </TabPanel>
    </Tabs>


    {/* LLM section */}
    {!isTransforming && !isFinished && (
      <Card sx={{ mt: 1 }}>
        {llmComponent}
      </Card>
    )}


    {/* Errors */}
    {!!chainError && (
      <Alert color='warning' sx={{ mt: 1 }}>
        <Typography component='div'>{chainError}</Typography>
      </Alert>
    )}

    {/* Persona! */}
    {chainOutput && <>
      <Card sx={{ boxShadow: 'md', mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography level='title-lg' color='success' startDecorator={<SettingsAccessibilityIcon color='success' />}>
            Persona Prompt
          </Typography>
          <GoodTooltip title='Copy system prompt'>
            <Button color='success' onClick={() => copyToClipboard(chainOutput, 'Persona prompt')} endDecorator={<ContentCopyIcon />} sx={{ minWidth: 120 }}>
              Copy
            </Button>
          </GoodTooltip>
        </Box>
        <CardContent>
          <Alert variant='soft' color='success' sx={{ mb: 1 }}>
            You may now copy the text below and use it as Custom prompt!
          </Alert>
          <RenderMarkdown textBlock={{ type: 'text', content: chainOutput }} />
        </CardContent>
      </Card>
    </>}


    {/* Input: Transcript/Text */}
    {chainInputText && <>
      <Typography level='title-lg' sx={{ mt: 3, mb: 0.5 }}>
        Input Data
      </Typography>

      <Card>
        <CardContent>
          <Typography level='title-md' sx={{ mb: 1 }}>
            Transcript / Text
          </Typography>
          <Box>
            <Typography level='body-sm'>
              {chainInputText.slice(0, 280)}...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </>}

    {/* Intermediate outputs rendered as cards in a grid */}
    {chainIntermediates && chainIntermediates.length > 0 && <>
      <Typography level='title-lg' sx={{ mt: 3, mb: 0.5 }}>
        {isTransforming ? 'Working...' : 'Intermediate Work'}
      </Typography>

      <Grid container spacing={2}>
        {chainIntermediates.map((intermediate, i) =>
          <Grid xs={12} sm={6} md={4} key={i}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography level='title-sm' sx={{ mb: 1 }}>
                  {i + 1}. {PersonaCreationSteps[i].name}
                </Typography>
                <Typography level='body-sm'>
                  {intermediate?.slice(0, 140)}...
                </Typography>
              </CardContent>
            </Card>
          </Grid>,
        )}
      </Grid>
    </>}


    {/* Dialog: Embodiment Progress */}
    {isTransforming && <GoodModal open>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
        <CircularProgress color='primary' value={Math.max(10, 100 * chainProgress)} />
      </Box>
      <Box>
        <Typography color='success' level='title-lg'>
          Embodying Persona ...
        </Typography>
        <Typography level='title-sm' sx={{ mt: 1 }}>
          Using: {personaLlm?.label}
        </Typography>
      </Box>
      <Box>
        <Typography color='success' level='title-sm' sx={{ fontWeight: 600 }}>
          {chainStepName}
        </Typography>
        <LinearProgress color='success' determinate value={Math.max(10, 100 * chainProgress)} sx={{ mt: 1.5 }} />
        <Typography level='title-sm' sx={{ mt: 1 }}>
          {chainStepInterimChars === null ? 'Loading ...' : `Generating (${chainStepInterimChars.toLocaleString()} bytes) ...`}
        </Typography>
      </Box>
      <Typography level='title-sm'>
        This may take 1-2 minutes. Do not close this window or the progress will be lost.
        While larger models will produce higher quality prompts,
        if you experience any errors (e.g. LLM timeouts, or context overflows for larger videos)
        please try again with faster/smaller models.
      </Typography>
      <Button variant='soft' color='neutral' onClick={abortChain} sx={{ ml: 'auto', minWidth: 100, mt: 3 }}>
        Cancel
      </Button>
    </GoodModal>}

  </>;
}