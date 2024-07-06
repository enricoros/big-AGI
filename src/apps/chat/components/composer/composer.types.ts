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
  metadata: {
    title?: string,
    generatedBy?: string,
    altText?: string,
    width?: number,
    height?: number,
  },
  collapsible: false,
};

export type ComposerOutputMultiPart = ComposerOutputPart[];
