const { contextBridge, desktopCapturer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  /** True when running inside the Electron shell. */
  isElectron: true,

  /**
   * Capture the primary screen as a PNG data-URL (silent — no browser picker dialog).
   * Returns null if capture fails.
   */
  captureScreen: async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      const primary = sources[0];
      if (!primary) return null;
      return primary.thumbnail.toDataURL();
    } catch (err) {
      console.error('[electronAPI] captureScreen failed:', err);
      return null;
    }
  },

});
