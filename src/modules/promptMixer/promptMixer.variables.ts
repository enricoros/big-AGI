/**
 * Prompt Mixer: the {{Variables}} a template can use.
 *
 * `promptMixer` (promptMixer.ts) expands them; an editor imports the lists it offers from here.
 *
 * NOTE: think twice before changing a variable: templates at rest carry them (stored personas, custom instructions).
 */

/// Types

interface PromptMixerVariableDefinition {

  scope: 'global' | 'system';     // 'persona' | 'user';
  description: string;

  dependencies?: {
    lowHourPrecision?: boolean;   // affects behavior with time
  };

  // function to generate the replacement text
  replace: (context: PromptMixerContext) => string | null;
}

export interface PromptMixerContext {
  deviceIsDesktop?: boolean;
  deviceBrowserLang?: string;
  lowHourPrecision?: boolean;
  customFields?: Record<string, string>;    // caller's own placeholders, e.g. { '{{N}}': '3' }
}

export type PromptMixerVariableId = keyof typeof PromptMixerVariables;


// Registry

export const PromptMixerVariables: Record<string, PromptMixerVariableDefinition> = {

  // Date and Time

  '{{Today}}': {
    scope: 'global',
    description: 'Current date in YYYY-MM-DD format',
    replace: () => {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    },
  },

  // {{LocaleNow}} - enough information to get on the same page with the user
  '{{LocaleNow}}': {
    scope: 'global',
    description: 'Locale-aware date and time',
    dependencies: { lowHourPrecision: true },
    replace: ({ lowHourPrecision, deviceBrowserLang }) => {
      const formatter = new Intl.DateTimeFormat(deviceBrowserLang, {
        weekday: 'short', // Full name of the day of the week
        year: 'numeric', // Numeric year
        month: 'short', // Full name of the month
        day: 'numeric', // Numeric day of the month
        hour: '2-digit', // 2-digit hour
        // NOTE: disable the minutes if we are using auto-breakpoints, as this will invalidate all every minute...
        minute: lowHourPrecision ? undefined : '2-digit', // 2-digit minute
        timeZoneName: 'short', // Short timezone name (e.g., GMT, CST)
        hour12: true, // Use 12-hour time format; set to false for 24-hour format if preferred
      });
      return formatter.format(new Date());
    },
  },

  // Rendering Capabilities

  '{{PreferTables}}': {
    scope: 'system',
    description: 'Instruct to prefer tabulated data',
    replace: () => 'Data presentation: prefer tables for comparisons and structured information when they are easier to read than prose or lists. In Markdown tables, use unpadded cells and --- separators.',
  },

  '{{RenderMermaid}}': {
    scope: 'system',
    description: 'Enable Mermaid diagram rendering',
    replace: () => 'Mermaid rendering: Enabled for diagrams and pie charts, but no other chart types. Use `mermaid` fenced code blocks.',
  },

  '{{RenderPlantUML}}': {
    scope: 'system',
    description: 'Enable PlantUML diagram rendering',
    replace: () => 'PlantUML rendering: Enabled',
  },

  '{{RenderSVG}}': {
    scope: 'system',
    description: 'Enable SVG rendering',
    replace: () => 'SVG in markdown rendering: Enabled',
  },

  '{{RenderHTML}}': {
    scope: 'system',
    description: 'Enable HTML rendering with device awareness',
    replace: ({ deviceIsDesktop }) =>
      `HTML in markdown rendering: Sleek HTML5 for ${deviceIsDesktop ? 'desktop' : 'mobile'} screens (self-contained with CSS/JS, leverage top libraries, external links OK)`,
  },

  '{{RenderChartJS}}': {
    scope: 'system',
    description: 'Enable ChartJS chart rendering',
    replace: () => 'Chart.js rendering: Enabled when a chart helps explain the data. For Chart.js output, choose a suitable chart type and put one complete configuration in each `chartjs` fenced code block. Inside each block, use strict JSON only (DO NOT USE FUNCTIONS; no comments or trailing commas). Put any explanation outside the block.',
  },

} as const;


// Mixins: the variables an editor offers as chips

export const PromptMixerMixins: Record<'output' | 'variables', { id: PromptMixerVariableId, description: string }[]> = {
  output: [
    // Core Rendering
    { id: '{{RenderMermaid}}', description: 'Mermaid Diagrams' },
    { id: '{{RenderPlantUML}}', description: 'UML Diagrams' },
    { id: '{{RenderHTML}}', description: 'Interactive HTML' },
    { id: '{{RenderSVG}}', description: 'Vector Graphics' },
    // Data Presentation
    { id: '{{RenderChartJS}}', description: 'Interactive Charts' },
    { id: '{{PreferTables}}', description: 'Prefer Tables' },
  ],
  variables: [
    { id: '{{LocaleNow}}', description: 'Date and Time' },
  ],
} as const;
