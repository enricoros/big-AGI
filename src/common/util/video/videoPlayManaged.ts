/**
 * EXPERIMENTAL ephemeral video playback (Gemini Omni video generation).
 *
 * Shows a model-generated video in a lightweight full-screen overlay. The object URL is revoked when
 * the overlay closes, so NOTHING is persisted - the video is gone on reload. Deliberately tiny (no
 * store, no React portal, no NorthBridge coordination) while we experiment with generated video output.
 *
 * If we decide to keep generated video, this becomes a real fragment + renderer + (opt-in) persistence.
 */
export function videoPlayObjectUrl(objectUrl: string, label?: string): void {
  if (typeof document === 'undefined' || !objectUrl) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.82);cursor:zoom-out;';

  const video = document.createElement('video');
  video.src = objectUrl;
  video.controls = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.5);';
  if (label) video.setAttribute('aria-label', label);
  video.addEventListener('click', (e) => e.stopPropagation()); // clicking the video shouldn't close the overlay

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  function close(): void {
    if (!overlay.parentNode) return;
    video.pause();
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    URL.revokeObjectURL(objectUrl); // ephemeral: free the blob, nothing is kept
  }

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  overlay.appendChild(video);
  document.body.appendChild(overlay);
}
