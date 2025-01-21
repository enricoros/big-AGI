export interface YouTubeVideoData {
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