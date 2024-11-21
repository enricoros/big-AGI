/// STAGE 1 - Mimetype Guessing

type GuessedMimeType = keyof typeof GuessedMimeLookupTable;
type GuessedMimeInfo = { ext: string[] | null, dt: GuessedMimeContents }
type GuessedMimeContents =
  | 'plain'     // text/plain
  | 'markdown'  //
  | 'html'      //
  | 'code'      //
  | 'doc-pdf' | 'doc-msw' | 'doc-msxl' | 'doc-msppt'
  | 'image' | 'audio' | 'video'
  | 'other';

const GuessedMimeLookupTable: Record<string, GuessedMimeInfo> = {
  // Plain text
  // - shall be rendered and edited as plain text
  'text/plain': { ext: ['txt', 'text', 'log', 'conf', 'def', 'list', 'in', 'ini'], dt: 'plain' },

  // Markdown
  // - shall be rendered with sizes and styles, as markdown does
  'text/markdown': { ext: ['md', 'markdown', 'mdown', 'mkd'], dt: 'markdown' },

  // HTML
  // - shall be rendered as an HTML page
  'text/html': { ext: ['htm', 'html', 'shtml', 'xhtml'], dt: 'html' },

  // SVG treated as code - or shall it not be?
  'image/svg+xml': { ext: ['svg'], dt: 'code' },

  // Code (including various programming languages)
  'text/css': { ext: ['css', 'scss', 'less', 'sass'], dt: 'code' },
  'text/javascript': { ext: ['js', 'mjs', 'jsx'], dt: 'code' },
  'application/x-javascript': { ext: null, dt: 'code' },
  'text/x-typescript': { ext: ['ts', 'tsx', 'd.ts'], dt: 'code' }, // TypeScript files (recommended is application/typescript, but we standardize to text/x-typescript instead as per Gemini's standard)
  'application/x-typescript': { ext: null, dt: 'code' },
  'text/csv': { ext: ['csv', 'tsv'], dt: 'code' },
  'text/x-python': { ext: ['py', 'pyw'], dt: 'code' },
  'application/x-python-code': { ext: null, dt: 'code' },
  'application/x-ipynb+json': { ext: ['ipynb'], dt: 'code' },
  'application/json': { ext: ['json', 'jsonld'], dt: 'code' },
  'text/xml': { ext: ['xml', 'xsl', 'xsd', 'rss', 'atom'], dt: 'code' },
  'application/rtf': { ext: ['rtf'], dt: 'code' },
  'text/rtf': { ext: null, dt: 'code' },
  'text/x-java': { ext: ['java', 'jsp', 'jspx', 'jhtm', 'jhtml'], dt: 'code' },
  'text/x-c': { ext: ['c', 'h'], dt: 'code' },
  'text/x-c++': { ext: ['cpp', 'hpp', 'cc', 'hh', 'cxx', 'hxx'], dt: 'code' },
  'text/x-csharp': { ext: ['cs', 'csx'], dt: 'code' },
  'text/x-ruby': { ext: ['rb', 'rhtml', 'rjs', 'rxml', 'erb'], dt: 'code' },
  'text/x-go': { ext: ['go'], dt: 'code' },
  'text/x-rust': { ext: ['rs'], dt: 'code' },
  'text/x-sh': { ext: ['sh', 'bash', 'zsh', 'ksh'], dt: 'code' },
  'text/x-scala': { ext: ['scala'], dt: 'code' },
  'text/x-kotlin': { ext: ['kt'], dt: 'code' },
  'text/x-swift': { ext: ['swift', 'swiftui'], dt: 'code' },

  // Document formats
  'application/pdf': { ext: ['pdf'], dt: 'doc-pdf' },
  'application/x-pdf': { ext: null, dt: 'doc-pdf' },
  'application/acrobat': { ext: null, dt: 'doc-pdf' },
  'application/msword': { ext: ['doc'], dt: 'doc-msw' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: ['docx'], dt: 'doc-msw' },
  'application/vnd.ms-excel': { ext: ['xls'], dt: 'doc-msxl' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: ['xlsx'], dt: 'doc-msxl' },
  'application/vnd.ms-powerpoint': { ext: ['ppt'], dt: 'doc-msppt' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: ['pptx'], dt: 'doc-msppt' },

  // Image formats
  'image/jpeg': { ext: ['jpg', 'jpeg', 'jpe'], dt: 'image' },
  'image/png': { ext: ['png'], dt: 'image' },
  'image/gif': { ext: ['gif'], dt: 'image' },
  'image/bmp': { ext: ['bmp'], dt: 'image' },
  'image/webp': { ext: ['webp'], dt: 'image' },
  'image/tiff': { ext: ['tif', 'tiff'], dt: 'image' },
  'image/x-icon': { ext: ['ico'], dt: 'image' },
  'image/heic': { ext: ['heic'], dt: 'image' },
  'image/heif': { ext: ['heif'], dt: 'image' },

  // Audio formats
  'audio/wav': { ext: ['wav'], dt: 'audio' },
  'audio/mpeg': { ext: ['mp3'], dt: 'audio' },
  'audio/ogg': { ext: ['ogg'], dt: 'audio' },
  'audio/aac': { ext: ['aac', 'm4a'], dt: 'audio' },
  'audio/aiff': { ext: ['aif', 'aiff', 'aifc'], dt: 'audio' },
  'audio/flac': { ext: ['flac'], dt: 'audio' },

  // Video formats
  'video/mp4': { ext: ['mp4', 'm4v'], dt: 'video' },
  'video/mpeg': { ext: ['mpeg', 'mpg'], dt: 'video' },
  'video/mov': { ext: ['mov'], dt: 'video' },
  'video/avi': { ext: ['avi'], dt: 'video' },
  'video/x-flv': { ext: ['flv'], dt: 'video' },
  'video/webm': { ext: ['webm', 'weba'], dt: 'video' },
  'video/wmv': { ext: ['wmv'], dt: 'video' },
  'video/3gpp': { ext: ['3gp', '3gpp'], dt: 'video' },

  // Compressed files
  'application/x-compressed': { ext: ['zip', 'rar', '7z', 'tar'], dt: 'other' },
  'application/x-gzip': { ext: ['gz'], dt: 'other' },
  'application/x-bzip2': { ext: ['bz2'], dt: 'other' },
};

const MdTitleToMimeLookupTable: Record<string, GuessedMimeType> = {
  'typescript': 'text/x-typescript',
  'ts': 'text/x-typescript',
  'tsx': 'text/x-typescript',
  'javascript': 'text/javascript',
  'js': 'text/javascript',
  'jsx': 'text/javascript',
  'python': 'text/x-python',
  'py': 'text/x-python',
  'json': 'application/json',
  'html': 'text/html',
  'htm': 'text/html',
  'css': 'text/css',
  'md': 'text/markdown',
  'markdown': 'text/markdown',
  'sh': 'text/x-sh',
  'bash': 'text/x-sh',
  'shell': 'text/x-sh',
  'csv': 'text/csv',
  'tsv': 'text/csv',
  'xml': 'text/xml',
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function reverseLookupMimeType(fileExtension: string): GuessedMimeType | null {
  for (const [mimeType, { ext }] of Object.entries(GuessedMimeLookupTable)) {
    if (ext && ext.includes(fileExtension))
      return mimeType;
  }
  return null;
}

export function reverseLookupMdTitle(mdTitle: string): { mimeType: GuessedMimeType, extension: string | null } | null {
  const guessedMimeType = MdTitleToMimeLookupTable[mdTitle] || null;
  if (guessedMimeType) {
    const { ext } = GuessedMimeLookupTable[guessedMimeType];
    return { mimeType: guessedMimeType, extension: (ext ? ext[0] : null) || null };
  }
  return null;
}

export function guessInputContentTypeFromMime(mimeType: GuessedMimeType): GuessedMimeContents {
  return GuessedMimeLookupTable[mimeType]?.dt ?? 'plain';
}

export function heuristicMimeTypeFixup(mimeType: GuessedMimeType, fileExtension?: string): GuessedMimeType {

  // Mpeg-transport video steam -> Typescript
  if (!mimeType.startsWith('text/') && fileExtension && GuessedMimeLookupTable['text/x-typescript']?.ext?.includes(fileExtension))
    return 'text/x-typescript';

  return mimeType;
}


/// STAGE 2 - Converter mimetypes, to decide which converter(s) to apply to an input

// MimeTypes to treat as plain text for attachment purposes
export function mimeTypeIsPlainText(mimeType: string): boolean {
  // we include this list: https://ai.google.dev/gemini-api/docs/prompting_with_media?lang=node#plain_text_formats
  // and include a greater number of plain text files
  const docType = GuessedMimeLookupTable[mimeType]?.dt;
  return docType === 'plain' || docType === 'markdown' || docType === 'html' || docType === 'code';
}

// Image Rules across the supported LLMs
//
// OpenAI: https://platform.openai.com/docs/guides/vision/what-type-of-files-can-i-upload
//  - Supported Image formats:
//    - Images are first scaled to fit within a 2048 x 2048 square (if larger), maintaining their aspect ratio.
//      Then, they are scaled down such that the shortest side of the image is 768px (if larger)
//    - PNG (.png), JPEG (.jpeg and .jpg), WEBP (.webp), and non-animated GIF (.gif)
//
// Google: https://ai.google.dev/gemini-api/docs/prompting_with_media
//  - Supported Image formats:
//    - models: gemini-1.5-pro, gemini-pro-vision
//    - PNG - image/png, JPEG - image/jpeg, WEBP - image/webp, HEIC - image/heic, HEIF - image/heif
//    - [strat] for prompts containing a single image, it might perform better if that image is placed before the text prompt
//    - Maximum of 16 individual images for the gemini-pro-vision and 3600 images for gemini-1.5-pro
//    - No specific limits to the number of pixels in an image; however, larger images are scaled down to
//    - fit a maximum resolution of 3072 x 3072 while preserving their original aspect ratio
//
//  - Supported Audio formats:
//    - models: gemini-1.5-pro
//    - WAV - audio/wav, MP3 - audio/mp3, AIFF - audio/aiff, AAC - audio/aac, OGG Vorbis - audio/ogg, FLAC - audio/flac
//    - The maximum supported length of audio data in a single prompt is 9.5 hours
//    - Audio files are resampled down to a 16 Kbps data resolution, and multiple channels of audio are combined into a single channel
//    - No limit of audio files in a single prompt (but < 9.5Hrs)
//
//  - Supported Video formats:
//    - models: gemini-1.5-pro
//    - video/mp4 video/mpeg, video/mov, video/avi, video/x-flv, video/mpg, video/webm, video/wmv, video/3gpp
//    - The File API service samples videos into images at 1 frame per second (FPS) and may be subject to change to provide the best
//      inference quality. Individual images take up 258 tokens regardless of resolution and quality
//
// Anthropic: https://docs.anthropic.com/en/docs/vision
//  - Supported Image formats:
//    - image/jpeg, image/png, image/gif, and image/webp
//    - If image’s long edge is more than 1568 pixels, or your image is more than ~1600 tokens, it will first be scaled down
//      - Max Image Size per Aspect ratio: 1:1 1092x1092 px, 3:4 951x1268 px, 2:3 896x1344 px, 9:16 819x1456 px, 1:2 784x1568 px
//    - Max size is 5MB/image on the API
//    - Up to 20 images in a single request (note, request, not message)

// Least common denominator of the instructions above - MimeTypes to treat as supported images for attachment purposes
export function mimeTypeIsSupportedImage(mimeType: string): boolean {
  if (GuessedMimeLookupTable[mimeType]?.dt !== 'image')
    return false;
  // We actually narrow it down here to be a tad more restrictive
  return ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType);
}

// MimeTypes to treat as PDF documents for attachment purposes
export function mimeTypeIsPDF(mimeType: string): boolean {
  return GuessedMimeLookupTable[mimeType]?.dt === 'doc-pdf';
}

// MimeTypes to treat as Word documents for attachment purposes
export function mimeTypeIsDocX(mimeType: string): boolean {
  return GuessedMimeLookupTable[mimeType]?.dt === 'doc-msw';
}
