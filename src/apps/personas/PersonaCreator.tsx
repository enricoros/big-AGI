import * as React from 'react';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid, Input, LinearProgress, Tab, TabList, TabPanel, Tabs, Textarea, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsAccessibilityIcon from '@mui/icons-material/SettingsAccessibility';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { GoodModal } from '~/common/components/GoodModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { apiQuery } from '~/common/util/trpc.client';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useFormRadioLlmType } from '~/common/components/forms/useFormRadioLlmType';

import { LLMChainStep, useLLMChain } from './useLLMChain';


function extractVideoID(videoURL: string): string | null {
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^#&?]*).*/;
  const match = videoURL.match(regExp);
  return (match && match[1]?.length == 11) ? match[1] : null;
}


function useTranscriptFromVideo(videoID: string | null) {
  const { data, isFetching, isError, error } =
    apiQuery.ytpersona.getTranscript.useQuery({ videoId: videoID || '' }, {
      enabled: !!videoID,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    });
  return {
    title: data?.videoTitle ?? null,
    thumbnailUrl: data?.thumbnailUrl ?? null,
    transcript: data?.transcript?.trim() ?? null,
    isFetching,
    isError, error,
  };
}


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
  const [videoURL, setVideoURL] = React.useState('');
  const [videoID, setVideoID] = React.useState('');
  const [personaTranscript, setPersonaTranscript] = React.useState<string | null>(null);
  const [personaText, setPersonaText] = React.useState('');
  const [selectedTab, setSelectedTab] = React.useState(0);

  // external state
  const [personaLlm, llmComponent] = useFormRadioLlmType('Persona Creation Model');

  // fetch transcript when the Video ID is ready, then store it
  const { transcript, thumbnailUrl, title, isFetching, isError, error: transcriptError } =
    useTranscriptFromVideo(videoID);
  React.useEffect(() => setPersonaTranscript(transcript), [transcript]);

  // Reset the relevant state when the selected tab changes
  React.useEffect(() => {
      // reset state
      setVideoURL('');
      setVideoID('');
      setPersonaTranscript(null);
      setPersonaText('');
  }, [selectedTab]);

  // use the transformation sequence to create a persona
  const { isFinished, isTransforming, chainProgress, chainIntermediates, chainStepName, chainOutput, chainError, abortChain } =
    useLLMChain(PersonaCreationSteps, personaLlm?.id, personaTranscript ?? undefined);

  const handleVideoIdChange = (e: React.ChangeEvent<HTMLInputElement>) => setVideoURL(e.target.value);

  const handleFetchTranscript = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // stop the form submit
    const videoId = extractVideoID(videoURL);
    if (!videoId) {
      setVideoURL('Invalid');
    } else {
      setPersonaTranscript(null);
      setVideoID(videoId);
    }
  };

  // New handler for persona text change
  const handlePersonaTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPersonaText(e.target.value);
  };

  return <>

    <Typography level='title-sm' mb={3}>
      Create the <em>System Prompt</em> of an AI Persona from YouTube or Text.
    </Typography>

    <Tabs defaultValue={0} variant='outlined'
      value={selectedTab}
      onChange={(event, newValue) => setSelectedTab(newValue as number)}>
      <TabList sx={{ minHeight: 48 }}>
        <Tab>From YouTube Video</Tab>
        <Tab>From Text</Tab>
      </TabList>

      {/* YouTube URL inputs */}
      <TabPanel value={0} sx={{ p: 3 }}>

        <Typography level='title-md' startDecorator={<YouTubeIcon sx={{ color: '#f00' }} />} sx={{ mb: 3 }}>
          YouTube -&gt; Persona
        </Typography>

        <form onSubmit={handleFetchTranscript}>
          <Input
            required
            type='url'
            fullWidth
            variant='outlined'
            placeholder='YouTube Video URL'
            value={videoURL}
            onChange={handleVideoIdChange}
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button type='submit' variant='solid' disabled={isFetching || isTransforming || !videoURL} loading={isFetching} sx={{ minWidth: 140 }}>
              Create
            </Button>
            <GoodTooltip title='This example comes from the popular Fireship YouTube channel, which presents technical topics with irreverent humor.'>
              <Button variant='outlined' color='neutral' onClick={() => setVideoURL('https://www.youtube.com/watch?v=M_wZpSEvOkc')}>
                Example
              </Button>
            </GoodTooltip>
          </Box>
        </form>
      </TabPanel>

      {/* Text area for users to paste copied text */}
      <TabPanel value={1} sx={{ p: 3 }}>

        <Typography level='title-md' startDecorator={<TextFieldsIcon />} sx={{ mb: 3 }}>
          <b>Text</b> -&gt; Persona
        </Typography>

        <Textarea
          variant='outlined'
          minRows={4} maxRows={8}
          placeholder='Paste your text here...'
          value={personaText}
          onChange={handlePersonaTextChange}
          sx={{
            backgroundColor: 'background.level1',
            '&:focus-within': {
              backgroundColor: 'background.popup',
            },
            lineHeight: 1.75,
            mb: 1.5,
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button variant='solid' disabled={isFetching || isTransforming || !personaText} onClick={() => setPersonaTranscript(personaText)} sx={{ minWidth: 140 }}>
            Create
          </Button>
          {!!personaText?.length && <Typography level='body-sm'>{personaText.length.toLocaleString()}</Typography>}
        </Box>
      </TabPanel>
    </Tabs>

    {/* LLM selector (chat vs fast) */}
    {!isTransforming && !isFinished && <Box sx={{ mt: 3 }}>{llmComponent}</Box>}

    {/* Errors */}
    {isError && (
      <Alert color='warning' sx={{ mt: 1 }}>
        <Typography component='div'>{transcriptError?.message || 'Unknown error'}</Typography>
      </Alert>
    )}
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
          <Typography level='title-sm' sx={{ lineHeight: 1.75 }}>
            {chainOutput}
          </Typography>
        </CardContent>
      </Card>
    </>}

    {/* Input: Transcript*/}
    {personaTranscript && <>
      <Typography level='title-lg' sx={{ mt: 3, mb: 0.5 }}>
        Input Data
      </Typography>

      <Card>
        <CardContent>
          <Typography level='title-md' sx={{ mb: 1 }}>
            {title || 'Transcript / Text'}
          </Typography>
          <Box>
            {!!thumbnailUrl && <picture><img src={thumbnailUrl} alt='YouTube Video Thumbnail' height={80} style={{ float: 'left', marginRight: 8 }} /></picture>}
            <Typography level='body-sm'>
              {personaTranscript.slice(0, 280)}...
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