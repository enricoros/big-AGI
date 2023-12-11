export type ComposerOutputPartType = 'text-block' | 'image-part';

export type ComposerOutputPart = {
  type: 'text-block',
  text: string,
  title: string | null,
  collapsible: boolean,
} | {
  // TODO: not implemented yet
  type: 'image-part',
  base64Url: string,
  collapsible: false,
};

export type ComposerOutputMultiPart = ComposerOutputPart[];
