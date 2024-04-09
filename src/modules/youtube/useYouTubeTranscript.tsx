// Copyright (c) 2023-2024 Enrico Ros
// This subsystem is responsible for fetching the transcript of a YouTube video.
// It is used by the Big-AGI Persona Creator to create a character sheet.

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { frontendSideFetch } from '~/common/util/clientFetchers';

import { fetchYouTubeTranscript } from './youtube.fetcher';
import { apiAsync } from '~/common/util/trpc.client';

// configuration
const USE_FRONTEND_FETCH = false;


export interface YTVideoTranscript {
  title: string;
  transcript: string;
  thumbnailUrl: string;
}

export function useYouTubeTranscript(videoID: string | null, onNewTranscript: (transcript: YTVideoTranscript) => void) {

  // state
  const [transcript, setTranscript] = React.useState<YTVideoTranscript | null>(null);

  // data
  const { data, isFetching, isError, error } = useQuery({
    enabled: !!videoID,
    queryKey: ['transcript', videoID],
    queryFn: async () => USE_FRONTEND_FETCH
      ? fetchYouTubeTranscript(videoID!, url => frontendSideFetch(url).then(res => res.text()))
      : apiAsync.youtube.getTranscript.query({ videoId: videoID! }),
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
    isError, error,
  };
}