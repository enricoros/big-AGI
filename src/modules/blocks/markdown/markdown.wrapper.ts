export function wrapWithMarkdownSyntax(text: string, marker: '~~' | '**' | '=='): string {
  // Extract leading and trailing spaces
  const startMatch = text.match(/^\s*/);
  const endMatch = text.match(/\s*$/);

  const startSpaces = startMatch ? startMatch[0] : '';
  const endSpaces = endMatch ? endMatch[0] : '';

  // Trim the inner content and escape special characters
  const innerContent = text.trim();
  const escapedContent = innerContent.replace(/([\\`*_\[\]{}()#+\-.!])/g, '\\$1');

  // Wrap the inner content with the specified markers
  return `${startSpaces}${marker}${escapedContent}${marker}${endSpaces}`;
}