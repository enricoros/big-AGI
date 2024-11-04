import { z } from 'zod';

import { getImageInformationFromBytes } from '~/modules/t2i/t2i.server';


/// THIS IS NORMALLY SERVER-SIDE CODE - do not include/invoke in the frontend ///


function extractFromTo(html: string, from: string, to: string, label: string): string {
  const indexStart = html.indexOf(from);
  const indexEnd = html.indexOf(to, indexStart);
  if (indexStart < 0 || indexEnd <= indexStart)
    throw new Error(`[YouTube API Issue] Could not find '${label}'`);
  return html.substring(indexStart, indexEnd);
}


interface YouTubeVideoData {
  videoId: string;
  videoTitle: string;
  videoDescription: string;
  thumbnailUrl: string;
  thumbnailImage: null | {
    imgDataUrl: string;
    mimeType: string;
    width: number;
    height: number;
  };
  transcript: string;
}

function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': '\'',
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
  };
  return text.replace(/&(?:#x?[0-9a-f]+|[a-z]+);/gi, (match) =>
    entities[match] || match,
  );
}

export async function downloadYouTubeVideoData(videoId: string, fetchTextFn: (url: string) => Promise<string>): Promise<YouTubeVideoData> {

  // 1. find the captions URL within the video HTML page
  const html = await fetchTextFn(`https://www.youtube.com/watch?v=${videoId}`);

  const captionsUrlEnc = extractFromTo(html, 'https://www.youtube.com/api/timedtext', '"', 'Captions URL');
  const captionsUrl = decodeURIComponent(captionsUrlEnc.replaceAll('\\u0026', '&'));

  const thumbnailUrl = extractFromTo(html, 'https://i.ytimg.com/vi/', '"', 'Thumbnail URL').replaceAll('maxres', 'hq');
  const videoTitle = decodeHtmlEntities(extractFromTo(html, '<title>', '</title>', 'Video Title').slice(7).replaceAll(' - YouTube', '').trim());
  const videoDescription = extractFromTo(html, ',"shortDescription":"', '","', 'Video Description').slice(21);

  // 2. fetch the captions
  // note: the desktop player appends this much: &fmt=json3&xorb=2&xobt=3&xovt=3&cbr=Chrome&cbrver=114.0.0.0&c=WEB&cver=2.20230628.07.00&cplayer=UNIPLAYER&cos=Windows&cosver=10.0&cplatform=DESKTOP
  const captions = await fetchTextFn(captionsUrl + `&fmt=json3`);

  // parse json
  let captionsJson: any;
  try {
    captionsJson = JSON.parse(captions);
  } catch (e) {
    console.error(e);
    throw new Error('[YouTube API Issue] Could not parse the captions');
  }

  // validate object
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

  // 4. fetch and process the thumbnail image
  let thumbnailImage: YouTubeVideoData['thumbnailImage'] = null;
  try {
    thumbnailImage = await _downloadAndConvertThumbnail(thumbnailUrl);
  } catch (error) {
    console.error('Error fetching or processing thumbnail:', error);
  }

  return {
    videoId,
    videoTitle,
    videoDescription,
    thumbnailUrl,
    thumbnailImage,
    transcript,
  };
}


async function _downloadAndConvertThumbnail(url: string): Promise<YouTubeVideoData['thumbnailImage']> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch thumbnail: HTTP ${response.status}`);
      return null;
    }
    // get low-level image information
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imgInfo = getImageInformationFromBytes(imageBuffer);
    // return the image dataurl and its information
    return {
      mimeType: imgInfo.mimeType,
      imgDataUrl: `data:${imgInfo.mimeType};base64,${base64Image}`,
      width: imgInfo.width,
      height: imgInfo.height,
    };
  } catch (error) {
    console.error('Error downloading or processing thumbnail:', error);
    return null;
  }
}
