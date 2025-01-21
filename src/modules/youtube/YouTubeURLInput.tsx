import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Input } from '@mui/joy';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { InlineError } from '~/common/components/InlineError';

import type { YouTubeVideoData } from './youtube.types';
import { extractYoutubeVideoIDFromURL } from './youtube.utils';
import { youTubeGetVideoData } from './useYouTubeTranscript';


interface YouTubeURLInputProps {
  onSubmit: (transcript: string) => void;
  sx?: SxProps;
}

export const YouTubeURLInput: React.FC<YouTubeURLInputProps> = ({ onSubmit, sx }) => {

  // state
  const [url, setUrl] = React.useState('');

  // derived state
  const validVideoId = extractYoutubeVideoIDFromURL(url);

  // query
  const { isFetching: isTranscriptFetching, refetch: refetchTranscript, isError, error, isSuccess } = useQuery({
    enabled: false,
    queryKey: ['videoData', validVideoId],
    queryFn: async (): Promise<YouTubeVideoData> => youTubeGetVideoData(validVideoId!),
    staleTime: Infinity,
  });


  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  }, [setUrl]);

  const handleSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent form from causing a page reload

    const result = await refetchTranscript();
    if (result.data)
      onSubmit(result.data.transcript);

  }, [onSubmit, refetchTranscript]);


  return (
    <Box sx={sx}>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
            sx={{ backgroundColor: 'background.popup' }}
          />
          <Button
            type='submit'
            color={isSuccess ? 'success' : isTranscriptFetching ? 'neutral' : 'primary'}
            variant={isSuccess ? 'soft' : !validVideoId ? 'outlined' : 'solid'}
            disabled={!validVideoId}
            loading={isTranscriptFetching}
            sx={{ minWidth: 140 }}
            // endDecorator={isSuccess ? '✓' : undefined}
          >
            Get Transcript
          </Button>
        </Box>
      </form>
      {isError && <InlineError error={`Error fetching transcript. Please try again. ${error.message}`}></InlineError>}
    </Box>
  );
};