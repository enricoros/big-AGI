//
// Utilities for rendering tool invocations
//

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

  // Add other confirmed provider-hosted tools here as discovered
} as const;


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
