import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Card, IconButton, Input, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { useYouTubeTranscript, YTVideoTranscript } from '~/modules/youtube/useYouTubeTranscript';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';

import type { SimplePersonaProvenance } from '../store-app-personas';


function extractVideoID(videoURL: string): string | null {
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^#&?]*).*/;
  const match = videoURL.match(regExp);
  return (match && match[1]?.length == 11) ? match[1] : null;
}


function YouTubeVideoTranscriptCard(props: { transcript: YTVideoTranscript, onClose: () => void, sx?: SxProps }) {
  const { transcript } = props;
  return (
    <Card
      variant='soft'
      sx={{
        border: '1px dashed',
        borderColor: 'neutral.solidBg',
        p: 1,
        ...props.sx,
      }}
    >
      <Box sx={{ position: 'relative' }}>
        {!!transcript.thumbnailUrl && (
          <picture style={{ lineHeight: 0 }}>
            <img
              src={transcript.thumbnailUrl}
              alt='YouTube Video Thumbnail'
              height={80}
              style={{ float: 'left', marginRight: 8 }}
            />
          </picture>
        )}

        {/*<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>*/}
        <Typography level='title-sm'>
          {transcript?.title}
        </Typography>
        <Typography level='body-xs' sx={{ mt: 0.75 }}>
          {transcript?.transcript.slice(0, 280)}...
        </Typography>
        {/*</Box>*/}

        <IconButton
          size='sm'
          onClick={props.onClose}
          sx={{
            position: 'absolute', top: -8, right: -8,
            borderRadius: 'md',
          }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>
    </Card>
  );
}


export function FromYouTube(props: {
  isTransforming: boolean;
  onCreate: (text: string, provenance: SimplePersonaProvenance) => void;
}) {

  // state
  const [videoURL, setVideoURL] = React.useState('');
  const [videoID, setVideoID] = React.useState<string | null>(null);

  // external state

  const { onCreate } = props;
  const onNewTranscript = React.useCallback((transcript: YTVideoTranscript) => {
    // setVideoID(null); // reset the video ID, to cycle the refetch
    onCreate(
      transcript.transcript,
      {
        type: 'youtube',
        url: videoURL,
        title: transcript.title,
        thumbnailUrl: transcript.thumbnailUrl,
      },
    );
  }, [onCreate, videoURL]);

  const {
    transcript,
    isFetching, isError, error,
  } = useYouTubeTranscript(videoID, onNewTranscript);


  const handleVideoURLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoID(null);
    setVideoURL(e.target.value);
  };

  const handleCreateFromTranscript = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // stop the form submit

    const videoId = extractVideoID(videoURL) || null;
    if (!videoId)
      setVideoURL('Invalid');

    // kick-start the transcript fetch
    setVideoID(videoId);
  };


  return <>

    <Typography level='title-md' startDecorator={<YouTubeIcon sx={{ color: '#f00' }} />} sx={{ mb: 3 }}>
      YouTube -&gt; Persona
    </Typography>

    <form onSubmit={handleCreateFromTranscript}>
      <Input
        required
        type='url'
        fullWidth
        disabled={isFetching || props.isTransforming}
        variant='outlined'
        placeholder='YouTube Video URL'
        value={videoURL}
        onChange={handleVideoURLChange}
        sx={{ mb: 1.5, backgroundColor: 'background.popup' }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          type='submit' variant='solid'
          disabled={isFetching || props.isTransforming || !videoURL}
          loading={isFetching}
          sx={{ minWidth: 140 }}
        >
          Create
        </Button>

        <GoodTooltip title='This example comes from the popular Fireship YouTube channel, which presents technical topics with irreverent humor.'>
          <Button variant='outlined' color='neutral' onClick={() => setVideoURL('https://www.youtube.com/watch?v=M_wZpSEvOkc')}>
            Example
          </Button>
        </GoodTooltip>
      </Box>
    </form>

    {isError && (
      <InlineError error={error} sx={{ mt: 3 }} />
    )}

    {!!transcript && !!videoID && (
      <YouTubeVideoTranscriptCard transcript={transcript} onClose={() => setVideoID(null)} sx={{ mt: 3 }} />
    )}

  </>;
}