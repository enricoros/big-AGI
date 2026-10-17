// configuration
const OPTION_DEBUG_PARSER = false;
const OPTION_MAX_LENGTH = 100;
const OPTION_MAX_OPTIONS = 8;
const OPTION_MIN_OPTIONS = 2;

const debugParser = (...args: any[]) => console.log('[DEV] parseOptions:', ...args);


/**
 * Splits a trailing option list off a text: 2-8 '- ...' or '1. ...' items of one kind, each under 100 chars, at most
 * one blank line apart, right after a line ending with ':' or '?'. Null when the text ends any other way.
 */
export function parseTrailingOptions(text: string): { beforeText: string; options: string[] } | null {

  const options: string[] = [];
  let remainingText = text.trimEnd();
  let inOL = false;
  let inUL = false;
  let nlCount = 0;

  while (true) {

    // get the last line of text (-1 is okay, as it's the last line)
    const prevNewlineIdx = remainingText.lastIndexOf('\n');
    const chunk = remainingText.slice(prevNewlineIdx + 1);

    // check if it's a list item
    if (chunk.startsWith('- ') || chunk.startsWith('* ') || chunk.startsWith('+ ') || chunk.startsWith('• ')) {
      if (inOL) {
        if (OPTION_DEBUG_PARSER) debugParser('switched from OL to UL (end)');
        return null;
      }
      inUL = true;
      nlCount = 0;
      if (chunk.length > OPTION_MAX_LENGTH) {
        if (OPTION_DEBUG_PARSER) debugParser('UL option too long (end)');
        return null;
      }
      // only for UL we want to remove the list marker
      options.unshift(chunk.slice(2));
    } else if (/^\d+\.\s/.test(chunk)) {
      if (inUL) {
        if (OPTION_DEBUG_PARSER) debugParser('switched from UL to OL (end)');
        return null;
      }
      inOL = true;
      nlCount = 0;
      if (chunk.length > OPTION_MAX_LENGTH) {
        if (OPTION_DEBUG_PARSER) debugParser('OL option too long (end)');
        return null;
      }
      options.unshift(chunk);
    } else if (chunk.trim() === '') {
      nlCount++;
      if (nlCount > 1) {
        if (OPTION_DEBUG_PARSER) debugParser('two newlines (end)');
        return null;
      }
    } else if (remainingText.endsWith(':') || remainingText.endsWith('?') /*|| remainingText.endsWith('.')*/) {
      if (options.length >= OPTION_MIN_OPTIONS) {
        if (OPTION_DEBUG_PARSER) debugParser('found options (end)', remainingText);
        return { beforeText: remainingText, options };
      }
      if (OPTION_DEBUG_PARSER) debugParser('not enough options (end)');
      return null;
    } else {
      if (OPTION_DEBUG_PARSER) debugParser('not a list item (end)');
      return null;
    }

    // end when too many options
    if (options.length > OPTION_MAX_OPTIONS) {
      if (OPTION_DEBUG_PARSER) debugParser('too many options (end)');
      return null;
    }

    if (prevNewlineIdx === -1) {
      if (OPTION_DEBUG_PARSER) debugParser('no more newlines (end)');
      return null;
    }
    remainingText = remainingText.slice(0, prevNewlineIdx);
    if (OPTION_DEBUG_PARSER) debugParser({ prevNewlineIdx, chunk, remainingText });
  }
}
