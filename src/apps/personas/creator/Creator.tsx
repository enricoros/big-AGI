import * as React from 'react';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, FormLabel, Grid, IconButton, LinearProgress, Tab, tabClasses, TabList, TabPanel, Tabs, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsAccessibilityIcon from '@mui/icons-material/SettingsAccessibility';

import { LLMChainStep, useLLMChain } from '~/modules/aifn/useLLMChain';
import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { agiUuid } from '~/common/util/idUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useFormEditTextArray } from '~/common/components/forms/useFormEditTextArray';
import { useLLMSelect, useLLMSelectLocalState } from '~/common/components/forms/useLLMSelect';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';
import { useUIContentScaling } from '~/common/state/store-ui';

import { FromText } from './FromText';
import { FromYouTube } from './FromYouTube';
import { prependSimplePersona, SimplePersonaProvenance } from '../store-app-personas';


// delay to start a new chain after the previous one finishes
const CONTINUE_DELAY: number | false = false;


const Prompts: string[] = [
  "---\n**Stage 1: Character Analysis Role**\n\n\"You are an expert in analyzing and embodying diverse characters. Your mission is to meticulously study transcripts or provided texts to capture key attributes of a speaker. You will draft comprehensive character sheets and refine them for authenticity. Be creative, concise, and feel free to make reasonable assumptions without hedging.\"",
  "---\n\n**Stage 2: In-Depth Research and Analysis**\n\n\"Conduct a comprehensive analysis of the provided transcript or text. Identify and elaborate on the following aspects of the speaker:\n\n- **Age**\n- **Professional Field or Occupation**\n- **Distinct Personality Traits**\n- **Style of Communication**\n- **Narrative Context**\n- **Level of Self-Awareness**\n- **Use of Humor**\n- **Cultural Background**\n- **Core Values**\n- **Passions and Interests**\n- **Fears and Insecurities**\n- **Personal History**\n- **Social Interactions**\n\nYour output for this stage is an in-depth written analysis that captures both the superficial characteristics and the deeper nuances of the speaker's persona.\"",
  "---\n\n**Stage 3: Drafting the Character Sheet**\n\n\"Transform your analysis into a draft of the character sheet. The character sheet should encapsulate all crucial personality dimensions, along with the persona's motivations and aspirations. Strive for a balance between succinctness and depth of detail for each dimension. Use the following format:\n\n- **Nickname (character prefers to be called by this name):**\n\n- **Backstory (character would describe themselves as):** *(Up to 3000 characters)*\n\n- **Personality Traits:** *(List of adjectives that describe the character)*\n\n- **Tone:** *(One word that describes the character's overall tone)*\n\n- **Age:**\n\n- **History:** *(Detailed history of the character, up to 3000 characters)*\n\n- **Likes:** *(List of likes, up to 3000 characters)*\n\n- **Dislikes:** *(List of dislikes, up to 3000 characters)*\n\n- **Conversational Goals:** *(Up to 3000 characters)*\n\n- **Conversational Examples:** *(Up to 3000 characters)*\"",
  "---\n\n**Stage 4: Refinement and Validation**\n\n\"Compare your draft character sheet with the original transcript to validate its content. Ensure it captures both the speaker's overt characteristics and subtle undertones. Omit any unknown information. Fine-tune areas that require clarity, have been overlooked, or need more authenticity. Use clear and illustrative examples from the transcript to refine the sheet and provide meaningful, tangible reference points.\n\nYour final output is a coherent, comprehensive, and nuanced instruction that begins with 'You are a...' and serves as a go-to guide for an actor recreating the persona.\""
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
      addUserChainInput: true,
      addUserText: instructions[1],
    },
    {
      name: titles[2],
      addModelPrevOutput: true,
      addUserText: instructions[2],
    },
    {
      name: titles[3],
      addModelPrevOutput: true,
      addUserText: instructions[3],
    },
  ];
}


export const PersonaPromptCard = (props: {
  content: string,
  contentScaling: ContentScaling,
}) =>
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
      <ScaledTextBlockRenderer
        text={props.content}
        contentScaling={props.contentScaling}
        textRenderVariant='markdown'
      />
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
  const contentScaling = useUIContentScaling();
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
      id: agiUuid('persona-creator-chain'),
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
    chainOutputText,
    chainErrorMessage,
    userCancelChain,
    restartChain,
  } = useLLMChain(
    creationChainSteps,
    personaLlm?.id,
    chainInputText ?? undefined,
    'persona-extract',
    chainId,
    savePersona,
  );


  // Reset the relevant state when the selected tab changes
  React.useEffect(() => {
    setChainInputText(null);
  }, [selectedTab]);


  // [debug] Restart the chain when complete after a delay
  const debugRestart = !!CONTINUE_DELAY && !isTransforming && (chainProgress === 1 || !!chainErrorMessage);
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
    {!!chainErrorMessage && (
      <Alert color='warning' sx={{ mt: 1 }}>
        <Typography component='div'>{chainErrorMessage}</Typography>
      </Alert>
    )}

    {/* The Persona (Output) */}
    {chainOutputText && <>
      <PersonaPromptCard
        content={chainOutputText}
        contentScaling={contentScaling}
      />
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
