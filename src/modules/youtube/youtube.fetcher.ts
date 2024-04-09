import { z } from 'zod';

const youtubeTranscriptionSchema = z.object({
  wireMagic: z.literal('pb3'),
  events: z.array(
    z.object({
      tStartMs: z.number(),
      dDurationMs: z.number().optional(),
      aAppend: z.number().optional(),
      segs: z.array(
        z.object({
          utf8: z.string(),
          tOffsetMs: z.number().optional(),
        }),
      ).optional(),
    }),
  ),
});

function extractFromTo(html: string, from: string, to: string, label: string): string {
  const indexStart = html.indexOf(from);
  const indexEnd = html.indexOf(to, indexStart);
  if (indexStart < 0 || indexEnd <= indexStart)
    throw new Error(`[YouTube API Issue] Could not find '${label}'`);
  return html.substring(indexStart, indexEnd);
}


interface YouTubeTranscriptData {
  videoId: string;
  videoTitle: string;
  thumbnailUrl: string;
  transcript: string;
}


export async function fetchYouTubeTranscript(videoId: string, fetchTextFn: (url: string) => Promise<string>): Promise<YouTubeTranscriptData> {

  // 1. find the captions URL within the video HTML page
  const html = await fetchTextFn(`https://www.youtube.com/watch?v=${videoId}`);

  const captionsUrlEnc = extractFromTo(html, 'https://www.youtube.com/api/timedtext', '"', 'Captions URL');
  const captionsUrl = decodeURIComponent(captionsUrlEnc.replaceAll('\\u0026', '&'));
  const thumbnailUrl = extractFromTo(html, 'https://i.ytimg.com/vi/', '"', 'Thumbnail URL').replaceAll('maxres', 'hq');
  const videoTitle = extractFromTo(html, '<title>', '</title>', 'Video Title').slice(7).replaceAll(' - YouTube', '').trim();

  // 2. fetch the captions
  // note: the desktop player appends this much: &fmt=json3&xorb=2&xobt=3&xovt=3&cbr=Chrome&cbrver=114.0.0.0&c=WEB&cver=2.20230628.07.00&cplayer=UNIPLAYER&cos=Windows&cosver=10.0&cplatform=DESKTOP
  const captions = await fetchTextFn(captionsUrl + `&fmt=json3`);

  let captionsJson: any;
  try {
    captionsJson = JSON.parse(captions);
  } catch (e) {
    console.error(e);
    throw new Error('[YouTube API Issue] Could not parse the captions');
  }
  const safeData = youtubeTranscriptionSchema.safeParse(captionsJson);
  if (!safeData.success) {
    console.error(safeData.error);
    throw new Error('[YouTube API Issue] Could not verify the captions');
  }

  // 3. flatten to text
  const transcript = safeData.data.events
    .flatMap(event => event.segs ?? [])
    .map(seg => seg.utf8)
    .join('');

  return {
    videoId,
    videoTitle,
    thumbnailUrl,
    transcript,
  };
}