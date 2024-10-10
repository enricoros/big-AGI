import type { WordsDiff } from './wordsdiff/RenderWordsDiff';


export type RenderBlockInputs = BlockInput[];


// In order of priority from the most frequent to the least
type BlockInput = {
  bkId?: string;
  /* Other fields remain the same */
} & ({
  /* Rendered as markdown or plain text */
  bkt: 'md-bk';
  content: string;
} | {
  /* Rendered as Code (can be copied, LiveFile'd, etc) */
  // NOTE: this should actually be called 'Fenced' block?
  bkt: 'code-bk';
  title: string;
  code: string;
  lines: number;
  isPartial: boolean;
} | {
  /* Rendered as HTML (dangerous) */
  bkt: 'dang-html-bk';
  html: string;
} | {
  /* (Markdown Image) Rendered as an image */
  bkt: 'img-url-bk';
  url: string;
  alt?: string;
} | {
  /* Rendered as red/green text diffs */
  bkt: 'txt-diffs-bk';
  wordsDiff: WordsDiff;
});