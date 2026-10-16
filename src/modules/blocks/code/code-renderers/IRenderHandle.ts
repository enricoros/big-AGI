export type IRenderHandle = {
  renderAsPNGBlob: (transparentBackground: boolean) => Promise<{
    blob: Blob,
    prefix: 'svg' | 'chart' | 'diagram' | 'uml',
  } | null>;
};
