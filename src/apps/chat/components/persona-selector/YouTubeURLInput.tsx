import * as React from 'react';

import { Box, Button, Input } from '@mui/joy';
import YouTubeIcon from '@mui/icons-material/YouTube';

import type { SxProps } from '@mui/joy/styles/types';
import { useYouTubeTranscript, YTVideoTranscript } from '~/modules/youtube/useYouTubeTranscript';


interface YouTubeURLInputProps {
  onSubmit: (transcript: string) => void;
  isFetching: boolean;
  sx?: SxProps;
}

export const YouTubeURLInput: React.FC<YouTubeURLInputProps> = ({ onSubmit, isFetching, sx }) => {
  const [url, setUrl] = React.useState('');
  const [submitFlag, setSubmitFlag] = React.useState(false);

  // Function to extract video ID from URL
  function extractVideoID(videoURL: string): string | null {
    const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^#&?]*).*/;
    const match = videoURL.match(regExp);
    return (match && match[1]?.length == 11) ? match[1] : null;
  }

  const videoID = extractVideoID(url);

  // Callback function to handle new transcript
  const handleNewTranscript = (newTranscript: YTVideoTranscript) => {
    onSubmit(newTranscript.transcript); // Pass the transcript text to the onSubmit handler
    setSubmitFlag(false); // Reset submit flag after handling
  };

  const { transcript, isFetching: isTranscriptFetching, isError, error } = useYouTubeTranscript(videoID && submitFlag ? videoID : null, handleNewTranscript);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent form from causing a page reload
    setSubmitFlag(true); // Set flag to indicate a submit action
  };

  return (
    <Box sx={{ mb: 1, ...sx }}>
      <form onSubmit={handleSubmit}>
        <Input
          required
          type='url'
          fullWidth
          disabled={isFetching || isTranscriptFetching}
          variant='outlined'
          placeholder='Enter YouTube Video URL'
          value={url}
          onChange={handleChange}
          startDecorator={<YouTubeIcon sx={{ color: '#f00' }} />}
          sx={{ mb: 1.5, backgroundColor: 'background.popup' }}
        />
        <Button
          type='submit'
          variant='solid'
          disabled={isFetching || isTranscriptFetching || !url}
          loading={isFetching || isTranscriptFetching}
          sx={{ minWidth: 140 }}
        >
          Get Transcript
        </Button>
        {isError && <div>Error fetching transcript. Please try again.</div>}
      </form>
    </Box>
  );
};