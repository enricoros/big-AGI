export function extractYoutubeVideoIDFromURL(testYTUrl: string): string | null {

  /* NOTE: We had this approach before, but changing to using the URL class for parsing.
   * const regExpInitial = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})(?:\S+)?$/;
   * const regExpProbOkay = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|clip\/)|youtu\.be\/)([\w-]{11})(?:\S+)?$/;
   * const match = videoURL.match(regExp);
   * return match ? match[1] : null;
   */
  try {
    testYTUrl = testYTUrl.trim();
    if (!testYTUrl)
      return null;

    // relax protocol
    // noinspection HttpUrlsUsage
    if (!testYTUrl.startsWith('http://') && !testYTUrl.startsWith('https://'))
      testYTUrl = 'https://' + testYTUrl;

    const url = new URL(testYTUrl);

    // require a YouTube hostname
    const youtubeDomainPatterns = [
      /^(?:www\.)?youtube\.com$/,                    // Main domain
      /^(?:.*\.)?youtube\.com$/,                     // Any subdomain
      /^youtu\.be$/,                                 // Short links
      /^youtube\.[a-z]{2,3}(?:\.[a-z]{2})?$/,        // Country-specific domains
    ] as const;
    const isYoutubeHostname = youtubeDomainPatterns.some(pattern => pattern.test(url.hostname));
    if (!isYoutubeHostname)
      return null;

    // YouTube video ID validation pattern
    const videoIdPattern = /^[\w-]{11}$/;

    // SHORTLINK path match
    if (url.hostname === 'youtu.be') {
      const possibleID = url.pathname.slice(1).split('/')[0]; // Get first path segment
      if (videoIdPattern.test(possibleID))
        return possibleID;
      // console.log('[DEV]: Invalid youtu.be video ID:', possibleID);
      return null;
    }

    // QUERY match - Check for video ID in query parameters - both 'v' and 'video_id'
    const queryVideoId = url.searchParams.get('v') || url.searchParams.get('video_id');
    if (queryVideoId && videoIdPattern.test(queryVideoId))
      return queryVideoId;

    // PATH match - Handle various YouTube path patterns
    const validPaths = ['watch', 'embed', 'shorts', 'live', 'clip', 'v'];
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // If the first segment is a known path type, look for ID in the next segment
    if (pathSegments.length >= 2 && validPaths.includes(pathSegments[0])) {
      const possibleID = pathSegments[1];
      if (videoIdPattern.test(possibleID))
        return possibleID;
    }

    // Check each path segment for a valid video ID
    for (const segment of pathSegments)
      if (videoIdPattern.test(segment))
        return segment;

    return null;
  } catch (e) {
    return null;
  }
}