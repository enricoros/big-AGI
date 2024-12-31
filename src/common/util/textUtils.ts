export function capitalizeFirstLetter(string: string) {
  return string?.length ? (string.charAt(0).toUpperCase() + string.slice(1)) : string;
}


export function countWords(text: string) {
  const trimmedText = text.trim();
  if (!trimmedText) return 0;
  return trimmedText.split(/\s+/).length;
}

export function countLines(text?: string) {
  if (!text) return 0;
  return text.split('\n').length;
}

/**
 * Convert a string (e.g., a web URL or file name) to a human-readable hyphenated format.
 * This function:
 * - Optionally removes URL schemas (http://, https://, ftp://, etc.)
 * - Handles query parameters by replacing '=' with '-' and '&' with '--'
 * - Replaces non-alphanumeric characters with hyphens
 * - Removes redundant hyphens
 * - Trims leading and trailing hyphens
 * - Converts the result to lowercase
 */
export function humanReadableHyphenated(text: string, removeSchema: boolean = false): string {
  // Trim the input and optionally remove URL schema
  let processed = text.trim();
  if (removeSchema)
    processed = processed.replace(/^(https?|file):\/\//, '');

  // Handle query parameters
  processed = processed.replace(/\?/g, '-')  // Replace '?' with '-'
    .replace(/=/g, '-')   // Replace '=' with '-'
    .replace(/&/g, '--'); // Replace '&' with '--'

  return processed
    .replace(/[^a-zA-Z0-9]+/g, '-') // Replace non-alphanumeric characters (including spaces) with hyphens
    .replace(/-{2,}/g, '-') // Remove redundant hyphens
    .replace(/^-+|-+$/g, '') // Remove leading and trailing hyphens
    .toLowerCase();
}


export function ellipsizeFront(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  return '…' + text.slice(-(maxLength - 1));
}

export function ellipsizeMiddle(text: string, maxLength: number, ellipsis: string = '…'): string {
  if (text.length <= maxLength)
    return text;
  if (maxLength <= ellipsis.length)
    return ellipsis.slice(0, maxLength);

  const sideLength = (maxLength - ellipsis.length) / 2;
  const frontLength = Math.ceil(sideLength);
  const backLength = Math.floor(sideLength);

  return text.slice(0, frontLength) + ellipsis + text.slice(-backLength);
}

export function ellipsizeEnd(text: string, maxLength: number, maxLines?: number) {
  let wasTruncated = false;

  // Handle maxLines if specified
  if (maxLines !== undefined && maxLines > 0) {
    const lines = text.split('\n');
    if (lines.length > maxLines) {
      text = lines.slice(0, maxLines).join('\n');
      wasTruncated = true;
    }
  }

  // Check if text exceeds maxLength and truncate if necessary
  if (text.length > maxLength) {
    text = text.slice(0, maxLength - 1) + '…';
    // wasTruncated = true; // not useful here
  } else if (wasTruncated) {
    // If text was truncated by lines but not by length, add ellipsis if possible
    if (text.length + 1 <= maxLength) {
      text += '…';
    } else if (maxLength > 0) {
      // Truncate one character to add ellipsis without exceeding maxLength
      text = text.slice(0, maxLength - 1) + '…';
    }
  }

  return text;
}


export function textEscapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


export function textIsSingleEmoji(text: string): boolean {
  if (!Intl.Segmenter)
    throw new Error('Intl.Segmenter is not supported');

  // create segmenter instance with default locale
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const segments = Array.from(segmenter.segment(text));
  return segments.length === 1;
}