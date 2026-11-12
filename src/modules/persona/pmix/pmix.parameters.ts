/**
 * Prompt Mixer Parameter Registry
 *
 * This module provides a type-safe parameter management system for prompt variables.
 * It handles variable definitions, dependencies, and runtime replacements while
 * maintaining strict type safety throughout the application.
 *
 * Key concepts:
 * - Variables are categorized by their scope/type
 * - Each variable has a clear definition of its dependencies and replacement logic
 * - The system is extensible for future object-variable replacement
 */

/// Types

interface PVariableDefinition {

  scope: 'global' | 'system';     // 'persona' | 'user';
  description: string;

  dependencies?: {
    lowHourPrecision?: boolean;   // affects behavior with time
  };

  // function to generate the replacement text
  replace: (context: PPromptMixerContext) => string | null;
}

export interface PPromptMixerContext {
  deviceIsDesktop?: boolean;
  deviceBrowserLang?: string;
  lowHourPrecision?: boolean;
  customFields?: Record<string, string>;
}

export type PPromptVariable = keyof typeof PromptVariableRegistry;


// Registry

export const PromptVariableRegistry: Record<string, PVariableDefinition> = {

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
