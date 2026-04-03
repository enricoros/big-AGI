//
// Utilities for rendering tool invocations
//

import type { DMessageToolInvocationPart, DMessageToolResponsePart } from '~/common/stores/chat/chat.fragments';
import type { InterleavedFragment } from '~/common/stores/chat/hooks/useFragmentBuckets';

/**
 * [EDITORIAL] Known hosted tool name translations
 *
 * This mapping provides human-readable names for actual hosted tools
 * from AI model providers. Only add entries for confirmed provider-hosted tools.
 *
 * Note: Tool calls != Function calls
 * - Tool calls: Provider-hosted tools (e.g., Anthropic's computer use, Gemini's code execution)
 * - Function calls: User/app-defined functions that the model can invoke
 */
const KNOWN_TOOL_TRANSLATIONS: Record<string, string> = {
  // Anthropic Computer Use Tools (hosted)
  'computer': 'Computer Use',
  'computer_20241022': 'Computer Use',
  'bash': 'Bash',
  'bash_20241022': 'Bash',
  'text_editor': 'Text Editor',
  'text_editor_20241022': 'Text Editor',

  // Gemini Tools (hosted)
  'code_execution': 'Code Execution',
  'google_search_retrieval': 'Google Search',

  // Hosted web tools
  'web_search': 'Web Search',
  'web_fetch': 'Web Fetch',

  // Add other confirmed provider-hosted tools here as discovered
} as const;

const HOSTED_WEB_TOOL_NAMES = new Set([
  'web_search',
  'web_fetch',
  'google_search_retrieval',
]);

export function isHostedWebToolName(name: string): boolean {
  return HOSTED_WEB_TOOL_NAMES.has(name);
}

export function isHostedWebToolInvocationPart(part: DMessageToolInvocationPart): boolean {
  return part.invocation.type === 'function_call' && isHostedWebToolName(part.invocation.name);
}

export function isHostedWebToolResponsePart(part: DMessageToolResponsePart): boolean {
  return part.response.type === 'function_call' && isHostedWebToolName(part.response.name) && part.environment === 'upstream';
}

export function isInlineHostedWebFragment(fragment: InterleavedFragment): boolean {
  if (fragment.ft !== 'content')
    return false;

  const { part } = fragment;
  if (part.pt === 'tool_invocation')
    return isHostedWebToolInvocationPart(part);
  if (part.pt === 'tool_response')
    return isHostedWebToolResponsePart(part);

  return false;
}

export function groupInlineHostedWebFragments(fragments: readonly InterleavedFragment[]): Array<{
  inlineHostedWeb: boolean;
  fragments: InterleavedFragment[];
}> {
  const groups: Array<{ inlineHostedWeb: boolean; fragments: InterleavedFragment[] }> = [];

  for (const fragment of fragments) {
    const inlineHostedWeb = isInlineHostedWebFragment(fragment);
    const previousGroup = groups[groups.length - 1];

    if (inlineHostedWeb && previousGroup?.inlineHostedWeb) {
      previousGroup.fragments.push(fragment);
      continue;
    }

    groups.push({
      inlineHostedWeb,
      fragments: [fragment],
    });
  }

  return groups;
}

export function getCompactInvocationDetails(name: string, args: string | null | undefined): Array<{ label: string; value: string; asCode?: boolean }> {
  const trimmedArgs = args?.trim() || '';
  if (!trimmedArgs)
    return [];

  let parsedArgs: unknown = null;
  try {
    parsedArgs = JSON.parse(trimmedArgs);
  } catch {
    return [{ label: 'Args', value: trimmedArgs, asCode: true }];
  }

  if (!parsedArgs || typeof parsedArgs !== 'object' || Array.isArray(parsedArgs))
    return [{ label: 'Args', value: trimmedArgs, asCode: true }];

  const argsRecord = parsedArgs as Record<string, unknown>;

  if (name === 'web_search') {
    const query = typeof argsRecord.q === 'string'
      ? argsRecord.q
      : typeof argsRecord.query === 'string'
        ? argsRecord.query
        : '';
    return query ? [{ label: 'Query', value: query }] : [];
  }

  if (name === 'web_fetch') {
    const url = typeof argsRecord.url === 'string' ? argsRecord.url : '';
    return url ? [{ label: 'URL', value: url }] : [];
  }

  return [{ label: 'Args', value: trimmedArgs, asCode: true }];
}


/**
 * Translate a function/tool name to a human-readable format
 *
 * First checks for known hosted tools, then applies heuristics for function names
 */
export function humanReadableFunctionName(name: string, invocationType: 'function_call' | 'code_execution', phase: 'invocation' | 'response'): string {
  if (invocationType === 'code_execution')
    return phase === 'invocation' ? 'Generated code' : 'Executed code';

  // check for known hosted tools
  if (KNOWN_TOOL_TRANSLATIONS[name])
    return KNOWN_TOOL_TRANSLATIONS[name];

  // apply heuristics for user-defined function names
  if (name.startsWith('get_'))
    return _toTitleCase(name.substring(4));
  if (name.startsWith('fetch_'))
    return _toTitleCase(name.substring(6));
  if (name.startsWith('search_'))
    return _toTitleCase(name.substring(7)) + ' Search';

  return _toTitleCase(name);
}

/**
 * Get function display name and color
 */
export function functionNameAppearance(environment: 'upstream' | 'server' | 'client'): {
  label: string;
  color: 'primary' | 'neutral' | 'success';
} {
  switch (environment) {
    case 'upstream':
      return { label: 'Hosted', color: 'primary' };
    case 'server':
      return { label: 'Server', color: 'neutral' };
    case 'client':
      return { label: 'Client', color: 'success' };
  }
}


function _toTitleCase(fName: string): string {
  // snake_case -> Title Case
  if (fName.includes('_'))
    return fName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  // camelCase -> Title Case
  const withSpaces = fName.replace(/([A-Z])/g, ' $1').trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
