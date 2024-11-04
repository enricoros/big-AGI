// Copyright (c) 2023-2024 Enrico Ros
// This subsystem is responsible for fetching the transcript of a YouTube video.
// It is used by the Big-AGI Persona Creator to create a character sheet.

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

// import { fetchYouTubeTranscript } from './youtube.fetcher';
import { apiAsync } from '~/common/util/trpc.client';

// configuration
const USE_FRONTEND_FETCH = false;


export interface YTVideoTranscript {
  title: string;
  transcript: string;
  thumbnailUrl: string;
}

export async function youTubeGetVideoData(videoId: string) {
  if (USE_FRONTEND_FETCH) {
    // return fetchYouTubeTranscript(videoId, url => frontendSideFetch(url).then(res => res.text()));
    throw new Error('Big-AGI: Browser youtube transcript download is disabled.');
  }
  return apiAsync.youtube.getTranscript.query({ videoId });
}


export function useYouTubeTranscript(videoID: string | null, onNewTranscript: (transcript: YTVideoTranscript) => void) {

  // state
  const [transcript, setTranscript] = React.useState<YTVideoTranscript | null>(null);

  // data
  const { data, isFetching, isError, error } = useQuery({
    enabled: !!videoID,
    queryKey: ['transcript', videoID],
    queryFn: async () => youTubeGetVideoData(videoID!),
    staleTime: Infinity,
  });

  // update the transcript when the underlying data changes
  React.useEffect(() => {
    if (!data) {
      // setTranscript(null);
      return;
    }
    const transcript = {
      title: data.videoTitle,
      transcript: data.transcript,
      thumbnailUrl: data.thumbnailUrl,
    };
    setTranscript(transcript);
    onNewTranscript(transcript);
  }, [data, onNewTranscript]);


  return {
    transcript,
    isFetching,
    isError,
    error,
  };
}