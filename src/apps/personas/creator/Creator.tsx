import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, FormLabel, Grid, IconButton, LinearProgress, Tab, tabClasses, TabList, TabPanel, Tabs, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsAccessibilityIcon from '@mui/icons-material/SettingsAccessibility';

import { LLMChainStep, useLLMChain } from '~/modules/aifn/useLLMChain';
import { RenderMarkdownMemo } from '~/modules/blocks/markdown/RenderMarkdown';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useFormEditTextArray } from '~/common/components/forms/useFormEditTextArray';
import { useLLMSelect, useLLMSelectLocalState } from '~/common/components/forms/useLLMSelect';
import { useToggleableBoolean } from '~/common/util/useToggleableBoolean';

import { FromText } from './FromText';
import { FromYouTube } from './FromYouTube';
import { prependSimplePersona, SimplePersonaProvenance } from '../store-app-personas';


// delay to start a new chain after the previous one finishes
const CONTINUE_DELAY: number | false = false;


const Prompts: string[] = [
  'You are skilled in analyzing and embodying diverse characters. You meticulously study transcripts to capture key attributes, draft comprehensive character sheets, and refine them for authenticity. Feel free to make assumptions without hedging, be concise and be creative.',
  'Conduct comprehensive research on the provided transcript. Identify key characteristics of the speaker, including age, professional field, distinct personality traits, style of communication, narrative context, and self-awareness. Additionally, consider any unique aspects such as their use of humor, their cultural background, core values, passions, fears, personal history, and social interactions. Your output for this stage is an in-depth written analysis that exhibits an understanding of both the superficial and more profound aspects of the speaker\'s persona.',
  'Craft your documented analysis into a draft of the \'You are a...\' character sheet. It should encapsulate all crucial personality dimensions, along with the motivations and aspirations of the persona. Keep in mind to balance succinctness and depth of detail for each dimension. The deliverable here is a comprehensive draft of the character sheet that captures the speaker\'s unique essence.',
  'Compare the draft character sheet with the original transcript, validating its content and ensuring it captures both the speaker’s overt characteristics and the subtler undertones. Omit unknown information, fine-tune any areas that require clarity, have been overlooked, or require more authenticity. Use clear and illustrative examples from the transcript to refine your sheet and offer meaningful, tangible reference points. Your output is a coherent, comprehensive, and nuanced instruction that begins with \'You are a...\' and  serves as a go-to guide for an actor recreating the persona.',
];

const getTitlesForTab = (selectedTab: number): string[] => {
  const analyzeSubject: string = selectedTab ? 'text' : 'transcript';
  return [
    'Common: Creator System Prompt',
    `Analyze the ${analyzeSubject}`,
    'Define the character',
    'Cross the t\'s',
  ];
};

// chain to convert a text input string (e.g. youtube transcript) into a persona prompt
function createChain(instructions: string[], titles: string[]): LLMChainStep[] {
  return [
    {
      name: titles[1],
      setSystem: instructions[0],
      addUserInput: true,
      addUser: instructions[1],
    },
    {
      name: titles[2],
      addPrevAssistant: true,
      addUser: instructions[2],
    },
    {
      name: titles[3],
      addPrevAssistant: true,
      addUser: instructions[3],
    },
  ];
}


export const PersonaPromptCard = (props: { content: string }) =>
  <Card sx={{ boxShadow: 'md', mt: 3 }}>

    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography level='title-lg' color='success' startDecorator={<SettingsAccessibilityIcon color='success' />}>
        Persona Prompt
      </Typography>
      <GoodTooltip title='Copy system prompt'>
        <Button color='success' onClick={() => copyToClipboard(props.content, 'Persona prompt')} endDecorator={<ContentCopyIcon />} sx={{ minWidth: 120 }}>
          Copy
        </Button>
      </GoodTooltip>
    </Box>

    <CardContent>
      <Alert variant='soft' color='success' sx={{ mb: 1 }}>
        You may now copy the text below and use it as Custom prompt!
      </Alert>
      <RenderMarkdownMemo textBlock={{ type: 'text', content: props.content }} />
    </CardContent>
  </Card>;


export function Creator(props: { display: boolean }) {

  // state
  const advanced = useToggleableBoolean();
  const [selectedTab, setSelectedTab] = React.useState(0);
  const [chainInputText, setChainInputText] = React.useState<string | null>(null);
  const [inputProvenance, setInputProvenance] = React.useState<SimplePersonaProvenance | null>(null);
  const [showIntermediates, setShowIntermediates] = React.useState(false);

  // external state
  const [personaLlmId, setPersonaLlmId] = useLLMSelectLocalState(true);
  const [personaLlm, llmComponent] = useLLMSelect(personaLlmId, setPersonaLlmId, 'Persona Creation Model');


  // editable prompts
  const promptTitles = React.useMemo(() => getTitlesForTab(selectedTab), [selectedTab]);

  const {
    strings: editedInstructions, stringEditors: instructionEditors,
  } = useFormEditTextArray(Prompts, promptTitles);

  const { steps: creationChainSteps, id: chainId } = React.useMemo(() => {
    return {
      steps: createChain(editedInstructions, promptTitles),
      id: uuidv4(),
    };
  }, [editedInstructions, promptTitles]);

  const llmLabel = personaLlm?.label || undefined;
  const savePersona = React.useCallback((personaPrompt: string, inputText: string) => {
    prependSimplePersona(personaPrompt, inputText, inputProvenance ?? undefined, llmLabel);
  }, [inputProvenance, llmLabel]);

  const {
    // isFinished,
    isTransforming,
    chainProgress,
    chainIntermediates,
    chainStepName,
    chainStepInterimChars,
    chainOutput,
    chainError,
    userCancelChain,
    restartChain,
  } = useLLMChain(creationChainSteps, personaLlm?.id, chainInputText ?? undefined, savePersona, 'persona-extract', chainId);


  // Reset the relevant state when the selected tab changes
  React.useEffect(() => {
    setChainInputText(null);
  }, [selectedTab]);


  // [debug] Restart the chain when complete after a delay
  const debugRestart = !!CONTINUE_DELAY && !isTransforming && (chainProgress === 1 || !!chainError);
  React.useEffect(() => {
    if (debugRestart) {
      const timeout = setTimeout(restartChain, CONTINUE_DELAY);
      return () => clearTimeout(timeout);
    }
  }, [debugRestart, restartChain]);


  const handleCreate = React.useCallback((text: string, provenance: SimplePersonaProvenance) => {
    setChainInputText(text);
    setInputProvenance(provenance);
  }, []);

  const handleCancel = React.useCallback(() => {
    setChainInputText(null);
    setInputProvenance(null);
    userCancelChain();
  }, [userCancelChain]);


  // Hide the GFX, but not the logic (hooks)
  if (!props.display)
    return null;

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
      sx={{
        // boxShadow: 'sm',
        borderRadius: 'md',
        // overflow: 'hidden',
        display: isTransforming ? 'none' : undefined,
      }}
    >
      <TabList
        sx={{
          minHeight: '3rem',
          [`& .${tabClasses.root}[aria-selected="true"]`]: {
            // color: 'primary.softColor',
            bgcolor: 'background.popup',
            boxShadow: 'sm',
            fontWeight: 'lg',
          },
          // first element
          '& > *:first-of-type': { borderTopLeftRadius: '0.5rem' },
        }}
      >
        <Tab>From YouTube</Tab>
        <Tab>From Text</Tab>
      </TabList>
      <TabPanel keepMounted value={0} sx={{ p: 3 }}>
        <FromYouTube isTransforming={isTransforming} onCreate={handleCreate} />
      </TabPanel>
      <TabPanel keepMounted value={1} sx={{ p: 3 }}>
        <FromText isCreating={isTransforming} onCreate={handleCreate} />
      </TabPanel>

      <Divider orientation='horizontal' />

      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {llmComponent}

        {advanced.on && (
          <Box sx={{ my: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {instructionEditors}
          </Box>
        )}

        <FormLabel onClick={advanced.toggle} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>
          {advanced.on ? 'Hide Advanced' : 'Advanced: Prompts'}
        </FormLabel>
      </Box>
    </Tabs>


    {/* Embodiment Progress */}
    {/* <GoodModal open> */}
    {isTransforming && <Card><CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
        <Typography color='success' level='title-sm' sx={{ fontWeight: 'lg' }}>
          {chainStepName}
        </Typography>
        <LinearProgress color='success' determinate value={Math.max(10, 100 * chainProgress)} sx={{ mt: 1.5 }} />
        <Typography level='body-sm' sx={{ mt: 1 }}>
          {chainStepInterimChars === null ? 'Loading ...' : `Generating (${chainStepInterimChars.toLocaleString()} bytes) ...`}
        </Typography>
      </Box>
      <Typography level='title-sm'>
        This may take 1-2 minutes.
        While larger models will produce higher quality prompts,
        if you experience any errors (e.g. LLM timeouts, or context overflows for larger videos)
        please try again with faster/smaller models.
      </Typography>
      <Button variant='soft' color='neutral' onClick={handleCancel} sx={{ ml: 'auto', minWidth: 100, mt: 3 }}>
        Cancel
      </Button>
    </CardContent></Card>}


    {/* Errors */}
    {!!chainError && (
      <Alert color='warning' sx={{ mt: 1 }}>
        <Typography component='div'>{chainError}</Typography>
      </Alert>
    )}

    {/* The Persona (Output) */}
    {chainOutput && <>
      <PersonaPromptCard content={chainOutput} />
    </>}


    {/* Input + Intermediate outputs (with expander) */}
    {(isTransforming || chainIntermediates?.length > 0) && <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 3, mb: 0.5, mx: 1 }}>
        <Typography level='title-lg'>
          {isTransforming ? 'Working ...' : 'Intermediate Work'}
        </Typography>
        <IconButton size='sm' variant={showIntermediates ? 'solid' : 'outlined'} onClick={() => setShowIntermediates(s => !s)}>
          <AddIcon />
        </IconButton>
      </Box>
      <Grid container spacing={2}>
        <Grid xs={12} md={showIntermediates ? 12 : 6}>
          <Card sx={{ height: '100%', overflow: 'hidden' }}>
            <CardContent>
              <Typography color='success' level='title-sm' sx={{ mb: 1 }}>
                Input Text
              </Typography>
              <Typography level='body-sm'>
                {showIntermediates ? chainInputText : (chainInputText?.slice(0, 280) + '...')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {chainIntermediates.map((intermediate, i) =>
          <Grid xs={12} md={showIntermediates ? 12 : 6} key={i}>
            <Card sx={{ height: '100%', overflow: 'hidden' }}>
              <CardContent>
                <Typography color='success' level='title-sm' sx={{ mb: 1 }}>
                  {i + 1}. {intermediate.name}
                </Typography>
                <Typography level='body-sm'>
                  {showIntermediates ? intermediate.output : (intermediate.output?.slice(0, 280) + '...')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>,
        )}
      </Grid>
    </>}

  </>;
}