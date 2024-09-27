export function extractYoutubeVideoIDFromURL(videoURL: string): string | null {
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})(?:\S+)?$/;
  const match = videoURL.match(regExp);
  return match ? match[1] : null;
}