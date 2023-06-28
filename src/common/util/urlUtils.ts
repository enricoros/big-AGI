/**
 * If the string is a valid URL, return it. Otherwise, return null.
 */
export function asValidURL(textString: string | null): string | null {
  if (!textString) return null;
  const urlRegex = /^(https?:\/\/\S+)$/g;
  const trimmedTextString = textString.trim();
  const urlMatch = urlRegex.exec(trimmedTextString);
  return urlMatch ? urlMatch[1] : null;
}