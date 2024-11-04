import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Input } from '@mui/joy';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { extractYoutubeVideoIDFromURL } from '~/modules/youtube/youtube.utils';
import { useYouTubeTranscript, YTVideoTranscript } from '~/modules/youtube/useYouTubeTranscript';


interface YouTubeURLInputProps {
  onSubmit: (transcript: string) => void;
  sx?: SxProps;
}

export const YouTubeURLInput: React.FC<YouTubeURLInputProps> = ({ onSubmit, sx }) => {

  // state
  const [url, setUrl] = React.useState('');
  const [submitFlag, setSubmitFlag] = React.useState(false);

  const videoID = extractYoutubeVideoIDFromURL(url);

  // Callback function to handle new transcript
  const handleNewTranscript = React.useCallback((newTranscript: YTVideoTranscript) => {
    onSubmit(newTranscript.transcript); // Pass the transcript text to the onSubmit handler
    setSubmitFlag(false); // Reset submit flag after handling
  }, [onSubmit]);

  const { isFetching: isTranscriptFetching, isError, error } = useYouTubeTranscript(videoID && submitFlag ? videoID : null, handleNewTranscript);

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
          disabled={isTranscriptFetching}
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
          disabled={isTranscriptFetching || !url}
          loading={isTranscriptFetching}
          sx={{ minWidth: 140 }}
        >
          Get Transcript
        </Button>
        {isError && <div>Error fetching transcript. Please try again. ${JSON.stringify(error)}</div>}
      </form>
    </Box>
  );
};