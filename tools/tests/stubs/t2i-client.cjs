const { createTextContentFragment } = require('../../../src/common/stores/chat/chat.fragments.ts');

module.exports = {
  getActiveTextToImageProviderOrThrow: () => ({
    painter: 'Stub Painter',
    vendor: 'openai',
  }),
  t2iGenerateImageContentFragments: async (_provider, imageText) => [
    createTextContentFragment(`stub image for ${imageText}`),
  ],
  t2iGenerateImagesOrThrow: async () => [],
  useCapabilityTextToImage: () => ({
    mayEdit: true,
    mayWork: true,
  }),
};
