import type { Diff as TextDiff } from '@sanity/diff-match-patch';

// Block types
export type Block =
  | CodeBlock
  | HtmlBlock
  | ImageBlock
  | TextBlock
  | TextDiffBlock;

export type CodeBlock = { type: 'codeb'; blockTitle: string; blockCode: string; complete: boolean; };
export type HtmlBlock = { type: 'htmlb'; html: string; };
export type ImageBlock = { type: 'imageb'; url: string; alt?: string }; // Added optional alt property
export type TextBlock = { type: 'textb'; content: string; }; // for Text or Markdown
export type TextDiffBlock = { type: 'diffb'; textDiffs: TextDiff[] };
